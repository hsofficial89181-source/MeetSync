/**
 * Seed Script
 *
 * Populates the database with realistic demo data so you can
 * see the full app without uploading real recordings.
 *
 * Usage:
 *   npm run seed
 *   npm run seed -- --reset    (wipe all data first)
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const RESET = process.argv.includes('--reset');

async function seed() {
  const client = await pool.connect();
  console.log('Seeding database...');

  try {
    await client.query('BEGIN');

    if (RESET) {
      console.log('Resetting data...');
      // Drop lazy-created tables first if they exist
      await client.query(`
        DROP TABLE IF EXISTS task_comments CASCADE;
        DROP TABLE IF EXISTS share_links CASCADE;
      `);
      await client.query(`
        TRUNCATE notifications, decisions, tasks, meetings,
                 integrations, team_members, refresh_tokens, users, workspaces
        RESTART IDENTITY CASCADE
      `);
    }

    // ── Workspace ─────────────────────────────────────────────
    const wsId = uuidv4();
    await client.query(
      `INSERT INTO workspaces (id, name, slug) VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO NOTHING`,
      [wsId, 'Acme Corp', 'acme-corp']
    );

    // Re-fetch in case it already existed
    const { rows: [ws] } = await client.query(
      "SELECT id FROM workspaces WHERE slug = 'acme-corp'"
    );
    const workspaceId = ws.id;

    // ── Users ─────────────────────────────────────────────────
    const hash = await bcrypt.hash('password123', 12);
    const users = [
      { id: uuidv4(), name: 'Ali Khan',   email: 'ali@acme.com',   role: 'admin'  },
      { id: uuidv4(), name: 'Sara Malik', email: 'sara@acme.com',  role: 'member' },
      { id: uuidv4(), name: 'Zaid Khan',  email: 'zaid@acme.com',  role: 'member' },
      { id: uuidv4(), name: 'Nida Rehman',email: 'nida@acme.com',  role: 'member' },
    ];

    for (const u of users) {
      await client.query(
        `INSERT INTO users (id, name, email, password_hash, role, workspace_id)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (email) DO NOTHING`,
        [u.id, u.name, u.email, hash, u.role, workspaceId]
      );
    }

    // Re-fetch real IDs
    const { rows: dbUsers } = await client.query(
      'SELECT id, name, email FROM users WHERE workspace_id = $1', [workspaceId]
    );
    const userByEmail = Object.fromEntries(dbUsers.map(u => [u.email, u]));

    // ── Team members ──────────────────────────────────────────
    const teamMembers = [
      { name: 'Ali Khan',    email: 'ali@acme.com',   role: 'Product',     slack_user_id: 'U001', jira_account_id: 'jira-001' },
      { name: 'Sara Malik',  email: 'sara@acme.com',  role: 'Engineering', slack_user_id: 'U002', jira_account_id: 'jira-002' },
      { name: 'Zaid Khan',   email: 'zaid@acme.com',  role: 'Engineering', slack_user_id: 'U003', jira_account_id: 'jira-003' },
      { name: 'Nida Rehman', email: 'nida@acme.com',  role: 'Design',      slack_user_id: 'U004', jira_account_id: 'jira-004' },
      { name: 'Omar Sheikh', email: 'omar@acme.com',  role: 'DevOps',      slack_user_id: 'U005', jira_account_id: 'jira-005' },
    ];
    for (const m of teamMembers) {
      await client.query(
        `INSERT INTO team_members (workspace_id, name, email, role, slack_user_id, jira_account_id)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (workspace_id, email) DO NOTHING`,
        [workspaceId, m.name, m.email, m.role, m.slack_user_id, m.jira_account_id]
      );
    }

    // ── Meetings ──────────────────────────────────────────────
    const meetings = [
      {
        id: uuidv4(), title: 'Q3 Roadmap Planning', source: 'zoom',
        duration_seconds: 2820, status: 'done', days_ago: 0,
        summary: 'Aligned on Q3 priorities: API redesign, new onboarding flow, and staging environment. Aug 15 launch target confirmed with no scope changes.',
      },
      {
        id: uuidv4(), title: 'Engineering Standup', source: 'upload',
        duration_seconds: 900, status: 'done', days_ago: 1,
        summary: 'Zaid blocked on AWS access for staging. Sara making good progress on API docs. Sprint on track.',
      },
      {
        id: uuidv4(), title: 'Client Onboarding — Acme Corp', source: 'google_meet',
        duration_seconds: 1920, status: 'done', days_ago: 2,
        summary: 'Successful first onboarding session. Client chose checklist onboarding over wizard. Follow-up checklist and NDA renewal needed.',
      },
      {
        id: uuidv4(), title: 'Design Review — v2.1 UI', source: 'upload',
        duration_seconds: 3600, status: 'done', days_ago: 5,
        summary: 'Reviewed new task board designs. Approved kanban layout. Mobile responsive version needed before launch.',
      },
      {
        id: uuidv4(), title: 'Weekly All-Hands', source: 'zoom',
        duration_seconds: 2100, status: 'done', days_ago: 7,
        summary: 'Company-wide update. Q2 metrics reviewed. New hire introductions. Q3 OKRs presented.',
      },
    ];

    for (const m of meetings) {
      await client.query(
        `INSERT INTO meetings
           (id, workspace_id, title, source, duration_seconds, status, summary,
            created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW() - INTERVAL '${m.days_ago} days')`,
        [m.id, workspaceId, m.title, m.source, m.duration_seconds,
         m.status, m.summary, userByEmail['ali@acme.com']?.id]
      );
    }

    // ── Tasks ─────────────────────────────────────────────────
    const today = new Date();
    const d = (offset) => {
      const date = new Date(today);
      date.setDate(date.getDate() + offset);
      return date.toISOString().split('T')[0];
    };

    const tasks = [
      // Q3 Roadmap tasks
      { meeting: 0, title: 'Update API documentation for v2.1', assignee: 'sara@acme.com', due: d(-3), priority: 'high',   status: 'in_progress', labels: ['Docs'] },
      { meeting: 0, title: 'Push OpenAPI spec to monorepo',     assignee: 'zaid@acme.com', due: d(0),  priority: 'urgent', status: 'in_review',   labels: ['Engineering'] },
      { meeting: 0, title: 'Grant Zaid AWS staging access',     assignee: 'omar@acme.com', due: d(0),  priority: 'urgent', status: 'in_review',   labels: ['Infra'] },
      { meeting: 0, title: 'Design checklist onboarding screens',assignee:'nida@acme.com',  due: d(7),  priority: 'high',   status: 'backlog',     labels: ['Design'] },
      { meeting: 0, title: 'Write test cases for API v2.1',     assignee: 'zaid@acme.com', due: d(10), priority: 'medium', status: 'backlog',     labels: ['QA'] },
      { meeting: 0, title: 'Update changelog for v2.1 release', assignee: 'sara@acme.com', due: d(14), priority: 'low',    status: 'backlog',     labels: ['Docs'] },
      // Standup tasks
      { meeting: 1, title: 'Set up staging environment on AWS', assignee: 'zaid@acme.com', due: d(-4), priority: 'urgent', status: 'in_progress', labels: ['Infra'] },
      { meeting: 1, title: 'Review open pull requests',          assignee: 'sara@acme.com', due: d(1),  priority: 'medium', status: 'backlog',     labels: ['Engineering'] },
      // Onboarding tasks
      { meeting: 2, title: 'Share onboarding checklist with Acme', assignee: 'ali@acme.com', due: d(0), priority: 'high', status: 'in_progress', labels: ['Client'] },
      { meeting: 2, title: 'Review and approve NDA renewal',    assignee: 'ali@acme.com',  due: d(3),  priority: 'high',   status: 'backlog',     labels: ['Legal'] },
      { meeting: 2, title: 'Schedule follow-up call for week 2', assignee:'nida@acme.com', due: d(5),  priority: 'medium', status: 'backlog',     labels: ['Client'] },
      // Done tasks
      { meeting: 2, title: 'Send Acme welcome email',           assignee: 'ali@acme.com',  due: d(-5), priority: 'high',  status: 'done',        labels: ['Client'] },
      { meeting: 4, title: 'Create Jira project for Q3',        assignee: 'sara@acme.com', due: d(-7), priority: 'medium',status: 'done',        labels: ['Engineering'] },
      { meeting: 4, title: 'Share Q2 retrospective notes',      assignee: 'nida@acme.com', due: d(-6), priority: 'low',   status: 'done',        labels: [] },
    ];

    for (const t of tasks) {
      await client.query(
        `INSERT INTO tasks
           (meeting_id, workspace_id, title, assignee_name, assignee_email,
            due_date, priority, status, labels)
         SELECT $1,$2,$3,
           (SELECT name FROM team_members WHERE workspace_id=$2 AND email=$4),
           $4,$5,$6,$7,$8
         WHERE NOT EXISTS (
           SELECT 1 FROM tasks WHERE meeting_id=$1 AND title=$3
         )`,
        [
          meetings[t.meeting].id, workspaceId,
          t.title, t.assignee, t.due,
          t.priority, t.status, t.labels,
        ]
      );
    }

    // ── Decisions ─────────────────────────────────────────────
    const decisions = [
      { meeting: 0, description: 'Go with checklist onboarding (Option B) over wizard flow', owner: 'Nida Rehman' },
      { meeting: 0, description: 'API v2.1 will be the final version before public launch',  owner: 'Sara Malik' },
      { meeting: 0, description: 'Q3 launch target stays at Aug 15 — no scope change',       owner: 'Ali Khan' },
      { meeting: 2, description: 'Onboarding will use 30-day trial with full access',         owner: 'Ali Khan' },
      { meeting: 3, description: 'Kanban layout approved for task board v2',                   owner: 'Nida Rehman' },
    ];

    for (const d of decisions) {
      await client.query(
        `INSERT INTO decisions (meeting_id, workspace_id, description, owner_name)
         VALUES ($1,$2,$3,$4)`,
        [meetings[d.meeting].id, workspaceId, d.description, d.owner]
      );
    }

    // ── Integrations ──────────────────────────────────────────
    const integrations = ['slack', 'notion', 'jira'];
    for (const provider of integrations) {
      await client.query(
        `INSERT INTO integrations (workspace_id, provider, enabled, config)
         VALUES ($1,$2,TRUE,'{}') ON CONFLICT (workspace_id, provider) DO NOTHING`,
        [workspaceId, provider]
      );
    }

    // ── Notifications ─────────────────────────────────────────
    const adminId = userByEmail['ali@acme.com']?.id;
    if (adminId) {
      const notifs = [
        { type: 'meeting_done',   title: 'Q3 Roadmap Planning processed',  body: '12 tasks extracted, 3 decisions captured' },
        { type: 'task_assigned',  title: 'New task assigned to you',       body: 'Share onboarding checklist with Acme — due today' },
        { type: 'overdue',        title: '3 tasks are overdue',            body: 'Review and action needed' },
      ];
      for (const n of notifs) {
        await client.query(
          'INSERT INTO notifications (user_id, type, title, body) VALUES ($1,$2,$3,$4)',
          [adminId, n.type, n.title, n.body]
        );
      }
    }

    await client.query('COMMIT');

    console.log('\n✓ Seed complete!\n');
    console.log('  Workspace: Acme Corp');
    console.log('  Login:     ali@acme.com / password123');
    console.log(`  Meetings:  ${meetings.length}`);
    console.log(`  Tasks:     ${tasks.length}`);
    console.log(`  Decisions: ${decisions.length}`);
    console.log('\nOpen http://localhost:5173 to explore.\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
