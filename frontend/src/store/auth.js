/**
 * Auth Store
 *
 * Single source of truth for authentication state.
 * Token storage: localStorage only.
 * Token injection: api.js interceptor reads from localStorage on every request.
 * No redundant api.defaults.headers manipulation here — that caused sync issues.
 */

import { create } from 'zustand';
import api from '../services/api';

export const useAuthStore = create((set) => ({
  user:            null,
  workspace:       null,
  isLoading:       true,
  isAuthenticated: false,

  /** Called once on app mount — restores session from stored token */
  init: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      set({
        user:            data,
        workspace:       { id: data.workspace_id, name: data.workspace_name, slug: data.workspace_slug },
        isAuthenticated: true,
        isLoading:       false,
      });
    } catch {
      // Token invalid or expired — api.js interceptor already tried refresh
      // If we reach here, refresh also failed → clear and go to login
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('accessToken',  data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    set({
      user:            data.user,
      workspace:       data.workspace,
      isAuthenticated: true,
    });
    return data;
  },

  register: async (name, email, password, workspaceName) => {
    const { data } = await api.post('/auth/register', { name, email, password, workspaceName });
    localStorage.setItem('accessToken',  data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    set({
      user:            data.user,
      workspace:       data.workspace,
      isAuthenticated: true,
    });
    return data;
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try { await api.post('/auth/logout', { refreshToken }); } catch {}
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, workspace: null, isAuthenticated: false });
  },

  updateUser: (patch) => set((s) => ({ user: { ...s.user, ...patch } })),
  updateWorkspace: (patch) => set((s) => ({ workspace: { ...s.workspace, ...patch } })),
}));
