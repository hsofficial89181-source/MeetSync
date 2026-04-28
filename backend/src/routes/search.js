/**
 * /api/search
 *
 * GET /api/search?q=deploy&type=tasks,meetings,decisions
 *
 * Full-text search across meetings, tasks, and decisions
 * using Postgres ILIKE for simplicity (upgrade to tsvector for scale)
 */

const express = require('express');
const { pool } = require('../models/migrate');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  const { q, type = 'tasks,meetings,decisions', limit = 20 } = req.query;

  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }

  const workspaceId = req.user.workspace_id;
  const term = `%${q.trim()}%`;
  const types = type.split(',').map(t => t.trim());
  const lim = Math.min(parseInt(limit) || 20, 50);

  try {
    const results = {};

    if (types.includes('meetings')) {
      const { rows } = await pool.query(`
        SELECT id, title, summary, status, created_at,
               'meeting' AS result_type,
               title AS match_text
        FROM meetings
        WHERE workspace_id = $1
          AND (title ILIKE $2 OR summary ILIKE $2)
          AND status = 'done'
        ORDER BY created_at DESC
        LIMIT $3
      `, [workspaceId, term, lim]);
      results.meetings = rows;
    }

    if (types.includes('tasks')) {
      const { rows } = await pool.query(`
        SELECT t.id, t.title, t.status, t.priority, t.assignee_name,
               t.due_date, t.meeting_id, m.title AS meeting_title,
               'task' AS result_type
        FROM tasks t
        JOIN meetings m ON m.id = t.meeting_id
        WHERE t.workspace_id = $1
          AND (t.title ILIKE $2 OR t.description ILIKE $2
               OR t.assignee_name ILIKE $2 OR t.source_quote ILIKE $2)
        ORDER BY
          CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
          t.created_at DESC
        LIMIT $3
      `, [workspaceId, term, lim]);
      results.tasks = rows;
    }

    if (types.includes('decisions')) {
      const { rows } = await pool.query(`
        SELECT d.id, d.description, d.owner_name, d.agreed_by,
               d.meeting_id, m.title AS meeting_title,
               'decision' AS result_type
        FROM decisions d
        JOIN meetings m ON m.id = d.meeting_id
        WHERE d.workspace_id = $1
          AND (d.description ILIKE $2 OR d.owner_name ILIKE $2)
        ORDER BY d.created_at DESC
        LIMIT $3
      `, [workspaceId, term, lim]);
      results.decisions = rows;
    }

    const totalCount =
      (results.meetings?.length || 0) +
      (results.tasks?.length || 0) +
      (results.decisions?.length || 0);

    res.json({ query: q, total: totalCount, results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
