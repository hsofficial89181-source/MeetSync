require('dotenv').config();

const { validateEnv }    = require('./config/validateEnv');
validateEnv();

const express  = require('express');
const cors     = require('cors');
const http     = require('http');
const WebSocket= require('ws');

const { setupWebSocket }       = require('./services/websocket');
const { startScheduledJobs }   = require('./jobs/scheduler');
const { startWorker }          = require('./workers/pipelineWorker');
const { setupGracefulShutdown }= require('./utils/gracefulShutdown');
const { log, requestLogger }   = require('./utils/logger');
const { apiLimiter }           = require('./middleware/rateLimiter');
const { xssSanitizer, httpsRedirect, securityHeaders, requestSizeGuard } = require('./middleware/security');
const { pool }                 = require('./models/migrate');

// ── Route imports ──────────────────────────────────────────────────────────
const authRouter          = require('./routes/auth');
const meetingsRouter      = require('./routes/meetings');
const tasksRouter         = require('./routes/tasks');        // includes /:id/comments
const integrationsRouter  = require('./routes/integrations');
const teamRouter          = require('./routes/team');
const analyticsRouter     = require('./routes/analytics');
const searchRouter        = require('./routes/search');
const notificationsRouter = require('./routes/notifications');
const settingsRouter      = require('./routes/settings');
const exportRouter        = require('./routes/export');
const shareRouter         = require('./routes/share');
const healthRouter        = require('./routes/health');
const webhookZoomRouter   = require('./routes/webhookZoom');
const webhookGoogleRouter = require('./routes/webhookGoogle');

const app    = express();
const server = http.createServer(app);

// WebSocket
const wss = new WebSocket.Server({ server, path: '/ws' });
setupWebSocket(wss);

// ── Middleware ─────────────────────────────────────────────────────────────
app.set('trust proxy', 1);
app.use(httpsRedirect);
app.use(securityHeaders);
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Webhook routes before JSON parser (need raw body for HMAC)
app.use('/api/webhooks', webhookZoomRouter);
app.use('/api/webhooks', webhookGoogleRouter);

app.use(express.json({ limit: '10mb' }));
app.use(requestSizeGuard);
app.use(xssSanitizer);
app.use(requestLogger);
app.use(apiLimiter);

// ── API Routes ─────────────────────────────────────────────────────────────
app.use('/api/health',        healthRouter);
app.use('/api/auth',          authRouter);
app.use('/api/meetings',      meetingsRouter);
app.use('/api/tasks',         tasksRouter);         // GET/PATCH/DELETE tasks + /:id/comments
app.use('/api/integrations',  integrationsRouter);
app.use('/api/team',          teamRouter);
app.use('/api/analytics',     analyticsRouter);
app.use('/api/search',        searchRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/settings',      settingsRouter);
app.use('/api/export',        exportRouter);
app.use('/api/meetings',      shareRouter);         // POST /api/meetings/:id/share, DELETE
app.use('/api/share',         shareRouter);         // GET  /api/share/public/:token

// 404
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Error handler
app.use((err, req, res, next) => {
  log.error(`${req.method} ${req.path}`, { error: err.message, status: err.status });
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ── Start ──────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3001', 10);

server.listen(PORT, () => {
  log.info('MeetSync AI v2.0 started', {
    port: PORT, env: process.env.NODE_ENV || 'development', pid: process.pid,
  });
  startScheduledJobs();
  const pipelineWorker = startWorker();
  setupGracefulShutdown(server, { pool, worker: pipelineWorker });
});
