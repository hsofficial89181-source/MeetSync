/**
 * /api/team  — workspace-scoped, auth required
 */

const express = require('express');
const { pool } = require('../models/migrate');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const wid = (req) => req.user.workspace_id;

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM team_members WHERE workspace_id=$1 ORDER BY name',
      [wid(req)]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, email, role, slack_user_id, jira_account_id, notion_user_id, linear_user_id } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'name and email required' });
    const { rows } = await pool.query(
      `INSERT INTO team_members
         (workspace_id, name, email, role, slack_user_id, jira_account_id, notion_user_id, linear_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (workspace_id, email)
       DO UPDATE SET name=$2, role=$4, slack_user_id=$5, jira_account_id=$6,
                     notion_user_id=$7, linear_user_id=$8
       RETURNING *`,
      [wid(req), name, email.toLowerCase(), role||null,
       slack_user_id||null, jira_account_id||null, notion_user_id||null, linear_user_id||null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const fields  = ['name','email','role','slack_user_id','jira_account_id','notion_user_id','linear_user_id'];
    const updates = [];
    const params  = [];
    let   i       = 1;

    for (const f of fields) {
      if (req.body[f] !== undefined) { updates.push(`${f} = $${i++}`); params.push(req.body[f]); }
    }
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    params.push(wid(req), req.params.id);

    const { rows } = await pool.query(
      `UPDATE team_members SET ${updates.join(', ')}
       WHERE workspace_id = $${i++} AND id = $${i}
       RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query(
      'DELETE FROM team_members WHERE id=$1 AND workspace_id=$2',
      [req.params.id, wid(req)]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
