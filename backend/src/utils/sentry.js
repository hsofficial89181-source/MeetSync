/**
 * Sentry Error Tracking
 *
 * Captures unhandled exceptions and pipeline errors with full context.
 * Zero-cost in development (no-ops when SENTRY_DSN is not set).
 *
 * Setup:
 *   1. Create project at sentry.io
 *   2. Add SENTRY_DSN=https://xxx@ooo.ingest.sentry.io/yyy to .env
 *   3. That's it — errors auto-capture from unhandledRejection and uncaughtException
 *
 * Install: npm install @sentry/node
 */

let Sentry = null;

function initSentry() {
  if (!process.env.SENTRY_DSN) {
    console.log('Sentry: SENTRY_DSN not set, error tracking disabled');
    return;
  }

  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn:         process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release:     `meetsync@2.0.0`,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      // Scrub sensitive data before sending to Sentry
      beforeSend(event) {
        if (event.request?.headers?.authorization) {
          event.request.headers.authorization = '[Filtered]';
        }
        if (event.request?.data?.password) {
          event.request.data.password = '[Filtered]';
        }
        return event;
      },
    });
    console.log('✓ Sentry error tracking initialized');
  } catch (err) {
    console.warn('Sentry init failed (package may not be installed):', err.message);
  }
}

/**
 * Express error handler middleware — reports to Sentry
 * Must be added BEFORE your own error handler in index.js
 */
function sentryErrorHandler() {
  if (!Sentry) return (err, req, res, next) => next(err);
  return Sentry.Handlers.errorHandler();
}

/**
 * Capture a pipeline error with full context
 */
function capturePipelineError(meetingId, error, extra = {}) {
  if (!Sentry) return;
  Sentry.withScope(scope => {
    scope.setTag('component', 'ai-pipeline');
    scope.setContext('meeting', { meetingId, ...extra });
    Sentry.captureException(error);
  });
}

/**
 * Manually capture any error with optional tags
 */
function captureError(error, tags = {}, extra = {}) {
  if (!Sentry) return;
  Sentry.withScope(scope => {
    Object.entries(tags).forEach(([k, v]) => scope.setTag(k, v));
    Object.entries(extra).forEach(([k, v]) => scope.setContext(k, v));
    Sentry.captureException(error);
  });
}

module.exports = { initSentry, sentryErrorHandler, capturePipelineError, captureError };
