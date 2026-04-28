const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../models/migrate');
const { authLimiter } = require('../middleware/rateLimiter');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function signAccess(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

/**
 * POST /api/auth/register
 * Creates workspace + admin user
 */
router.post('/register', authLimiter, async (req, res, next) => {
  const { name, email, password, workspaceName } = req.body;
  if (!name || !email || !password || !workspaceName) {
    return res.status(400).json({ error: 'name, email, password, workspaceName are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if email already exists
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Create workspace
    const slug = workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const uniqueSlug = `${slug}-${Date.now().toString(36)}`;
    const { rows: [workspace] } = await client.query(
      'INSERT INTO workspaces (name, slug) VALUES ($1, $2) RETURNING *',
      [workspaceName, uniqueSlug]
    );

    // Create admin user
    const hash = await bcrypt.hash(password, 12);
    const { rows: [user] } = await client.query(
      `INSERT INTO users (name, email, password_hash, role, workspace_id)
       VALUES ($1, $2, $3, 'admin', $4) RETURNING id, name, email, role, workspace_id`,
      [name, email.toLowerCase(), hash, workspace.id]
    );

    await client.query('COMMIT');

    const accessToken = signAccess(user.id);
    const refreshToken = uuidv4();
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'30 days\')',
      [user.id, refreshToken]
    );

    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', authLimiter, async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT u.*, w.name AS workspace_name, w.slug AS workspace_slug
       FROM users u JOIN workspaces w ON w.id = u.workspace_id
       WHERE u.email = $1 AND u.is_active = TRUE`,
      [email.toLowerCase()]
    );

    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last_login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const accessToken = signAccess(user.id);
    const refreshToken = uuidv4();
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'30 days\')',
      [user.id, refreshToken]
    );

    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      workspace: { id: user.workspace_id, name: user.workspace_name, slug: user.workspace_slug },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  try {
    const { rows } = await pool.query(
      `SELECT rt.*, u.id as uid, u.name, u.email, u.role, u.is_active
       FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
       WHERE rt.token = $1 AND rt.expires_at > NOW()`,
      [refreshToken]
    );

    const record = rows[0];
    if (!record || !record.is_active) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Rotate refresh token
    const newRefreshToken = uuidv4();
    await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'30 days\')',
      [record.uid, newRefreshToken]
    );

    res.json({
      accessToken: signAccess(record.uid),
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', requireAuth, async (req, res, next) => {
  const { refreshToken } = req.body;
  try {
    if (refreshToken) {
      await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.avatar_url, u.last_login,
            w.id as workspace_id, w.name as workspace_name, w.slug as workspace_slug
     FROM users u JOIN workspaces w ON w.id = u.workspace_id
     WHERE u.id = $1`,
    [req.user.id]
  );
  res.json(rows[0]);
});

module.exports = router;
