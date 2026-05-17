const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../models/migrate');
const { authLimiter } = require('../../middleware/rateLimiter');

const router = express.Router();

function signAccess(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

/**
 * POST /api/admin/auth/login
 * Super Admin login - validates superadmin role
 */
router.post('/login', authLimiter, async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT u.*, w.name AS workspace_name, w.slug AS workspace_slug
       FROM users u LEFT JOIN workspaces w ON w.id = u.workspace_id
       WHERE u.email = $1 AND u.is_active = TRUE AND u.role = 'superadmin'`,
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
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role 
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/auth/logout
 */
router.post('/logout', async (req, res, next) => {
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
 * PATCH /api/admin/auth/profile
 * Update current superadmin profile (name, email)
 */
router.patch('/profile', async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { name, email } = req.body;
    const updates = [];
    const values = [];
    let i = 1;

    if (name !== undefined) { updates.push(`name = $${i++}`); values.push(name); }
    if (email !== undefined) {
      const { rows: existing } = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email.toLowerCase(), payload.sub]
      );
      if (existing[0]) {
        return res.status(409).json({ error: 'Email already in use by another user' });
      }
      updates.push(`email = $${i++}`);
      values.push(email.toLowerCase());
    }

    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    updates.push(`updated_at = NOW()`);
    values.push(payload.sub);

    const { rows: [u] } = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, name, email, role`,
      values
    );
    res.json(u);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
});

/**
 * POST /api/admin/auth/profile/password
 * Change superadmin password
 */
router.post('/profile/password', async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const { rows: [u] } = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1 AND role = \'superadmin\'',
      [payload.sub]
    );
    if (!u) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, u.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hash, payload.sub]
    );

    // Invalidate all refresh tokens
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [payload.sub]);

    res.json({ success: true, message: 'Password updated. Please log in again.' });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
});

/**
 * GET /api/admin/auth/me
 * Get current superadmin info
 */
router.get('/me', async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = $1 AND is_active = TRUE AND role = \'superadmin\'',
      [payload.sub]
    );
    if (!rows[0]) return res.status(401).json({ error: 'Super Admin not found or inactive' });
    res.json(rows[0]);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
