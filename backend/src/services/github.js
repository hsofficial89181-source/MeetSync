/**
 * GitHub Issues Integration
 *
 * Creates GitHub issues from extracted tasks.
 * Great for engineering teams who use GitHub Projects instead of Jira.
 *
 * Setup:
 *  1. Create a Personal Access Token with `repo` scope at github.com/settings/tokens
 *  2. Note your owner (username or org) and repo name
 *  3. Connect via /api/integrations/github
 */

const axios = require('axios');
const { pool } = require('../models/migrate');

const PRIORITY_LABELS = {
  urgent: ['priority: urgent', 'bug'],
  high:   ['priority: high'],
  medium: ['priority: medium'],
  low:    ['priority: low'],
};

async function createGitHubIssues(tasks, meeting, config = {}) {
  const token = config.token || process.env.GITHUB_TOKEN;
  const owner = config.owner || process.env.GITHUB_OWNER;
  const repo  = config.repo  || process.env.GITHUB_REPO;

  if (!token || !owner || !repo) {
    throw new Error('GitHub token, owner, and repo are required');
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };

  const results = [];

  for (const task of tasks) {
    try {
      const labels = [
        ...(PRIORITY_LABELS[task.priority] || ['priority: medium']),
        ...(task.labels || []).map(l => l.toLowerCase()),
        'meetsync',
      ];

      const body = [
        task.description || '',
        '',
        '---',
        `**Source meeting:** ${meeting.title}`,
        task.source_quote ? `**Quote:** _"${task.source_quote}"_` : '',
        task.assignee_name ? `**Originally assigned to:** ${task.assignee_name}` : '',
        `**Created by:** MeetSync AI`,
      ].filter(line => line !== '').join('\n');

      const { data: issue } = await axios.post(
        `https://api.github.com/repos/${owner}/${repo}/issues`,
        {
          title: task.title,
          body,
          labels,
          ...(task.due_date && {
            milestone: null, // You'd need to create/find a milestone for the due date
          }),
        },
        { headers }
      );

      // Store GitHub issue number in our DB
      await pool.query(
        "UPDATE tasks SET jira_issue_id = $1 WHERE id = $2",
        [`GH-${issue.number}`, task.id]
      );

      results.push({ taskId: task.id, issueNumber: issue.number, url: issue.html_url, success: true });
    } catch (err) {
      console.error(`GitHub: Failed to create issue for "${task.title}":`, err.response?.data?.message || err.message);
      results.push({ taskId: task.id, success: false, error: err.message });
    }
  }

  console.log(`GitHub: Created ${results.filter(r => r.success).length}/${tasks.length} issues in ${owner}/${repo}`);
  return results;
}

/**
 * Test GitHub connection
 */
async function testGitHubConnection(config = {}) {
  const token = config.token || process.env.GITHUB_TOKEN;
  const owner = config.owner || process.env.GITHUB_OWNER;
  const repo  = config.repo  || process.env.GITHUB_REPO;

  const { data } = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
  );

  return `Connected to ${data.full_name} (${data.open_issues_count} open issues)`;
}

module.exports = { createGitHubIssues, testGitHubConnection };
