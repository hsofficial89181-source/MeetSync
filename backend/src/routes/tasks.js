/**
 * /api/tasks  — workspace-scoped, auth required
 * /api/tasks/:id/comments — nested sub-router
 */

const express = require('express');
const { pool } = require('../models/migrate');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const wid = (req) => req.user.workspace_id;

// Ensure task_comments table exists (idempotent)
let commentsTableReady = false;
async function ensureCommentsTable() {
  if (commentsTableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_comments (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id    UUID REFERENCES tasks(id) ON DELETE CASCADE,
      user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
      user_name  VARCHAR(100),
      body       TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_comments_task ON task_comments(task_id);
  `);
  commentsTableReady = true;
}

// ── Stats — must be before /:id to avoid param collision ──────────────────
router.get('/stats/summary', async (req, res, next) => {
  try {
    const { rows: [stats] } = await pool.query(
      `SELECT
         COUNT(*)::int                                              AS total,
         COUNT(*) FILTER (WHERE status = 'done')::int              AS done,
         COUNT(*) FILTER (WHERE status != 'done'
                            AND due_date < CURRENT_DATE)::int      AS overdue,
         COUNT(*) FILTER (WHERE priority IN ('urgent','high')
                            AND status != 'done')::int             AS urgent,
         ROUND(
           COUNT(*) FILTER (WHERE status = 'done') * 100.0
           / NULLIF(COUNT(*), 0), 1
         )                                                         AS completion_rate
       FROM tasks WHERE workspace_id = $1`,
      [wid(req)]
    );
    res.json(stats);
  } catch (err) { next(err); }
});

// ── Task list ──────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { status, meeting_id, assignee, overdue } = req.query;
    const conditions = ['t.workspace_id = $1'];
    const params     = [wid(req)];
    let   i          = 2;

    if (status)             { conditions.push(`t.status = $${i++}`);        params.push(status); }
    if (meeting_id)         { conditions.push(`t.meeting_id = $${i++}`);     params.push(meeting_id); }
    if (assignee)           { conditions.push(`t.assignee_email = $${i++}`); params.push(assignee); }
    if (overdue === 'true') { conditions.push(`t.due_date < CURRENT_DATE AND t.status != 'done'`); }

    const { rows } = await pool.query(
      `SELECT t.*, m.title AS meeting_title
       FROM tasks t
       JOIN meetings m ON m.id = t.meeting_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY
         CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
         t.due_date ASC NULLS LAST, t.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── Update task ────────────────────────────────────────────────────────────
router.patch('/:id', async (req, res, next) => {
  try {
    const allowed = ['status','assignee_name','assignee_email','due_date','priority','title','description'];
    const updates = [];
    const params  = [];
    let   i       = 1;

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${i++}`);
        params.push(req.body[field]);
      }
    }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });
    updates.push(`updated_at = NOW()`);
    params.push(wid(req), req.params.id);

    const { rows } = await pool.query(
      `UPDATE tasks SET ${updates.join(', ')}
       WHERE workspace_id = $${i++} AND id = $${i} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Task not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ── Delete task ────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND workspace_id = $2',
      [req.params.id, wid(req)]
    );
    if (!rowCount) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Comments sub-router (nested at /:id/comments) ─────────────────────────
// GET  /api/tasks/:id/comments
router.get('/:id/comments', async (req, res, next) => {
  try {
    await ensureCommentsTable();
    // Verify task belongs to this workspace
    const { rows: [task] } = await pool.query(
      'SELECT id FROM tasks WHERE id = $1 AND workspace_id = $2',
      [req.params.id, wid(req)]
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { rows } = await pool.query(
      `SELECT c.*, u.avatar_url
       FROM task_comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.task_id = $1
       ORDER BY c.created_at ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/tasks/:id/comments
router.post('/:id/comments', async (req, res, next) => {
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'Comment body is required' });
  try {
    await ensureCommentsTable();
    const { rows: [task] } = await pool.query(
      'SELECT id FROM tasks WHERE id = $1 AND workspace_id = $2',
      [req.params.id, wid(req)]
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { rows: [comment] } = await pool.query(
      `INSERT INTO task_comments (task_id, user_id, user_name, body)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, req.user.id, req.user.name, body.trim()]
    );
    res.status(201).json(comment);
  } catch (err) { next(err); }
});

// DELETE /api/tasks/:id/comments/:commentId
router.delete('/:id/comments/:commentId', async (req, res, next) => {
  try {
    await ensureCommentsTable();
    const { rowCount } = await pool.query(
      'DELETE FROM task_comments WHERE id = $1 AND user_id = $2',
      [req.params.commentId, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Comment not found or not yours' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
