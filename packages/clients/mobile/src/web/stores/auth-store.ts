/**
 * Auth Store - Simplified mobile authentication
 *
 * Single unified flow:
 * 1. Enter WORD-WORD-NUMBER code or scan QR
 * 2. Get device token (auto-approved)
 * 3. Token saved, connection established
 *
 * Auto-routing: Tries local first, falls back to relay.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isP2PConnected, p2pApiRequest } from './p2p-store';

// Device credential (single key for all device info)
interface DeviceCredential {
  token: string;      // Full device token (deviceId:token)
  id: string;         // Device ID
  name?: string;      // Device name (optional)
  localUrl?: string;  // Last known local URL for reconnection
  // Server identity for persistent reconnection (Plex-like)
  serverId?: string;      // Persistent server UUID
  serverName?: string;    // Human-friendly server name
  relayCode?: string;     // Persistent relay code for reconnection
}

// Get stored device credential
function getStoredCredential(): DeviceCredential | null {
  try {
    const stored = localStorage.getItem('audiio-device');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// Store device credential
function storeCredential(credential: DeviceCredential): void {
  localStorage.setItem('audiio-device', JSON.stringify(credential));
}

// Clear device credential
function clearCredential(): void {
  localStorage.removeItem('audiio-device');
  // Also clear legacy keys
  localStorage.removeItem('audiio-device-token');
  localStorage.removeItem('audiio-device-id');
}

// Token accessor - will be set after store is created
let getTokenPart: () => string | null = () => null;

// Get session token from URL (for local access)
function getUrlToken(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('token');
  } catch {
    return null;
  }
}

/**
 * Check if we're running in remote mode (GitHub Pages or other static host)
 * In remote mode, we can only use P2P - direct HTTP won't work
 */
function isRemoteMode(): boolean {
  const host = window.location.hostname;
  return host.includes('github.io') ||
         host.includes('netlify') ||
         host.includes('vercel') ||
         host.includes('pages.dev');
}

