/**
 * Auth Store - Manages authentication state
 *
 * When connected via P2P, API calls are routed through the P2P connection.
 * When on local network, API calls go directly to the server.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isP2PConnected, p2pApiRequest } from './p2p-store';

// Token accessor - will be set after store is created
let getToken: () => string | null = () => null;

/**
 * Fetch wrapper that routes API calls through P2P when connected,
 * or falls back to direct HTTP for local network access.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();

  // Try P2P first if connected
  if (isP2PConnected()) {
    const body = options.body ? JSON.parse(options.body as string) : undefined;
    const p2pResponse = await p2pApiRequest(url, {
      method: options.method as string,
      body
    });

    if (p2pResponse) {
      // Create a Response-like object from P2P response
      return new Response(JSON.stringify(p2pResponse.data), {
        status: p2pResponse.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Fall back to direct HTTP (local network)
  let finalUrl = url;
  if (token && url.startsWith('/api')) {
    const separator = url.includes('?') ? '&' : '?';
    finalUrl = `${url}${separator}token=${token}`;
  }

  return fetch(finalUrl, options);
}

// Alias for backwards compatibility
export const tunnelFetch = apiFetch;

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  isValidating: boolean;
  isPairing: boolean;
  error: string | null;

  // Actions
  setToken: (token: string) => void;
  validateToken: () => Promise<boolean>;
  pairWithCode: (pairingCode: string) => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      isAuthenticated: false,
      isValidating: false,
      isPairing: false,
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

      pairWithCode: async (pairingCode: string) => {
        set({ isPairing: true, error: null });

        try {
          const response = await fetch('/api/auth/pair', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ pairingCode })
          });

          const data = await response.json();

          if (data.success && data.deviceToken) {
            // Store device token for future connections
            localStorage.setItem('audiio-device-token', data.deviceToken);
            localStorage.setItem('audiio-device-id', data.deviceId);

            // Extract token part for session auth
            const tokenPart = data.deviceToken.split(':')[1];
            if (tokenPart) {
              set({ token: tokenPart, isAuthenticated: true, isPairing: false });
              return true;
            }
          }

          // Pairing failed
          set({
            isPairing: false,
            error: data.error || 'Pairing failed'
          });
          return false;
        } catch (error) {
          set({
            isPairing: false,
            error: 'Unable to connect to server'
          });
          return false;
        }
      },

      logout: () => {
        localStorage.removeItem('audiio-device-token');
        localStorage.removeItem('audiio-device-id');
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
