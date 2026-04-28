/**
 * Microsoft Teams Integration
 *
 * Posts meeting summaries as Adaptive Cards to Teams channels.
 * Uses incoming webhooks — no bot registration required.
 *
 * Setup:
 *  1. In Teams: go to a channel → ... → Connectors → Incoming Webhook
 *  2. Create webhook, copy the URL
 *  3. Paste URL when connecting via /api/integrations/teams
 */

const axios = require('axios');

/**
 * Post a meeting summary as an Adaptive Card to Teams
 */
async function postTeamsSummary(meeting, tasks, decisions, summary, config = {}) {
  const webhookUrl = config.webhook_url || process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl) throw new Error('Teams webhook URL not configured');

  const priorityEmoji = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
  const urgentCount = tasks.filter(t => t.priority === 'urgent' || t.priority === 'high').length;

  // Build Adaptive Card payload
  const card = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'ColumnSet',
              columns: [
                {
                  type: 'Column',
                  width: 'auto',
                  items: [{
                    type: 'TextBlock',
                    text: '⚡',
                    size: 'ExtraLarge',
                  }],
                },
                {
                  type: 'Column',
                  width: 'stretch',
                  items: [
                    {
                      type: 'TextBlock',
                      text: meeting.title,
                      weight: 'Bolder',
                      size: 'Large',
                      wrap: true,
                    },
                    {
                      type: 'TextBlock',
                      text: `${tasks.length} tasks · ${decisions.length} decisions${urgentCount > 0 ? ` · 🔴 ${urgentCount} urgent` : ''}`,
                      isSubtle: true,
                      spacing: 'None',
                    },
                  ],
                },
              ],
            },
            {
              type: 'TextBlock',
              text: summary || 'No summary available.',
              wrap: true,
              separator: true,
              spacing: 'Medium',
            },
            ...(decisions.length > 0 ? [
              {
                type: 'TextBlock',
                text: '✅ Key Decisions',
                weight: 'Bolder',
                spacing: 'Medium',
              },
              {
                type: 'TextBlock',
                text: decisions.map(d => `• ${d.description}`).join('\n'),
                wrap: true,
                spacing: 'Small',
              },
            ] : []),
            {
              type: 'TextBlock',
              text: '⚡ Action Items',
              weight: 'Bolder',
              spacing: 'Medium',
            },
            {
              type: 'FactSet',
              facts: tasks.slice(0, 8).map(t => ({
                title: `${priorityEmoji[t.priority] || '🟡'} ${t.title}`,
                value: [
                  t.assignee_name && `→ ${t.assignee_name}`,
                  t.due_date && `due ${t.due_date}`,
                ].filter(Boolean).join(' · ') || 'Unassigned',
              })),
            },
            ...(tasks.length > 8 ? [{
              type: 'TextBlock',
              text: `_+${tasks.length - 8} more tasks_`,
              isSubtle: true,
              spacing: 'Small',
            }] : []),
          ],
          actions: [
            {
              type: 'Action.OpenUrl',
              title: 'View in MeetSync',
              url: `${process.env.FRONTEND_URL}/meetings`,
            },
          ],
          msteams: { width: 'Full' },
        },
      },
    ],
  };

  await axios.post(webhookUrl, card, {
    headers: { 'Content-Type': 'application/json' },
  });

  console.log(`Teams: Posted summary for "${meeting.title}"`);
}

/**
 * Test Teams webhook connectivity
 */
async function testTeamsConnection(config = {}) {
  const webhookUrl = config.webhook_url || process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl) throw new Error('Teams webhook URL not configured');

  await axios.post(webhookUrl, {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        type: 'AdaptiveCard',
        version: '1.4',
        body: [{
          type: 'TextBlock',
          text: '✅ MeetSync AI is connected to this channel!',
          weight: 'Bolder',
        }],
      },
    }],
  });

  return 'Teams webhook connected successfully';
}

module.exports = { postTeamsSummary, testTeamsConnection };
