/**
 * Stripe Service
 *
 * Wraps all Stripe API calls for subscription management.
 * Requires STRIPE_SECRET_KEY in environment.
 */

const Stripe = require('stripe');
const { log } = require('../utils/logger');

let stripe = null;

function getStripe() {
  if (!stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      log.error('Stripe secret key is not configured in environment');
      throw new Error('Payment service is not available. Please contact support.');
    }
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

/**
 * Map plan code to Stripe Price ID from env
 */
function getStripePriceId(planCode) {
  const map = {
    starter:             process.env.STRIPE_PRICE_STARTER,
    professional:        process.env.STRIPE_PRICE_PROFESSIONAL,
    business:            process.env.STRIPE_PRICE_BUSINESS,
    enterprise:          process.env.STRIPE_PRICE_ENTERPRISE,
    starter_yearly:      process.env.STRIPE_PRICE_STARTER_YEARLY,
    professional_yearly: process.env.STRIPE_PRICE_PROFESSIONAL_YEARLY,
    business_yearly:     process.env.STRIPE_PRICE_BUSINESS_YEARLY,
    enterprise_yearly:   process.env.STRIPE_PRICE_ENTERPRISE_YEARLY,
  };
  return map[planCode] || null;
}

/**
 * Find an existing Stripe Customer by metadata workspaceId, or create a new one
 */
async function findOrCreateCustomer({ email, name, workspaceId }) {
  const s = getStripe();
  const existing = await s.customers.search({
    query: `metadata['workspaceId']:'${workspaceId}'`,
    limit: 1,
  });
  if (existing.data.length > 0) {
    return existing.data[0];
  }
  return s.customers.create({
    email,
    name,
    metadata: { workspaceId },
  });
}

/**
 * Step 1: Create a SetupIntent for collecting card details via Stripe Elements.
 * Returns { clientSecret, customerId }
 */
async function createSubscriptionSetup({ customerEmail, customerName, planCode, workspaceId }) {
  const s = getStripe();
  const priceId = getStripePriceId(planCode);
  if (!priceId) {
    log.error('No Stripe Price ID configured for plan', { planCode });
    throw new Error('No Stripe Price ID configured for this plan');
  }

  const customer = await findOrCreateCustomer({
    email: customerEmail,
    name: customerName,
    workspaceId,
  });

  const setupIntent = await s.setupIntents.create({
    customer: customer.id,
    payment_method_types: ['card'],
    usage: 'off_session',
    metadata: { workspaceId, planCode },
  });

  return {
    clientSecret: setupIntent.client_secret,
    customerId: customer.id,
  };
}

/**
 * Extract the billing period from a Stripe subscription object.
 * Handles both the new API (Basil 2025-03-31: period on items.data[0])
 * and the old API (top-level current_period_start/end).
 * Falls back to billing_cycle_anchor + price interval if neither is available.
 */
function getSubscriptionPeriod(subscription) {
  const item = subscription.items?.data?.[0];

  // New API (Basil): period is on subscription items
  if (item?.current_period_start && item?.current_period_end) {
    return {
      start: item.current_period_start,
      end: item.current_period_end,
    };
  }

  // Old API: top-level fields
  if (subscription.current_period_start && subscription.current_period_end) {
    return {
      start: subscription.current_period_start,
      end: subscription.current_period_end,
    };
  }

  // Fallback: use billing_cycle_anchor + price interval
  if (subscription.billing_cycle_anchor) {
    const start = subscription.billing_cycle_anchor;
    const interval = item?.price?.recurring?.interval || 'month';
    const intervalCount = item?.price?.recurring?.interval_count || 1;
    const startDate = new Date(start * 1000);
    if (interval === 'year') {
      startDate.setFullYear(startDate.getFullYear() + intervalCount);
    } else {
      startDate.setMonth(startDate.getMonth() + intervalCount);
    }
    return { start, end: Math.floor(startDate.getTime() / 1000) };
  }

  return { start: null, end: null };
}

/**
 * Step 2: Create a subscription using the payment method collected via SetupIntent.
 * Returns { subscriptionId, customerId }
 */
async function createSubscriptionWithPayment({ customerId, planCode, workspaceId, paymentMethodId }) {
  const s = getStripe();
  const priceId = getStripePriceId(planCode);
  if (!priceId) {
    log.error('No Stripe Price ID configured for plan', { planCode });
    throw new Error('No Stripe Price ID configured for this plan');
  }

  await s.paymentMethods.attach(paymentMethodId, { customer: customerId });
  await s.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  const subscription = await s.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'allow_incomplete',
    default_payment_method: paymentMethodId,
    metadata: { workspaceId, planCode },
  });

  const period = getSubscriptionPeriod(subscription);

  return {
    subscriptionId: subscription.id,
    customerId,
    status: subscription.status,
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
  };
}

/**
 * Create a Stripe Checkout Session for subscribing to a plan
 */
