import { create } from 'zustand';
import api from '../services/api';

export const useStore = create((set, get) => ({
  // ── Meetings ──────────────────────────────────────────────────────────────
  meetings: [],
  meetingsLoading: false,

  fetchMeetings: async () => {
    set({ meetingsLoading: true });
    try {
      const { data } = await api.get('/meetings');
      set({ meetings: data });
    } catch (err) {
      console.error('fetchMeetings:', err.message);
    } finally {
      set({ meetingsLoading: false });
    }
  },

  addMeeting: (meeting) =>
    set((s) => ({ meetings: [meeting, ...s.meetings] })),

  updateMeeting: (id, patch) =>
    set((s) => ({
      meetings: s.meetings.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),

  removeMeeting: (id) =>
    set((s) => ({ meetings: s.meetings.filter((m) => m.id !== id) })),

  // ── Tasks ─────────────────────────────────────────────────────────────────
  tasks: [],
  tasksLoading: false,

  fetchTasks: async (filters = {}) => {
    set({ tasksLoading: true });
    try {
      const { data } = await api.get('/tasks', { params: filters });
      set({ tasks: data });
    } catch (err) {
      console.error('fetchTasks:', err.message);
    } finally {
      set({ tasksLoading: false });
    }
  },

  updateTask: async (id, patch) => {
    const { data } = await api.patch(`/tasks/${id}`, patch);
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? data : t)),
    }));
    return data;
  },

  deleteTask: async (id) => {
    await api.delete(`/tasks/${id}`);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
  },

  // ── Stats ─────────────────────────────────────────────────────────────────
  stats: null,
  fetchStats: async () => {
    try {
      const { data } = await api.get('/tasks/stats/summary');
      set({ stats: data });
    } catch (err) {
      console.error('fetchStats:', err.message);
    }
  },

  // ── Integrations ──────────────────────────────────────────────────────────
  integrations: [],
  fetchIntegrations: async () => {
    try {
      const { data } = await api.get('/integrations');
      set({ integrations: data });
    } catch (err) {
      console.error('fetchIntegrations:', err.message);
    }
  },

  toggleIntegration: async (provider, config = {}) => {
    const current = get().integrations.find((i) => i.provider === provider);
    if (current?.enabled) {
      await api.delete(`/integrations/${provider}`);
    } else {
      await api.post(`/integrations/${provider}`, { config });
    }
    await get().fetchIntegrations();
  },

  // ── Processing state (live via WebSocket) ─────────────────────────────────
  processingStates: {},

  setProcessingStep: (meetingId, step) =>
    set((s) => ({
      processingStates: {
        ...s.processingStates,
        [meetingId]: {
          ...(s.processingStates[meetingId] || {}),
          steps: [...(s.processingStates[meetingId]?.steps || []), step],
          status: 'processing',
        },
      },
    })),

  setProcessingDone: (meetingId, result) =>
    set((s) => ({
      processingStates: {
        ...s.processingStates,
        [meetingId]: { ...(s.processingStates[meetingId] || {}), status: 'done', result },
      },
    })),

  setProcessingError: (meetingId, message) =>
    set((s) => ({
      processingStates: {
        ...s.processingStates,
        [meetingId]: { ...(s.processingStates[meetingId] || {}), status: 'error', message },
      },
    })),
}));
