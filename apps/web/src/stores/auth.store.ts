import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRole } from '@3pl/shared';
import type { UserDetail } from '../types';
import { decodeAccessToken } from '../lib/jwt';
import * as authApi from '../api/auth';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserDetail | null;

  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: UserDetail | null) => void;
  loadCurrentUser: () => Promise<void>;
  refreshSession: () => Promise<string | null>;
  logout: () => Promise<void>;
  clear: () => void;

  hasPermission: (key: string) => boolean;
  hasRole: (...roles: UserRole[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,

      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),

      loadCurrentUser: async () => {
        if (!get().accessToken) return;
        try {
          set({ user: await authApi.me() });
        } catch {
          /* route guard / interceptor handles the redirect */
        }
      },

      refreshSession: async () => {
        const rt = get().refreshToken;
        if (!rt) return null;
        try {
          const tokens = await authApi.refresh(rt);
          set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
          return tokens.accessToken;
        } catch {
          get().clear();
          return null;
        }
      },

      logout: async () => {
        const rt = get().refreshToken;
        try {
          if (rt) await authApi.logout(rt);
        } catch {
          /* best-effort */
        } finally {
          get().clear();
        }
      },

      clear: () => set({ accessToken: null, refreshToken: null, user: null }),

      hasPermission: (key) => {
        const claims = decodeAccessToken(get().accessToken);
        return claims?.permissions.includes(key) ?? false;
      },

      hasRole: (...roles) => {
        const claims = decodeAccessToken(get().accessToken);
        return claims?.roles.some((r) => roles.includes(r)) ?? false;
      },
    }),
    {
      name: '3pl-auth',
      partialize: (s) => ({ accessToken: s.accessToken, refreshToken: s.refreshToken }),
    },
  ),
);

export function isAuthenticated(): boolean {
  return Boolean(useAuthStore.getState().accessToken);
}
