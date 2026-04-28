/**
 * Google Meet / Drive Webhook Receiver
 *
 * Google Meet saves recordings to Google Drive automatically.
 * We use Drive's push notification API to get notified when
 * a new recording lands, then download and process it.
 *
 * Setup:
 *  1. Create a Google Cloud project + enable Drive API
 *  2. Set up OAuth 2.0 credentials
 *  3. Call POST /api/webhooks/google/setup to register the watch
 *  4. Google will POST to /api/webhooks/google/drive on new files
 *
 * Docs: https://developers.google.com/drive/api/guides/push
 */

const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { pool } = require('../models/migrate');
const { enqueueMeeting } = require('../services/aiPipeline');

const router = express.Router();

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';

// Token cache (in production: store in Redis/DB)
let cachedToken = null;
let tokenExpiry = 0;

async function getGoogleAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60000) return cachedToken;

  const { data } = await axios.post(GOOGLE_TOKEN_URL, {
    client_id:     process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    grant_type:    'refresh_token',
  });

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

/**
 * POST /api/webhooks/google/drive
 * Google Drive push notification — fires when any watched file changes
 */
router.post('/google/drive', express.json(), async (req, res) => {
  // Acknowledge immediately (Google requires fast response)
  res.status(200).send();

  const resourceId = req.headers['x-goog-resource-id'];
  const state      = req.headers['x-goog-resource-state'];

  if (state !== 'add' && state !== 'update') return;

  // Log the event
  await pool.query(
    'INSERT INTO webhook_events (provider, event_type, payload) VALUES ($1, $2, $3)',
    ['google', 'drive.change', JSON.stringify({ resourceId, state, headers: req.headers })]
  );

  // Check for new Meet recordings
  handleGoogleDriveChange(resourceId).catch(err =>
    console.error('Google Drive webhook failed:', err.message)
  );
});

async function handleGoogleDriveChange(resourceId) {
  const token = await getGoogleAccessToken();

  // List recently modified MP4 files in "Meet Recordings" folder
  const { data } = await axios.get(`${DRIVE_API}/files`, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      q: `mimeType='video/mp4' and name contains 'Meet' and trashed=false`,
      orderBy: 'modifiedTime desc',
      pageSize: 5,
      fields: 'files(id,name,size,createdTime,videoMediaMetadata)',
    },
  });

  const files = data.files || [];

  for (const file of files) {
    // Skip if already processed
    const { rows: existing } = await pool.query(
      'SELECT id FROM meetings WHERE google_event_id = $1', [file.id]
    );
    if (existing.length > 0) continue;

    await processGoogleMeetRecording(file, token);
  }
}

async function processGoogleMeetRecording(file, token) {
  const { rows: [workspace] } = await pool.query('SELECT id FROM workspaces LIMIT 1');
  if (!workspace) return;

  const meetingId = uuidv4();
  const title = file.name.replace(/\.mp4$/i, '').replace(/_/g, ' ');
  const duration = file.videoMediaMetadata?.durationMillis
    ? Math.floor(file.videoMediaMetadata.durationMillis / 1000)
    : null;

  await pool.query(
    `INSERT INTO meetings (id, workspace_id, title, source, duration_seconds, status, google_event_id)
     VALUES ($1, $2, $3, 'google_meet', $4, 'pending', $5)`,
    [meetingId, workspace.id, title, duration, file.id]
  );

  console.log(`Google Meet: Downloading "${title}"...`);

  // Download file from Drive
  const tmpPath = `/tmp/gmeet-${meetingId}.mp4`;
  const response = await axios({
    url: `${DRIVE_API}/files/${file.id}?alt=media`,
    method: 'GET',
    responseType: 'stream',
    headers: { Authorization: `Bearer ${token}` },
  });

  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(tmpPath);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  await enqueueMeeting(meetingId, tmpPath);
  console.log(`Google Meet: Enqueued "${title}" for processing`);
}

/**
 * POST /api/webhooks/google/setup
 * Register a Drive watch channel (call once to activate notifications)
 */
router.post('/google/setup', async (req, res, next) => {
  try {
    const token = await getGoogleAccessToken();
    const channelId = uuidv4();

    const { data } = await axios.post(
      `${DRIVE_API}/files/watch`,
      {
        id: channelId,
        type: 'web_hook',
        address: `${process.env.PUBLIC_URL}/api/webhooks/google/drive`,
        expiration: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json({
      success: true,
      channelId: data.id,
      resourceId: data.resourceId,
      expiration: new Date(parseInt(data.expiration)).toISOString(),
      message: 'Google Drive watch registered. Recordings will auto-import.',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
