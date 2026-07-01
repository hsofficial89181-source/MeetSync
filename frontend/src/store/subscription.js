/**
 * Subscription Store
 *
 * Manages subscription, usage, and invoice state for the billing system.
 */

import { create } from 'zustand';
import api from '../services/api';

export const useSubscriptionStore = create((set, get) => ({
  // ── State ──────────────────────────────────────────────────────────────
  plans: [],
  subscription: null,
  usage: null,
  invoices: [],
  invoiceDetail: null,
  history: [],
  paymentMethod: null,
  loading: {
    plans: false,
    subscription: false,
    usage: false,
    invoices: false,
    invoiceDetail: false,
    history: false,
  },
  error: null,

  // ── Actions ────────────────────────────────────────────────────────────

  fetchPlans: async () => {
    set((s) => ({ loading: { ...s.loading, plans: true } }));
    try {
      const { data } = await api.get('/subscriptions/plans');
      set({ plans: data });
    } catch (err) {
      console.error('fetchPlans:', err.message);
    } finally {
      set((s) => ({ loading: { ...s.loading, plans: false } }));
    }
  },

  fetchSubscription: async () => {
    set((s) => ({ loading: { ...s.loading, subscription: true } }));
    try {
      const { data } = await api.get('/subscriptions/current');
      set({ subscription: data, paymentMethod: data.payment_method });
      return data;
    } catch (err) {
      console.error('fetchSubscription:', err.message);
    } finally {
      set((s) => ({ loading: { ...s.loading, subscription: false } }));
    }
  },

  fetchUsage: async () => {
    set((s) => ({ loading: { ...s.loading, usage: true } }));
    try {
      const { data } = await api.get('/subscriptions/usage');
      set({ usage: data });
      return data;
    } catch (err) {
      console.error('fetchUsage:', err.message);
    } finally {
      set((s) => ({ loading: { ...s.loading, usage: false } }));
    }
  },

  initSubscription: async (planCode) => {
    const { data } = await api.post('/subscriptions/subscribe', { planCode });
    return data;
  },

  confirmSubscription: async ({ customerId, planCode, paymentMethodId }) => {
    const { data } = await api.post('/subscriptions/confirm-subscription', {
      customerId, planCode, paymentMethodId,
    });
    return data;
  },

  upgradePlan: async (planCode) => {
    const { data } = await api.post('/subscriptions/upgrade', { planCode });
    await get().fetchSubscription();
    await get().fetchUsage();
    await get().fetchInvoices();
    return data;
  },

  previewUpgrade: async (planCode) => {
    const { data } = await api.get('/subscriptions/upgrade-preview', { params: { planCode } });
    return data;
  },

  downgradePlan: async (planCode) => {
    const { data } = await api.post('/subscriptions/downgrade', { planCode });
    await get().fetchSubscription();
    await get().fetchUsage();
    return data;
  },

  cancelSubscription: async () => {
    const { data } = await api.post('/subscriptions/cancel');
    await get().fetchSubscription();
    return data;
  },

  reactivateSubscription: async () => {
    const { data } = await api.post('/subscriptions/reactivate');
    await get().fetchSubscription();
    return data;
  },

  fetchHistory: async () => {
    set((s) => ({ loading: { ...s.loading, history: true } }));
    try {
      const { data } = await api.get('/subscriptions/history');
      set({ history: data });
    } catch (err) {
      console.error('fetchHistory:', err.message);
    } finally {
      set((s) => ({ loading: { ...s.loading, history: false } }));
    }
  },

  fetchInvoices: async (params = {}) => {
    set((s) => ({ loading: { ...s.loading, invoices: true } }));
    try {
      const { data } = await api.get('/invoices', { params });
      set({ invoices: data.invoices, invoicePagination: data.pagination });
      return data;
    } catch (err) {
      console.error('fetchInvoices:', err.message);
    } finally {
      set((s) => ({ loading: { ...s.loading, invoices: false } }));
    }
  },

  fetchInvoiceDetail: async (id) => {
    set((s) => ({ loading: { ...s.loading, invoiceDetail: true } }));
    try {
      const { data } = await api.get(`/invoices/${id}`);
      set({ invoiceDetail: data });
      return data;
    } catch (err) {
      console.error('fetchInvoiceDetail:', err.message);
    } finally {
      set((s) => ({ loading: { ...s.loading, invoiceDetail: false } }));
    }
  },

  downloadInvoice: async (id) => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`/api/invoices/${id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to download invoice');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },

  fetchPaymentMethod: async () => {
    try {
      const { data } = await api.get('/subscriptions/payment-method');
      set({ paymentMethod: data.payment_method });
      return data.payment_method;
    } catch (err) {
      console.error('fetchPaymentMethod:', err.message);
    }
  },

  setupPaymentMethod: async () => {
    const { data } = await api.post('/subscriptions/payment-method/setup');
    return data.client_secret;
  },

  // Convenience: fetch all billing data at once
  fetchAll: async () => {
    await Promise.all([
      get().fetchPlans(),
      get().fetchSubscription(),
      get().fetchUsage(),
      get().fetchInvoices(),
    ]);
  },
}));
