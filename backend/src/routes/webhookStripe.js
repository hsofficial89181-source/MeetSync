/**
 * Stripe Webhook Handler
 *
 * Registered BEFORE express.json() middleware — needs raw body for signature verification.
 * Handles subscription lifecycle events from Stripe.
 */

const express = require('express');
const { pool } = require('../db');
const { log } = require('../utils/logger');
const stripeService = require('../services/stripe');

const router = express.Router();

/**
 * Verify Stripe webhook signature and parse event
 */
function verifyWebhookSignature(rawBody, signature) {
  const stripe = stripeService.getStripe();
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!endpointSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }
  return stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);
}

/**
 * POST /api/webhooks/stripe
 * Raw body is passed via express.raw middleware configured in index.js
 */
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = verifyWebhookSignature(req.body, sig);
  } catch (err) {
    log.error('Stripe webhook signature verification failed', { error: err.message });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutCompleted(event.data.object);
        break;
      }
      case 'customer.subscription.updated': {
        await handleSubscriptionUpdated(event.data.object);
        break;
      }
      case 'customer.subscription.deleted': {
        await handleSubscriptionDeleted(event.data.object);
        break;
      }
      case 'invoice.payment_succeeded': {
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      }
      case 'invoice.payment_failed': {
        await handleInvoicePaymentFailed(event.data.object);
        break;
      }
      default:
        log.info('Unhandled Stripe event', { type: event.type });
    }

    res.json({ received: true });
  } catch (err) {
    log.error('Stripe webhook handler error', { type: event.type, error: err.message });
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

/**
 * Handle checkout.session.completed
 * Create subscription record in DB
 */
async function handleCheckoutCompleted(session) {
  const workspaceId = session.metadata?.workspaceId;
  const planCode = session.metadata?.planCode;
  if (!workspaceId || !planCode) return;

  const { rows: [plan] } = await pool.query(
    'SELECT id FROM subscription_plans WHERE code = $1',
    [planCode]
  );
  if (!plan) return;

  const stripeSubId = session.subscription;
  const stripe = stripeService.getStripe();
  const subscription = await stripe.subscriptions.retrieve(stripeSubId);
  const period = stripeService.getSubscriptionPeriod(subscription);

  // Upsert subscription
  await pool.query(
    `INSERT INTO subscriptions (workspace_id, plan_id, status, stripe_subscription_id, stripe_customer_id,
                                current_period_start, current_period_end, cancel_at_period_end)
     VALUES ($1, $2, 'active', $3, $4, $5, $6, FALSE)
     ON CONFLICT (workspace_id) DO UPDATE SET
       plan_id = $2, status = 'active', stripe_subscription_id = $3, stripe_customer_id = $4,
       current_period_start = $5, current_period_end = $6, cancel_at_period_end = FALSE,
       canceled_at = NULL, trial_ends_at = NULL, updated_at = NOW()`,
    [
      workspaceId,
      plan.id,
      stripeSubId,
      session.customer,
      period.start ? new Date(period.start * 1000) : null,
      period.end ? new Date(period.end * 1000) : null,
    ]
  );

  await pool.query(
    `INSERT INTO subscription_history (workspace_id, action, to_plan, details)
     VALUES ($1, 'created', $2, $3)`,
    [workspaceId, planCode, JSON.stringify({ stripe_subscription_id: stripeSubId })]
  );

  log.info('Subscription created via checkout', { workspaceId, planCode });
}

/**
 * Handle customer.subscription.updated
 * Sync status, period, plan changes
 */
async function handleSubscriptionUpdated(subscription) {
  const { rows: [sub] } = await pool.query(
    'SELECT id, workspace_id FROM subscriptions WHERE stripe_subscription_id = $1',
    [subscription.id]
  );
  if (!sub) return;

  const stripe = stripeService.getStripe();
  const priceId = subscription.items.data[0]?.price?.id;
  const { rows: [plan] } = await pool.query(
    'SELECT id, code FROM subscription_plans WHERE stripe_price_id = $1',
    [priceId]
  );

  const status = subscription.status === 'active' ? 'active' :
                 subscription.status === 'past_due' ? 'past_due' :
                 subscription.status === 'canceled' ? 'canceled' :
                 subscription.status === 'trialing' ? 'trial' :
                 subscription.status;

  const period = stripeService.getSubscriptionPeriod(subscription);

  await pool.query(
    `UPDATE subscriptions SET
       status = $1, current_period_start = $2, current_period_end = $3,
       cancel_at_period_end = $4, ${plan ? 'plan_id = $5, pending_plan_id = NULL,' : ''} updated_at = NOW()
     WHERE id = $${plan ? 6 : 5}`,
    plan
      ? [status, period.start ? new Date(period.start * 1000) : null, period.end ? new Date(period.end * 1000) : null, subscription.cancel_at_period_end, plan.id, sub.id]
      : [status, period.start ? new Date(period.start * 1000) : null, period.end ? new Date(period.end * 1000) : null, subscription.cancel_at_period_end, sub.id]
  );

  log.info('Subscription updated', { workspaceId: sub.workspace_id, status });
}

/**
 * Handle customer.subscription.deleted
 */
async function handleSubscriptionDeleted(subscription) {
  await pool.query(
    `UPDATE subscriptions SET status = 'canceled', canceled_at = NOW(), cancel_at_period_end = FALSE, updated_at = NOW()
     WHERE stripe_subscription_id = $1`,
    [subscription.id]
  );

  const { rows: [sub] } = await pool.query(
    'SELECT workspace_id FROM subscriptions WHERE stripe_subscription_id = $1',
    [subscription.id]
  );
  if (sub) {
    await pool.query(
      `INSERT INTO subscription_history (workspace_id, action, details)
       VALUES ($1, 'canceled', $2)`,
      [sub.workspace_id, JSON.stringify({ stripe_subscription_id: subscription.id })]
    );
  }

  log.info('Subscription deleted', { stripeSubscriptionId: subscription.id });
}

/**
 * Handle invoice.payment_succeeded
 * Create/sync invoice record
 */
async function handleInvoicePaymentSucceeded(invoice) {
  const { rows: [sub] } = await pool.query(
    'SELECT id, workspace_id, stripe_subscription_id FROM subscriptions WHERE stripe_customer_id = $1',
    [invoice.customer]
  );
  if (!sub) return;

  const { rows: [plan] } = await pool.query(
    'SELECT id, code, name FROM subscription_plans WHERE stripe_price_id = $1',
    [invoice.lines.data[0]?.price?.id]
  );

  let invPeriodStart = invoice.period_start;
  let invPeriodEnd = invoice.period_end;
  if (!invPeriodStart || !invPeriodEnd || invPeriodStart === invPeriodEnd) {
    try {
      const stripe = stripeService.getStripe();
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
      const subPeriod = stripeService.getSubscriptionPeriod(stripeSub);
      invPeriodStart = subPeriod.start;
      invPeriodEnd = subPeriod.end;
    } catch {}
  }

  await pool.query(
    `INSERT INTO invoices (workspace_id, subscription_id, stripe_invoice_id, invoice_number,
                           amount_cents, currency, tax_cents, total_cents, status,
                           period_start, period_end, paid_at, pdf_url, plan_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'paid', $9, $10, NOW(), $11, $12)
     ON CONFLICT (stripe_invoice_id) DO UPDATE SET
       status = 'paid', paid_at = NOW(), pdf_url = $11, plan_id = $12, updated_at = NOW()`,
    [
      sub.workspace_id,
      sub.id,
      invoice.id,
      invoice.number || `INV-${Date.now()}`,
      invoice.subtotal || 0,
      invoice.currency || 'usd',
      invoice.tax || 0,
      invoice.total || 0,
      invPeriodStart ? new Date(invPeriodStart * 1000) : null,
      invPeriodEnd ? new Date(invPeriodEnd * 1000) : null,
      invoice.invoice_pdf || null,
      plan?.id || null,
    ]
  );

  log.info('Invoice payment succeeded', { workspaceId: sub.workspace_id, invoiceId: invoice.id });
}

/**
 * Handle invoice.payment_failed
 */
async function handleInvoicePaymentFailed(invoice) {
  const { rows: [sub] } = await pool.query(
    'SELECT id, workspace_id FROM subscriptions WHERE stripe_customer_id = $1',
    [invoice.customer]
  );
  if (!sub) return;

  await pool.query(
    'UPDATE subscriptions SET status = ' + "'past_due'" + ', updated_at = NOW() WHERE id = $1',
    [sub.id]
  );

  await pool.query(
    `INSERT INTO invoices (workspace_id, subscription_id, stripe_invoice_id, invoice_number,
                           amount_cents, currency, tax_cents, total_cents, status,
                           period_start, period_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', $9, $10)
     ON CONFLICT (stripe_invoice_id) DO UPDATE SET status = 'open', updated_at = NOW()`,
    [
      sub.workspace_id,
      sub.id,
      invoice.id,
      invoice.number || `INV-${Date.now()}`,
      invoice.subtotal || 0,
      invoice.currency || 'usd',
      invoice.tax || 0,
      invoice.total || 0,
      invoice.period_start ? new Date(invoice.period_start * 1000) : null,
      invoice.period_end ? new Date(invoice.period_end * 1000) : null,
    ]
  );

  await pool.query(
    `INSERT INTO subscription_history (workspace_id, action, details)
     VALUES ($1, 'payment_failed', $2)`,
    [sub.workspace_id, JSON.stringify({ invoice_id: invoice.id })]
  );

  log.warn('Invoice payment failed', { workspaceId: sub.workspace_id, invoiceId: invoice.id });
}

module.exports = router;
