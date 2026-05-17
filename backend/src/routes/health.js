/**
 * Health Check Route
 *
 * GET /api/health          — basic liveness probe (always fast)
 * GET /api/health/ready    — readiness probe (checks DB + Redis)
 * GET /api/health/detailed — full system diagnostics (internal only)
 */

const express = require('express');
const { pool } = require('../models/migrate');
const router = express.Router();

const startTime = Date.now();

/**
 * GET /api/health
 * Lightweight liveness check — used by load balancers.
 * Returns 200 immediately without checking dependencies.
 */
router.get('/', (req, res) => {
  res.json({ status: 'ok', version: process.env.npm_package_version || '2.0.0' });
});

/**
 * GET /api/health/ready
 * Readiness probe — returns 503 if DB or Redis is unreachable.
 * Used by Kubernetes/Railway to hold traffic during cold start.
 */
router.get('/ready', async (req, res) => {
  const checks = {};
  let allHealthy = true;

  // Check Postgres
  try {
    await pool.query('SELECT 1');
    checks.postgres = 'ok';
  } catch (err) {
    checks.postgres = `error: ${err.message}`;
    allHealthy = false;
  }

  // Check Redis
  try {
    const IORedis = require('ioredis');
    const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true, connectTimeout: 3000, maxRetriesPerRequest: 1,
    });
    await redis.ping();
    await redis.quit();
    checks.redis = 'ok';
  } catch (err) {
    checks.redis = `error: ${err.message}`;
    allHealthy = false;
  }

  const status = allHealthy ? 'ready' : 'degraded';
  res.status(allHealthy ? 200 : 503).json({ status, checks });
});

/**
 * GET /api/health/detailed
 * Full diagnostics — restrict to internal network in production.
 */
router.get('/detailed', async (req, res) => {
  // In production, restrict to internal IPs
  if (process.env.NODE_ENV === 'production') {
    const ip = req.ip || req.connection.remoteAddress;
    const isInternal = ip === '127.0.0.1' || ip === '::1' || ip?.startsWith('10.') || ip?.startsWith('172.') || ip?.startsWith('192.168.');
    if (!isInternal) return res.status(403).json({ error: 'Forbidden' });
  }

  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const mem = process.memoryUsage();

  // DB stats
  let dbStats = null;
  try {
    const { rows: [counts] } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM meetings)::int AS meetings,
        (SELECT COUNT(*) FROM tasks)::int    AS tasks,
        (SELECT COUNT(*) FROM users)::int    AS users
    `);
    dbStats = counts;
  } catch (err) {
    dbStats = { error: err.message };
  }

  res.json({
    status: 'ok',
    version: '2.0.0',
    uptime_seconds: uptime,
    environment: process.env.NODE_ENV || 'development',
    memory: {
      heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
      rss_mb: Math.round(mem.rss / 1024 / 1024),
    },
    database: dbStats,
    integrations_configured: {
      assemblyai: !!process.env.ASSEMBLYAI_API_KEY,
      openai:     !!process.env.OPENAI_API_KEY,
      slack:      !!process.env.SLACK_BOT_TOKEN,
      notion:     !!process.env.NOTION_TOKEN,
      zoom:       !!process.env.ZOOM_CLIENT_ID,
      s3:         !!process.env.AWS_S3_BUCKET,
      smtp:       !!process.env.SMTP_HOST,
    },
  });
});

module.exports = router;
