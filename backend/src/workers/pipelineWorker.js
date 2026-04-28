/**
 * Pipeline Worker
 *
 * Two modes:
 *   1. In-process (default for dev): auto-started by index.js alongside the API server.
 *   2. Standalone (scaling):         npm run worker  —  a separate process for high volume.
 *
 * Usage (standalone):
 *   npm run worker
 *   WORKER_CONCURRENCY=5 npm run worker
 */

const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { processMeeting } = require('../services/aiPipeline');

/**
 * Create and start a BullMQ worker that consumes the 'meeting-pipeline' queue.
 * Returns the Worker instance so the caller can close it on shutdown.
 */
function startWorker() {
  const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });

  connection.on('error', (err) => {
    console.error('[Worker] Redis connection error:', err.message);
  });

  const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '2', 10);

  const worker = new Worker(
    'meeting-pipeline',
    async (job) => {
      console.log(`[Worker] Processing job ${job.id} — meetingId: ${job.data.meetingId}`);

      const { meetingId, localPath } = job.data;

      // Report progress back to the queue (visible in Bull Board dashboard)
      await job.updateProgress(5);

      await processMeeting(meetingId, localPath, async (step, pct) => {
        await job.updateProgress(pct);
        console.log(`[Worker] ${meetingId} — ${step} (${pct}%)`);
      });

      return { success: true, meetingId };
    },
    {
      connection,
      concurrency,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`[Worker] Job ${job.id} completed — meeting ${result.meetingId}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Error:', err);
  });

  console.log(`[Worker] Pipeline worker started — concurrency: ${concurrency}`);

  return worker;
}

// ── Standalone mode: node src/workers/pipelineWorker.js ────────────────────
if (require.main === module) {
  require('dotenv').config();
  const worker = startWorker();

  console.log('[Worker] Waiting for jobs on queue: meeting-pipeline...');

  process.on('SIGTERM', async () => {
    console.log('[Worker] Shutting down...');
    await worker.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('[Worker] Shutting down...');
    await worker.close();
    process.exit(0);
  });
}

module.exports = { startWorker };
