/**
 * Graceful Shutdown
 *
 * On SIGTERM/SIGINT:
 *  1. Stop accepting new connections
 *  2. Wait for in-flight requests to finish (up to 30s)
 *  3. Close DB pool and Redis connections
 *  4. Exit cleanly
 *
 * This prevents dropped requests during deployments.
 */

const { log } = require('../utils/logger');

function setupGracefulShutdown(server, { pool, redisConnection, pipelineQueue, worker } = {}) {
  let isShuttingDown = false;

  async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    log.info(`Received ${signal}. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(async () => {
      log.info('HTTP server closed. Cleaning up...');

      try {
        // Close BullMQ worker (in-process mode)
        if (worker) {
          await worker.close();
          log.info('BullMQ worker closed');
        }

        // Close BullMQ queue connection
        if (pipelineQueue) {
          await pipelineQueue.close();
          log.info('BullMQ queue closed');
        }

        // Close Redis
        if (redisConnection) {
          await redisConnection.quit();
          log.info('Redis connection closed');
        }

        // Close Postgres pool
        if (pool) {
          await pool.end();
          log.info('Postgres pool closed');
        }

        log.info('Graceful shutdown complete');
        process.exit(0);
      } catch (err) {
        log.error('Error during shutdown', { error: err.message });
        process.exit(1);
      }
    });

    // Force exit after 30 seconds if requests don't drain
    setTimeout(() => {
      log.error('Forced shutdown after 30s timeout');
      process.exit(1);
    }, 30000);
  }

  // Intercept all shutdown signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  // Catch unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    log.error('Unhandled promise rejection', { reason: String(reason) });
  });

  // Catch uncaught exceptions
  process.on('uncaughtException', (err) => {
    log.error('Uncaught exception', { error: err.message, stack: err.stack });
    shutdown('uncaughtException');
  });
}

module.exports = { setupGracefulShutdown };
