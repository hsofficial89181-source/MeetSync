/**
 * Zoom Webhook Receiver
 *
 * Handles:
 *  - recording.completed  → auto-download and process meeting
 *  - meeting.ended        → log event
 *  - Zoom URL validation challenge
 *
 * Setup in Zoom Marketplace:
 *  1. Create a Server-to-Server OAuth app
 *  2. Set webhook URL to: https://yourdomain.com/api/webhooks/zoom
 *  3. Subscribe to: recording.completed
 *  4. Copy ZOOM_WEBHOOK_SECRET_TOKEN to .env
 */

const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { pool } = require('../models/migrate');
const { enqueueMeeting } = require('../services/aiPipeline');

const router = express.Router();

/**
 * Verify Zoom webhook signature
 */
function verifyZoomSignature(req) {
  const timestamp = req.headers['x-zm-request-timestamp'];
  const signature = req.headers['x-zm-signature'];
  if (!timestamp || !signature) return false;

  const message = `v0:${timestamp}:${JSON.stringify(req.body)}`;
  const hash = crypto
    .createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET_TOKEN || '')
    .update(message)
    .digest('hex');

  return signature === `v0=${hash}`;
}

/**
 * POST /api/webhooks/zoom
 */
router.post('/zoom', express.json(), async (req, res) => {
  const { event, payload } = req.body;

  // Zoom URL validation challenge (required when first registering webhook)
  if (event === 'endpoint.url_validation') {
    const hash = crypto
      .createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET_TOKEN || '')
      .update(payload.plainToken)
      .digest('hex');
    return res.json({ plainToken: payload.plainToken, encryptedToken: hash });
  }

  // Verify signature for all other events
  if (!verifyZoomSignature(req)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Log webhook event
  await pool.query(
    'INSERT INTO webhook_events (provider, event_type, payload) VALUES ($1, $2, $3)',
    ['zoom', event, JSON.stringify(req.body)]
  );

  res.status(200).json({ received: true });

  // Process asynchronously
  if (event === 'recording.completed') {
    handleZoomRecording(payload).catch(err =>
      console.error('Zoom webhook processing failed:', err.message)
    );
  }
});

async function handleZoomRecording(payload) {
  const { object } = payload;
  const meetingId_zoom = object.id;
  const topic = object.topic || 'Zoom Meeting';
  const duration = object.duration * 60; // minutes → seconds

  // Find the best recording file (prefer MP4, fallback to M4A)
  const recordings = object.recording_files || [];
  const audioFile = recordings.find(f => f.file_type === 'M4A') ||
                    recordings.find(f => f.file_type === 'MP4') ||
                    recordings[0];

  if (!audioFile?.download_url) {
    console.warn('Zoom: No downloadable recording found for meeting:', topic);
    return;
  }

  // Get a workspace to assign this meeting to
  // In production you'd match by Zoom account ID → workspace
  const { rows: [workspace] } = await pool.query('SELECT id FROM workspaces LIMIT 1');
  if (!workspace) return;

  // Check if we already processed this Zoom meeting
  const { rows: existing } = await pool.query(
    'SELECT id FROM meetings WHERE zoom_meeting_id = $1', [String(meetingId_zoom)]
  );
  if (existing.length > 0) {
    console.log('Zoom: Already processed meeting', meetingId_zoom);
    return;
  }

  // Create meeting record
  const meetingId = uuidv4();
  await pool.query(
    `INSERT INTO meetings (id, workspace_id, title, source, duration_seconds, status, zoom_meeting_id)
     VALUES ($1, $2, $3, 'zoom', $4, 'pending', $5)`,
    [meetingId, workspace.id, topic, duration, String(meetingId_zoom)]
  );

  console.log(`Zoom: Downloading recording for "${topic}"...`);

  // Download recording
  const tmpPath = `/tmp/zoom-${meetingId}.m4a`;
  const token = await getZoomAccessToken();

  const response = await axios({
    url: audioFile.download_url,
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

  console.log(`Zoom: Downloaded "${topic}", enqueuing for processing...`);

  // Enqueue for AI processing
  await enqueueMeeting(meetingId, tmpPath);
}

/**
 * Get Zoom Server-to-Server OAuth access token
 */
async function getZoomAccessToken() {
  const credentials = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
  ).toString('base64');

  const { data } = await axios.post(
    'https://zoom.us/oauth/token?grant_type=account_credentials&account_id=' +
    process.env.ZOOM_ACCOUNT_ID,
    null,
    { headers: { Authorization: `Basic ${credentials}` } }
  );

  return data.access_token;
}

module.exports = router;
