const fs = require('fs');

const ALLOWED_MIME_TYPES = new Set([
  'audio/mpeg',       // Standard mp3
  'audio/mp4',        // m4a detected by some systems
  'audio/x-m4a',      // m4a mime type 🎧 (ADDED THIS)
  'audio/wav',        // wav
  'audio/x-wav',      // Extended wav support
  'audio/ogg',        // ogg
  'audio/webm',       // webm
  'video/mp4',        // mp4 video / m4a base container
  'video/webm',       // webm video
]);

const MAX_FILE_SIZE_BYTES = 300 * 1024 * 1024; // 300 MB

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
    return res.status(400).json({ error: 'File too large. Maximum 300 MB.' });
  }

  // 2. Detect real MIME type from magic bytes
  try {
    const { fileTypeFromFile } = await import('file-type');
    const type = await fileTypeFromFile(path);

    // Agar library detect na kar paye to extension baseline check lazmi hona chahiye fallback k liye
    const detectedMime = type ? type.mime : req.file.mimetype;

    if (!ALLOWED_MIME_TYPES.has(detectedMime)) {
      fs.unlink(path, () => {});
      return res.status(400).json({
        error: `Invalid file type: ${detectedMime}. Allowed: mp3, mp4, m4a, wav, ogg, webm.`,
      });
    }
    
    req.detectedMimeType = detectedMime;
    next();
  } catch (err) {
    fs.unlink(path, () => {});
    return res.status(400).json({ error: 'Could not validate file type.' });
  }
}

module.exports = { validateAudioFile };
