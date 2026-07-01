import React, { useState, useEffect, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  Loader2, Lock, CheckCircle2, AlertCircle, ShieldCheck, ArrowLeft,
  Zap, Check,
} from 'lucide-react';
import { useSubscriptionStore } from '../../store/subscription';

function formatCents(cents) {
  return `$${(cents / 100).toFixed(0)}`;
}

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ''
);

const elementOptions = {
  style: {
    base: {
      color: '#F0F2FF',
      backgroundColor: '#1E2230',
      fontFamily: 'DM Sans, sans-serif',
      fontSize: '15px',
      '::placeholder': { color: '#555E80' },
      iconColor: '#555E80',
    },
    invalid: {
      color: '#EF4444',
      iconColor: '#EF4444',
    },
    complete: {
      color: '#22C55E',
      iconColor: '#22C55E',
    },
  },
  classes: { focus: 'stripe-focus', invalid: 'stripe-invalid' },
};

const fieldWrapperStyle = {
  position: 'relative',
  background: '#1E2230',
  border: '1px solid #2A2F42',
  borderRadius: 10,
  padding: '14px 14px',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const MONTHLY_PRICE_CENTS = {
  starter:      9900,
  professional: 29900,
  business:     79900,
  enterprise:   349900,
};

const PLAN_FEATURES = {
  starter: ['10 meeting hours/month', 'AI transcription & summaries', 'Task extraction', 'Email support'],
  professional: ['30 meeting hours/month', 'AI transcription & summaries', 'Task extraction', 'Priority support', 'Advanced analytics'],
  business: ['80 meeting hours/month', 'AI transcription & summaries', 'Task extraction', 'Priority support', 'Advanced analytics', 'Team collaboration'],
  enterprise: ['350 meeting hours/month', 'AI transcription & summaries', 'Task extraction', 'Dedicated support', 'Advanced analytics', 'Team collaboration', 'Custom integrations'],
};

function FieldLabel({ children, complete, error }) {
  return (
    <label style={{
      display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text2)',
      marginBottom: 6, transition: 'color 0.15s',
      ...(complete && { color: 'var(--green)' }),
      ...(error && { color: 'var(--red)' }),
    }}>
      {children}
    </label>
  );
}

