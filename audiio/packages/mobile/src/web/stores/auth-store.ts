/**
 * Auth Store - Manages authentication state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Token accessor - will be set after store is created
let getToken: () => string | null = () => null;

/**
 * Fetch wrapper that includes token and headers needed for localtunnel bypass
 * Automatically adds the auth token to all /api requests
 */
export async function tunnelFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();

  // Add token to URL if it's an API call
  let finalUrl = url;
  if (token && url.startsWith('/api')) {
    const separator = url.includes('?') ? '&' : '?';
    finalUrl = `${url}${separator}token=${token}`;
  }

  return fetch(finalUrl, {
    ...options,
    headers: {
      'Bypass-Tunnel-Reminder': 'true',
      ...options.headers,
    }
  });
}

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  isValidating: boolean;
  error: string | null;

  // Actions
  setToken: (token: string) => void;
  validateToken: () => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      isAuthenticated: false,
      isValidating: false,
      error: null,

      setToken: (token) => {
        set({ token, error: null });
      },

      validateToken: async () => {
        const { token } = get();

        if (!token) {
          set({ isAuthenticated: false });
          return false;
        }

        set({ isValidating: true, error: null });

        try {
          const response = await tunnelFetch(`/api/health?token=${token}`);

          if (response.ok) {
            set({ isAuthenticated: true, isValidating: false });
            return true;
          } else {
            set({
              isAuthenticated: false,
              isValidating: false,
              error: 'Invalid or expired token',
              token: null
            });
            return false;
          }
        } catch (error) {
          set({
            isAuthenticated: false,
            isValidating: false,
            error: 'Unable to connect to server'
          });
          return false;
        }
      },

      logout: () => {
        set({
          token: null,
          isAuthenticated: false,
          error: null
        });
      }
    }),
    {
      name: 'audiio-mobile-auth',
      partialize: (state) => ({ token: state.token })
    }
  )
);

// Set up the token accessor after store is created
getToken = () => useAuthStore.getState().token;
