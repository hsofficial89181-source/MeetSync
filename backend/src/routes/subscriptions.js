/**
 * /api/subscriptions — workspace-scoped subscription management
 *
 * GET    /plans              list all available plans
 * GET    /current            get current subscription + usage
 * GET    /usage              get usage summary
 * POST   /subscribe          create subscription with incomplete payment (returns clientSecret)
 * GET    /upgrade-preview    preview prorated charge for upgrade
 * POST   /upgrade            upgrade/downgrade plan
 * POST   /cancel             cancel subscription at period end
 * POST   /reactivate         reactivate canceled subscription
 * GET    /history            subscription audit history
 * GET    /payment-method     get current payment method
 * POST   /payment-method/setup  create SetupIntent for payment method update
 */

const express = require('express');
const { pool } = require('../models/migrate');
const { requireAuth } = require('../middleware/auth');
const { log } = require('../utils/logger');
const stripeService = require('../services/stripe');
const { getWorkspaceUsage } = require('../services/usage');

const router = express.Router();
router.use(requireAuth);

const wid = (req) => req.user.workspace_id;

/**
 * Require workspace admin
 */
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Workspace admin access required' });
  }
  next();
}

/**
 * GET /api/subscriptions/plans
 */
router.get('/plans', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, code, name, price_cents, interval, hours_limit, sort_order
       FROM subscription_plans
       WHERE is_active = TRUE
       ORDER BY sort_order ASC`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

/**
 * GET /api/subscriptions/current
 */
router.get('/current', async (req, res, next) => {
  try {
    const { rows: [sub] } = await pool.query(
      `SELECT s.*, sp.code AS plan_code, sp.name AS plan_name, sp.hours_limit, sp.price_cents, sp.interval,
              pp.code AS pending_plan_code, pp.name AS pending_plan_name
       FROM subscriptions s
       LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
       LEFT JOIN subscription_plans pp ON pp.id = s.pending_plan_id
       WHERE s.workspace_id = $1
       LIMIT 1`,
      [wid(req)]
    );

    if (!sub) {
      return res.json({ subscription: null, plan: null });
    }

    // Lazy trial expiration: if trial has ended, mark as expired
    if (sub.status === 'trial' && sub.trial_ends_at && new Date(sub.trial_ends_at) < new Date()) {
      await pool.query(
        `UPDATE subscriptions SET status = 'expired', updated_at = NOW() WHERE id = $1`,
        [sub.id]
      );
      await pool.query(
        `INSERT INTO subscription_history (workspace_id, action, from_plan, to_plan, details)
         VALUES ($1, 'trial_expired', $2, $2, $3)`,
        [wid(req), sub.plan_code, JSON.stringify({ trial_ends_at: sub.trial_ends_at })]
      );
      sub.status = 'expired';
    }

    let paymentMethod = null;
    if (sub.stripe_customer_id) {
      try {
        paymentMethod = await stripeService.getPaymentMethod(sub.stripe_customer_id);
      } catch {}
    }

    res.json({
      subscription: {
        id: sub.id,
        status: sub.status,
        current_period_start: sub.current_period_start,
        current_period_end: sub.current_period_end,
        cancel_at_period_end: sub.cancel_at_period_end,
        canceled_at: sub.canceled_at,
        pending_plan_id: sub.pending_plan_id,
        pending_plan_code: sub.pending_plan_code,
        pending_plan_name: sub.pending_plan_name,
        trial_ends_at: sub.trial_ends_at,
      },
      plan: {
        code: sub.plan_code,
        name: sub.plan_name,
        hours_limit: sub.hours_limit,
        price_cents: sub.price_cents,
        interval: sub.interval,
      },
      payment_method: paymentMethod,
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/subscriptions/usage
 */
router.get('/usage', async (req, res, next) => {
  try {
    const usage = await getWorkspaceUsage(wid(req));
    res.json(usage);
  } catch (err) { next(err); }
});

/**
 * POST /api/subscriptions/subscribe
 * Step 1: Creates a SetupIntent for collecting card details via Stripe Elements.
 * Returns { clientSecret, customerId }
 */
router.post('/subscribe', requireAdmin, async (req, res, next) => {
  try {
    const { planCode } = req.body;
    if (!planCode) return res.status(400).json({ error: 'planCode is required' });

    const { rows: [plan] } = await pool.query(
      'SELECT * FROM subscription_plans WHERE code = $1 AND is_active = TRUE',
      [planCode]
    );
    if (!plan) return res.status(400).json({ error: 'Invalid plan' });

    const { rows: [existingSub] } = await pool.query(
      `SELECT s.*, sp.interval FROM subscriptions s
       JOIN subscription_plans sp ON sp.id = s.plan_id
       WHERE s.workspace_id = $1 AND s.status = 'active'
       LIMIT 1`,
      [wid(req)]
    );
    if (existingSub && existingSub.interval === 'year' && plan.interval === 'month') {
      return res.status(400).json({ error: 'You have an active yearly subscription. Monthly plans will be available after your yearly subscription expires.' });
    }

    const result = await stripeService.createSubscriptionSetup({
      customerEmail: req.user.email,
      customerName: req.user.name,
      planCode,
      workspaceId: wid(req),
    });

    res.json({
      clientSecret: result.clientSecret,
      customerId: result.customerId,
    });
  } catch (err) {
    log.error('Subscription setup failed', { error: err.message, stack: err.stack });

    const friendlyErrors = {
      'Payment service is not available': 'Payment service is temporarily unavailable. Please try again later or contact support.',
      'No Stripe Price ID configured': 'This plan is not ready for checkout yet. Please contact support.',
      'Invalid plan': 'The selected plan is invalid. Please refresh and try again.',
    };

    let userMessage = 'Unable to process your request at this time. Please try again later.';
    for (const [key, msg] of Object.entries(friendlyErrors)) {
      if (err.message?.includes(key)) { userMessage = msg; break; }
    }

    res.status(400).json({ error: userMessage });
  }
});

/**
 * POST /api/subscriptions/confirm-subscription
 * Step 2: Creates a subscription using the payment method collected via SetupIntent.
 * Returns { subscriptionId }
 */
router.post('/confirm-subscription', requireAdmin, async (req, res, next) => {
  try {
    const { customerId, planCode, paymentMethodId } = req.body;
    if (!customerId || !planCode || !paymentMethodId) {
      return res.status(400).json({ error: 'customerId, planCode, and paymentMethodId are required' });
    }

    const { rows: [plan] } = await pool.query(
      'SELECT id FROM subscription_plans WHERE code = $1 AND is_active = TRUE',
      [planCode]
    );
    if (!plan) return res.status(400).json({ error: 'Invalid plan' });

    const result = await stripeService.createSubscriptionWithPayment({
      customerId,
      planCode,
      workspaceId: wid(req),
      paymentMethodId,
    });

    const status = result.status === 'active' ? 'active' :
                   result.status === 'trialing' ? 'trial' :
                   result.status === 'past_due' ? 'past_due' :
                   result.status;

    // Check if converting from trial
    const { rows: [existingSub ] } = await pool.query(
      'SELECT status FROM subscriptions WHERE workspace_id = $1',
      [wid(req)]
    );
    const isTrialConversion = existingSub?.status === 'trial';

    await pool.query(
      `INSERT INTO subscriptions (workspace_id, plan_id, status, stripe_subscription_id, stripe_customer_id,
                                  current_period_start, current_period_end, cancel_at_period_end, trial_ends_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NULL)
       ON CONFLICT (workspace_id) DO UPDATE SET
         plan_id = $2, status = $3, stripe_subscription_id = $4, stripe_customer_id = $5,
         current_period_start = $6, current_period_end = $7, cancel_at_period_end = FALSE,
         canceled_at = NULL, trial_ends_at = NULL, updated_at = NOW()`,
      [
        wid(req),
        plan.id,
        status,
        result.subscriptionId,
        result.customerId,
        result.currentPeriodStart ? new Date(result.currentPeriodStart * 1000) : null,
        result.currentPeriodEnd ? new Date(result.currentPeriodEnd * 1000) : null,
      ]
    );

    await pool.query(
      `INSERT INTO subscription_history (workspace_id, action, to_plan, details)
       VALUES ($1, $2, $3, $4)`,
      [
        wid(req),
        isTrialConversion ? 'trial_converted' : 'created',
        planCode,
        JSON.stringify({ stripe_subscription_id: result.subscriptionId }),
      ]
    );

    try {
      const stripe = stripeService.getStripe();
      const stripeSub = await stripe.subscriptions.retrieve(result.subscriptionId);
      const invId = typeof stripeSub.latest_invoice === 'string'
        ? stripeSub.latest_invoice
        : stripeSub.latest_invoice?.id;

      if (invId) {
        const inv = await stripe.invoices.retrieve(invId);
        const { rows: [dbSub] } = await pool.query(
          'SELECT id FROM subscriptions WHERE workspace_id = $1', [wid(req)]
        );
        if (dbSub && inv.status) {
          let invPeriodStart = inv.period_start;
          let invPeriodEnd = inv.period_end;
          if (!invPeriodStart || !invPeriodEnd || invPeriodStart === invPeriodEnd) {
            const subPeriod = stripeService.getSubscriptionPeriod(stripeSub);
            invPeriodStart = subPeriod.start;
            invPeriodEnd = subPeriod.end;
          }
          await pool.query(
            `INSERT INTO invoices (workspace_id, subscription_id, stripe_invoice_id, invoice_number,
                                   amount_cents, currency, tax_cents, total_cents, status,
                                   period_start, period_end, paid_at, pdf_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             ON CONFLICT (stripe_invoice_id) DO UPDATE SET
               status = $9, paid_at = $12, pdf_url = $13, updated_at = NOW()`,
            [
              wid(req), dbSub.id, inv.id,
              inv.number || `INV-${Date.now()}`,
              inv.subtotal || 0, inv.currency || 'usd', inv.tax || 0, inv.total || 0,
              inv.status === 'paid' ? 'paid' : inv.status,
              invPeriodStart ? new Date(invPeriodStart * 1000) : null,
              invPeriodEnd   ? new Date(invPeriodEnd   * 1000) : null,
              inv.status === 'paid' ? new Date() : null,
              inv.invoice_pdf || null,
            ]
          );
        }
      }
    } catch (invoiceErr) {
      log.warn('Could not upsert initial invoice', { error: invoiceErr.message });
    }

    log.info('Subscription confirmed', { workspaceId: wid(req), planCode, status });

    res.json({
      subscriptionId: result.subscriptionId,
      customerId: result.customerId,
      status,
    });
  } catch (err) {
    log.error('Subscription confirmation failed', { error: err.message, stack: err.stack });
    res.status(400).json({ error: 'Unable to complete your subscription. Please try again or contact support.' });
  }
});

/**
 * GET /api/subscriptions/upgrade-preview?planCode=xxx
 * Preview the prorated charge and payment method for an upgrade.
 */
router.get('/upgrade-preview', requireAdmin, async (req, res, next) => {
  try {
    const { planCode } = req.query;
    if (!planCode) return res.status(400).json({ error: 'planCode is required' });

    const { rows: [sub] } = await pool.query(
      'SELECT * FROM subscriptions WHERE workspace_id = $1',
      [wid(req)]
    );

    if (!sub || !sub.stripe_subscription_id) {
      return res.status(400).json({ error: 'No active subscription to upgrade' });
    }

    if (sub.status !== 'active') {
      return res.status(400).json({ error: 'Subscription is not active' });
    }

    const { rows: [newPlan] } = await pool.query(
      'SELECT * FROM subscription_plans WHERE code = $1 AND is_active = TRUE',
      [planCode]
    );
    if (!newPlan) return res.status(400).json({ error: 'Invalid plan' });

    const upcoming = await stripeService.previewUpgradeInvoice(sub.stripe_subscription_id, planCode);

    let paymentMethod = null;
    if (sub.stripe_customer_id) {
      try {
        paymentMethod = await stripeService.getPaymentMethod(sub.stripe_customer_id);
      } catch {}
    }

    res.json({
      amount_cents: upcoming.proration_amount || 0,
      currency: upcoming.currency || 'usd',
      subtotal_cents: upcoming.subtotal || 0,
      tax_cents: upcoming.tax || 0,
      plan: {
        code: newPlan.code,
        name: newPlan.name,
        hours_limit: newPlan.hours_limit,
        price_cents: newPlan.price_cents,
      },
      payment_method: paymentMethod,
    });
  } catch (err) {
    log.error('Upgrade preview failed', { error: err.message });
    res.status(400).json({ error: 'Unable to preview upgrade. Please try again.' });
  }
});

/**
 * POST /api/subscriptions/upgrade
 * Upgrade to a higher-tier plan immediately with proration.
 */
router.post('/upgrade', requireAdmin, async (req, res, next) => {
  try {
    const { planCode } = req.body;
    if (!planCode) return res.status(400).json({ error: 'planCode is required' });

    const { rows: [sub] } = await pool.query(
      'SELECT * FROM subscriptions WHERE workspace_id = $1',
      [wid(req)]
    );

    if (!sub || !sub.stripe_subscription_id) {
      return res.status(400).json({ error: 'No active subscription to upgrade' });
    }

    if (sub.status !== 'active') {
      return res.status(400).json({ error: 'Subscription is not active' });
    }

    const { rows: [newPlan] } = await pool.query(
      'SELECT * FROM subscription_plans WHERE code = $1 AND is_active = TRUE',
      [planCode]
    );
    if (!newPlan) return res.status(400).json({ error: 'Invalid plan' });

    const { rows: [oldPlan] } = await pool.query(
      'SELECT code, interval FROM subscription_plans WHERE id = $1',
      [sub.plan_id]
    );

    if (oldPlan && oldPlan.interval === 'year' && newPlan.interval === 'month') {
      return res.status(400).json({ error: 'You have an active yearly subscription. Monthly plans will be available after your yearly subscription expires.' });
    }

    const result = await stripeService.upgradeSubscription(sub.stripe_subscription_id, planCode);

    await pool.query(
      'UPDATE subscriptions SET plan_id = $1, pending_plan_id = NULL, updated_at = NOW() WHERE id = $2',
      [newPlan.id, sub.id]
    );

    // Upsert the proration invoice into the invoices table
    if (result.invoice) {
      try {
        let invPeriodStart = result.invoice.period_start;
        let invPeriodEnd = result.invoice.period_end;
        if (!invPeriodStart || !invPeriodEnd || invPeriodStart === invPeriodEnd) {
          const stripeSub = await stripeService.retrieveSubscription(sub.stripe_subscription_id);
          const subPeriod = stripeService.getSubscriptionPeriod(stripeSub);
          invPeriodStart = subPeriod.start;
          invPeriodEnd = subPeriod.end;
        }
        await pool.query(
          `INSERT INTO invoices (workspace_id, subscription_id, stripe_invoice_id, invoice_number,
                                 amount_cents, currency, tax_cents, total_cents, status,
                                 period_start, period_end, paid_at, pdf_url, plan_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT (stripe_invoice_id) DO UPDATE SET
             status = $9, paid_at = $12, pdf_url = $13, plan_id = $14, updated_at = NOW()`,
          [
            wid(req),
            sub.id,
            result.invoice.id,
            result.invoice.number || `INV-${Date.now()}`,
            result.invoice.subtotal || 0,
            result.invoice.currency || 'usd',
            result.invoice.tax || 0,
            result.invoice.total || 0,
            result.invoice.status === 'paid' ? 'paid' : (result.invoice.status || 'open'),
            invPeriodStart ? new Date(invPeriodStart * 1000) : null,
            invPeriodEnd ? new Date(invPeriodEnd * 1000) : null,
            result.invoice.status === 'paid' ? new Date() : null,
            result.invoice.invoice_pdf || null,
            newPlan.id,
          ]
        );
      } catch (invErr) {
        log.warn('Could not upsert upgrade invoice', { error: invErr.message });
      }
    }

    await pool.query(
      `INSERT INTO subscription_history (workspace_id, action, from_plan, to_plan, performed_by, details)
       VALUES ($1, 'upgraded', $2, $3, $4, $5)`,
      [
        wid(req),
        oldPlan?.code || null,
        planCode,
        req.user.id,
        JSON.stringify({ stripe_subscription_id: sub.stripe_subscription_id }),
      ]
    );

    res.json({
      success: true,
      message: `Subscription upgraded to ${newPlan.name}`,
      status: result.subscription?.status,
    });
  } catch (err) {
    log.error('Subscription upgrade failed', { error: err.message });
    res.status(400).json({ error: err.message || 'Failed to upgrade subscription' });
  }
});

/**
 * POST /api/subscriptions/downgrade
 * Schedule a downgrade to a lower-tier plan. The current plan remains active
 * until the end of the billing period. The new plan takes effect at renewal.
 * Usage is NOT reset immediately — the current plan's quota stays in effect.
 */
router.post('/downgrade', requireAdmin, async (req, res, next) => {
  try {
    const { planCode } = req.body;
    if (!planCode) return res.status(400).json({ error: 'planCode is required' });

    const { rows: [sub] } = await pool.query(
      'SELECT * FROM subscriptions WHERE workspace_id = $1',
      [wid(req)]
    );

    if (!sub || !sub.stripe_subscription_id) {
      return res.status(400).json({ error: 'No active subscription to downgrade' });
    }

    if (sub.status !== 'active') {
      return res.status(400).json({ error: 'Subscription is not active' });
    }

    const { rows: [newPlan] } = await pool.query(
      'SELECT * FROM subscription_plans WHERE code = $1 AND is_active = TRUE',
      [planCode]
    );
    if (!newPlan) return res.status(400).json({ error: 'Invalid plan' });

    const { rows: [oldPlan] } = await pool.query(
      'SELECT code, interval FROM subscription_plans WHERE id = $1',
      [sub.plan_id]
    );

    if (oldPlan && oldPlan.interval === 'year' && newPlan.interval === 'month') {
      return res.status(400).json({ error: 'You have an active yearly subscription. Monthly plans will be available after your yearly subscription expires.' });
    }

    await stripeService.scheduleDowngrade(sub.stripe_subscription_id, planCode);

    await pool.query(
      'UPDATE subscriptions SET pending_plan_id = $1, updated_at = NOW() WHERE id = $2',
      [newPlan.id, sub.id]
    );

    await pool.query(
      `INSERT INTO subscription_history (workspace_id, action, from_plan, to_plan, performed_by, details)
       VALUES ($1, 'downgraded', $2, $3, $4, $5)`,
      [
        wid(req),
        oldPlan?.code || null,
        planCode,
        req.user.id,
        JSON.stringify({ stripe_subscription_id: sub.stripe_subscription_id, scheduled: true }),
      ]
    );

    res.json({
      success: true,
      message: `Plan will switch to ${newPlan.name} at the end of the current billing period`,
    });
  } catch (err) {
    log.error('Subscription downgrade failed', { error: err.message });
    res.status(400).json({ error: err.message || 'Failed to schedule downgrade' });
  }
});

/**
 * POST /api/subscriptions/cancel
 * Cancel subscription at period end
 */
router.post('/cancel', requireAdmin, async (req, res, next) => {
  try {
    const { rows: [sub] } = await pool.query(
      'SELECT * FROM subscriptions WHERE workspace_id = $1',
      [wid(req)]
    );

    if (!sub || !sub.stripe_subscription_id) {
      return res.status(400).json({ error: 'No active subscription to cancel' });
    }

    await stripeService.cancelSubscriptionAtPeriodEnd(sub.stripe_subscription_id);

    await pool.query(
      'UPDATE subscriptions SET cancel_at_period_end = TRUE, updated_at = NOW() WHERE id = $1',
      [sub.id]
    );

    const plan = await pool.query('SELECT code FROM subscription_plans WHERE id = $1', [sub.plan_id]);

    await pool.query(
      `INSERT INTO subscription_history (workspace_id, action, from_plan, to_plan, performed_by)
       VALUES ($1, 'canceled', $2, $2, $3)`,
      [wid(req), plan.rows[0]?.code || null, req.user.id]
    );

    res.json({ success: true, message: 'Subscription will be canceled at the end of the current billing period' });
  } catch (err) {
    log.error('Subscription cancellation failed', { error: err.message });
    res.status(400).json({ error: err.message || 'Failed to cancel subscription' });
  }
});

/**
 * POST /api/subscriptions/reactivate
 * Reactivate a subscription that was set to cancel at period end
 */
router.post('/reactivate', requireAdmin, async (req, res, next) => {
  try {
    const { rows: [sub] } = await pool.query(
      'SELECT * FROM subscriptions WHERE workspace_id = $1',
      [wid(req)]
    );

    if (!sub || !sub.stripe_subscription_id) {
      return res.status(400).json({ error: 'No subscription to reactivate' });
    }

    if (!sub.cancel_at_period_end) {
      return res.status(400).json({ error: 'Subscription is not set to cancel' });
    }

    await stripeService.reactivateSubscription(sub.stripe_subscription_id);

    await pool.query(
      'UPDATE subscriptions SET cancel_at_period_end = FALSE, updated_at = NOW() WHERE id = $1',
      [sub.id]
    );

    const plan = await pool.query('SELECT code FROM subscription_plans WHERE id = $1', [sub.plan_id]);

    await pool.query(
      `INSERT INTO subscription_history (workspace_id, action, from_plan, to_plan, performed_by)
       VALUES ($1, 'reactivated', $2, $2, $3)`,
      [wid(req), plan.rows[0]?.code || null, req.user.id]
    );

    res.json({ success: true, message: 'Subscription reactivated' });
  } catch (err) {
    log.error('Subscription reactivation failed', { error: err.message });
    res.status(400).json({ error: err.message || 'Failed to reactivate subscription' });
  }
});

/**
 * GET /api/subscriptions/history
 */
router.get('/history', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT sh.*, u.name AS performed_by_name
       FROM subscription_history sh
       LEFT JOIN users u ON u.id = sh.performed_by
       WHERE sh.workspace_id = $1
       ORDER BY sh.created_at DESC
       LIMIT 50`,
      [wid(req)]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

/**
 * GET /api/subscriptions/payment-method
 */
router.get('/payment-method', async (req, res, next) => {
  try {
    const { rows: [sub] } = await pool.query(
      'SELECT stripe_customer_id FROM subscriptions WHERE workspace_id = $1',
      [wid(req)]
    );

    if (!sub || !sub.stripe_customer_id) {
      return res.json({ payment_method: null });
    }

    const pm = await stripeService.getPaymentMethod(sub.stripe_customer_id);
    res.json({ payment_method: pm });
  } catch (err) { next(err); }
});

/**
 * POST /api/subscriptions/payment-method/setup
 * Create a SetupIntent for updating payment method
 */
router.post('/payment-method/setup', requireAdmin, async (req, res, next) => {
  try {
    const { rows: [sub] } = await pool.query(
      'SELECT stripe_customer_id FROM subscriptions WHERE workspace_id = $1',
      [wid(req)]
    );

    if (!sub || !sub.stripe_customer_id) {
      return res.status(400).json({ error: 'No Stripe customer found' });
    }

    const intent = await stripeService.createSetupIntent(sub.stripe_customer_id);
    res.json({ client_secret: intent.client_secret });
  } catch (err) {
    log.error('SetupIntent creation failed', { error: err.message });
    res.status(400).json({ error: err.message || 'Failed to create setup intent' });
  }
});

/**
 * POST /api/subscriptions/sync
 * Pull current subscription status from Stripe and update DB
 */
router.post('/sync', requireAdmin, async (req, res, next) => {
  try {
    const { rows: [sub] } = await pool.query(
      'SELECT * FROM subscriptions WHERE workspace_id = $1',
      [wid(req)]
    );

    if (!sub || !sub.stripe_subscription_id) {
      return res.status(400).json({ error: 'No Stripe subscription found to sync' });
    }

    const stripeSub = await stripeService.retrieveSubscription(sub.stripe_subscription_id);

    const status = stripeSub.status === 'active'   ? 'active'   :
                   stripeSub.status === 'trialing'  ? 'trial'    :
                   stripeSub.status === 'past_due'  ? 'past_due' :
                   stripeSub.status === 'canceled'  ? 'canceled' :
                   stripeSub.status;

    const period = stripeService.getSubscriptionPeriod(stripeSub);
    const periodStart = period.start;
    const periodEnd = period.end;

    await pool.query(
      `UPDATE subscriptions SET
         status = $1, current_period_start = $2, current_period_end = $3,
         cancel_at_period_end = $4, updated_at = NOW()
       WHERE id = $5`,
      [
        status,
        periodStart ? new Date(periodStart * 1000) : sub.current_period_start,
        periodEnd   ? new Date(periodEnd   * 1000) : sub.current_period_end,
        stripeSub.cancel_at_period_end || false,
        sub.id,
      ]
    );

    log.info('Subscription synced from Stripe', { workspaceId: wid(req), status });
    res.json({ success: true, status });
  } catch (err) {
    log.error('Subscription sync failed', { error: err.message });
    res.status(400).json({ error: 'Failed to sync subscription. Please try again.' });
  }
});

module.exports = router;
