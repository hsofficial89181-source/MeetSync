/**
 * Notion Integration
 * Creates a meeting notes page with decisions, tasks, and summary
 */

const { Client } = require('@notionhq/client');
const { pool } = require('../models/migrate');

async function createNotionPage(meeting, tasks, decisions, summary, config = {}) {
  const token = config.token || process.env.NOTION_TOKEN;
  const databaseId = config.database_id || process.env.NOTION_DATABASE_ID;

  const notion = new Client({ auth: token });

  const priorityEmoji = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' };

  // Build the page content blocks
  const blocks = [
    // Summary section
    {
      object: 'block',
      type: 'heading_2',
      heading_2: { rich_text: [{ type: 'text', text: { content: '📋 Meeting Summary' } }] },
    },
    {
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [{ type: 'text', text: { content: summary || 'No summary available.' } }] },
    },
    {
      object: 'block',
      type: 'divider',
      divider: {},
    },

    // Decisions section
    {
      object: 'block',
      type: 'heading_2',
      heading_2: { rich_text: [{ type: 'text', text: { content: '✅ Key Decisions' } }] },
    },
    ...decisions.map(d => ({
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [
          { type: 'text', text: { content: d.description }, annotations: { bold: true } },
          { type: 'text', text: { content: d.owner_name ? ` — Owner: ${d.owner_name}` : '' } },
        ],
      },
    })),
    {
      object: 'block',
      type: 'divider',
      divider: {},
    },

    // Tasks section
    {
      object: 'block',
      type: 'heading_2',
      heading_2: { rich_text: [{ type: 'text', text: { content: '⚡ Action Items' } }] },
    },
    ...tasks.map(t => ({
      object: 'block',
      type: 'to_do',
      to_do: {
        checked: false,
        rich_text: [
          {
            type: 'text',
            text: {
              content: `${priorityEmoji[t.priority] || '🟡'} ${t.title}${t.assignee_name ? ` → ${t.assignee_name}` : ''}${t.due_date ? ` (due ${t.due_date})` : ''}`,
            },
          },
        ],
      },
    })),
  ];

  // Create the page in the Notion database
  const page = await notion.pages.create({
    parent: { database_id: databaseId },
    properties: {
      Name: {
        title: [{ text: { content: meeting.title } }],
      },
      Date: {
        date: { start: new Date(meeting.created_at).toISOString().split('T')[0] },
      },
      Status: {
        select: { name: 'Processed' },
      },
      'Task Count': {
        number: tasks.length,
      },
    },
    children: blocks,
  });

  // Save Notion page IDs back to tasks
  // (In practice you'd create linked sub-pages per task)
  await pool.query(
    'UPDATE tasks SET notion_page_id = $1 WHERE meeting_id = $2',
    [page.id, meeting.id]
  );

  console.log(`Notion: Created page "${meeting.title}" with ${tasks.length} tasks`);
  return page.id;
}

module.exports = { createNotionPage };
