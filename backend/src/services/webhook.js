/**
 * Zapier / Make (formerly Integromat) Webhook Integration
 *
 * When a meeting is processed, POSTs a rich payload to a configured webhook URL.
 * This connects MeetSync to 5,000+ apps via Zapier/Make without writing code.
 *
 * Payload includes: meeting metadata, transcript, tasks, decisions, summary.
 *
 * Setup:
 *  1. In Zapier: New Zap → Trigger: Webhooks by Zapier → Catch Hook
 *  2. Copy the webhook URL
 *  3. Connect via /api/integrations/zapier with { webhook_url: '...' }
 *
 * Example Zaps people build:
 *  - MeetSync → Google Sheets (task tracker)
 *  - MeetSync → HubSpot (create follow-up tasks from sales calls)
 *  - MeetSync → Asana
 *  - MeetSync → Monday.com
 *  - MeetSync → SMS via Twilio when urgent tasks are assigned
 */

const axios = require('axios');

/**
 * Fire webhook with full meeting payload
 */
async function fireWebhook(meeting, tasks, decisions, summary, config = {}) {
  const webhookUrl = config.webhook_url;
  if (!webhookUrl) throw new Error('Webhook URL not configured');

  const payload = {
    event: 'meeting.processed',
    timestamp: new Date().toISOString(),
    meeting: {
      id:        meeting.id,
      title:     meeting.title,
      source:    meeting.source,
      duration_seconds: meeting.duration_seconds,
      created_at: meeting.created_at,
      summary,
    },
    tasks: tasks.map(t => ({
      id:            t.id,
      title:         t.title,
      description:   t.description,
      assignee_name: t.assignee_name,
      assignee_email:t.assignee_email,
      due_date:      t.due_date,
      priority:      t.priority,
      status:        t.status,
      labels:        t.labels,
      source_quote:  t.source_quote,
      jira_issue_id: t.jira_issue_id,
      notion_page_id:t.notion_page_id,
    })),
    decisions: decisions.map(d => ({
      description: d.description,
      owner_name:  d.owner_name,
      agreed_by:   d.agreed_by,
    })),
    stats: {
      task_count:     tasks.length,
      decision_count: decisions.length,
      urgent_count:   tasks.filter(t => t.priority === 'urgent').length,
      high_count:     tasks.filter(t => t.priority === 'high').length,
      unassigned_count: tasks.filter(t => !t.assignee_email).length,
    },
  };

  const response = await axios.post(webhookUrl, payload, {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'MeetSync-AI/2.0',
      'X-MeetSync-Event': 'meeting.processed',
      'X-MeetSync-Meeting-Id': meeting.id,
    },
    timeout: 10000,
  });

  console.log(`Webhook: Fired to ${webhookUrl.slice(0, 50)}... — status ${response.status}`);
  return response.status;
}

/**
 * Test webhook by firing a sample payload
 */
async function testWebhook(config = {}) {
  const webhookUrl = config.webhook_url;
  if (!webhookUrl) throw new Error('Webhook URL not configured');

  await axios.post(webhookUrl, {
    event: 'webhook.test',
    timestamp: new Date().toISOString(),
    message: 'MeetSync AI webhook connection test successful',
    version: '2.0',
  }, {
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'MeetSync-AI/2.0' },
    timeout: 10000,
  });

  return 'Webhook test payload sent successfully';
}

module.exports = { fireWebhook, testWebhook };
