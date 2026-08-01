/**
 * Task Sync Service
 *
 * Handles per-task integration sync to Slack and Notion.
 * Tracks sync state in the task_integrations table.
 *
 * Key functions:
 *   - syncTaskToIntegrations(taskId): sync a task to assignee's connected integrations
 *   - removeTaskFromIntegrations(taskId, assigneeEmail): remove task from previous assignee's integrations
 *   - syncPendingTasksForUser(userId, provider): flush pending syncs when a user connects an integration
 */

const { pool } = require('../db');
const { sendSlackTaskDM, deleteSlackMessage } = require('./slack');
const { createNotionTask, deleteNotionBlock } = require('./notion');
const { log } = require('../utils/logger');

const PROVIDERS = ['slack', 'notion'];

/**
 * Sync a single task to the assignee's connected Slack and/or Notion.
 * If an integration is not connected, records a pending sync for later.
 *
 * @param {string} taskId - UUID of the task
 */
async function syncTaskToIntegrations(taskId) {
  const { rows: [task] } = await pool.query(
    `SELECT t.*, m.title AS meeting_title
     FROM tasks t
     LEFT JOIN meetings m ON m.id = t.meeting_id
     WHERE t.id = $1`,
    [taskId]
  );
  if (!task) {
    log.warn('syncTaskToIntegrations: task not found', { taskId });
    return;
  }

  if (!task.assignee_email) {
    log.info('syncTaskToIntegrations: no assignee, skipping', { taskId });
    return;
  }

  // Try to find assignee as a registered user (for personal integrations).
  // user may be null — we fall back to workspace integrations below.
  const { rows: [user] } = await pool.query(
    'SELECT id FROM users WHERE email = $1 AND workspace_id = $2',
    [task.assignee_email, task.workspace_id]
  );

  // Get team member info for Slack user ID lookup
  const { rows: [teamMember] } = await pool.query(
    'SELECT slack_user_id FROM team_members WHERE email = $1 AND workspace_id = $2',
    [task.assignee_email, task.workspace_id]
  );

  // Fetch workspace-level integrations as fallback (connected by admin)
  const { rows: workspaceIntegrations } = await pool.query(
    'SELECT * FROM integrations WHERE workspace_id = $1 AND enabled = TRUE AND provider = ANY($2)',
    [task.workspace_id, PROVIDERS]
  );
  const workspaceMap = new Map(workspaceIntegrations.map(i => [i.provider, i]));

  for (const provider of PROVIDERS) {
    // 1. Try assignee's personal integration first
    let integration = null;
    if (user) {
      const { rows: [personal] } = await pool.query(
        'SELECT * FROM integrations WHERE user_id = $1 AND provider = $2 AND enabled = TRUE',
        [user.id, provider]
      );
      integration = personal || null;
    }

    // 2. Fall back to workspace integration (e.g. admin-connected Slack/Notion)
    if (!integration) {
      integration = workspaceMap.get(provider) || null;
    }

    // Determine the user_id to track in task_integrations
    const syncUserId = user?.id ?? integration?.user_id;

    if (!integration) {
      if (syncUserId) {
        await upsertTaskIntegration(taskId, task.workspace_id, syncUserId, provider, 'pending', null, {});
        log.info('syncTaskToIntegrations: recorded pending sync', { taskId, provider, syncUserId });
      } else {
        log.info('syncTaskToIntegrations: no integration available', { taskId, provider });
      }
      continue;
    }

    try {
      const result = await syncToProvider(task, provider, integration.config, teamMember?.slack_user_id);
      await upsertTaskIntegration(taskId, task.workspace_id, syncUserId, provider, 'synced', result.external_id, result.external_meta || {});
      log.info('syncTaskToIntegrations: synced', { taskId, provider });
    } catch (err) {
      await upsertTaskIntegration(taskId, task.workspace_id, syncUserId, provider, 'failed', null, { error: err.message });
      log.warn('syncTaskToIntegrations: sync failed', { taskId, provider, error: err.message });
    }
  }
}

