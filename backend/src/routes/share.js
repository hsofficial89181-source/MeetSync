/**
 * /api/meetings/:id/share
 *
 * POST /     create a shareable read-only link (with optional expiry)
 * GET  /:token   public endpoint — returns meeting data for the token
 * DELETE /   revoke the share link
 *
 * Anyone with the token can view the meeting summary, tasks, and decisions
 * without logging in — useful for sharing with external stakeholders.
 */

const express = require('express');
const crypto = require('crypto');
const { pool } = require('../models/migrate');
const { requireAuth } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// Shared links table (add to migrate.js in production)
const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS share_links (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id  UUID REFERENCES meetings(id) ON DELETE CASCADE,
    token       VARCHAR(64) UNIQUE NOT NULL,
    expires_at  TIMESTAMPTZ,
    view_count  INTEGER DEFAULT 0,
    created_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
`;

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await pool.query(CREATE_TABLE);
  tableReady = true;
}

/**
 * POST /api/meetings/:id/share
 * Create a share link. Auth required.
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    await ensureTable();

    const { expires_in_days = 30 } = req.body;

    // Verify meeting belongs to workspace
    const { rows: [meeting] } = await pool.query(
      'SELECT id FROM meetings WHERE id = $1 AND workspace_id = $2',
      [req.params.id, req.user.workspace_id]
    );
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    // Revoke existing link if any
    await pool.query('DELETE FROM share_links WHERE meeting_id = $1', [req.params.id]);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = expires_in_days
      ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000)
      : null;

    await pool.query(
      'INSERT INTO share_links (meeting_id, token, expires_at, created_by) VALUES ($1, $2, $3, $4)',
      [req.params.id, token, expiresAt, req.user.id]
    );

    res.json({
      token,
      url: `${process.env.FRONTEND_URL}/share/${token}`,
      expires_at: expiresAt,
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/share/:token
 * Public — no auth required. Returns meeting data for external stakeholders.
 */
router.get('/public/:token', async (req, res, next) => {
  try {
    await ensureTable();

    const { rows: [link] } = await pool.query(
      `SELECT sl.*, m.title, m.summary, m.created_at, m.duration_seconds, m.status
       FROM share_links sl
       JOIN meetings m ON m.id = sl.meeting_id
       WHERE sl.token = $1
         AND (sl.expires_at IS NULL OR sl.expires_at > NOW())`,
      [req.params.token]
    );

    if (!link) return res.status(404).json({ error: 'Share link not found or expired' });

    // Increment view count
    await pool.query('UPDATE share_links SET view_count = view_count + 1 WHERE token = $1', [req.params.token]);

    // Get tasks and decisions
    const [tasks, decisions] = await Promise.all([
      pool.query('SELECT title, assignee_name, due_date, priority, status, labels FROM tasks WHERE meeting_id = $1', [link.meeting_id]),
      pool.query('SELECT description, owner_name, agreed_by FROM decisions WHERE meeting_id = $1', [link.meeting_id]),
    ]);

    res.json({
      meeting: {
        title: link.title,
        summary: link.summary,
        created_at: link.created_at,
        duration_seconds: link.duration_seconds,
      },
      tasks: tasks.rows,
      decisions: decisions.rows,
      view_count: link.view_count + 1,
    });
  } catch (err) { next(err); }
});

/**
 * DELETE /api/meetings/:id/share
 * Revoke share link. Auth required.
 */
router.delete('/', requireAuth, async (req, res, next) => {
  try {
    await ensureTable();
    await pool.query(
      'DELETE FROM share_links WHERE meeting_id = $1', [req.params.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
