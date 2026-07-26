/**
 * Notion Integration
 * Creates a meeting notes page with decisions, tasks, and summary
 */

const { Client } = require('@notionhq/client');
const { pool } = require('../db');

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

/**
 * Create a to-do block in the user's Notion database for a specific task.
 * @param {object} task - Task row with title, description, priority, due_date, assignee_name
 * @param {string} meetingTitle - Title of the source meeting
 * @param {object} config - Integration config with token and database_id
 * @returns {Promise<{block_id: string}>}
 */
async function createNotionTask(task, meetingTitle, config = {}) {
  const token = config.token || process.env.NOTION_TOKEN;
  const databaseId = config.database_id || process.env.NOTION_DATABASE_ID;

  const notion = new Client({ auth: token });

  const priorityEmoji = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[task.priority] || '🟡';

  const properties = {
    Name: {
      title: [{ text: { content: `${priorityEmoji} ${task.title}` } }],
    },
  };

  if (task.due_date) {
    properties['Due Date'] = {
      date: { start: task.due_date },
    };
  }

  if (task.priority) {
    properties['Priority'] = {
      select: { name: task.priority.charAt(0).toUpperCase() + task.priority.slice(1) },
    };
  }

  const page = await notion.pages.create({
    parent: { database_id: databaseId },
    properties,
    children: [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: `From meeting: ${meetingTitle}` } }],
        },
      },
      ...(task.description ? [{
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: task.description } }],
        },
      }] : []),
      {
        object: 'block',
        type: 'to_do',
        to_do: {
          checked: false,
          rich_text: [{ type: 'text', text: { content: task.title } }],
        },
      },
    ],
  });

  console.log(`Notion: Created task page "${task.title}" (id: ${page.id})`);
  return { block_id: page.id };
}

/**
 * Archive (delete) a Notion block/page by ID.
 * @param {object} config - Integration config with token
 * @param {string} blockId - Notion block/page ID to archive
 */
async function deleteNotionBlock(config = {}, blockId) {
  const token = config.token || process.env.NOTION_TOKEN;
  const notion = new Client({ auth: token });

  await notion.blocks.delete({ block_id: blockId });

  console.log(`Notion: Archived block ${blockId}`);
  return true;
}

module.exports = { createNotionPage, createNotionTask, deleteNotionBlock };