function CheckoutForm({ plan, customerId, clientSecret, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const cardNumberRef = useRef(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [nameBlurred, setNameBlurred] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState(false);
  const [expiryComplete, setExpiryComplete] = useState(false);
  const [expiryError, setExpiryError] = useState(false);
  const [cvcComplete, setCvcComplete] = useState(false);
  const [cvcError, setCvcError] = useState(false);
  const { confirmSubscription } = useSubscriptionStore();

  const nameValid = cardholderName.trim().length > 0;
  const nameError = nameBlurred && !nameValid;
  const allComplete = nameValid && cardComplete && expiryComplete && cvcComplete;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError('');

    const cardNumberElement = elements.getElement(CardNumberElement);

    const { error: setupError, setupIntent } = await stripe.confirmCardSetup(
      clientSecret,
      {
        payment_method: {
          card: cardNumberElement,
          billing_details: { name: cardholderName.trim() },
        },
      }
    );

    if (setupError) {
      setError(
        setupError.type === 'card_error' || setupError.type === 'validation_error'
          ? setupError.message
          : 'An unexpected error occurred. Please try again.'
      );
      setProcessing(false);
      return;
    }

    try {
      const result = await confirmSubscription({
        customerId,
        planCode: plan.code,
        paymentMethodId: setupIntent.payment_method,
      });
      if (result.status === 'active' || result.status === 'trial') {
        onSuccess();
      } else {
        setError('Payment requires additional verification. Please try again or contact support.');
        setProcessing(false);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create subscription. Please try again.');
      setProcessing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 10, padding: '12px 14px', marginBottom: 20,
          fontSize: 13, color: '#dc2626', display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Cardholder Name */}
      <div style={{ marginBottom: 16 }}>
        <FieldLabel complete={nameValid && nameBlurred} error={nameError}>Cardholder Name</FieldLabel>
        <div style={{
          ...fieldWrapperStyle,
          ...(nameError && { borderColor: 'var(--red)' }),
          ...(nameValid && nameBlurred && { borderColor: 'rgba(34,197,94,0.4)' }),
          padding: 0,
        }}>
          <input
            type="text"
            value={cardholderName}
            onChange={e => setCardholderName(e.target.value)}
            onBlur={() => setNameBlurred(true)}
            placeholder="Name on card"
            autoComplete="cc-name"
            style={{
              display: 'block', width: '100%', background: 'transparent',
              border: 'none', outline: 'none',
              color: cardholderName ? '#F0F2FF' : '#555E80',
              fontFamily: 'DM Sans, sans-serif', fontSize: '15px',
              padding: '14px 14px',
            }}
          />
        </div>
      </div>

      {/* Card Number */}
      <div style={{ marginBottom: 16 }}>
        <FieldLabel complete={cardComplete} error={cardError}>Card Number</FieldLabel>
        <div style={{
          ...fieldWrapperStyle,
          ...(cardError && { borderColor: 'var(--red)' }),
          ...(cardComplete && !cardError && { borderColor: 'rgba(34,197,94,0.4)' }),
        }}>
          <CardNumberElement
            ref={cardNumberRef}
            options={elementOptions}
            onChange={(e) => {
              setCardComplete(e.complete);
              setCardError(!!e.error);
            }}
          />
        </div>
      </div>

      {/* Expiry + CVC */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
        <div>
          <FieldLabel complete={expiryComplete} error={expiryError}>Expiry</FieldLabel>
          <div style={{
            ...fieldWrapperStyle,
            ...(expiryError && { borderColor: 'var(--red)' }),
            ...(expiryComplete && !expiryError && { borderColor: 'rgba(34,197,94,0.4)' }),
          }}>
            <CardExpiryElement
              options={elementOptions}
              onChange={(e) => {
                setExpiryComplete(e.complete);
                setExpiryError(!!e.error);
              }}
            />
          </div>
        </div>
        <div>
          <FieldLabel complete={cvcComplete} error={cvcError}>CVC</FieldLabel>
          <div style={{
            ...fieldWrapperStyle,
            ...(cvcError && { borderColor: 'var(--red)' }),
            ...(cvcComplete && !cvcError && { borderColor: 'rgba(34,197,94,0.4)' }),
          }}>
            <CardCvcElement
              options={elementOptions}
              onChange={(e) => {
                setCvcComplete(e.complete);
                setCvcError(!!e.error);
              }}
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={!stripe || !allComplete || processing}
        style={{
          width: '100%', marginTop: 4, padding: '13px 20px', fontSize: 15, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: processing || !allComplete ? 'rgba(91,106,240,0.6)' : 'var(--accent2)',
          color: '#fff', border: 'none', borderRadius: 10, cursor: processing ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s',
          boxShadow: allComplete && !processing ? '0 4px 14px rgba(91,106,240,0.35)' : 'none',
        }}
      >
        {processing ? (
          <><Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> Processing…</>
        ) : (
          <><Lock size={15} /> Subscribe & Pay {formatCents(plan?.price_cents)}/{plan?.interval === 'year' ? 'yr' : 'mo'}</>
        )}
      </button>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        marginTop: 14, fontSize: 12, color: 'var(--text3)',
      }}>
        <ShieldCheck size={13} />
        <span>256-bit SSL · Secured by Stripe · Never stored on our servers</span>
      </div>
    </form>
  );
}

export default function Checkout({ plan, onClose, onSuccess }) {
  const { initSubscription } = useSubscriptionStore();

  const [clientSecret, setClientSecret] = useState(null);
  const [customerId, setCustomerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!plan) return;
    let cancelled = false;

    async function init() {
      try {
        const result = await initSubscription(plan.code);
        if (!cancelled) {
          setClientSecret(result.clientSecret);
          setCustomerId(result.customerId);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.message || 'Failed to initialize payment');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();

    return () => { cancelled = true; };
  }, [plan?.code]);

  async function handleSuccess() {
    setSuccess(true);
    if (onSuccess) await onSuccess();
    setTimeout(() => onClose(), 2500);
  }

  function handleRetry() {
    setLoadError('');
    setLoading(true);
    setClientSecret(null);
  }

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px' }}>
        <CheckCircle2 size={56} style={{ color: 'var(--green)', margin: '0 auto 20px' }} />
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Payment Successful!
        </h2>
        <p style={{ fontSize: 15, color: 'var(--text2)', marginBottom: 8 }}>
          Your <strong>{plan?.name}</strong> subscription is now active.
        </p>
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>
          Redirecting to billing…
        </p>
        <Loader2 size={20} style={{ margin: '20px auto 0', color: 'var(--text3)', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onClose}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
          color: 'var(--text2)', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans, sans-serif',
          transition: 'color 0.15s', marginBottom: 20,
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text2)'}
      >
        <ArrowLeft size={14} />
        Back to Plans
      </button>

      <div style={checkoutGridStyle} className="checkout-grid">
        {/* Left: Plan summary */}
        <div style={summaryCardStyle} className="checkout-summary">
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 12 }}>
            Order Summary
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              {plan?.name?.replace(' (Yearly)', '')}
            </div>
            {plan?.interval === 'year' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent2)' }}>
                    {formatCents(Math.round((plan?.price_cents || 0) / 12))}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--text3)' }}>/month</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                  Billed {formatCents(plan?.price_cents)} annually · <span style={{ color: '#16a34a', fontWeight: 600 }}>{(() => { const base = plan?.code?.replace('_yearly', ''); const monthly = MONTHLY_PRICE_CENTS[base]; return monthly ? `Save ${Math.round((1 - plan.price_cents / (monthly * 12)) * 100)}%` : ''; })()}</span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent2)' }}>
                  {formatCents(plan?.price_cents)}
                </span>
                <span style={{ fontSize: 14, color: 'var(--text3)' }}>/month</span>
              </div>
            )}
          </div>

          <div style={{
            background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: 'rgba(91,106,240,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Zap size={16} style={{ color: 'var(--accent2)' }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                {plan?.hours_limit} meeting hours
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                Per billing cycle
              </div>
            </div>
          </div>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {(PLAN_FEATURES[plan?.code?.replace('_yearly', '')] || PLAN_FEATURES.starter).map((feature, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: 'rgba(34,197,94,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Check size={11} style={{ color: 'var(--green)' }} />
                </div>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>{feature}</span>
              </div>
            ))}
          </div>

          {/* Order total */}
          <div style={{
            borderTop: '1px solid var(--border)', paddingTop: 16,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text2)' }}>
              <span>Subtotal</span>
              <span>{formatCents(plan?.price_cents)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text2)' }}>
              <span>Tax</span>
              <span>Calculated by Stripe</span>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700,
              color: 'var(--text)', paddingTop: 8, borderTop: '1px solid var(--border)',
            }}>
              <span>Total</span>
              <span>{formatCents(plan?.price_cents)}/{plan?.interval === 'year' ? 'yr' : 'mo'}</span>
            </div>
          </div>
        </div>

        {/* Right: Payment form */}
        <div style={paymentCardStyle} className="checkout-payment">
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              Payment Details
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text3)' }}>
              Enter your card information to complete your subscription.
            </p>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <Loader2 size={32} style={{ color: 'var(--accent2)', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
              <div style={{ fontSize: 14, color: 'var(--text3)', marginTop: 16 }}>
                Preparing secure payment…
              </div>
            </div>
          ) : loadError ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <AlertCircle size={36} style={{ color: 'var(--red)', margin: '0 auto 14px' }} />
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
                Payment Setup Failed
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20, lineHeight: 1.5 }}>
                {loadError}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button className="btn btn-ghost btn-sm" onClick={onClose}>
                  Back to Plans
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleRetry}>
                  Try Again
                </button>
              </div>
            </div>
          ) : clientSecret ? (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm plan={plan} customerId={customerId} clientSecret={clientSecret} onSuccess={handleSuccess} />
            </Elements>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const checkoutGridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 24,
  alignItems: 'start',
};

const summaryCardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: '28px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
};

const paymentCardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: '28px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
};
