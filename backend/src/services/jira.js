/**
 * Jira Integration
 * Creates issues in Jira from extracted tasks
 */

const axios = require('axios');
const { pool } = require('../models/migrate');

const PRIORITY_MAP = {
  urgent: 'Highest',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

/**
 * Create Jira issues for a list of tasks
 * Updates tasks in DB with jira_issue_id
 */
async function createJiraIssues(tasks, meeting, config = {}) {
  const baseUrl = config.base_url || process.env.JIRA_BASE_URL;
  const email = config.email || process.env.JIRA_EMAIL;
  const token = config.api_token || process.env.JIRA_API_TOKEN;
  const projectKey = config.project_key || process.env.JIRA_PROJECT_KEY || 'ENG';

  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const headers = {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const results = [];

  for (const task of tasks) {
    try {
      const issueBody = {
        fields: {
          project: { key: projectKey },
          summary: task.title,
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: task.description || '' },
                  { type: 'hardBreak' },
                  { type: 'text', text: `\nSource: ${meeting.title}` },
                  { type: 'hardBreak' },
                  ...(task.source_quote
                    ? [{ type: 'text', text: `\nQuote: "${task.source_quote}"` }]
                    : []),
                ],
              },
            ],
          },
          issuetype: { name: 'Task' },
          priority: { name: PRIORITY_MAP[task.priority] || 'Medium' },
          ...(task.due_date && { duedate: task.due_date }),
          ...(task.assignee_jira_id && {
            assignee: { accountId: task.assignee_jira_id },
          }),
          labels: task.labels || [],
        },
      };

      const response = await axios.post(
        `${baseUrl}/rest/api/3/issue`,
        issueBody,
        { headers }
      );

      const jiraIssueId = response.data.key;

      // Save Jira issue ID back to our DB
      await pool.query(
        'UPDATE tasks SET jira_issue_id = $1 WHERE id = $2',
        [jiraIssueId, task.id]
      );

      results.push({ taskId: task.id, jiraIssueId, success: true });
    } catch (err) {
      console.error(`Failed to create Jira issue for task "${task.title}":`, err.response?.data || err.message);
      results.push({ taskId: task.id, success: false, error: err.message });
    }
  }

  console.log(`Jira: Created ${results.filter(r => r.success).length}/${tasks.length} issues`);
  return results;
}

/**
 * Sync task status back from Jira
 * Maps Jira statuses to our internal statuses
 */
async function syncJiraStatuses(config = {}) {
  const baseUrl = config.base_url || process.env.JIRA_BASE_URL;
  const email = config.email || process.env.JIRA_EMAIL;
  const token = config.api_token || process.env.JIRA_API_TOKEN;

  const auth = Buffer.from(`${email}:${token}`).toString('base64');

  // Get all tasks that have Jira issue IDs
  const { rows: tasks } = await pool.query(
    'SELECT id, jira_issue_id FROM tasks WHERE jira_issue_id IS NOT NULL'
  );

  const STATUS_MAP = {
    'To Do': 'backlog',
    'In Progress': 'in_progress',
    'In Review': 'in_review',
    'Done': 'done',
  };

  for (const task of tasks) {
    try {
      const response = await axios.get(
        `${baseUrl}/rest/api/3/issue/${task.jira_issue_id}`,
        { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } }
      );

      const jiraStatus = response.data.fields.status.name;
      const ourStatus = STATUS_MAP[jiraStatus] || 'backlog';

      await pool.query(
        'UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2',
        [ourStatus, task.id]
      );
    } catch (err) {
      // Skip failed syncs silently
    }
  }
}

module.exports = { createJiraIssues, syncJiraStatuses };
