/**
 * AI Pipeline Service — v3 (complete)
 *
 * Integrations pushed after every meeting:
 *   Jira · Notion · Slack · Linear · Microsoft Teams · GitHub Issues · Zapier/Make webhook
 */

const Anthropic = require('@anthropic-ai/sdk');
const { Queue } = require('bullmq');
const IORedis   = require('ioredis');
const fs        = require('fs');
const { pool }  = require('../models/migrate');
const { transcribeAudio }         = require('./transcription');
const { broadcastToMeeting }      = require('./websocket');
const { createJiraIssues }        = require('./jira');
const { createNotionPage }        = require('./notion');
const { postSlackSummary }        = require('./slack');
const { createLinearIssues }      = require('./linear');
const { postTeamsSummary }        = require('./teams');
const { createGitHubIssues }      = require('./github');
const { fireWebhook }             = require('./webhook');
const { matchTeamMembers }        = require('./teamMatcher');
const { sendTaskAssignmentEmails }= require('./email');
const { log }                     = require('../utils/logger');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const pipelineQueue = new Queue('meeting-pipeline', { connection: redisConnection });

async function enqueueMeeting(meetingId, localPath) {
  const job = await pipelineQueue.add('process', { meetingId, localPath }, {
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 50  },
  });
  return job.id;
}

async function processMeeting(meetingId, localPath, onProgress = () => {}) {
  try {
    // ── 1. Transcribe ──────────────────────────────────────────
    await updateStatus(meetingId, 'transcribing');
    broadcast(meetingId, 'step', { step: 'transcribing', label: 'Transcribing audio…', pct: 10 });
    onProgress('transcribing', 10);

    let transcript, retries = 0;
    while (retries < 3) {
      try { transcript = await transcribeAudio(localPath); break; }
      catch (err) {
        if (++retries === 3) throw err;
        log.warn(`Transcription attempt ${retries} failed, retrying…`, { error: err.message });
        await sleep(2000 * retries);
      }
    }

    await pool.query(
      'UPDATE meetings SET transcript=$1, updated_at=NOW() WHERE id=$2',
      [JSON.stringify(transcript), meetingId]
    );
    fs.unlink(localPath, () => {});
    broadcast(meetingId, 'step', { step: 'transcribed', label: 'Transcript ready', pct: 35 });
    onProgress('transcribed', 35);

    // ── Cancellation check (before expensive Claude call) ──────
    const { rows: [checkAfterTranscript] } = await pool.query('SELECT status FROM meetings WHERE id=$1', [meetingId]);
    if (checkAfterTranscript?.status === 'cancelled') {
      log.info('Meeting cancelled before extraction', { meetingId });
      broadcast(meetingId, 'cancelled', {});
      return { success: false, cancelled: true };
    }

    // ── 2. Extract with Claude ─────────────────────────────────
    await updateStatus(meetingId, 'extracting');
    broadcast(meetingId, 'step', { step: 'extracting', label: 'AI extracting tasks & decisions…', pct: 50 });
    onProgress('extracting', 50);

    const extracted = await extractActionsWithClaude(transcript);

    // ── 3. Auto-assign ─────────────────────────────────────────
    broadcast(meetingId, 'step', { step: 'assigning', label: 'Auto-assigning to team…', pct: 65 });
    onProgress('assigning', 65);

    const { rows: [meeting] } = await pool.query('SELECT * FROM meetings WHERE id=$1', [meetingId]);
    const teamMembers = await getTeamMembers(meeting.workspace_id);
    const tasks = matchTeamMembers(extracted.tasks, teamMembers);

    // ── 4. Persist ─────────────────────────────────────────────
    await saveExtractedData(meetingId, meeting.workspace_id, tasks, extracted.decisions, extracted.summary);
    broadcast(meetingId, 'step', { step: 'saved', label: 'Saved to database', pct: 75 });
    onProgress('saved', 75);

    // ── 5. Email assignees (fire-and-forget) ───────────────────
    sendTaskAssignmentEmails(tasks, meeting).catch(err =>
      log.warn('Email notifications failed', { error: err.message })
    );

    // ── 6. Push to all connected integrations ──────────────────
    broadcast(meetingId, 'step', { step: 'integrations', label: 'Syncing to integrations…', pct: 88 });
    onProgress('integrations', 88);

    await pushToIntegrations(meetingId, meeting.workspace_id, tasks, extracted).catch(err =>
      log.warn('Integration push partial failure', { error: err.message })
    );

    // ── 7. Done ────────────────────────────────────────────────
    const { rows: [checkBeforeDone] } = await pool.query('SELECT status FROM meetings WHERE id=$1', [meetingId]);
    if (checkBeforeDone?.status === 'cancelled') {
      log.info('Meeting cancelled before done', { meetingId });
      broadcast(meetingId, 'cancelled', {});
      return { success: false, cancelled: true };
    }
    await updateStatus(meetingId, 'done');
    onProgress('done', 100);
    broadcast(meetingId, 'done', {
      taskCount:     tasks.length,
      decisionCount: extracted.decisions.length,
      summary:       extracted.summary,
    });

    log.info('Meeting pipeline complete', { meetingId, taskCount: tasks.length });
    return { success: true, taskCount: tasks.length };

  } catch (err) {
    log.error('Pipeline failed', { meetingId, error: err.message });
    await updateStatus(meetingId, 'error', err.message);
    broadcast(meetingId, 'error', { message: err.message });
    throw err;
  }
}

