const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../../models/migrate');

const router = express.Router();

/**
 * GET /api/admin/users
 * List all users across all workspaces (paginated)
 */
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search, workspace_id } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE u.role != 'superadmin'";
    const params = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (workspace_id) {
      whereClause += ` AND u.workspace_id = $${paramIndex}`;
      params.push(workspace_id);
      paramIndex++;
    }

    const countQuery = `SELECT COUNT(*) as total FROM users u ${whereClause}`;
    const { rows: countRows } = await pool.query(countQuery, params);

    const dataQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.avatar_url,
        u.is_active,
        u.last_login,
        u.created_at,
        w.id as workspace_id,
        w.name as workspace_name,
        w.slug as workspace_slug
      FROM users u
      LEFT JOIN workspaces w ON w.id = u.workspace_id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const { rows: users } = await pool.query(dataQuery, params);

    res.json({
      users,
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

/**
 * GET /api/admin/users/:id
 * Get user details
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.avatar_url,
        u.is_active,
        u.last_login,
        u.created_at,
        w.id as workspace_id,
        w.name as workspace_name,
        w.slug as workspace_slug
      FROM users u
      LEFT JOIN workspaces w ON w.id = u.workspace_id
      WHERE u.id = $1 AND u.role != 'superadmin'
    `, [id]);

    if (!rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/users/:id
 * Update user details
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, role, is_active, password } = req.body;

    // Build update fields dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }

    if (email !== undefined) {
      // Check if email is already taken by another user
      const { rows: existing } = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email.toLowerCase(), id]
      );
      if (existing[0]) {
        return res.status(409).json({ error: 'Email already in use by another user' });
      }
      updates.push(`email = $${paramIndex}`);
      values.push(email.toLowerCase());
      paramIndex++;
    }

    if (role !== undefined) {
      if (!['admin', 'member'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Must be admin or member' });
      }
      updates.push(`role = $${paramIndex}`);
      values.push(role);
      paramIndex++;
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      values.push(is_active);
      paramIndex++;
    }

    if (password !== undefined && password.length > 0) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      const hash = await bcrypt.hash(password, 12);
      updates.push(`password_hash = $${paramIndex}`);
      values.push(hash);
      paramIndex++;
      // Invalidate existing sessions
      await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [id]);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);

    const query = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND role != 'superadmin'
      RETURNING id, name, email, role, avatar_url, is_active, last_login, created_at, workspace_id
    `;
    values.push(id);

    const { rows } = await pool.query(query, values);

    if (!rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete user
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if user exists and is not superadmin
    const { rows: checkRows } = await pool.query(
      "SELECT id, role FROM users WHERE id = $1",
      [id]
    );

    if (!checkRows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (checkRows[0].role === 'superadmin') {
      return res.status(403).json({ error: 'Cannot delete Super Admin users' });
    }

    // Delete user's refresh tokens first
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [id]);

    // Delete user
    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/users/:id/reset-password
 * Reset user password (accepts custom password from admin)
 */
router.post('/:id/reset-password', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    // Check if user exists and is not superadmin
    const { rows: checkRows } = await pool.query(
      "SELECT id, role FROM users WHERE id = $1",
      [id]
    );

    if (!checkRows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (checkRows[0].role === 'superadmin') {
      return res.status(403).json({ error: 'Cannot reset Super Admin password through this endpoint' });
    }

    // Validate password
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const hash = await bcrypt.hash(password, 12);

    // Update password and invalidate existing sessions
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hash, id]
    );

    // Delete all refresh tokens for this user
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [id]);

    res.json({
      success: true,
      message: 'Password updated successfully. The user will need to log in with the new password.'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