/**
 * Remove a task from all integrations for a previous assignee.
 * Called when an assignee is changed.
 *
 * @param {string} taskId - UUID of the task
 * @param {string} assigneeEmail - Email of the previous assignee
 */
async function removeTaskFromIntegrations(taskId, assigneeEmail) {
  if (!assigneeEmail) return;

  // Find the user by email
  const { rows: [user] } = await pool.query(
    'SELECT id, workspace_id FROM users WHERE email = $1',
    [assigneeEmail.toLowerCase()]
  );

  // Get all synced task_integrations for this task
  const { rows: records } = await pool.query(
    `SELECT * FROM task_integrations WHERE task_id = $1 AND status = 'synced'`,
    [taskId]
  );

  // Fetch workspace-level integrations as fallback
  const workspaceId = user?.workspace_id;
  let workspaceIntegrations = new Map();
  if (workspaceId) {
    const { rows: wsInts } = await pool.query(
      'SELECT * FROM integrations WHERE workspace_id = $1 AND enabled = TRUE',
      [workspaceId]
    );
    workspaceIntegrations = new Map(wsInts.map(i => [i.provider, i]));
  }

  for (const record of records) {
    // 1. Try assignee's personal integration
    let integration = null;
    if (user) {
      const { rows: [personal] } = await pool.query(
        'SELECT config FROM integrations WHERE user_id = $1 AND provider = $2 AND enabled = TRUE',
        [user.id, record.provider]
      );
      integration = personal || null;
    }

    // 2. Fall back to workspace integration
    if (!integration) {
      integration = workspaceIntegrations.get(record.provider) || null;
    }

    if (!integration) {
      // Integration disconnected — just mark as removed
      await updateTaskIntegrationStatus(record.id, 'removed');
      continue;
    }

    try {
      await removeFromProvider(record.provider, integration.config, record.external_id, record.external_meta);
      await updateTaskIntegrationStatus(record.id, 'removed');
      log.info('removeTaskFromIntegrations: removed', { taskId, provider: record.provider });
    } catch (err) {
      log.warn('removeTaskFromIntegrations: removal failed', { taskId, provider: record.provider, error: err.message });
      await updateTaskIntegrationStatus(record.id, 'removed');
    }
  }
}

/**
 * Sync all pending tasks for a user when they connect an integration.
 * Called from the OAuth callback after a successful connection.
 *
 * @param {string} userId - UUID of the user who just connected
 * @param {string} provider - 'slack' or 'notion'
 */
