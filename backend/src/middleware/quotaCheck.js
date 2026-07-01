/**
 * Quota Check Middleware
 *
 * Validates that a workspace has sufficient meeting-hour quota
 * before allowing an upload. Used in the POST /api/meetings route.
 */

const { checkQuotaAvailable } = require('../services/usage');

/**
 * Middleware that checks quota after file has been saved by multer.
 * Always uses server-side detection via music-metadata to prevent
 * duration spoofing from the client. The client-provided duration_seconds
 * is intentionally ignored.
 *
 * Expects req.file to be set (multer has processed the file).
 */
async function quotaCheck(req, res, next) {
  if (!req.file) return next();

  const workspaceId = req.user.workspace_id;
  let durationSeconds = null;

  // Always detect duration server-side — never trust client-provided value
  try {
    const { parseStream } = require('music-metadata');
    const fs = require('fs');
    const stream = fs.createReadStream(req.file.path);
    const metadata = await parseStream(stream, { mimeType: req.detectedMimeType || req.file.mimetype });
    stream.destroy();
    durationSeconds = Math.round(metadata.format.duration || 0);
  } catch {
    // If we can't detect duration, allow upload — backend will record actual duration after transcription
    return next();
  }

  if (!durationSeconds || durationSeconds <= 0) {
    return next();
  }

  const MAX_DURATION_SECONDS = 2 * 60 * 60; // 2 hours
  if (durationSeconds > MAX_DURATION_SECONDS) {
    const fs = require('fs');
    fs.unlink(req.file.path, () => {});
    const hrs = Math.floor(durationSeconds / 3600);
    const mins = Math.ceil((durationSeconds % 3600) / 60);
    return res.status(400).json({
      error: `File too long (${hrs}h ${mins}m). Maximum duration is 2 hours.`,
      code: 'duration_exceeded',
    });
  }

  const check = await checkQuotaAvailable(workspaceId, durationSeconds);

  if (!check.allowed) {
    const fs = require('fs');
    fs.unlink(req.file.path, () => {});

    if (check.reason === 'no_subscription') {
      return res.status(402).json({
        error: 'No active subscription. Please choose a plan to start uploading meetings.',
        code: 'no_subscription',
      });
    }

    const remainingMinutes = Math.floor(check.remaining_seconds / 60);
    const requiredMinutes = Math.ceil(check.required_seconds / 60);

    return res.status(402).json({
      error: `Insufficient quota. This file requires ${requiredMinutes} minutes but you have ${remainingMinutes} minutes remaining. Please upgrade your plan.`,
      code: 'insufficient_quota',
      remaining_minutes: remainingMinutes,
      required_minutes: requiredMinutes,
      remaining_seconds: check.remaining_seconds,
      required_seconds: check.required_seconds,
    });
  }

  req.durationSeconds = durationSeconds;
  next();
}

module.exports = { quotaCheck };
