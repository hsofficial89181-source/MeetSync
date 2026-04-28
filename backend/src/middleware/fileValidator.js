const fs = require('fs');

const ALLOWED_MIME_TYPES = new Set([
  'audio/mpeg',       // mp3
  'audio/mp4',        // m4a
  'audio/wav',        // wav
  'audio/ogg',        // ogg
  'audio/webm',       // webm
  'video/mp4',        // mp4
  'video/webm',       // webm video
]);

const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

/**
 * Validates uploaded audio/video file using magic bytes (not just extension).
 * Must run AFTER multer has saved the file.
 */
async function validateAudioFile(req, res, next) {
  if (!req.file) return next();

  const { path, size } = req.file;

  // 1. Check file size
  if (size > MAX_FILE_SIZE_BYTES) {
    fs.unlink(path, () => {});
    return res.status(400).json({ error: 'File too large. Maximum 500 MB.' });
  }

  // 2. Detect real MIME type from magic bytes
  try {
    const { fileTypeFromFile } = await import('file-type');
    const type = await fileTypeFromFile(path);
    if (!type || !ALLOWED_MIME_TYPES.has(type.mime)) {
      fs.unlink(path, () => {});
      return res.status(400).json({
        error: `Invalid file type: ${type?.mime || 'unknown'}. Allowed: mp3, mp4, m4a, wav, ogg, webm.`,
      });
    }
    req.detectedMimeType = type.mime;
    next();
  } catch (err) {
    fs.unlink(path, () => {});
    return res.status(400).json({ error: 'Could not validate file type.' });
  }
}

module.exports = { validateAudioFile };
