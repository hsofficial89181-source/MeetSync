/**
 * /api/oauth — OAuth 2.0 flows for integrations
 *
 * Providers: slack · notion · zoom · google_meet
 *
 * GET  /:provider/start     → redirects user to provider OAuth consent page
 * GET  /:provider/callback  → exchanges code for token, stores in DB, redirects to frontend
 */

const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { pool } = require('../models/migrate');
const { requireAuth } = require('../middleware/auth');
const { log } = require('../utils/logger');

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const SUPPORTED = ['slack', 'notion', 'zoom', 'google_meet'];

// function callbackUrl(req, provider) {
//   const host = req.headers.host || 'localhost:3001';
//   const protocol = req.protocol || 'http';
//   return `${protocol}://${host}/api/oauth/${provider}/callback`;
// }

function callbackUrl(req, provider) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  return `${baseUrl}/api/oauth/${provider}/callback`;
}

function buildAuthUrl(req, provider, state) {
  switch (provider) {
    case 'slack':
      return (
        'https://slack.com/oauth/v2/authorize?' +
        new URLSearchParams({
          client_id: process.env.SLACK_CLIENT_ID || '',
          scope: 'chat:write,channels:read,users:read,channels:join',
          redirect_uri: callbackUrl(req, 'slack'),
          state,
        })
      );

    case 'notion':
      return (
        'https://api.notion.com/v1/oauth/authorize?' +
        new URLSearchParams({
          client_id: process.env.NOTION_CLIENT_ID || '',
          response_type: 'code',
          owner: 'user',
          redirect_uri: callbackUrl(req, 'notion'),
          state,
        })
      );

    case 'zoom':
      return (
        'https://zoom.us/oauth/authorize?' +
        new URLSearchParams({
          response_type: 'code',
          client_id: process.env.ZOOM_CLIENT_ID || '',
          redirect_uri: callbackUrl(req, 'zoom'),
          state,
        })
      );

    case 'google_meet':
      return (
        'https://accounts.google.com/o/oauth2/v2/auth?' +
        new URLSearchParams({
          response_type: 'code',
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          scope: [
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/calendar.readonly',
            'https://www.googleapis.com/auth/userinfo.email',
          ].join(' '),
          redirect_uri: callbackUrl(req, 'google_meet'),
          access_type: 'offline',
          prompt: 'consent',
          state,
        })
      );

    default:
      return null;
  }
}

async function exchangeCode(req, provider, code) {
  switch (provider) {
    case 'slack': {
      const redirectUri = callbackUrl(req, 'slack');
      const { data } = await axios.post(
        'https://slack.com/api/oauth.v2.access',
        new URLSearchParams({
          code,
          client_id: process.env.SLACK_CLIENT_ID || '',
          client_secret: process.env.SLACK_CLIENT_SECRET || '',
          redirect_uri: redirectUri,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      if (!data.ok) throw new Error(data.error || 'Slack token exchange failed');
      return {
        bot_token: data.access_token,
        team_id: data.team?.id,
        team_name: data.team?.name,
        channel: process.env.SLACK_DEFAULT_CHANNEL || '#general',
      };
    }

    case 'notion': {
      const credentials = Buffer.from(
        `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`
      ).toString('base64');
      const { data } = await axios.post(
        'https://api.notion.com/v1/oauth/token',
        {
          grant_type: 'authorization_code',
          code,
          redirect_uri: callbackUrl(req, 'notion'),
        },
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28',
          },
        }
      );
      return {
        token: data.access_token,
        workspace_name: data.workspace_name,
        bot_id: data.bot_id,
        database_id: data.duplicated_template_id || null,
      };
    }

    case 'zoom': {
      const credentials = Buffer.from(
        `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
      ).toString('base64');
      const { data } = await axios.post(
        'https://zoom.us/oauth/token?' +
          new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: callbackUrl(req, 'zoom'),
          }),
        null,
        { headers: { Authorization: `Basic ${credentials}` } }
      );
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      };
    }

    case 'google_meet': {
      const { data } = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: callbackUrl(req, 'google_meet'),
        grant_type: 'authorization_code',
      });
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        calendar_id: 'primary',
      };
    }

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

// ── GET /:provider/start ────────────────────────────────────────────────────
router.get('/:provider/start', requireAuth, (req, res) => {
  const { provider } = req.params;
  if (!SUPPORTED.includes(provider)) {
    return res.status(400).json({ error: `Unsupported provider: ${provider}` });
  }

  const missingEnv = {
    slack: !process.env.SLACK_CLIENT_ID,
    notion: !process.env.NOTION_CLIENT_ID,
    zoom: !process.env.ZOOM_CLIENT_ID,
    google_meet: !process.env.GOOGLE_CLIENT_ID,
  };

  if (missingEnv[provider]) {
    return res.redirect(
      `${FRONTEND_URL}/oauth/callback?error=${encodeURIComponent(
        `${provider} OAuth is not configured on this server. Please set the CLIENT_ID and CLIENT_SECRET env vars.`
      )}&provider=${provider}`
    );
  }

  const state = jwt.sign(
    { workspace_id: req.user.workspace_id, user_id: req.user.id, provider },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );

  const authUrl = buildAuthUrl(req, provider, state);
  res.json({ url: authUrl });
});

// ── GET /:provider/callback ─────────────────────────────────────────────────
router.get('/:provider/callback', async (req, res) => {
  const { provider } = req.params;
  const { code, state, error: oauthError } = req.query;

  const failRedirect = (msg) =>
    res.redirect(
      `${FRONTEND_URL}/oauth/callback?error=${encodeURIComponent(msg)}&provider=${provider}`
    );

  if (oauthError) return failRedirect(oauthError);
  if (!code || !state) return failRedirect('Missing code or state parameter');

  let payload;
  try {
    payload = jwt.verify(state, process.env.JWT_SECRET);
  } catch {
    return failRedirect('Invalid or expired OAuth state. Please try connecting again.');
  }

  if (payload.provider !== provider) {
    return failRedirect('Provider mismatch in OAuth state.');
  }

  try {
    const config = await exchangeCode(req, provider, code);

    await pool.query(
      `INSERT INTO integrations (workspace_id, provider, enabled, config)
       VALUES ($1, $2, TRUE, $3)
       ON CONFLICT (workspace_id, provider)
       DO UPDATE SET enabled = TRUE, config = $3, updated_at = NOW()`,
      [payload.workspace_id, provider, JSON.stringify(config)]
    );

    log.info(`OAuth connected: ${provider}`, { workspaceId: payload.workspace_id });

    res.redirect(
      `${FRONTEND_URL}/oauth/callback?success=true&provider=${provider}`
    );
  } catch (err) {
    log.warn(`OAuth token exchange failed: ${provider}`, { error: err.message });
    failRedirect(err.message || 'Token exchange failed. Please try again.');
  }
});

module.exports = router;
