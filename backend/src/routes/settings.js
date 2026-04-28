/**
 * /api/settings
 *
 * GET  /workspace          - get workspace settings
 * PATCH /workspace         - update workspace name, preferences
 * GET  /profile            - get current user profile
 * PATCH /profile           - update name, avatar
 * POST /profile/password   - change password
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../models/migrate');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/settings/workspace
 */
router.get('/workspace', async (req, res, next) => {
  try {
    const { rows: [ws] } = await pool.query(
      'SELECT id, name, slug, settings, created_at FROM workspaces WHERE id = $1',
      [req.user.workspace_id]
    );
    res.json(ws);
  } catch (err) { next(err); }
});

/**
 * PATCH /api/settings/workspace
 */
router.patch('/workspace', async (req, res, next) => {
  try {
    const { name, settings } = req.body;
    const updates = [];
    const params = [];
    let i = 1;

    if (name) { updates.push(`name = $${i++}`); params.push(name); }
    if (settings) { updates.push(`settings = settings || $${i++}`); params.push(JSON.stringify(settings)); }

    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.user.workspace_id);

    const { rows: [ws] } = await pool.query(
      `UPDATE workspaces SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, name, slug, settings`,
      params
    );
    res.json(ws);
  } catch (err) { next(err); }
});

/**
 * GET /api/settings/profile
 */
router.get('/profile', async (req, res, next) => {
  try {
    const { rows: [u] } = await pool.query(
      'SELECT id, name, email, role, avatar_url, last_login, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(u);
  } catch (err) { next(err); }
});

/**
 * PATCH /api/settings/profile
 */
router.patch('/profile', async (req, res, next) => {
  try {
    const { name, avatar_url } = req.body;
    const updates = [];
    const params = [];
    let i = 1;

    if (name) { updates.push(`name = $${i++}`); params.push(name); }
    if (avatar_url !== undefined) { updates.push(`avatar_url = $${i++}`); params.push(avatar_url); }

    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    updates.push(`updated_at = NOW()`);
    params.push(req.user.id);

    const { rows: [u] } = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, name, email, role, avatar_url`,
      params
    );
    res.json(u);
  } catch (err) { next(err); }
});

/**
 * POST /api/settings/profile/password
 */
router.post('/profile/password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const { rows: [u] } = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1', [req.user.id]
    );

    const valid = await bcrypt.compare(currentPassword, u.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hash, req.user.id]
    );

    // Invalidate all refresh tokens
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.user.id]);

    res.json({ success: true, message: 'Password updated. Please log in again.' });
  } catch (err) { next(err); }
});

/**
 * GET /api/settings/members
 * List all users in workspace
 */
router.get('/members', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, avatar_url, last_login, is_active, created_at
       FROM users WHERE workspace_id = $1 ORDER BY name`,
      [req.user.workspace_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

/**
 * POST /api/settings/members/invite
 * Invite a new user to the workspace
 */
router.post('/members/invite', async (req, res, next) => {
  try {
    const { name, email, role = 'member' } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'name and email required' });

    const tempPassword = Math.random().toString(36).slice(-10);
    const hash = await bcrypt.hash(tempPassword, 12);

    const { rows: [u] } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, workspace_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, name, email, role`,
      [name, email.toLowerCase(), hash, role, req.user.workspace_id]
    );

    if (!u) return res.status(409).json({ error: 'Email already registered' });

    // In production: send invitation email with temp password
    res.status(201).json({
      user: u,
      tempPassword,
      message: `Invited ${email}. Share the temp password: ${tempPassword}`,
    });
  } catch (err) { next(err); }
});

module.exports = router;
