/**
 * Linear Integration
 * Creates Linear issues from extracted tasks via Linear GraphQL API
 */

const axios = require('axios');
const { pool } = require('../models/migrate');

const PRIORITY_MAP = { urgent: 1, high: 2, medium: 3, low: 4 };

async function createLinearIssues(tasks, meeting, config = {}) {
  const apiKey = config.api_key || process.env.LINEAR_API_KEY;
  const teamId = config.team_id || process.env.LINEAR_TEAM_ID;

  if (!apiKey || !teamId) {
    console.warn('Linear: API key or team ID not configured');
    return;
  }

  const headers = {
    'Authorization': apiKey,
    'Content-Type': 'application/json',
  };

  const results = [];

  for (const task of tasks) {
    try {
      const mutation = `
        mutation CreateIssue($input: IssueCreateInput!) {
          issueCreate(input: $input) {
            success
            issue {
              id
              identifier
              url
            }
          }
        }
      `;

      const variables = {
        input: {
          teamId,
          title: task.title,
          description: [
            task.description,
            task.source_quote ? `\n> "${task.source_quote}"` : '',
            `\n**Source meeting:** ${meeting.title}`,
          ].filter(Boolean).join('\n'),
          priority: PRIORITY_MAP[task.priority] || 3,
          ...(task.due_date && { dueDate: task.due_date }),
          ...(task.assignee_linear_id && { assigneeId: task.assignee_linear_id }),
          labelNames: task.labels || [],
        },
      };

      const response = await axios.post(
        'https://api.linear.app/graphql',
        { query: mutation, variables },
        { headers }
      );

      const issue = response.data?.data?.issueCreate?.issue;
      if (issue) {
        await pool.query(
          'UPDATE tasks SET linear_issue_id = $1 WHERE id = $2',
          [issue.identifier, task.id]
        );
        results.push({ taskId: task.id, linearId: issue.identifier, success: true });
      }
    } catch (err) {
      console.error(`Linear: Failed to create issue for "${task.title}":`, err.response?.data || err.message);
      results.push({ taskId: task.id, success: false });
    }
  }

  console.log(`Linear: Created ${results.filter(r => r.success).length}/${tasks.length} issues`);
  return results;
}

/**
 * Test Linear connection
 */
async function testLinearConnection(config = {}) {
  const apiKey = config.api_key || process.env.LINEAR_API_KEY;
  const response = await axios.post(
    'https://api.linear.app/graphql',
    { query: '{ viewer { id name email } }' },
    { headers: { Authorization: apiKey, 'Content-Type': 'application/json' } }
  );
  const viewer = response.data?.data?.viewer;
  if (!viewer) throw new Error('Invalid API key');
  return `Connected as ${viewer.name} (${viewer.email})`;
}

module.exports = { createLinearIssues, testLinearConnection };
