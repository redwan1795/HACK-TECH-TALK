import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole =
  | 'producer_home'
  | 'producer_farmer'
  | 'consumer'
  | 'broker'
  | 'mentor'
  | 'operator';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  displayName: string | null;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;

  setAuth: (data: { user: AuthUser; accessToken: string; refreshToken: string }) => void;
  setAccessToken: (token: string) => void;
  clear: () => void;

  isAuthenticated: () => boolean;
  hasRole: (...roles: UserRole[]) => boolean;
  isProducer: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      setAuth: ({ user, accessToken, refreshToken }) =>
        set({ user, accessToken, refreshToken }),

      setAccessToken: (accessToken) => set({ accessToken }),

      clear: () => set({ user: null, accessToken: null, refreshToken: null }),

      isAuthenticated: () => !!get().accessToken && !!get().user,

      hasRole: (...roles) => {
        const u = get().user;
        return !!u && roles.includes(u.role);
      },

      isProducer: () => {
        const r = get().user?.role;
        return r === 'producer_home' || r === 'producer_farmer';
      },
    }),
    {
      name: 'cg-auth',
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
      }),
    }
  )
);
