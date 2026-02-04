import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setToken: (token: string) => void;
  clearAuth: () => void;
  fetchUser: () => Promise<void>;
  bootstrap: (bootstrapToken: string, email: string, name: string) => Promise<string>;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setToken: (token: string) => {
        api.setToken(token);
        set({ token, isAuthenticated: true });
      },

      clearAuth: () => {
        api.setToken(null);
        set({ token: null, user: null, isAuthenticated: false, error: null });
      },

      fetchUser: async () => {
        const { token } = get();
        if (!token) return;

        set({ isLoading: true, error: null });
        try {
          api.setToken(token);
          const user = await api.getMe();
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Failed to fetch user',
            isLoading: false,
            isAuthenticated: false,
          });
        }
      },

      bootstrap: async (bootstrapToken: string, email: string, name: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.bootstrap({
            token: bootstrapToken,
            email,
            name,
          });

          api.setToken(response.api_token);
          set({
            token: response.api_token,
            isAuthenticated: true,
            isLoading: false,
            user: {
              id: response.user_id,
              email,
              name,
              roles: ['admin'],
            },
          });

          return response.api_token;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Bootstrap failed';
          set({ error: message, isLoading: false });
          throw err;
        }
      },
    }),
    {
      name: 'fold-auth',
      partialize: (state) => ({ token: state.token }),
      onRehydrateStorage: () => (state) => {
        // After hydration, sync token to API client and set isAuthenticated
        if (state?.token) {
          api.setToken(state.token);
          state.isAuthenticated = true;
        }
      },
    }
  )
);
