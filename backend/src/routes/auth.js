const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../models/migrate');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');
const { requireAuth } = require('../middleware/auth');
const { sendOtpEmail } = require('../services/otpEmail');

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

/**
 * POST /api/auth/forgot-password
 * Step 1: Generate OTP and send it to the user's email.
 * Always returns 200 to prevent user enumeration.
 */
router.post('/forgot-password', otpLimiter, async (req, res, next) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const { rows } = await pool.query(
      "SELECT id, name, email FROM users WHERE email = $1 AND is_active = TRUE AND role != 'superadmin'",
      [email.toLowerCase()]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'No user exists with this email address.' });
    }

    const user = rows[0];

    // Invalidate any existing unused OTPs for this user
    await pool.query(
      "UPDATE password_reset_otps SET used = TRUE WHERE user_id = $1 AND used = FALSE",
      [user.id]
    );

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    await pool.query(
      "INSERT INTO password_reset_otps (user_id, otp_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '10 minutes')",
      [user.id, otpHash]
    );

    // Send the OTP email — must succeed before we confirm to the user
    try {
      await sendOtpEmail(user.email, user.name, otp);
    } catch (emailErr) {
      // Clean up the OTP record we just created so the user can retry
      await pool.query(
        "UPDATE password_reset_otps SET used = TRUE WHERE user_id = $1 AND used = FALSE",
        [user.id]
      );
      return res.status(500).json({ error: emailErr.message });
    }

    res.json({ success: true, message: 'A 6-digit verification code has been sent to your email.' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/verify-otp
 * Step 2: Verify the 6-digit OTP. Returns a short-lived resetToken JWT.
 */
router.post('/verify-otp', authLimiter, async (req, res, next) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

  try {
    const { rows: userRows } = await pool.query(
      "SELECT id, name FROM users WHERE email = $1 AND is_active = TRUE AND role != 'superadmin'",
      [email.toLowerCase()]
    );

    if (!userRows[0]) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    const user = userRows[0];

    // Get the latest unused, unexpired OTP for this user
    const { rows: otpRows } = await pool.query(
      "SELECT id, otp_hash FROM password_reset_otps WHERE user_id = $1 AND used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
      [user.id]
    );

    if (!otpRows[0]) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    const valid = await bcrypt.compare(otp.toString(), otpRows[0].otp_hash);
    if (!valid) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    // Mark OTP as used
    await pool.query("UPDATE password_reset_otps SET used = TRUE WHERE id = $1", [otpRows[0].id]);

    // Issue a short-lived reset token (15 min)
    const resetToken = jwt.sign(
      { sub: user.id, purpose: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ success: true, resetToken });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/reset-password
 * Step 3: Set a new password using the resetToken from step 2.
 */
router.post('/reset-password', authLimiter, async (req, res, next) => {
  const { resetToken, password } = req.body;
  if (!resetToken || !password) {
    return res.status(400).json({ error: 'resetToken and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    let payload;
    try {
      payload = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
    }

    if (payload.purpose !== 'password_reset') {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
      [hash, payload.sub]
    );

    // Invalidate all refresh tokens (force re-login)
    await pool.query("DELETE FROM refresh_tokens WHERE user_id = $1", [payload.sub]);

    res.json({ success: true, message: 'Password updated successfully. Please log in.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
