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
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, email)
);

CREATE TABLE IF NOT EXISTS integrations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  provider       VARCHAR(50) NOT NULL,
  enabled        BOOLEAN DEFAULT FALSE,
  config         JSONB DEFAULT '{}',
  last_synced_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, provider)
);

-- Migrate integrations to per-user: add user_id column, update unique constraint
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_workspace_id_provider_key;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'integrations_workspace_user_provider_key') THEN
    ALTER TABLE integrations ADD CONSTRAINT integrations_workspace_user_provider_key UNIQUE(workspace_id, user_id, provider);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_integrations_user ON integrations(user_id);

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

-- ── Subscription & Billing ──────────────────────────────────────────────

-- Static reference table for subscription plans
CREATE TABLE IF NOT EXISTS subscription_plans (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(50) UNIQUE NOT NULL,
  name            VARCHAR(100) NOT NULL,
  price_cents     INTEGER NOT NULL,
  interval        VARCHAR(20) DEFAULT 'month',
  hours_limit     INTEGER NOT NULL,
  stripe_price_id TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- One subscription per workspace
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  plan_id                INTEGER REFERENCES subscription_plans(id),
  status                 VARCHAR(50) DEFAULT 'inactive',
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id     TEXT,
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN DEFAULT FALSE,
  canceled_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id)
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace ON subscriptions(workspace_id);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS pending_plan_id INTEGER REFERENCES subscription_plans(id);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS carry_over_seconds INTEGER DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Invoices synced from Stripe
CREATE TABLE IF NOT EXISTS invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  subscription_id   UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE,
  invoice_number    VARCHAR(50) NOT NULL,
  amount_cents      INTEGER NOT NULL,
  currency          VARCHAR(10) DEFAULT 'usd',
  tax_cents         INTEGER DEFAULT 0,
  total_cents       INTEGER NOT NULL,
  status            VARCHAR(50) DEFAULT 'open',
  period_start      TIMESTAMPTZ,
  period_end        TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  pdf_url           TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS plan_id INTEGER REFERENCES subscription_plans(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_workspace ON invoices(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- Per-meeting usage records for quota tracking
CREATE TABLE IF NOT EXISTS usage_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id          UUID REFERENCES meetings(id) ON DELETE CASCADE,
  duration_seconds    INTEGER NOT NULL,
  billing_period_start TIMESTAMPTZ,
  billing_period_end   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_usage_workspace ON usage_records(workspace_id);
CREATE INDEX IF NOT EXISTS idx_usage_period ON usage_records(workspace_id, billing_period_start);

-- Audit log for all subscription changes
CREATE TABLE IF NOT EXISTS subscription_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  action       VARCHAR(100) NOT NULL,
  from_plan    VARCHAR(50),
  to_plan      VARCHAR(50),
  details      JSONB,
  performed_by UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sub_history_workspace ON subscription_history(workspace_id);

-- Per-task integration sync tracking
CREATE TABLE IF NOT EXISTS task_integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID REFERENCES tasks(id) ON DELETE CASCADE,
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  provider        VARCHAR(50) NOT NULL,
  status          VARCHAR(20) DEFAULT 'pending',
  external_id     VARCHAR(200),
  external_meta   JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_task_integrations_task ON task_integrations(task_id);
CREATE INDEX IF NOT EXISTS idx_task_integrations_user ON task_integrations(user_id, provider, status);

-- Seed subscription plans (idempotent)
INSERT INTO subscription_plans (code, name, price_cents, interval, hours_limit, stripe_price_id, sort_order)
VALUES
  ('starter',             'Starter',                   9900,    'month', 10,  NULL, 1),
  ('professional',        'Professional',              29900,   'month', 30,  NULL, 2),
  ('business',            'Business',                  79900,   'month', 80,  NULL, 3),
  ('enterprise',          'Enterprise',               349900,   'month', 350, NULL, 4),
  ('starter_yearly',      'Starter (Yearly)',          99900,   'year',  120,  NULL, 5),
  ('professional_yearly', 'Professional (Yearly)',    349900,   'year',  360,  NULL, 6),
  ('business_yearly',     'Business (Yearly)',        949900,   'year',  960,  NULL, 7),
  ('enterprise_yearly',   'Enterprise (Yearly)',     3999900,   'year',  4200, NULL, 8)
ON CONFLICT (code) DO NOTHING;

-- Add updated_at to team_members for existing databases
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Patch existing yearly plan records with correct pricing (UPDATE for rows already in DB)
UPDATE subscription_plans SET price_cents = 99900,   hours_limit = 120  WHERE code = 'starter_yearly';
UPDATE subscription_plans SET price_cents = 349900,  hours_limit = 360  WHERE code = 'professional_yearly';
UPDATE subscription_plans SET price_cents = 949900,  hours_limit = 960  WHERE code = 'business_yearly';
UPDATE subscription_plans SET price_cents = 3999900, hours_limit = 4200 WHERE code = 'enterprise_yearly';
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