async function syncPendingTasksForUser(userId, provider) {
  // Get the integration config for this user+provider
  const { rows: [integration] } = await pool.query(
    'SELECT config, workspace_id FROM integrations WHERE user_id = $1 AND provider = $2 AND enabled = TRUE',
    [userId, provider]
  );
  if (!integration) {
    log.warn('syncPendingTasksForUser: integration not found or not enabled', { userId, provider });
    return;
  }

  // Find pending tasks for this user+provider, plus workspace-level pending tasks
  // (tracked under the admin's user_id who connected the workspace integration)
  const { rows: pendingRecords } = await pool.query(
    `SELECT ti.*, t.title, t.description, t.priority, t.due_date, t.assignee_name, t.assignee_email,
            m.title AS meeting_title
     FROM task_integrations ti
     JOIN tasks t ON t.id = ti.task_id
     LEFT JOIN meetings m ON m.id = t.meeting_id
     WHERE ti.workspace_id = $1 AND ti.provider = $2 AND ti.status = 'pending'
       AND (ti.user_id = $3 OR ti.user_id IS NULL)`,
    [integration.workspace_id, provider, userId]
  );

  if (pendingRecords.length === 0) {
    log.info('syncPendingTasksForUser: no pending tasks', { userId, provider });
    return;
  }

  // Get team member info for Slack user ID (filter by workspace)
  let slackUserId = null;
  if (provider === 'slack') {
    const { rows: [user] } = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (user) {
      const { rows: [tm] } = await pool.query(
        'SELECT slack_user_id FROM team_members WHERE email = $1 AND workspace_id = $2',
        [user.email.toLowerCase(), integration.workspace_id]
      );
      slackUserId = tm?.slack_user_id || null;
    }
  }

  log.info('syncPendingTasksForUser: flushing pending tasks', { userId, provider, count: pendingRecords.length });

  for (const record of pendingRecords) {
    // For Slack, also try to resolve the assignee's Slack user ID if different from the connecting user
    let taskSlackUserId = slackUserId;
    if (provider === 'slack' && !taskSlackUserId && record.assignee_email) {
      const { rows: [tm] } = await pool.query(
        'SELECT slack_user_id FROM team_members WHERE email = $1 AND workspace_id = $2',
        [record.assignee_email.toLowerCase(), record.workspace_id]
      );
      taskSlackUserId = tm?.slack_user_id || null;
    }

    const task = {
      id: record.task_id,
      title: record.title,
      description: record.description,
      priority: record.priority,
      due_date: record.due_date,
      assignee_name: record.assignee_name,
      assignee_email: record.assignee_email,
      meeting_title: record.meeting_title,
    };

    try {
      const result = await syncToProvider(task, provider, integration.config, taskSlackUserId);
      await upsertTaskIntegration(record.task_id, record.workspace_id, userId, provider, 'synced', result.external_id, result.external_meta || {});
      log.info('syncPendingTasksForUser: synced pending task', { taskId: record.task_id, provider });
    } catch (err) {
      await upsertTaskIntegration(record.task_id, record.workspace_id, userId, provider, 'failed', null, { error: err.message });
      log.warn('syncPendingTasksForUser: sync failed for pending task', { taskId: record.task_id, provider, error: err.message });
    }
  }
}

/**
 * Mark all task_integrations as removed for a user+provider.
 * Called when a user disconnects an integration.
 *
 * @param {string} userId - UUID of the user
 * @param {string} provider - 'slack' or 'notion'
 */
async function markRemovedForUserProvider(userId, provider) {
  await pool.query(
    `UPDATE task_integrations SET status = 'removed', updated_at = NOW()
     WHERE user_id = $1 AND provider = $2 AND status = 'synced'`,
    [userId, provider]
  );
  log.info('markRemovedForUserProvider: marked all as removed', { userId, provider });
}

// ── Internal helpers ──────────────────────────────────────────────────────

async function syncToProvider(task, provider, config, slackUserId) {
  switch (provider) {
    case 'slack': {
      const { ts, channel_id } = await sendSlackTaskDM(task, task.meeting_title, config, slackUserId);
      return { external_id: ts, external_meta: { channel_id } };
    }
    case 'notion': {
      const { block_id } = await createNotionTask(task, task.meeting_title, config);
      return { external_id: block_id, external_meta: {} };
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

async function removeFromProvider(provider, config, externalId, externalMeta) {
  switch (provider) {
    case 'slack':
      await deleteSlackMessage(config, externalId, externalMeta?.channel_id);
      break;
    case 'notion':
      await deleteNotionBlock(config, externalId);
      break;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

async function upsertTaskIntegration(taskId, workspaceId, userId, provider, status, externalId, externalMeta) {
  await pool.query(
    `INSERT INTO task_integrations (task_id, workspace_id, user_id, provider, status, external_id, external_meta)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (task_id, provider)
     DO UPDATE SET status = $5, external_id = $6, external_meta = $7, user_id = $3, updated_at = NOW()`,
    [taskId, workspaceId, userId, provider, status, externalId, JSON.stringify(externalMeta || {})]
  );
}

async function updateTaskIntegrationStatus(id, status) {
  await pool.query(
    'UPDATE task_integrations SET status = $1, updated_at = NOW() WHERE id = $2',
    [status, id]
  );
}

module.exports = {
  syncTaskToIntegrations,
  removeTaskFromIntegrations,
  syncPendingTasksForUser,
  markRemovedForUserProvider,
};