/**
 * Fetch wrapper that routes API calls through P2P when connected,
 * or falls back to direct HTTP for local network access.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Try P2P first if connected
  if (isP2PConnected()) {
    const body = options.body ? JSON.parse(options.body as string) : undefined;
    const p2pResponse = await p2pApiRequest(url, {
      method: options.method as string,
      body
    });

    if (p2pResponse) {
      // Debug: log the P2P response data
      console.log(`[apiFetch] P2P response for ${url}:`, p2pResponse.status, p2pResponse.data);
      // Create a Response-like object from P2P response
      return new Response(JSON.stringify(p2pResponse.data), {
        status: p2pResponse.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // In remote mode (GitHub Pages), we can only use P2P
  // Don't fall back to HTTP as it would hit the static host
  if (isRemoteMode()) {
    console.error('[apiFetch] P2P not connected in remote mode, cannot make request');
    return new Response(JSON.stringify({
      error: 'Not connected',
      message: 'P2P connection required for remote access'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Fall back to direct HTTP (local network only)
  // Use device token first, then URL session token as fallback
  const token = getTokenPart() || getUrlToken();
  let finalUrl = url;
  if (token && url.startsWith('/api')) {
    const separator = url.includes('?') ? '&' : '?';
    finalUrl = `${url}${separator}token=${token}`;
  }

  return fetch(finalUrl, options);
}

// Alias for backwards compatibility
export const tunnelFetch = apiFetch;

type ConnectionMode = 'local' | 'relay' | null;

interface AuthState {
  // Simplified state
  deviceToken: string | null;     // Full device token (deviceId:token)
  deviceId: string | null;
  deviceName: string | null;
  localUrl: string | null;        // Last known local URL
  connectionMode: ConnectionMode;

  // Server identity (for persistent reconnection)
  serverId: string | null;        // Persistent server UUID
  serverName: string | null;      // Human-friendly server name
  relayCode: string | null;       // Persistent relay code for reconnection

  // UI state
  isAuthenticated: boolean;
  isConnecting: boolean;
  isPairing: boolean;
  error: string | null;

  // Actions
  pair: (code: string, deviceName?: string) => Promise<boolean>;
  validateToken: () => Promise<boolean>;
  logout: () => void;

  // Get saved relay code for reconnection
  getSavedRelayCode: () => string | null;

  // Internal
  _setConnectionMode: (mode: ConnectionMode) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => {
      // Migrate from legacy storage on first load
      const stored = getStoredCredential();
      const legacyToken = localStorage.getItem('audiio-device-token');
      const legacyId = localStorage.getItem('audiio-device-id');

      const initial = stored ? {
        deviceToken: stored.token,
        deviceId: stored.id,
        deviceName: stored.name || null,
        localUrl: stored.localUrl || null,
        serverId: stored.serverId || null,
        serverName: stored.serverName || null,
        relayCode: stored.relayCode || null
      } : legacyToken && legacyId ? {
        deviceToken: legacyToken,
        deviceId: legacyId,
        deviceName: null,
        localUrl: null,
        serverId: null,
        serverName: null,
        relayCode: null
      } : {
        deviceToken: null,
        deviceId: null,
        deviceName: null,
        localUrl: null,
        serverId: null,
        serverName: null,
        relayCode: null
      };

      return {
        ...initial,
        connectionMode: null,
        isAuthenticated: !!initial.deviceToken,
        isConnecting: false,
        isPairing: false,
        error: null,

        pair: async (code: string, deviceName?: string) => {
          set({ isPairing: true, error: null });

          try {
            // Use apiFetch to route through P2P if connected
            const response = await apiFetch('/api/auth/pair', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                code: code.toUpperCase().trim(),
                deviceName: deviceName || getDefaultDeviceName()
              })
            });

            const data = await response.json();

            if (data.success && data.deviceToken) {
              // Store credential with server identity for persistent reconnection
              const credential: DeviceCredential = {
                token: data.deviceToken,
                id: data.deviceId,
                name: deviceName || getDefaultDeviceName(),
                localUrl: data.localUrl || window.location.origin,
                // Server identity (for Plex-like "pair once, connect forever")
                serverId: data.serverId,
                serverName: data.serverName,
                relayCode: data.relayCode
              };
              storeCredential(credential);

              console.log('[Auth] Paired successfully:', {
                deviceId: data.deviceId,
                serverId: data.serverId,
                serverName: data.serverName,
                relayCode: data.relayCode
              });

              set({
                deviceToken: data.deviceToken,
                deviceId: data.deviceId,
                deviceName: credential.name,
                localUrl: credential.localUrl,
                serverId: data.serverId || null,
                serverName: data.serverName || null,
                relayCode: data.relayCode || null,
                isAuthenticated: true,
                isPairing: false,
                error: null
              });

              return true;
            }

            // Pairing failed
            set({
              isPairing: false,
              error: data.error || 'Invalid or expired pairing code'
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

        validateToken: async () => {
          const { deviceToken } = get();

          if (!deviceToken) {
            set({ isAuthenticated: false });
            return false;
          }

          set({ isConnecting: true, error: null });

          try {
            // Use apiFetch to route through P2P when connected
            const response = await apiFetch('/api/auth/device', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ deviceToken })
            });

            const data = await response.json();

            if (data.valid) {
              // Determine connection mode based on P2P status
              const connectionMode = isP2PConnected() ? 'relay' : 'local';
              set({
                isAuthenticated: true,
                isConnecting: false,
                connectionMode
              });
              return true;
            } else {
              // Token invalid - clear credentials
              clearCredential();
              set({
                deviceToken: null,
                deviceId: null,
                isAuthenticated: false,
                isConnecting: false,
                error: 'Device not recognized. Please pair again.'
              });
              return false;
            }
          } catch (error) {
            // Can't reach server - might need to use relay
            set({
              isConnecting: false,
              error: 'Unable to connect to server'
            });
            return false;
          }
        },

        logout: () => {
          clearCredential();
          set({
            deviceToken: null,
            deviceId: null,
            deviceName: null,
            localUrl: null,
            serverId: null,
            serverName: null,
            relayCode: null,
            connectionMode: null,
            isAuthenticated: false,
            error: null
          });
        },

        getSavedRelayCode: () => {
          // Get stored relay code for reconnection without re-pairing
          const credential = getStoredCredential();
          return credential?.relayCode || get().relayCode;
        },

        _setConnectionMode: (mode) => set({ connectionMode: mode })
      };
    },
    {
      name: 'audiio-mobile-auth',
      partialize: (state) => ({
        deviceToken: state.deviceToken,
        deviceId: state.deviceId,
        deviceName: state.deviceName,
        localUrl: state.localUrl,
        // Server identity for persistent reconnection
        serverId: state.serverId,
        serverName: state.serverName,
        relayCode: state.relayCode
      })
    }
  )
);

// Set up the token accessor after store is created
// Send full deviceToken (deviceId:token format) for validation
getTokenPart = () => {
  const { deviceToken } = useAuthStore.getState();
  return deviceToken || null;
};

/**
 * Get a friendly device name based on user agent
 */
function getDefaultDeviceName(): string {
  const ua = navigator.userAgent;

  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) {
    const match = ua.match(/Android.*?;\s*([^)]+)/);
    if (match) return match[1].split(' Build')[0];
    return 'Android Device';
  }
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Linux/.test(ua)) return 'Linux';

  return 'Mobile Device';
}
