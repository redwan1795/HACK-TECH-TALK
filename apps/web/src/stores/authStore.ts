import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../lib/api';
import type { User, AuthLoginRequest, AuthRegisterRequest } from '@community-garden/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (data: AuthLoginRequest) => Promise<void>;
  register: (data: AuthRegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string, user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setTokens: (accessToken, refreshToken, user) => {
        localStorage.setItem('accessToken', accessToken);
        set({ accessToken, refreshToken, user, isAuthenticated: true });
      },

      login: async (data) => {
        const res = await apiClient.post('/auth/login', data);
        get().setTokens(res.data.accessToken, res.data.refreshToken, res.data.user);
      },

      register: async (data) => {
        const res = await apiClient.post('/auth/register', data);
        get().setTokens(res.data.accessToken, res.data.refreshToken, res.data.user);
      },

      logout: async () => {
        const { refreshToken } = get();
        try {
          if (refreshToken) {
            await apiClient.post('/auth/logout', { refreshToken });
          }
        } finally {
          localStorage.removeItem('accessToken');
          set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Keep the separate accessToken key in sync so the apiClient interceptor
        // can read it after a page refresh (it only reads localStorage, not Zustand).
        if (state?.accessToken) {
          localStorage.setItem('accessToken', state.accessToken);
        }
      },
    }
  )
);
