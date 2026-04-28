/**
 * Email Service
 * Sends task assignment notifications and meeting summaries via SMTP
 * Compatible with Resend, SendGrid, Mailgun, or any SMTP provider
 */

const nodemailer = require('nodemailer');

function getTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST  || 'smtp.ethereal.email',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const FROM = process.env.EMAIL_FROM || 'MeetSync AI <noreply@meetsync.ai>';

const PRIORITY_EMOJI = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' };

/**
 * Send task assignment emails to all assignees with real email addresses.
 * Groups tasks by assignee to send one email per person.
 */
async function sendTaskAssignmentEmails(tasks, meeting) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log('Email: SMTP not configured, skipping notifications');
    return;
  }

  // Group tasks by assignee email
  const byEmail = {};
  for (const task of tasks) {
    if (!task.assignee_email) continue;
    if (!byEmail[task.assignee_email]) byEmail[task.assignee_email] = [];
    byEmail[task.assignee_email].push(task);
  }

  const transporter = getTransporter();

  for (const [email, assigneeTasks] of Object.entries(byEmail)) {
    const name = assigneeTasks[0].assignee_name || email.split('@')[0];
    await transporter.sendMail({
      from: FROM,
      to: email,
      subject: `⚡ ${assigneeTasks.length} task${assigneeTasks.length > 1 ? 's' : ''} assigned from "${meeting.title}"`,
      html: buildAssignmentEmail(name, assigneeTasks, meeting),
    });
    console.log(`Email: Sent ${assigneeTasks.length} tasks to ${email}`);
  }
}

/**
 * Send a meeting summary email to all participants
 */
async function sendMeetingSummaryEmail(meeting, tasks, decisions, summary, recipientEmails) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return;
  const transporter = getTransporter();

  await transporter.sendMail({
    from: FROM,
    to: recipientEmails.join(', '),
    subject: `📋 Meeting summary: "${meeting.title}"`,
    html: buildSummaryEmail(meeting, tasks, decisions, summary),
  });
}

function buildAssignmentEmail(name, tasks, meeting) {
  const taskRows = tasks.map(t => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #2A2F42">
        <div style="font-size:14px;font-weight:500;color:#F0F2FF;margin-bottom:4px">
          ${PRIORITY_EMOJI[t.priority] || '🟡'} ${t.title}
        </div>
        ${t.due_date ? `<div style="font-size:12px;color:#F59E0B">Due: ${t.due_date}</div>` : ''}
        ${t.source_quote ? `<div style="font-size:12px;color:#8B92B3;font-style:italic;margin-top:4px">"${t.source_quote}"</div>` : ''}
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0D0F14;font-family:'DM Sans',Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
      <div style="width:32px;height:32px;background:#5B6AF0;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px">⚡</div>
      <span style="font-size:18px;font-weight:600;color:#F0F2FF">MeetSync AI</span>
    </div>

    <div style="background:#161920;border:1px solid #2A2F42;border-radius:12px;padding:24px;margin-bottom:16px">
      <h2 style="color:#F0F2FF;font-size:18px;margin:0 0 8px">Hi ${name},</h2>
      <p style="color:#8B92B3;font-size:14px;margin:0 0 20px;line-height:1.6">
        You were assigned <strong style="color:#7B8BFF">${tasks.length} task${tasks.length > 1 ? 's' : ''}</strong>
        from the meeting: <strong style="color:#F0F2FF">${meeting.title}</strong>
      </p>

      <table style="width:100%;border-collapse:collapse">
        ${taskRows}
      </table>
    </div>

    <div style="text-align:center;padding-top:16px">
      <a href="${process.env.FRONTEND_URL}/tasks" style="background:#5B6AF0;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500">
        View all tasks →
      </a>
    </div>

    <p style="color:#555E80;font-size:12px;text-align:center;margin-top:24px">
      MeetSync AI — turning meetings into action
    </p>
  </div>
</body>
</html>`;
}

function buildSummaryEmail(meeting, tasks, decisions, summary) {
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0D0F14;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px">
    <div style="background:#161920;border:1px solid #2A2F42;border-radius:12px;padding:24px">
      <h2 style="color:#F0F2FF;margin:0 0 8px">📋 ${meeting.title}</h2>
      <p style="color:#8B92B3;font-size:14px;margin:0 0 20px">${summary}</p>

      ${decisions.length > 0 ? `
        <h3 style="color:#F0F2FF;font-size:14px;margin:0 0 12px">✅ Key Decisions</h3>
        <ul style="color:#8B92B3;font-size:13px;padding-left:16px">
          ${decisions.map(d => `<li style="margin-bottom:6px">${d.description}</li>`).join('')}
        </ul>
      ` : ''}

      <h3 style="color:#F0F2FF;font-size:14px;margin:16px 0 12px">⚡ Action Items (${tasks.length})</h3>
      ${tasks.map(t => `
        <div style="padding:8px 0;border-bottom:1px solid #2A2F42">
          <span style="color:#F0F2FF;font-size:13px">${PRIORITY_EMOJI[t.priority] || ''} ${t.title}</span>
          ${t.assignee_name ? `<span style="color:#7B8BFF;font-size:12px"> → ${t.assignee_name}</span>` : ''}
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>`;
}

module.exports = { sendTaskAssignmentEmails, sendMeetingSummaryEmail };
