const express = require('express');
const { pool } = require('../../db');

const router = express.Router();

/**
 * GET /api/admin/analytics
 * System-wide analytics data for charts
 */
router.get('/', async (req, res, next) => {
  try {
    const [growthWs, growthUsers, revenue, plans] = await Promise.all([
      pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
          COUNT(*)::int AS workspaces
        FROM workspaces
        WHERE created_at >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at)
      `),
      pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
          COUNT(*)::int AS users
        FROM users
        WHERE role != 'superadmin' AND created_at >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at)
      `),
      pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', paid_at), 'YYYY-MM') AS month,
          SUM(total_cents)::int AS revenue_cents
        FROM invoices
        WHERE status = 'paid' AND paid_at >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', paid_at)
        ORDER BY DATE_TRUNC('month', paid_at)
      `),
      pool.query(`
        SELECT
          sp.name AS plan_name,
          COUNT(s.id)::int AS count
        FROM subscriptions s
        JOIN subscription_plans sp ON sp.id = s.plan_id
        WHERE s.status = 'active'
        GROUP BY sp.name
        ORDER BY count DESC
      `),
    ]);

    const monthMap = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap[key] = { month: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), workspaces: 0, users: 0, revenue_cents: 0 };
    }

    for (const r of growthWs.rows) {
      if (monthMap[r.month]) monthMap[r.month].workspaces = r.workspaces;
    }
    for (const r of growthUsers.rows) {
      if (monthMap[r.month]) monthMap[r.month].users = r.users;
    }
    for (const r of revenue.rows) {
      if (monthMap[r.month]) monthMap[r.month].revenue_cents = r.revenue_cents;
    }

    res.json({
      growth: Object.values(monthMap),
      revenue: Object.values(monthMap),
      plans: plans.rows,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
