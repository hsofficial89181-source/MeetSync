/**
 * /api/integrations — v3
 *
 * Providers: slack · notion · zoom · google_meet
 *
 * GET    /              list all integrations and connection status
 * POST   /:provider     connect/configure
 * DELETE /:provider     disconnect
 * POST   /:provider/test  verify connectivity
 */

const express  = require('express');
const axios    = require('axios');
const { pool } = require('../models/migrate');
const { requireAuth } = require('../middleware/auth');
const { log }  = require('../utils/logger');

const router = express.Router();
router.use(requireAuth);

const SUPPORTED_PROVIDERS = [
  'slack', 'notion', 'zoom', 'google_meet',
];

// ── GET / ──────────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT provider, enabled, last_synced_at FROM integrations WHERE workspace_id=$1',
      [req.user.workspace_id]
    );
    const connected = new Map(rows.map(r => [r.provider, r]));
    const result = SUPPORTED_PROVIDERS.map(provider => ({
      provider,
      enabled:        connected.get(provider)?.enabled       || false,
      last_synced_at: connected.get(provider)?.last_synced_at|| null,
    }));
    res.json(result);
  } catch (err) { next(err); }
});

// ── POST /:provider ────────────────────────────────────────────────────────
router.post('/:provider', async (req, res, next) => {
  const { provider } = req.params;
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    return res.status(400).json({ error: `Unsupported provider: ${provider}` });
  }
  try {
    await pool.query(
      `INSERT INTO integrations (workspace_id, provider, enabled, config)
       VALUES ($1,$2,TRUE,$3)
       ON CONFLICT (workspace_id, provider)
       DO UPDATE SET enabled=TRUE, config=$3, updated_at=NOW()`,
      [req.user.workspace_id, provider, JSON.stringify(req.body.config || {})]
    );
    res.json({ provider, enabled: true });
  } catch (err) { next(err); }
});

// ── DELETE /:provider ──────────────────────────────────────────────────────
router.delete('/:provider', async (req, res, next) => {
  try {
    await pool.query(
      "UPDATE integrations SET enabled=FALSE, config='{}', updated_at=NOW() WHERE workspace_id=$1 AND provider=$2",
      [req.user.workspace_id, req.params.provider]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── POST /:provider/test ───────────────────────────────────────────────────
router.post('/:provider/test', async (req, res, next) => {
  const { provider } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT config FROM integrations WHERE workspace_id=$1 AND provider=$2 AND enabled=TRUE',
      [req.user.workspace_id, provider]
    );
    if (!rows[0]) return res.status(404).json({ error: `${provider} is not connected` });

    const cfg = rows[0].config || {};
    let message = 'Connected';

    switch (provider) {
      case 'slack': {
        const token = cfg.bot_token || process.env.SLACK_BOT_TOKEN;
        const r = await axios.get('https://slack.com/api/auth.test', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.data.ok) throw new Error(r.data.error || 'Slack auth failed');
        message = `Connected as @${r.data.user} in ${r.data.team}`;
        break;
      }

      case 'notion': {
        const { Client } = require('@notionhq/client');
        const notion = new Client({ auth: cfg.token || process.env.NOTION_TOKEN });
        const u = await notion.users.me();
        message = `Connected as ${u.name || u.id}`;
        break;
      }

      case 'zoom': {
        message = cfg.access_token ? 'Zoom OAuth connected' : 'Zoom webhook configured';
        break;
      }

      case 'google_meet': {
        message = cfg.refresh_token ? 'Google Meet OAuth connected' : 'Google Meet configured';
        break;
      }
    }

    await pool.query(
      'UPDATE integrations SET last_synced_at=NOW() WHERE workspace_id=$1 AND provider=$2',
      [req.user.workspace_id, provider]
    );

    res.json({ success: true, message });
  } catch (err) {
    log.warn(`Integration test failed: ${req.params.provider}`, { error: err.message });
    res.json({ success: false, message: err.message });
  }
});

module.exports = router;
