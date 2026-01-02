/**
 * P2P Store - Manages relay connection state for remote access
 *
 * Connects to the Audiio Relay server for signaling.
 * Enter the code shown on desktop to connect from anywhere.
 *
 * API Tunneling: When connected via relay, all API calls are routed
 * through the encrypted WebSocket connection to the desktop.
 */

import { create } from 'zustand';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, decodeUTF8, encodeUTF8 } from 'tweetnacl-util';

// Relay server URL - will be updated after Fly.io deployment
const RELAY_URL = import.meta.env.VITE_RELAY_URL || 'wss://audiio-relay.fly.dev';

export type P2PConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Key pair for E2E encryption
interface KeyPair {
  publicKey: string;
  secretKey: Uint8Array;
}

// Pending API requests waiting for response
interface PendingRequest {
  resolve: (response: { ok: boolean; status: number; data: unknown }) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}
const pendingRequests = new Map<string, PendingRequest>();

// Generate a random hex ID
function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate encryption key pair
function generateKeyPair(): KeyPair {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(keyPair.publicKey),
    secretKey: keyPair.secretKey
  };
}

// Encrypt message for desktop
function encrypt(message: string, recipientPublicKey: string, senderSecretKey: Uint8Array): { encrypted: string; nonce: string } {
  const messageBytes = decodeUTF8(message);
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const recipientPubKey = decodeBase64(recipientPublicKey);

  const encrypted = nacl.box(messageBytes, nonce, recipientPubKey, senderSecretKey);
  if (!encrypted) {
    throw new Error('Encryption failed');
  }

  return {
    encrypted: encodeBase64(encrypted),
    nonce: encodeBase64(nonce)
  };
}

// Decrypt message from desktop
function decrypt(encrypted: string, nonce: string, senderPublicKey: string, recipientSecretKey: Uint8Array): string {
  const encryptedBytes = decodeBase64(encrypted);
  const nonceBytes = decodeBase64(nonce);
  const senderPubKey = decodeBase64(senderPublicKey);

  const decrypted = nacl.box.open(encryptedBytes, nonceBytes, senderPubKey, recipientSecretKey);
  if (!decrypted) {
    throw new Error('Decryption failed');
  }

  return encodeUTF8(decrypted);
}

interface P2PState {
  status: P2PConnectionStatus;
  connectionCode: string | null;
  error: string | null;
  desktopPublicKey: string | null;
  selfId: string;
  ws: WebSocket | null;
  keyPair: KeyPair;
  authToken: string | null;
  localUrl: string | null;

  // Password requirement state
  requiresPassword: boolean;
  pendingRoomId: string | null;
  pendingServerName: string | null;

  // Actions
  connect: (code: string, deviceName?: string, passwordHash?: string) => Promise<boolean>;
  connectWithPassword: (password: string) => Promise<boolean>;
  disconnect: () => void;
  send: (type: string, payload?: unknown) => void;
  apiRequest: (url: string, options?: { method?: string; body?: unknown }) => Promise<{ ok: boolean; status: number; data: unknown }>;

  // Internal
  _setStatus: (status: P2PConnectionStatus) => void;
  _setError: (error: string | null) => void;
  _onMessage: (handler: (type: string, payload: unknown) => void) => void;
}

// Message handler registry
let messageHandler: ((type: string, payload: unknown) => void) | null = null;

// Ping interval handle
let pingInterval: ReturnType<typeof setInterval> | null = null;

// Auto-reconnect config
const RECONNECT_CONFIG = {
  initialDelay: 1000,
  maxDelay: 30000,
  multiplier: 1.5,
  maxAttempts: 10,
};

// Reconnect state
let reconnectAttempts = 0;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let lastCode: string | null = null;
let lastDeviceName: string | null = null;

// Generate key pair on load
const keyPair = generateKeyPair();
const selfId = keyPair.publicKey.substring(0, 16);

