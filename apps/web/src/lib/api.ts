import axios, { AxiosError } from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token on every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 — attempt one refresh, then redirect to /login
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config) & { _retry?: boolean };
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers!['Authorization'] = `Bearer ${token}`;
        return apiClient(original);
      });
    }
    original._retry = true;
    isRefreshing = true;

    const stored = JSON.parse(localStorage.getItem('auth-storage') ?? '{}');
    const refreshToken = stored?.state?.refreshToken as string | undefined;

    if (!refreshToken) {
      isRefreshing = false;
      window.location.href = '/login';
      return Promise.reject(error);
    }

    try {
      const { data } = await apiClient.post('/auth/refresh', { refreshToken });
      localStorage.setItem('accessToken', data.accessToken);
      if (stored?.state) {
        stored.state.accessToken = data.accessToken;
        stored.state.refreshToken = data.refreshToken;
        localStorage.setItem('auth-storage', JSON.stringify(stored));
      }
      processQueue(null, data.accessToken);
      original.headers!['Authorization'] = `Bearer ${data.accessToken}`;
      return apiClient(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('auth-storage');
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
