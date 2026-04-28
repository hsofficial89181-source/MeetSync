const jwt = require('jsonwebtoken');
const { pool } = require('../models/migrate');

/**
 * Verifies JWT and attaches req.user
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Attach user from DB (ensures user still active)
    const { rows } = await pool.query(
      'SELECT id, name, email, role, workspace_id FROM users WHERE id = $1 AND is_active = TRUE',
      [payload.sub]
    );
    if (!rows[0]) return res.status(401).json({ error: 'User not found or inactive' });
    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Requires admin role
 */
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
