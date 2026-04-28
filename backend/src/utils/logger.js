/**
 * Structured Logger
 * JSON output in production (for log aggregators like Datadog, Logtail, etc.)
 * Pretty console output in development
 * Never logs secrets — sanitizes sensitive fields automatically
 */

const SENSITIVE_KEYS = new Set([
  'password', 'password_hash', 'token', 'secret', 'api_key', 'apikey',
  'authorization', 'cookie', 'jwt', 'access_token', 'refresh_token',
]);

function sanitize(obj, depth = 0) {
  if (depth > 5 || obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => sanitize(item, depth + 1));

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = sanitize(value, depth + 1);
    }
  }
  return result;
}

const isDev = process.env.NODE_ENV !== 'production';

function formatDev(level, message, meta) {
  const timestamp = new Date().toISOString().slice(11, 23);
  const colors = { info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m', debug: '\x1b[90m' };
  const reset = '\x1b[0m';
  const color = colors[level] || '';
  const metaStr = meta && Object.keys(meta).length > 0 ? ' ' + JSON.stringify(sanitize(meta)) : '';
  console[level === 'error' ? 'error' : 'log'](`${color}[${timestamp}] ${level.toUpperCase()}${reset} ${message}${metaStr}`);
}

function formatProd(level, message, meta) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta ? sanitize(meta) : {}),
    service: 'meetsync-api',
    env: process.env.NODE_ENV,
  };
  console[level === 'error' ? 'error' : 'log'](JSON.stringify(entry));
}

const log = {
  info:  (msg, meta) => isDev ? formatDev('info',  msg, meta) : formatProd('info',  msg, meta),
  warn:  (msg, meta) => isDev ? formatDev('warn',  msg, meta) : formatProd('warn',  msg, meta),
  error: (msg, meta) => isDev ? formatDev('error', msg, meta) : formatProd('error', msg, meta),
  debug: (msg, meta) => {
    if (process.env.LOG_LEVEL === 'debug') {
      isDev ? formatDev('debug', msg, meta) : formatProd('debug', msg, meta);
    }
  },
  // HTTP request logger middleware
  http: (req, res, duration) => {
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    log[level](`${req.method} ${req.path} ${res.statusCode}`, {
      duration_ms: Math.round(duration),
      ip: req.ip,
      user_id: req.user?.id,
    });
  },
};

/**
 * Express request logging middleware
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => log.http(req, res, Date.now() - start));
  next();
}

module.exports = { log, requestLogger };
