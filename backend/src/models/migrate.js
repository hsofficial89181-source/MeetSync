require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const MIGRATIONS = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS workspaces (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  slug       VARCHAR(100) UNIQUE NOT NULL,
  settings   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(200) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) DEFAULT 'member',
  avatar_url    TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meetings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  title             VARCHAR(255) NOT NULL,
  source            VARCHAR(50) DEFAULT 'upload',
  duration_seconds  INTEGER,
  participant_count INTEGER DEFAULT 0,
  audio_url         TEXT,
  transcript        JSONB,
  summary           TEXT,
  status            VARCHAR(50) DEFAULT 'pending',
  error_message     TEXT,
  zoom_meeting_id   VARCHAR(100),
  google_event_id   VARCHAR(100),
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id       UUID REFERENCES meetings(id) ON DELETE CASCADE,
  workspace_id     UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  assignee_name    VARCHAR(100),
  assignee_email   VARCHAR(200),
  due_date         DATE,
  priority         VARCHAR(20) DEFAULT 'medium',
  status           VARCHAR(50) DEFAULT 'backlog',
  labels           TEXT[],
  source_quote     TEXT,
  jira_issue_id    VARCHAR(100),
  notion_page_id   VARCHAR(100),
  linear_issue_id  VARCHAR(100),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS decisions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id   UUID REFERENCES meetings(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  owner_name   VARCHAR(100),
  agreed_by    TEXT[],
  source_quote TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name             VARCHAR(100) NOT NULL,
  email            VARCHAR(200) NOT NULL,
  slack_user_id    VARCHAR(50),
  jira_account_id  VARCHAR(100),
  notion_user_id   VARCHAR(100),
  linear_user_id   VARCHAR(100),
  role             VARCHAR(100),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, email)
);

CREATE TABLE IF NOT EXISTS integrations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  provider       VARCHAR(50) NOT NULL,
  enabled        BOOLEAN DEFAULT FALSE,
  config         JSONB DEFAULT '{}',
  last_synced_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, provider)
);

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  link       TEXT,
  read       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider   VARCHAR(50) NOT NULL,
  event_type VARCHAR(100),
  payload    JSONB,
  processed  BOOLEAN DEFAULT FALSE,
  error      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_workspace ON meetings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status    ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_created   ON meetings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_meeting      ON tasks(meeting_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace    ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status       ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee     ON tasks(assignee_email);
CREATE INDEX IF NOT EXISTS idx_tasks_due          ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_decisions_meeting  ON decisions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_notifs_user        ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens     ON refresh_tokens(token);

-- Task comments (previously created lazily in route handlers)
CREATE TABLE IF NOT EXISTS task_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  user_name  VARCHAR(100),
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comments_task ON task_comments(task_id);

-- Share links for read-only public meeting views
CREATE TABLE IF NOT EXISTS share_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id  UUID REFERENCES meetings(id) ON DELETE CASCADE,
  token       VARCHAR(64) UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ,
  view_count  INTEGER DEFAULT 0,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);

-- OTP table for forgot-password flow
CREATE TABLE IF NOT EXISTS password_reset_otps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  otp_hash   TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_user ON password_reset_otps(user_id);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running migrations...');
    await client.query(MIGRATIONS);
    console.log('Migrations complete.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) migrate();
module.exports = { pool };

// Add this at the end of the MIGRATIONS string before the closing backtick:
// (These tables were previously created lazily in route handlers)
