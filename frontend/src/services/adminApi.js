import axios from 'axios';

const adminApi = axios.create({
  baseURL: '/api/admin',
  timeout: 30000,
});

// Request interceptor: attach JWT from localStorage
adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminAccessToken');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle auth errors
adminApi.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    // If 401 and not already retrying and not the refresh endpoint itself
    if (
      err.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes('/auth/refresh') &&
      !original.url?.includes('/auth/login')
    ) {
      // Clear admin token and redirect to admin login
      localStorage.removeItem('adminAccessToken');
      localStorage.removeItem('adminRefreshToken');
      window.location.href = '/admin/login';
    }

    const message = err.response?.data?.error || err.message || 'Something went wrong';
    return Promise.reject(new Error(message));
  }
);

export default adminApi;