async function createCheckoutSession({ customerEmail, planCode, workspaceId, successUrl, cancelUrl }) {
  const s = getStripe();
  const priceId = getStripePriceId(planCode);
  if (!priceId) {
    log.error('No Stripe Price ID configured for plan', { planCode });
    throw new Error('No Stripe Price ID configured for this plan');
  }

  const session = await s.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: customerEmail,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { workspaceId, planCode },
    subscription_data: {
      metadata: { workspaceId, planCode },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  return session;
}

/**
 * Create a Stripe Customer
 */
async function createCustomer({ email, name, workspaceId }) {
  const s = getStripe();
  return s.customers.create({
    email,
    name,
    metadata: { workspaceId },
  });
}

/**
 * Retrieve a subscription from Stripe
 */
async function retrieveSubscription(stripeSubscriptionId) {
  const s = getStripe();
  return s.subscriptions.retrieve(stripeSubscriptionId);
}

/**
 * Upgrade a subscription immediately with proration.
 * Creates and pays an invoice for the prorated difference right away.
 */
async function upgradeSubscription(stripeSubscriptionId, newPlanCode) {
  const s = getStripe();
  const newPriceId = getStripePriceId(newPlanCode);
  if (!newPriceId) {
    log.error('No Stripe Price ID configured for plan', { planCode: newPlanCode });
    throw new Error('No Stripe Price ID configured for this plan');
  }

  const subscription = await s.subscriptions.retrieve(stripeSubscriptionId);
  const itemId = subscription.items.data[0].id;
  const customerId = subscription.customer;

  const updated = await s.subscriptions.update(stripeSubscriptionId, {
    items: [{ id: itemId, price: newPriceId }],
    proration_behavior: 'always_invoice',
  });

  let invoice = null;
  try {
    const latestInvoiceId = updated.latest_invoice;
    if (latestInvoiceId) {
      invoice = await s.invoices.retrieve(latestInvoiceId, { expand: ['payment_intent'] });
    }
  } catch (invErr) {
    log.warn('Failed to retrieve proration invoice during upgrade', { error: invErr.message });
  }

  return { subscription: updated, invoice };
}

/**
 * Schedule a downgrade to take effect at the next billing period
 */
async function scheduleDowngrade(stripeSubscriptionId, newPlanCode) {
  const s = getStripe();
  const newPriceId = getStripePriceId(newPlanCode);
  if (!newPriceId) {
    log.error('No Stripe Price ID configured for plan', { planCode: newPlanCode });
    throw new Error('No Stripe Price ID configured for this plan');
  }

  const subscription = await s.subscriptions.retrieve(stripeSubscriptionId);
  const itemId = subscription.items.data[0].id;

  return s.subscriptions.update(stripeSubscriptionId, {
    items: [{ id: itemId, price: newPriceId }],
    proration_behavior: 'none',
  });
}

/**
 * Cancel a subscription at period end
 */
async function cancelSubscriptionAtPeriodEnd(stripeSubscriptionId) {
  const s = getStripe();
  return s.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: true,
  });
}

/**
 * Reactivate a subscription that was set to cancel at period end
 */
async function reactivateSubscription(stripeSubscriptionId) {
  const s = getStripe();
  return s.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: false,
  });
}

/**
 * Immediately cancel a subscription
 */
async function cancelSubscriptionImmediately(stripeSubscriptionId) {
  const s = getStripe();
  return s.subscriptions.cancel(stripeSubscriptionId);
}

/**
 * Create a SetupIntent for updating payment method
 */
async function createSetupIntent(customerId) {
  const s = getStripe();
  return s.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
  });
}

/**
 * Get the default payment method for a customer
 */
async function getPaymentMethod(customerId) {
  const s = getStripe();
  const customer = await s.customers.retrieve(customerId);
  if (!customer.invoice_settings?.default_payment_method) return null;

  const pm = await s.paymentMethods.retrieve(customer.invoice_settings.default_payment_method);
  return {
    id: pm.id,
    brand: pm.card?.brand,
    last4: pm.card?.last4,
    exp_month: pm.card?.exp_month,
    exp_year: pm.card?.exp_year,
  };
}

/**
 * Preview the prorated charge for upgrading a subscription to a new plan.
 * Returns the upcoming invoice with proration line items.
 */
async function previewUpgradeInvoice(stripeSubscriptionId, newPlanCode) {
  const s = getStripe();
  const newPriceId = getStripePriceId(newPlanCode);
  if (!newPriceId) {
    throw new Error('No Stripe Price ID configured for this plan');
  }

  const subscription = await s.subscriptions.retrieve(stripeSubscriptionId);
  const itemId = subscription.items.data[0].id;

  const upcoming = await s.invoices.createPreview({
    customer: subscription.customer,
    subscription: stripeSubscriptionId,
    subscription_details: {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: 'create_prorations',
    },
  });

  const prorationLines = (upcoming.lines?.data || []).filter(l => {
    const parentType = l.parent?.type;
    const details = parentType ? l.parent?.[parentType] : null;
    return details?.proration === true;
  });
  const prorationAmount = prorationLines.reduce((sum, l) => sum + (l.amount || 0), 0);

  return {
    total: upcoming.total,
    subtotal: upcoming.subtotal,
    tax: upcoming.tax,
    currency: upcoming.currency,
    proration_amount: prorationAmount,
  };
}

/**
 * List invoices from Stripe for a customer
 */
async function listStripeInvoices(customerId, { limit = 10, startingAfter } = {}) {
  const s = getStripe();
  return s.invoices.list({
    customer: customerId,
    limit,
    ...(startingAfter && { starting_after: startingAfter }),
  });
}

/**
 * Retrieve a single invoice from Stripe
 */
async function retrieveStripeInvoice(invoiceId) {
  const s = getStripe();
  return s.invoices.retrieve(invoiceId);
}

module.exports = {
  getStripe,
  getStripePriceId,
  findOrCreateCustomer,
  createSubscriptionSetup,
  createSubscriptionWithPayment,
  createCheckoutSession,
  createCustomer,
  retrieveSubscription,
  getSubscriptionPeriod,
  upgradeSubscription,
  scheduleDowngrade,
  cancelSubscriptionAtPeriodEnd,
  reactivateSubscription,
  cancelSubscriptionImmediately,
  createSetupIntent,
  getPaymentMethod,
  previewUpgradeInvoice,
  listStripeInvoices,
  retrieveStripeInvoice,
};