export const useP2PStore = create<P2PState>((set, get) => ({
  status: 'disconnected',
  connectionCode: null,
  error: null,
  desktopPublicKey: null,
  selfId,
  ws: null,
  keyPair,
  authToken: null,
  localUrl: null,

  // Password requirement state
  requiresPassword: false,
  pendingRoomId: null,
  pendingServerName: null,

  connect: async (code: string, deviceName?: string, passwordHash?: string) => {
    const normalizedCode = code.toUpperCase().trim();

    // Store for auto-reconnect
    lastCode = normalizedCode;
    lastDeviceName = deviceName || getDeviceName();

    // Clear any pending reconnect
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    set({
      status: 'connecting',
      connectionCode: normalizedCode,
      error: null,
      requiresPassword: false,
      pendingRoomId: null,
      pendingServerName: null
    });

    try {
      console.log(`[P2P] Connecting to relay: ${RELAY_URL}`);

      const ws = new WebSocket(RELAY_URL);
      set({ ws });

      return new Promise((resolve) => {
        let connectionTimeout: ReturnType<typeof setTimeout>;
        let resolved = false;

        const cleanup = () => {
          if (connectionTimeout) clearTimeout(connectionTimeout);
        };

        const resolveOnce = (value: boolean) => {
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve(value);
          }
        };

        connectionTimeout = setTimeout(() => {
          ws.close();
          set({
            status: 'error',
            error: 'Connection timeout. Make sure the code is correct and desktop is running.'
          });
          resolveOnce(false);
        }, 15000);

        ws.onopen = () => {
          console.log('[P2P] Connected to relay server');

          // Send join request with roomId (new static room model)
          const joinPayload: {
            roomId: string;
            code: string;
            publicKey: string;
            deviceName: string;
            userAgent: string;
            passwordHash?: string;
          } = {
            roomId: normalizedCode, // Room ID is the static code
            code: normalizedCode,   // Keep for backwards compatibility
            publicKey: get().keyPair.publicKey,
            deviceName: deviceName || getDeviceName(),
            userAgent: navigator.userAgent
          };

          // Include password hash if provided
          if (passwordHash) {
            joinPayload.passwordHash = passwordHash;
          }

          const joinMessage = {
            type: 'join',
            payload: joinPayload,
            timestamp: Date.now()
          };
          ws.send(JSON.stringify(joinMessage));
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            handleRelayMessage(message, set, get, () => {
              // On successful connection - reset reconnect attempts
              cleanup();
              reconnectAttempts = 0;
              startPingInterval(get);
              resolveOnce(true);
            }, (errorMsg: string) => {
              // On error
              set({ status: 'error', error: errorMsg });
              resolveOnce(false);
            });
          } catch (err) {
            console.error('[P2P] Failed to parse message:', err);
          }
        };

        ws.onclose = () => {
          cleanup();
          stopPingInterval();
          console.log('[P2P] Disconnected from relay');
          const { status } = get();
          if (status === 'connected') {
            set({
              status: 'disconnected',
              desktopPublicKey: null,
              error: 'Connection lost'
            });

            // Auto-reconnect if we have saved credentials
            if (lastCode && reconnectAttempts < RECONNECT_CONFIG.maxAttempts) {
              const delay = Math.min(
                RECONNECT_CONFIG.initialDelay * Math.pow(RECONNECT_CONFIG.multiplier, reconnectAttempts),
                RECONNECT_CONFIG.maxDelay
              );
              reconnectAttempts++;
              console.log(`[P2P] Auto-reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);

              reconnectTimeout = setTimeout(() => {
                const currentStatus = get().status;
                if (currentStatus === 'disconnected' && lastCode) {
                  get().connect(lastCode, lastDeviceName || undefined);
                }
              }, delay);
            }
          }
        };

        ws.onerror = (error) => {
          console.error('[P2P] WebSocket error:', error);
          set({
            status: 'error',
            error: 'Failed to connect to relay server'
          });
          resolveOnce(false);
        };
      });
    } catch (error) {
      console.error('[P2P] Connection error:', error);
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to connect'
      });
      return false;
    }
  },

  connectWithPassword: async (password: string) => {
    const { pendingRoomId } = get();
    if (!pendingRoomId) {
      console.error('[P2P] No pending room ID for password connection');
      return false;
    }

    // Hash the password (SHA-512 to match desktop)
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-512', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    console.log('[P2P] Connecting with password hash');

    // Clear the password requirement state
    set({
      requiresPassword: false,
      pendingRoomId: null,
      pendingServerName: null
    });

    // Connect with the password hash
    return get().connect(pendingRoomId, lastDeviceName || undefined, passwordHash);
  },

  disconnect: () => {
    const { ws } = get();
    stopPingInterval();

    // Clear auto-reconnect state
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    reconnectAttempts = 0;
    lastCode = null;
    lastDeviceName = null;

    if (ws) {
      ws.close();
    }
    set({
      status: 'disconnected',
      connectionCode: null,
      desktopPublicKey: null,
      ws: null,
      error: null,
      authToken: null,
      localUrl: null
    });
  },

  send: (type: string, payload?: unknown) => {
    const { ws, desktopPublicKey, keyPair } = get();
    if (ws && ws.readyState === WebSocket.OPEN && desktopPublicKey) {
      const message = JSON.stringify({ type, payload });
      const { encrypted, nonce } = encrypt(message, desktopPublicKey, keyPair.secretKey);

      ws.send(JSON.stringify({
        type: 'data',
        payload: { encrypted, nonce },
        timestamp: Date.now()
      }));
    } else {
      console.warn('[P2P] Cannot send - not connected');
    }
  },

  apiRequest: async (url: string, options?: { method?: string; body?: unknown }) => {
    const { ws, desktopPublicKey, keyPair } = get();

    if (!ws || ws.readyState !== WebSocket.OPEN || !desktopPublicKey) {
      throw new Error('Not connected via P2P');
    }

    const requestId = randomId().substring(0, 12);

    return new Promise((resolve, reject) => {
      // Set timeout for response
      const timeout = setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(new Error('API request timeout'));
      }, 30000);

      // Store pending request
      pendingRequests.set(requestId, { resolve, reject, timeout });

      // Send API request through relay
      const apiMessage = JSON.stringify({
        type: 'api-request',
        requestId,
        url,
        method: options?.method || 'GET',
        body: options?.body
      });

      const { encrypted, nonce } = encrypt(apiMessage, desktopPublicKey, keyPair.secretKey);

      ws.send(JSON.stringify({
        type: 'data',
        payload: { encrypted, nonce },
        timestamp: Date.now()
      }));

      console.log(`[P2P] API request: ${options?.method || 'GET'} ${url}`);
    });
  },

  _setStatus: (status) => set({ status }),
  _setError: (error) => set({ error }),
  _onMessage: (handler) => {
    messageHandler = handler;
  }
}));

/**
 * Handle messages from relay server
 */
function handleRelayMessage(
  message: { type: string; payload?: unknown; timestamp?: number },
  set: (state: Partial<P2PState>) => void,
  get: () => P2PState,
  onConnected: () => void,
  onError: (msg: string) => void
): void {
  const { keyPair } = get();

  switch (message.type) {
    case 'joined': {
      // Successfully joined - got desktop's public key and server info
      const payload = message.payload as { desktopPublicKey: string; serverName?: string };
      console.log(`[P2P] Connected to desktop${payload.serverName ? ` (${payload.serverName})` : ''}!`);
      set({
        status: 'connected',
        desktopPublicKey: payload.desktopPublicKey
      });
      onConnected();
      break;
    }

    case 'auth-required': {
      // Room requires password - set state for password UI
      const payload = message.payload as { roomId: string; serverName?: string };
      console.log(`[P2P] Password required for room: ${payload.roomId}`);
      set({
        status: 'disconnected',
        requiresPassword: true,
        pendingRoomId: payload.roomId,
        pendingServerName: payload.serverName || null,
        error: null
      });
      // Don't call onError - let the UI handle password input
      break;
    }

    case 'data': {
      // Encrypted data from desktop
      const { desktopPublicKey } = get();
      if (!desktopPublicKey) return;

      const payload = message.payload as { encrypted: string; nonce: string; from?: string };

      try {
        const decrypted = decrypt(
          payload.encrypted,
          payload.nonce,
          desktopPublicKey,
          keyPair.secretKey
        );
        const data = JSON.parse(decrypted);

        // Handle different message types
        if (data.type === 'welcome') {
          // Desktop sent auth info
          console.log('[P2P] Received welcome with auth token');
          if (data.authToken) {
            set({ authToken: data.authToken });
          }
          if (data.localUrl) {
            set({ localUrl: data.localUrl });
          }
        } else if (data.type === 'api-response') {
          const pending = pendingRequests.get(data.requestId);
          if (pending) {
            clearTimeout(pending.timeout);
            pendingRequests.delete(data.requestId);
            pending.resolve({
              ok: data.ok,
              status: data.status,
              data: data.data
            });
            console.log(`[P2P] API response: ${data.status} for ${data.requestId}`);
          }
        } else if (messageHandler && data.type) {
          messageHandler(data.type, data.payload);
        }
      } catch (err) {
        console.error('[P2P] Failed to decrypt message:', err);
      }
      break;
    }

    case 'peer-left': {
      // Desktop disconnected
      console.log('[P2P] Desktop disconnected');
      set({
        status: 'disconnected',
        desktopPublicKey: null,
        error: 'Desktop disconnected'
      });
      break;
    }

    case 'error': {
      const payload = message.payload as { code: string; message: string };
      console.error('[P2P] Relay error:', payload.message);
      onError(payload.message);
      break;
    }

    case 'pong':
      // Keep-alive response
      break;
  }
}

function startPingInterval(get: () => P2PState): void {
  stopPingInterval();

  // Ping every 15 seconds to keep connection alive
  pingInterval = setInterval(() => {
    const { ws } = get();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    }
  }, 15000);
}

function stopPingInterval(): void {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

/**
 * Get a friendly device name
 */
function getDeviceName(): string {
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

/**
 * Check if P2P is supported in this browser
 */
export function isP2PSupported(): boolean {
  return typeof WebSocket !== 'undefined';
}

/**
 * Check if P2P is connected and can be used for API calls
 */
export function isP2PConnected(): boolean {
  const state = useP2PStore.getState();
  return state.status === 'connected' && !!state.desktopPublicKey;
}

/**
 * Make an API request through P2P if connected
 * Returns null if not connected (caller should fall back to direct HTTP)
 */
export async function p2pApiRequest(
  url: string,
  options?: { method?: string; body?: unknown }
): Promise<{ ok: boolean; status: number; data: unknown } | null> {
  if (!isP2PConnected()) {
    return null;
  }
  try {
    return await useP2PStore.getState().apiRequest(url, options);
  } catch (error) {
    console.error('[P2P] API request failed:', error);
    return null;
  }
}

export { selfId };

// Handle visibility changes - reconnect when page becomes visible
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const state = useP2PStore.getState();
      // If we were connected but now disconnected, try to reconnect
      if (state.status === 'disconnected' && lastCode) {
        console.log('[P2P] Page became visible, attempting reconnect...');
        reconnectAttempts = 0; // Reset attempts for fresh reconnect
        state.connect(lastCode, lastDeviceName || undefined);
      }
    }
  });
}
