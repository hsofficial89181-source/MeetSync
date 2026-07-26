/**
 * /api/team  — workspace-scoped, auth required
 */

const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const wid = (req) => req.user.workspace_id;

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT tm.*,
        COALESCE(
          (SELECT json_agg(json_build_object('provider', i.provider, 'enabled', i.enabled))
           FROM integrations i WHERE i.user_id = u.id AND i.enabled = TRUE),
          '[]'::json
        ) AS integrations
       FROM team_members tm
       LEFT JOIN users u ON u.email = tm.email AND u.workspace_id = tm.workspace_id
       WHERE tm.workspace_id = $1
       ORDER BY tm.name`,
      [wid(req)]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { name, email, role } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'name and email required' });

    const lowerEmail = email.toLowerCase();

    // Verify the user exists in the workspace
    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND workspace_id = $2',
      [lowerEmail, wid(req)]
    );
    if (!existing.length) return res.status(404).json({ error: 'User not found in workspace. Add them in Settings > Members first.' });

    // Create or update the team member record
    const { rows } = await pool.query(
      `INSERT INTO team_members
         (workspace_id, name, email, role)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (workspace_id, email)
       DO UPDATE SET name=$2, role=$4
       RETURNING *`,
      [wid(req), name, lowerEmail, role || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { role } = req.body;
    if (role === undefined) return res.status(400).json({ error: 'Only role (job title) can be updated' });

    const { rows } = await pool.query(
      `UPDATE team_members SET role = $1, updated_at = NOW()
       WHERE workspace_id = $2 AND id = $3
       RETURNING *`,
      [role || null, wid(req), req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });

    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await pool.query(
      'DELETE FROM team_members WHERE id=$1 AND workspace_id=$2',
      [req.params.id, wid(req)]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