async function extractActionsWithClaude(transcript) {
  const text  = transcript.map(s => `[${s.speaker}] ${s.text}`).join('\n');
  const today = new Date().toISOString().split('T')[0];

  const prompt = `You are an expert meeting analyst. Extract all action items and key decisions.

TRANSCRIPT:
${text}

Respond ONLY with valid JSON — no markdown fences, no explanation:
{
  "summary": "2-3 sentence executive summary",
  "tasks": [{
    "title": "clear actionable task",
    "description": "context if needed",
    "assignee_name": "name or null",
    "due_date": "YYYY-MM-DD or null",
    "priority": "urgent|high|medium|low",
    "labels": ["Engineering","Design","Docs","QA","Infra","Client","Legal","Marketing"],
    "source_quote": "exact transcript line",
    "type": "task|blocker|follow_up"
  }],
  "decisions": [{
    "description": "what was decided",
    "owner_name": "name or null",
    "agreed_by": ["name1","name2"],
    "source_quote": "exact transcript line"
  }]
}

Rules:
- Only extract EXPLICIT commitments, not suggestions
- Mark as blocker if someone is blocked or waiting
- Convert relative dates to ISO dates. Today: ${today}
- Priority: "ASAP"/"urgent"/"today" = urgent|high; no deadline = medium|low`;

  const msg = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = msg.content[0].text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(raw);
}

async function getTeamMembers(workspaceId) {
  const { rows } = await pool.query(
    'SELECT * FROM team_members WHERE workspace_id=$1', [workspaceId]
  );
  return rows;
}

async function saveExtractedData(meetingId, workspaceId, tasks, decisions, summary) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE meetings SET summary=$1, updated_at=NOW() WHERE id=$2',
      [summary, meetingId]
    );
    for (const task of tasks) {
      const { rows: [saved] } = await client.query(
        `INSERT INTO tasks
           (meeting_id, workspace_id, title, description, assignee_name, assignee_email,
            due_date, priority, status, labels, source_quote)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'backlog',$9,$10) RETURNING id`,
        [meetingId, workspaceId, task.title, task.description || null,
         task.assignee_name || null, task.assignee_email || null,
         task.due_date || null, task.priority || 'medium',
         task.labels || [], task.source_quote || null]
      );
      task.id = saved.id;
    }
    for (const d of decisions) {
      await client.query(
        `INSERT INTO decisions (meeting_id, workspace_id, description, owner_name, agreed_by, source_quote)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [meetingId, workspaceId, d.description, d.owner_name || null,
         d.agreed_by || [], d.source_quote || null]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function pushToIntegrations(meetingId, workspaceId, tasks, extracted) {
  const { rows: integrations } = await pool.query(
    'SELECT * FROM integrations WHERE workspace_id=$1 AND enabled=TRUE',
    [workspaceId]
  );
  const { rows: [meeting] } = await pool.query('SELECT * FROM meetings WHERE id=$1', [meetingId]);

  const results = await Promise.allSettled(
    integrations.map(i => {
      switch (i.provider) {
        case 'jira':    return createJiraIssues(tasks, meeting, i.config);
        case 'notion':  return createNotionPage(meeting, tasks, extracted.decisions, extracted.summary, i.config);
        case 'slack':   return postSlackSummary(meeting, tasks, extracted.decisions, extracted.summary, i.config);
        case 'linear':  return createLinearIssues(tasks, meeting, i.config);
        case 'teams':   return postTeamsSummary(meeting, tasks, extracted.decisions, extracted.summary, i.config);
        case 'github':  return createGitHubIssues(tasks, meeting, i.config);
        case 'zapier':
        case 'webhook': return fireWebhook(meeting, tasks, extracted.decisions, extracted.summary, i.config);
        default:        return Promise.resolve();
      }
    })
  );

  results.forEach((r, idx) => {
    if (r.status === 'rejected') {
      log.warn(`Integration ${integrations[idx]?.provider} failed`, { error: r.reason?.message });
    }
  });
}

async function cancelMeeting(meetingId) {
  await updateStatus(meetingId, 'cancelled');
  try {
    const jobs = await pipelineQueue.getJobs(['waiting', 'delayed', 'prioritized']);
    const target = jobs.find(j => j.data?.meetingId === meetingId);
    if (target) await target.remove();
  } catch (err) {
    log.warn('Could not remove queued job for cancelled meeting', { meetingId, error: err.message });
  }
}

async function updateStatus(meetingId, status, errorMessage = null) {
  await pool.query(
    'UPDATE meetings SET status=$1, error_message=$2, updated_at=NOW() WHERE id=$3',
    [status, errorMessage, meetingId]
  );
}

function broadcast(meetingId, event, data) {
  broadcastToMeeting(meetingId, { event, data, timestamp: Date.now() });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { processMeeting, enqueueMeeting, cancelMeeting };
