const express = require('express');
const { pool } = require('../../models/migrate');

const router = express.Router();

/**
 * GET /api/admin/workspaces
 * List all workspaces with admin details and member counts
 */
router.get('/', async (req, res, next) => {
  try {
    const { rows: workspaces } = await pool.query(`
      SELECT 
        w.id,
        w.name,
        w.slug,
        w.settings,
        w.created_at,
        (
          SELECT jsonb_build_object(
            'id', u.id,
            'name', u.name,
            'email', u.email
          )
          FROM users u
          WHERE u.workspace_id = w.id AND u.role = 'admin'
          LIMIT 1
        ) as admin,
        (
          SELECT COUNT(*)
          FROM users u
          WHERE u.workspace_id = w.id AND u.is_active = TRUE
        ) as member_count
      FROM workspaces w
      ORDER BY w.created_at DESC
    `);

    res.json(workspaces);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/workspaces/:id
 * Get workspace details with all members
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get workspace details
    const { rows: workspaceRows } = await pool.query(`
      SELECT 
        w.id,
        w.name,
        w.slug,
        w.settings,
        w.created_at
      FROM workspaces w
      WHERE w.id = $1
    `, [id]);

    if (!workspaceRows[0]) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Get all members
    const { rows: members } = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.avatar_url,
        u.is_active,
        u.last_login,
        u.created_at
      FROM users u
      WHERE u.workspace_id = $1
      ORDER BY u.role = 'admin' DESC, u.name ASC
    `, [id]);

    res.json({
      workspace: workspaceRows[0],
      members
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/workspaces/:id
 * Update workspace details
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, settings } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Workspace name is required' });
    }

    const { rows } = await pool.query(`
      UPDATE workspaces 
      SET name = $1, settings = COALESCE($2, settings)
      WHERE id = $3
      RETURNING id, name, slug, settings, created_at
    `, [name, settings ? JSON.stringify(settings) : null, id]);

    if (!rows[0]) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/workspaces/:id
 * Delete workspace and all associated data
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if workspace exists
    const { rows: checkRows } = await pool.query(
      'SELECT id FROM workspaces WHERE id = $1',
      [id]
    );

    if (!checkRows[0]) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Delete workspace (cascades to all related data due to foreign keys)
    await pool.query('DELETE FROM workspaces WHERE id = $1', [id]);

    res.json({ success: true, message: 'Workspace deleted successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/workspaces/:id/members
 * Get workspace members (paginated)
 */
router.get('/:id/members', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const { rows: members } = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.avatar_url,
        u.is_active,
        u.last_login,
        u.created_at
      FROM users u
      WHERE u.workspace_id = $1
      ORDER BY u.role = 'admin' DESC, u.name ASC
      LIMIT $2 OFFSET $3
    `, [id, limit, offset]);

    const { rows: countRows } = await pool.query(
      'SELECT COUNT(*) as total FROM users WHERE workspace_id = $1',
      [id]
    );

    res.json({
      members,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countRows[0].total),
        pages: Math.ceil(countRows[0].total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
