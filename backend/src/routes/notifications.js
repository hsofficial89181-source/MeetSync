/**
 * /api/notifications
 *
 * GET  /         - list user's notifications (unread first)
 * POST /read/:id - mark one as read
 * POST /read-all - mark all as read
 * DELETE /:id    - delete notification
 */

const express = require('express');
const { pool } = require('../models/migrate');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM notifications
      WHERE user_id = $1
      ORDER BY read ASC, created_at DESC
      LIMIT 50
    `, [req.user.id]);
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/unread-count', async (req, res, next) => {
  try {
    const { rows: [r] } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND read = FALSE',
      [req.user.id]
    );
    res.json({ count: r.count });
  } catch (err) { next(err); }
});

router.post('/read/:id', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/read-all', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE notifications SET read = TRUE WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

/**
 * Helper: create a notification for a user (called internally)
 */
async function createNotification(userId, { type, title, body, link }) {
  await pool.query(
    'INSERT INTO notifications (user_id, type, title, body, link) VALUES ($1,$2,$3,$4,$5)',
    [userId, type, title, body || null, link || null]
  );
}

module.exports = router;
module.exports.createNotification = createNotification;
