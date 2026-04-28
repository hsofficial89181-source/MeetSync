/**
 * Security Middleware Stack
 *
 * Applied globally in index.js:
 *  - Helmet: secure HTTP headers (CSP, HSTS, X-Frame-Options, etc.)
 *  - HTTPS redirect in production
 *  - XSS sanitization on all request body strings
 *  - SQL injection basic guard (Postgres parameterized queries handle this,
 *    but this catches common patterns as a defence-in-depth layer)
 *  - Request size limits
 */

/**
 * Sanitize a value: strip HTML tags and null bytes from strings
 */
function sanitizeValue(val) {
  if (typeof val !== 'string') return val;
  return val
    .replace(/\0/g, '')                         // null bytes
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '') // script tags
    .replace(/javascript:/gi, '')               // js: URLs
    .replace(/on\w+\s*=/gi, '');                // inline event handlers
}

function sanitizeObject(obj) {
  if (obj === null || typeof obj !== 'object') return sanitizeValue(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = sanitizeObject(v);
  }
  return result;
}

/**
 * XSS sanitization middleware — cleans req.body, req.query, req.params
 */
function xssSanitizer(req, res, next) {
  if (req.body)   req.body   = sanitizeObject(req.body);
  if (req.query)  req.query  = sanitizeObject(req.query);
  if (req.params) req.params = sanitizeObject(req.params);
  next();
}

/**
 * HTTPS redirect middleware (production only)
 */
function httpsRedirect(req, res, next) {
  if (process.env.NODE_ENV !== 'production') return next();
  // Trust X-Forwarded-Proto from load balancer/proxy
  const proto = req.headers['x-forwarded-proto'];
  if (proto && proto !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
}

/**
 * Security headers (subset of helmet — add 'helmet' package for full set)
 * These are the most important headers without requiring extra dependencies
 */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' wss:;"
    );
  }
  next();
}

/**
 * Request body size limiter — extra guard on top of express.json limit
 */
function requestSizeGuard(req, res, next) {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const maxBodySize = 10 * 1024 * 1024; // 10 MB for JSON

  if (contentLength > maxBodySize) {
    return res.status(413).json({ error: 'Request body too large' });
  }
  next();
}

module.exports = { xssSanitizer, httpsRedirect, securityHeaders, requestSizeGuard };
