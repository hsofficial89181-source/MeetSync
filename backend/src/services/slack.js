/**
 * Slack Integration
 * Posts meeting summaries and task digests to channels
 * Optionally DMs assignees about their tasks
 */

const axios = require('axios');

async function postSlackSummary(meeting, tasks, decisions, summary, config = {}) {
  const token = config.bot_token || process.env.SLACK_BOT_TOKEN;
  const channel = config.channel || process.env.SLACK_DEFAULT_CHANNEL || '#general';

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const overdueCount = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date()).length;
  const urgentCount = tasks.filter(t => t.priority === 'urgent').length;

  // Build rich Slack Block Kit message
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `⚡ ${meeting.title}` },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Duration*\n${formatDuration(meeting.duration_seconds)}` },
        { type: 'mrkdwn', text: `*Tasks Created*\n${tasks.length}` },
        { type: 'mrkdwn', text: `*Decisions*\n${decisions.length}` },
        { type: 'mrkdwn', text: `*Urgent*\n${urgentCount > 0 ? `🔴 ${urgentCount}` : '—'}` },
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Summary*\n${summary}` },
    },
  ];

  // Add decisions if any
  if (decisions.length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*✅ Decisions*\n${decisions.map(d => `• ${d.description}`).join('\n')}`,
      },
    });
  }

  // Add top 5 tasks
  const topTasks = tasks.slice(0, 5);
  if (topTasks.length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*⚡ Action Items*\n${topTasks
          .map(t => {
            const priority = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[t.priority] || '🟡';
            const assignee = t.assignee_slack_id
              ? `<@${t.assignee_slack_id}>`
              : t.assignee_name || '_Unassigned_';
            const due = t.due_date ? ` · due ${t.due_date}` : '';
            return `${priority} ${t.title} → ${assignee}${due}`;
          })
          .join('\n')}${tasks.length > 5 ? `\n_+${tasks.length - 5} more tasks_` : ''}`,
      },
    });
  }

  // Post to channel
  await axios.post('https://slack.com/api/chat.postMessage', { channel, blocks }, { headers });

  // DM individual assignees about their tasks
  const assigneeGroups = groupBy(tasks.filter(t => t.assignee_slack_id), 'assignee_slack_id');
  for (const [slackUserId, userTasks] of Object.entries(assigneeGroups)) {
    const dmBlocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `👋 You were assigned *${userTasks.length} task${userTasks.length > 1 ? 's' : ''}* from *${meeting.title}*:`,
        },
      },
      ...userTasks.map(t => ({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `• *${t.title}*${t.due_date ? `\n  Due: ${t.due_date}` : ''}`,
        },
      })),
    ];

    await axios
      .post('https://slack.com/api/chat.postMessage', { channel: slackUserId, blocks: dmBlocks }, { headers })
      .catch(err => console.warn(`Failed to DM ${slackUserId}:`, err.message));
  }

  console.log(`Slack: Posted summary to ${channel}, DM'd ${Object.keys(assigneeGroups).length} assignees`);
}

function formatDuration(seconds) {
  if (!seconds) return 'Unknown';
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key];
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

module.exports = { postSlackSummary };
