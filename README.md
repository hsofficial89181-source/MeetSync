# MeetSync AI v2 — Complete Production Codebase

Turns every meeting into executed tasks. Auto-records, transcribes, extracts,
assigns, and syncs — with zero manual effort.

## Quick start

```bash
docker-compose up -d          # Postgres + Redis

cd backend && npm install
cp .env.example .env          # add ANTHROPIC_API_KEY + ASSEMBLYAI_API_KEY
npm run migrate && npm run dev # API on :3001

cd frontend && npm install
npm run dev                   # UI on :5173
```

Open http://localhost:5173, register your workspace, upload a meeting.

## Minimum required env vars

ANTHROPIC_API_KEY    Claude (task extraction)
ASSEMBLYAI_API_KEY   Speaker diarization — recommended
OPENAI_API_KEY       Whisper fallback if no AssemblyAI
DATABASE_URL         postgresql://meetsync:password@localhost:5432/meetsync
REDIS_URL            redis://localhost:6379
JWT_SECRET           any long random string

## What's built

Backend routes: auth, meetings, tasks, integrations, team,
analytics (7 endpoints), search, notifications, settings,
webhooks for Zoom and Google Meet.

Services: AssemblyAI + Whisper transcription, Claude extraction,
Jira + Notion + Slack + Linear push, email notifications,
BullMQ worker queue, Jira bidirectional sync cron.

Frontend pages: Login, Register, Dashboard, Meetings, Meeting Detail
(live pipeline progress), Task Board (Kanban), Analytics (charts),
Search (Cmd+K), Settings (workspace/profile/members), Integrations,
Team — all behind JWT auth guard with notification bell.

See DEPLOY.md for production deployment instructions.
