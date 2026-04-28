/**
 * /api/meetings  — workspace-scoped, auth required on all routes
 *
 * POST /              upload audio → enqueue pipeline job
 * GET  /              list meetings
 * GET  /:id           get meeting + transcript
 * GET  /:id/tasks     tasks for a meeting
 * GET  /:id/decisions decisions for a meeting
 * DELETE /:id         delete meeting
 */

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');
const { pool }        = require('../models/migrate');
const { enqueueMeeting, cancelMeeting } = require('../services/aiPipeline'); // ← queue, not direct
const { requireAuth }    = require('../middleware/auth');
const { uploadLimiter }  = require('../middleware/rateLimiter');
const { validateAudioFile } = require('../middleware/fileValidator');
const { log } = require('../utils/logger');

const router = express.Router();
router.use(requireAuth); // ← ALL routes protected

const wid = (req) => req.user.workspace_id;

const upload = multer({
  dest: '/tmp/meetsync-uploads/',
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4','.mp3','.m4a','.wav','.ogg','.webm'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`Unsupported file type: ${ext}`));
  },
});

/**
 * POST /api/meetings  — upload and enqueue
 */
router.post(
  '/',
  uploadLimiter,
  upload.single('audio'),
  validateAudioFile,
  async (req, res, next) => {
    if (!req.file) return res.status(400).json({ error: 'No audio file provided' });

    const meetingId = uuidv4();
    const title  = req.body.title || req.file.originalname.replace(/\.[^.]+$/, '');
    const source = req.body.source || 'upload';

    // Give temp file the proper extension for MIME detection downstream
    const ext      = path.extname(req.file.originalname);
    const localPath = req.file.path + ext;
    fs.renameSync(req.file.path, localPath);

    try {
      await pool.query(
        `INSERT INTO meetings (id, workspace_id, title, source, status, created_by)
         VALUES ($1,$2,$3,$4,'pending',$5)`,
        [meetingId, wid(req), title, source, req.user.id]
      );

      // Respond immediately — processing happens async
      res.status(202).json({
        meetingId, title, status: 'pending',
        message: 'Uploaded. AI processing started.',
      });

      // Enqueue for AI processing
      setImmediate(async () => {
        try {
          await enqueueMeeting(meetingId, localPath);
          log.info('Meeting enqueued', { meetingId, title });
        } catch (err) {
          log.error('Failed to enqueue meeting', { meetingId, error: err.message });
          await pool.query(
            "UPDATE meetings SET status='error', error_message=$1 WHERE id=$2",
            [err.message, meetingId]
          );
          fs.unlink(localPath, () => {});
        }
      });

    } catch (err) {
      fs.unlink(localPath, () => {});
      next(err);
    }
  }
);

/**
 * GET /api/meetings
 */
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.*,
              COUNT(DISTINCT t.id)::int AS task_count,
              COUNT(DISTINCT d.id)::int AS decision_count
       FROM meetings m
       LEFT JOIN tasks     t ON t.meeting_id = m.id
       LEFT JOIN decisions d ON d.meeting_id = m.id
       WHERE m.workspace_id = $1
       GROUP BY m.id
       ORDER BY m.created_at DESC
       LIMIT 100`,
      [wid(req)]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

/**
 * GET /api/meetings/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM meetings WHERE id=$1 AND workspace_id=$2',
      [req.params.id, wid(req)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Meeting not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

/**
 * GET /api/meetings/:id/tasks
 */
router.get('/:id/tasks', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM tasks WHERE meeting_id=$1 AND workspace_id=$2 ORDER BY created_at',
      [req.params.id, wid(req)]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

/**
 * GET /api/meetings/:id/decisions
 */
router.get('/:id/decisions', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM decisions WHERE meeting_id=$1 AND workspace_id=$2 ORDER BY created_at',
      [req.params.id, wid(req)]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

/**
 * POST /api/meetings/:id/cancel
 * Stop a meeting that is currently being processed or waiting in queue
 */
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const { rows: [meeting] } = await pool.query(
      'SELECT * FROM meetings WHERE id=$1 AND workspace_id=$2',
      [req.params.id, wid(req)]
    );
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (meeting.status === 'done') return res.status(400).json({ error: 'Cannot cancel a completed meeting' });
    if (meeting.status === 'cancelled') return res.status(400).json({ error: 'Meeting is already cancelled' });

    await cancelMeeting(req.params.id);
    res.json({ success: true, status: 'cancelled' });
  } catch (err) { next(err); }
});

/**
 * POST /api/meetings/:id/retry
 * Re-enqueue a failed meeting for reprocessing
 */
router.post('/:id/retry', async (req, res, next) => {
  try {
    const { rows: [meeting] } = await pool.query(
      "SELECT * FROM meetings WHERE id=$1 AND workspace_id=$2 AND status='error'",
      [req.params.id, wid(req)]
    );
    if (!meeting) return res.status(404).json({ error: 'Meeting not found or not in error state' });

    // Reset status and clear error
    await pool.query(
      "UPDATE meetings SET status='pending', error_message=NULL, updated_at=NOW() WHERE id=$1",
      [req.params.id]
    );

    // Retry not available without persistent storage (S3 disabled)
    return res.status(400).json({ error: 'Retry not available — persistent storage (S3) disabled' });
  } catch (err) { next(err); }
});

/**
 * DELETE /api/meetings/:id
 * Only allowed for meetings with status 'error' or 'cancelled'
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows: [meeting] } = await pool.query(
      'SELECT status FROM meetings WHERE id=$1 AND workspace_id=$2',
      [req.params.id, wid(req)]
    );
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (!['error', 'cancelled'].includes(meeting.status)) {
      return res.status(400).json({ error: 'Only failed or cancelled meetings can be deleted' });
    }
    await pool.query('DELETE FROM meetings WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
