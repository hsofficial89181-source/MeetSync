/**
 * /api/export
 *
 * GET /tasks.csv          — download all workspace tasks as CSV
 * GET /meeting/:id.csv    — download tasks for one meeting as CSV
 * GET /meeting/:id/report — full meeting report as plain-text (paste into email/doc)
 */

const express = require('express');
const { pool } = require('../models/migrate');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/export/tasks.csv
 */
router.get('/tasks.csv', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.title, t.assignee_name, t.assignee_email, t.due_date,
              t.priority, t.status, array_to_string(t.labels, ',') AS labels,
              t.created_at, t.updated_at,
              m.title AS meeting_title, t.jira_issue_id, t.notion_page_id, t.linear_issue_id
       FROM tasks t
       JOIN meetings m ON m.id = t.meeting_id
       WHERE t.workspace_id = $1
       ORDER BY t.created_at DESC`,
      [req.user.workspace_id]
    );

    const csv = toCSV(rows, [
      'title', 'assignee_name', 'assignee_email', 'due_date', 'priority',
      'status', 'labels', 'meeting_title', 'jira_issue_id', 'notion_page_id',
      'linear_issue_id', 'created_at',
    ]);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="meetsync-tasks-${dateStr()}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

/**
 * GET /api/export/meeting/:id.csv
 */
router.get('/meeting/:id.csv', async (req, res, next) => {
  try {
    const { rows: [meeting] } = await pool.query(
      'SELECT title FROM meetings WHERE id = $1 AND workspace_id = $2',
      [req.params.id, req.user.workspace_id]
    );
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const { rows } = await pool.query(
      `SELECT title, assignee_name, assignee_email, due_date, priority, status,
              array_to_string(labels, ',') AS labels, source_quote, created_at
       FROM tasks WHERE meeting_id = $1 ORDER BY priority`,
      [req.params.id]
    );

    const csv = toCSV(rows, ['title', 'assignee_name', 'assignee_email', 'due_date', 'priority', 'status', 'labels', 'source_quote', 'created_at']);

    const safeName = meeting.title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-tasks.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

/**
 * GET /api/export/meeting/:id/report
 * Plain-text meeting report — easy to paste into email or Confluence
 */
router.get('/meeting/:id/report', async (req, res, next) => {
  try {
    const { rows: [meeting] } = await pool.query(
      'SELECT * FROM meetings WHERE id = $1 AND workspace_id = $2',
      [req.params.id, req.user.workspace_id]
    );
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const [tasks, decisions] = await Promise.all([
      pool.query('SELECT * FROM tasks WHERE meeting_id = $1 ORDER BY priority', [req.params.id]),
      pool.query('SELECT * FROM decisions WHERE meeting_id = $1', [req.params.id]),
    ]);

    const priorityEmoji = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
    const lines = [
      `# ${meeting.title}`,
      `Date: ${new Date(meeting.created_at).toLocaleDateString()}`,
      meeting.duration_seconds ? `Duration: ${Math.round(meeting.duration_seconds / 60)} minutes` : '',
      '',
      '## Summary',
      meeting.summary || 'No summary available.',
      '',
    ];

    if (decisions.rows.length > 0) {
      lines.push('## Key Decisions', '');
      decisions.rows.forEach(d => {
        lines.push(`• ${d.description}`);
        if (d.owner_name) lines.push(`  Owner: ${d.owner_name}`);
      });
      lines.push('');
    }

    if (tasks.rows.length > 0) {
      lines.push(`## Action Items (${tasks.rows.length})`, '');
      tasks.rows.forEach(t => {
        const emoji = priorityEmoji[t.priority] || '🟡';
        const assignee = t.assignee_name ? ` → ${t.assignee_name}` : '';
        const due = t.due_date ? ` (due ${t.due_date})` : '';
        const status = t.status !== 'backlog' ? ` [${t.status}]` : '';
        lines.push(`${emoji} ${t.title}${assignee}${due}${status}`);
      });
    }

    const report = lines.filter(l => l !== null).join('\n');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${meeting.title.replace(/[^a-z0-9]/gi, '-')}-report.md"`);
    res.send(report);
  } catch (err) { next(err); }
});

// ── Helpers ──────────────────────────────────────────────────────────────
function toCSV(rows, columns) {
  if (rows.length === 0) return columns.join(',') + '\n';
  const header = columns.join(',');
  const body = rows.map(row =>
    columns.map(col => {
      const val = row[col];
      if (val === null || val === undefined) return '';
      const str = String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(',')
  );
  return [header, ...body].join('\n');
}

function dateStr() {
  return new Date().toISOString().split('T')[0];
}

module.exports = router;
