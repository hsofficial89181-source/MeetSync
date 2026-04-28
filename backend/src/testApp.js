/**
 * Test App Factory
 *
 * Creates an Express app instance without binding to a port.
 * Used by supertest in API integration tests.
 * Skips scheduled jobs and WebSocket server.
 */

require('dotenv').config({ path: '.env.test', override: false });
require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const { apiLimiter }         = require('./middleware/rateLimiter');
const { xssSanitizer, securityHeaders, requestSizeGuard } = require('./middleware/security');
const { requestLogger }      = require('./utils/logger');

const authRouter          = require('./routes/auth');
const meetingsRouter      = require('./routes/meetings');
const tasksRouter         = require('./routes/tasks');
const integrationsRouter  = require('./routes/integrations');
const teamRouter          = require('./routes/team');
const analyticsRouter     = require('./routes/analytics');
const searchRouter        = require('./routes/search');
const notificationsRouter = require('./routes/notifications');
const settingsRouter      = require('./routes/settings');
const exportRouter        = require('./routes/export');
const healthRouter        = require('./routes/health');

function createApp() {
  const app = express();

  app.use(cors({ origin: '*' }));
  app.use(securityHeaders);
  app.use(express.json({ limit: '10mb' }));
  app.use(requestSizeGuard);
  app.use(xssSanitizer);

  // Skip rate limiting in tests
  if (process.env.NODE_ENV !== 'test') {
    app.use(apiLimiter);
  }

  app.use('/api/auth',          authRouter);
  app.use('/api/meetings',      meetingsRouter);
  app.use('/api/tasks',         tasksRouter);
  app.use('/api/integrations',  integrationsRouter);
  app.use('/api/team',          teamRouter);
  app.use('/api/analytics',     analyticsRouter);
  app.use('/api/search',        searchRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/settings',      settingsRouter);
  app.use('/api/export',        exportRouter);
  app.use('/api/health',        healthRouter);

  app.use('/api/*', (req, res) => res.status(404).json({ error: 'Route not found' }));

  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
