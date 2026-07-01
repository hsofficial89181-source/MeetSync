const express = require('express');
const { pool } = require('../../models/migrate');

const router = express.Router();

/**
 * GET /api/admin/stats
 * System-wide statistics for the admin dashboard
 */
router.get('/', async (req, res, next) => {
  try {
    const [workspaces, users, subs, revenue] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS count FROM workspaces'),
      pool.query("SELECT COUNT(*)::int AS count FROM users WHERE role != 'superadmin'"),
      pool.query("SELECT COUNT(*)::int AS count FROM subscriptions WHERE status = 'active'"),
      pool.query("SELECT COALESCE(SUM(total_cents), 0)::int AS total FROM invoices WHERE status = 'paid'"),
    ]);

    res.json({
      total_workspaces: workspaces.rows[0].count,
      total_users: users.rows[0].count,
      active_subscriptions: subs.rows[0].count,
      total_revenue_cents: revenue.rows[0].total,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
