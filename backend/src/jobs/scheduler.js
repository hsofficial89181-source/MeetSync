/**
 * Scheduled Jobs
 *
 * FIXED: import paths corrected (this file lives in src/jobs/, not src/)
 *
 *  - Every 15 min: sync Jira statuses back → MeetSync
 *  - Every 1 hour:  send overdue task digest emails
 *  - Every 24 hours: send due-date reminders (24h before due)
 */

const { pool }            = require('../models/migrate');   // ← was './models/migrate'
const { syncJiraStatuses }= require('../services/jira');    // ← was './services/jira'
const { log }             = require('../utils/logger');      // ← was missing entirely

function startScheduledJobs() {
  log.info('Scheduled jobs started');

  // Jira bidirectional sync — every 15 minutes
  setInterval(runJiraSync,     15 * 60 * 1000);
  // Overdue digest — every hour
  setInterval(runOverdueDigest, 60 * 60 * 1000);
  // Due-date reminders — every hour (sends 24h-ahead reminders once per day)
  setInterval(runDueDateReminders, 60 * 60 * 1000);

  // Run once at startup after a short delay
  setTimeout(runJiraSync, 30 * 1000);
}

// ── Jira sync ──────────────────────────────────────────────────────────────
async function runJiraSync() {
  try {
    const { rows: integrations } = await pool.query(
      "SELECT workspace_id, config FROM integrations WHERE provider='jira' AND enabled=TRUE"
    );
    for (const i of integrations) {
      await syncJiraStatuses(i.config).catch(err =>
        log.warn('Jira sync failed', { workspace: i.workspace_id, error: err.message })
      );
    }
    if (integrations.length > 0) {
      log.info(`Jira sync complete`, { workspaces: integrations.length });
    }
  } catch (err) {
    log.error('Jira sync job error', { error: err.message });
  }
}

// ── Overdue digest ─────────────────────────────────────────────────────────
async function runOverdueDigest() {
  try {
    if (!process.env.SMTP_HOST) return;

    const { rows } = await pool.query(`
      SELECT t.*, m.title AS meeting_title
      FROM tasks t
      JOIN meetings m ON m.id = t.meeting_id
      WHERE t.status NOT IN ('done','in_review')
        AND t.due_date < CURRENT_DATE
        AND t.due_date > CURRENT_DATE - INTERVAL '7 days'
        AND t.assignee_email IS NOT NULL
    `);

    if (!rows.length) return;

    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    // Group by assignee
    const byEmail = {};
    for (const t of rows) {
      if (!byEmail[t.assignee_email]) byEmail[t.assignee_email] = [];
      byEmail[t.assignee_email].push(t);
    }

    for (const [email, tasks] of Object.entries(byEmail)) {
      const name = tasks[0].assignee_name || email.split('@')[0];
      const taskList = tasks.map(t =>
        `• ${t.title} (due ${t.due_date}, from "${t.meeting_title}")`
      ).join('\n');

      await transporter.sendMail({
        from:    process.env.EMAIL_FROM || 'MeetSync AI <noreply@meetsync.ai>',
        to:      email,
        subject: `⚠️ You have ${tasks.length} overdue task${tasks.length > 1 ? 's' : ''} in MeetSync`,
        text:    `Hi ${name},\n\nThese tasks are overdue:\n\n${taskList}\n\nView them at: ${process.env.FRONTEND_URL}/tasks`,
      }).catch(err => log.warn(`Overdue email failed: ${email}`, { error: err.message }));
    }

    log.info('Overdue digest sent', { recipients: Object.keys(byEmail).length });
  } catch (err) {
    log.error('Overdue digest job error', { error: err.message });
  }
}

// ── Due-date reminders (24h ahead) ────────────────────────────────────────
async function runDueDateReminders() {
  try {
    if (!process.env.SMTP_HOST) return;

    // Only run between 8-9 AM to avoid spamming
    const hour = new Date().getUTCHours();
    if (hour < 8 || hour > 9) return;

    const { rows } = await pool.query(`
      SELECT t.*, m.title AS meeting_title
      FROM tasks t
      JOIN meetings m ON m.id = t.meeting_id
      WHERE t.status NOT IN ('done','in_review')
        AND t.due_date = CURRENT_DATE + INTERVAL '1 day'
        AND t.assignee_email IS NOT NULL
    `);

    if (!rows.length) return;

    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    const byEmail = {};
    for (const t of rows) {
      if (!byEmail[t.assignee_email]) byEmail[t.assignee_email] = [];
      byEmail[t.assignee_email].push(t);
    }

    for (const [email, tasks] of Object.entries(byEmail)) {
      const name = tasks[0].assignee_name || email.split('@')[0];
      await transporter.sendMail({
        from:    process.env.EMAIL_FROM || 'MeetSync AI <noreply@meetsync.ai>',
        to:      email,
        subject: `⏰ Reminder: ${tasks.length} task${tasks.length > 1 ? 's' : ''} due tomorrow`,
        text:    `Hi ${name},\n\nThese tasks are due tomorrow:\n\n${tasks.map(t => `• ${t.title} (from "${t.meeting_title}")`).join('\n')}\n\nView them: ${process.env.FRONTEND_URL}/tasks`,
      }).catch(err => log.warn(`Due-date reminder failed: ${email}`, { error: err.message }));
    }

    log.info('Due-date reminders sent', { recipients: Object.keys(byEmail).length });
  } catch (err) {
    log.error('Due-date reminder job error', { error: err.message });
  }
}

module.exports = { startScheduledJobs };
