/**
 * /api/analytics
 *
 * GET /overview          - KPIs: meetings, tasks, completion rate, time saved
 * GET /tasks-by-status   - distribution across kanban columns
 * GET /tasks-by-assignee - leaderboard with overdue counts
 * GET /meetings-over-time - weekly meeting volume trend
 * GET /completion-trend  - weekly completion rate trend
 * GET /priority-breakdown - task count by priority
 * GET /integration-usage  - how many tasks went to each integration
 */

const express = require('express');
const { pool } = require('../models/migrate');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const wid = (req) => req.user.workspace_id;

/**
 * GET /api/analytics/overview
 */
router.get('/overview', async (req, res, next) => {
  try {
    const { rows: [stats] } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int   FROM meetings WHERE workspace_id = $1) AS total_meetings,
        (SELECT COUNT(*)::int   FROM meetings WHERE workspace_id = $1 AND status = 'done') AS processed_meetings,
        (SELECT COUNT(*)::int   FROM tasks    WHERE workspace_id = $1) AS total_tasks,
        (SELECT COUNT(*)::int   FROM tasks    WHERE workspace_id = $1 AND status = 'done') AS done_tasks,
        (SELECT COUNT(*)::int   FROM tasks    WHERE workspace_id = $1 AND status != 'done'
                                                 AND due_date < CURRENT_DATE) AS overdue_tasks,
        (SELECT COUNT(*)::int   FROM decisions WHERE workspace_id = $1) AS total_decisions,
        (SELECT ROUND(
          COUNT(*) FILTER (WHERE status='done') * 100.0 / NULLIF(COUNT(*),0), 1
        ) FROM tasks WHERE workspace_id = $1) AS completion_rate,
        (SELECT COUNT(DISTINCT assignee_email) FROM tasks WHERE workspace_id = $1
                                                             AND assignee_email IS NOT NULL) AS active_assignees
    `, [wid(req)]);

    // Estimate time saved: ~2 min per task (manual entry avoided)
    stats.estimated_minutes_saved = (stats.total_tasks || 0) * 2;

    res.json(stats);
  } catch (err) { next(err); }
});

/**
 * GET /api/analytics/tasks-by-status
 */
router.get('/tasks-by-status', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT status, COUNT(*)::int AS count
      FROM tasks WHERE workspace_id = $1
      GROUP BY status
      ORDER BY CASE status
        WHEN 'backlog' THEN 1 WHEN 'in_progress' THEN 2
        WHEN 'in_review' THEN 3 WHEN 'done' THEN 4 ELSE 5
      END
    `, [wid(req)]);
    res.json(rows);
  } catch (err) { next(err); }
});

/**
 * GET /api/analytics/tasks-by-assignee
 */
router.get('/tasks-by-assignee', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COALESCE(assignee_name, 'Unassigned') AS name,
        assignee_email AS email,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'done')::int AS done,
        COUNT(*) FILTER (WHERE status != 'done' AND due_date < CURRENT_DATE)::int AS overdue,
        COUNT(*) FILTER (WHERE status != 'done')::int AS open,
        ROUND(
          COUNT(*) FILTER (WHERE status='done') * 100.0 / NULLIF(COUNT(*),0), 0
        )::int AS completion_rate
      FROM tasks
      WHERE workspace_id = $1
      GROUP BY assignee_name, assignee_email
      ORDER BY total DESC
      LIMIT 20
    `, [wid(req)]);
    res.json(rows);
  } catch (err) { next(err); }
});

/**
 * GET /api/analytics/meetings-over-time
 * Returns last 12 weeks of meeting counts
 */
router.get('/meetings-over-time', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('week', created_at), 'Mon DD') AS week,
        COUNT(*)::int AS meetings,
        SUM(COALESCE(
          (SELECT COUNT(*) FROM tasks WHERE meeting_id = m.id), 0
        ))::int AS tasks_created
      FROM meetings m
      WHERE workspace_id = $1
        AND created_at > NOW() - INTERVAL '12 weeks'
        AND status = 'done'
      GROUP BY DATE_TRUNC('week', created_at)
      ORDER BY DATE_TRUNC('week', created_at)
    `, [wid(req)]);
    res.json(rows);
  } catch (err) { next(err); }
});

/**
 * GET /api/analytics/completion-trend
 * Weekly completion rate for last 8 weeks
 */
router.get('/completion-trend', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('week', created_at), 'Mon DD') AS week,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'done')::int AS done,
        ROUND(
          COUNT(*) FILTER (WHERE status='done') * 100.0 / NULLIF(COUNT(*),0), 0
        )::int AS rate
      FROM tasks
      WHERE workspace_id = $1
        AND created_at > NOW() - INTERVAL '8 weeks'
      GROUP BY DATE_TRUNC('week', created_at)
      ORDER BY DATE_TRUNC('week', created_at)
    `, [wid(req)]);
    res.json(rows);
  } catch (err) { next(err); }
});

/**
 * GET /api/analytics/priority-breakdown
 */
router.get('/priority-breakdown', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        priority,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'done')::int AS done
      FROM tasks
      WHERE workspace_id = $1
      GROUP BY priority
      ORDER BY CASE priority
        WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4
      END
    `, [wid(req)]);
    res.json(rows);
  } catch (err) { next(err); }
});

/**
 * GET /api/analytics/integration-usage
 */
router.get('/integration-usage', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE jira_issue_id  IS NOT NULL)::int AS jira,
        COUNT(*) FILTER (WHERE notion_page_id IS NOT NULL)::int AS notion,
        COUNT(*) FILTER (WHERE linear_issue_id IS NOT NULL)::int AS linear,
        COUNT(*)::int AS total
      FROM tasks WHERE workspace_id = $1
    `, [wid(req)]);
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
