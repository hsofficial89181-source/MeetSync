# MeetSync AI — Deployment & Architecture Guide

## Local Development (5 minutes)

### Prerequisites
- Node.js 18+
- Docker + Docker Compose
- API keys: Anthropic, OpenAI

### Step 1 — Start databases
```bash
docker-compose up -d
# Starts PostgreSQL on :5432 and Redis on :6379
```

### Step 2 — Backend setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your API keys (minimum: ANTHROPIC_API_KEY, OPENAI_API_KEY)
npm run migrate   # Creates all tables
npm run dev       # Starts on :3001
```

### Step 3 — Frontend setup
```bash
cd frontend
npm install
npm run dev       # Starts on :5173
```

Open http://localhost:5173 — you're live.

---

## Architecture Overview

```
Browser (React)
    │  HTTP /api/*
    │  WS  /ws
    ▼
Express Server (:3001)
    ├── POST /api/meetings     → multer upload → S3 → queue job
    ├── GET  /api/meetings     → Postgres query
    ├── GET  /api/tasks        → Postgres query
    ├── PATCH /api/tasks/:id   → status update → Jira sync
    └── POST /api/integrations → save config
    
    WebSocket Server
    └── broadcasts pipeline progress per meetingId

AI Pipeline (async, in-process)
    ├── 1. OpenAI Whisper    → transcript [{speaker,text,start,end}]
    ├── 2. Claude Sonnet     → {tasks[], decisions[], summary}
    ├── 3. Team Matcher      → fuzzy match names → assignee_email
    ├── 4. Save to Postgres
    └── 5. Push integrations → Jira + Notion + Slack (parallel)

Integrations
    ├── Slack   → chat.postMessage + DMs to assignees
    ├── Notion  → pages.create in target database
    └── Jira    → issues.create with priority/assignee/due date
```

---

## Production Deployment

### Option A — Railway (recommended, free tier available)

```bash
# Install Railway CLI
npm i -g @railway/cli
railway login

# From project root
railway new
railway add --database postgresql
railway add --database redis
railway up

# Set env vars
railway variables set ANTHROPIC_API_KEY=sk-ant-...
railway variables set OPENAI_API_KEY=sk-...
# ... etc
```

### Option B — Render

1. Create a new **Web Service** → connect your GitHub repo
2. Set **Build Command**: `cd backend && npm install`
3. Set **Start Command**: `cd backend && npm run migrate && npm start`
4. Add a **PostgreSQL** database add-on
5. Add a **Redis** add-on
6. Set all env vars in the dashboard

### Option C — Docker (self-hosted)

```dockerfile
# Dockerfile (backend)
FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --production
COPY backend/src ./src
EXPOSE 3001
CMD ["node", "src/index.js"]
```

```dockerfile
# Dockerfile (frontend)
FROM node:18-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

---

## Scaling Considerations

### For high volume (100+ meetings/day)
Move the AI pipeline to a separate **BullMQ worker process**:

```bash
# Run workers separately
npm run worker   # processes jobs from Redis queue
npm start        # API server only (no pipeline work)
```

The worker file (`src/worker.js`) pulls jobs off the queue instead of
running in-process. This way you can scale workers independently.

### Speaker Diarization (Production)
Whisper-1 doesn't identify speakers natively. For real speaker labels,
replace the transcription call in `aiPipeline.js` with:

- **AssemblyAI** (easiest): `speaker_labels: true` in the transcription request
- **Deepgram**: `diarize=true` parameter
- **Pyannote** (self-hosted, free): run as a separate microservice

### Audio Storage
For production, ensure `AWS_S3_BUCKET` is set. In development, the
pipeline skips S3 and processes the local temp file directly.

---

## Adding a New Integration

1. Add provider to `SUPPORTED_PROVIDERS` in `routes/integrations.js`
2. Create `services/newIntegration.js` with a `push(tasks, meeting, config)` function
3. Import and call it in `aiPipeline.js` → `pushToIntegrations()`
4. Add the UI card in `frontend/src/components/pages/Integrations.jsx`

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Claude API (task extraction) |
| `OPENAI_API_KEY` | ✅ | Whisper API (transcription) |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis (job queue) |
| `PORT` | — | Server port (default 3001) |
| `FRONTEND_URL` | — | CORS origin (default localhost:5173) |
| `AWS_ACCESS_KEY_ID` | — | S3 audio storage (skip in dev) |
| `AWS_SECRET_ACCESS_KEY` | — | S3 audio storage |
| `AWS_S3_BUCKET` | — | S3 bucket name |
| `SLACK_BOT_TOKEN` | — | Slack integration |
| `NOTION_TOKEN` | — | Notion integration |
| `JIRA_BASE_URL` | — | Jira instance URL |
| `JIRA_EMAIL` | — | Jira account email |
| `JIRA_API_TOKEN` | — | Jira API token |
