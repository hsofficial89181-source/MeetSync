/**
 * Admin Auth Store
 *
 * Separate auth store for Super Admin (isolated from regular app auth)
 * Token storage: localStorage with separate keys (adminAccessToken, adminRefreshToken)
 */

import { create } from 'zustand';
import adminApi from '../services/adminApi';

export const useAdminAuthStore = create((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  /** Called once on admin app mount - restores session from stored token */
  init: async () => {
    const token = localStorage.getItem('adminAccessToken');
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }
    try {
      const { data } = await adminApi.get('/auth/me');
      set({
        user: data,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      localStorage.removeItem('adminAccessToken');
      localStorage.removeItem('adminRefreshToken');
      set({
        isLoading: false,
        isAuthenticated: false,
        error: 'Session expired. Please log in again.',
      });
    }
  },

  login: async (email, password) => {
    try {
      set({ error: null });
      const { data } = await adminApi.post('/auth/login', { email, password });
      localStorage.setItem('adminAccessToken', data.accessToken);
      localStorage.setItem('adminRefreshToken', data.refreshToken);
      set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return data;
    } catch (err) {
      set({
        error: err.message || 'Login failed. Please check your credentials.',
        isAuthenticated: false,
      });
      throw err;
    }
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('adminRefreshToken');
    try {
      await adminApi.post('/auth/logout', { refreshToken });
    } catch (err) {
      // Ignore errors on logout
    }
    localStorage.removeItem('adminAccessToken');
    localStorage.removeItem('adminRefreshToken');
    set({ user: null, isAuthenticated: false, error: null });
  },

  clearError: () => set({ error: null }),

  updateUser: (patch) => set((s) => ({ user: { ...s.user, ...patch } })),
}));
