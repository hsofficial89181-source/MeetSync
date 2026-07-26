/**
 * Usage Service
 *
 * Tracks and calculates meeting-hour usage per workspace per billing period.
 */

const { pool } = require('../db');

/**
 * Get the current billing period for a workspace's subscription
 */
async function getCurrentPeriod(workspaceId) {
  const { rows: [sub] } = await pool.query(
    `SELECT s.current_period_start, s.current_period_end
     FROM subscriptions s
     WHERE s.workspace_id = $1 AND s.status NOT IN ('canceled', 'expired')
     ORDER BY created_at DESC
     LIMIT 1`,
    [workspaceId]
  );

  if (!sub || !sub.current_period_start) {
    return null;
  }

  return {
    start: sub.current_period_start,
    end: sub.current_period_end,
  };
}

/**
 * Get workspace usage summary for the current billing period
 */
async function getWorkspaceUsage(workspaceId) {
  const { rows: [sub] } = await pool.query(
    `SELECT s.*, sp.code AS plan_code, sp.name AS plan_name, sp.hours_limit, sp.price_cents, sp.interval
     FROM subscriptions s
     LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
     WHERE s.workspace_id = $1
     LIMIT 1`,
    [workspaceId]
  );

  if (!sub) {
    return {
      has_subscription: false,
      plan: null,
      status: 'inactive',
      quota_seconds: 0,
      used_seconds: 0,
      remaining_seconds: 0,
      usage_pct: 0,
      period_start: null,
      period_end: null,
    };
  }

  const planQuotaSeconds = (sub.hours_limit || 0) * 3600;
  const period = await getCurrentPeriod(workspaceId);

  let usedSeconds = 0;
  if (period) {
    const { rows: [{ sum }] } = await pool.query(
      `SELECT COALESCE(SUM(duration_seconds), 0) AS sum
       FROM usage_records
       WHERE workspace_id = $1
         AND billing_period_start >= $2
         AND billing_period_start < $3`,
      [workspaceId, period.start, period.end || new Date()]
    );
    usedSeconds = parseInt(sum, 10);
  }

  const remainingSeconds = Math.max(0, planQuotaSeconds - usedSeconds);
  const usagePct = planQuotaSeconds > 0 ? Math.min(100, Math.round((usedSeconds / planQuotaSeconds) * 100)) : 0;

  return {
    has_subscription: true,
    plan: {
      code: sub.plan_code,
      name: sub.plan_name,
      hours_limit: sub.hours_limit,
      price_cents: sub.price_cents,
      interval: sub.interval,
    },
    status: sub.status,
    quota_seconds: planQuotaSeconds,
    used_seconds: usedSeconds,
    remaining_seconds: remainingSeconds,
    usage_pct: usagePct,
    period_start: period?.start || sub.current_period_start,
    period_end: period?.end || sub.current_period_end,
    cancel_at_period_end: sub.cancel_at_period_end,
  };
}

/**
 * Record usage for a meeting
 */
async function recordUsage(workspaceId, meetingId, durationSeconds) {
  const period = await getCurrentPeriod(workspaceId);
  await pool.query(
    `INSERT INTO usage_records (workspace_id, meeting_id, duration_seconds, billing_period_start, billing_period_end)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      workspaceId,
      meetingId,
      durationSeconds,
      period?.start || null,
      period?.end || null,
    ]
  );
}

/**
 * Check if a workspace has enough quota for a given duration
 */
async function checkQuotaAvailable(workspaceId, durationSeconds) {
  const usage = await getWorkspaceUsage(workspaceId);

  if (!usage.has_subscription || !['active', 'trial'].includes(usage.status)) {
    return {
      allowed: false,
      reason: 'no_subscription',
      remaining_seconds: 0,
      required_seconds: durationSeconds,
    };
  }

  if (durationSeconds > usage.remaining_seconds) {
    return {
      allowed: false,
      reason: 'insufficient_quota',
      remaining_seconds: usage.remaining_seconds,
      required_seconds: durationSeconds,
      quota_seconds: usage.quota_seconds,
      used_seconds: usage.used_seconds,
    };
  }

  return {
    allowed: true,
    remaining_seconds: usage.remaining_seconds,
    required_seconds: durationSeconds,
  };
}

module.exports = {
  getCurrentPeriod,
  getWorkspaceUsage,
  recordUsage,
  checkQuotaAvailable,
};
