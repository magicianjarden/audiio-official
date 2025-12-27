/**
 * P2P Store - Manages P2P connection state for remote access
 *
 * Uses Nostr relays for serverless messaging.
 * Enter the code shown on desktop to connect from anywhere.
 *
 * API Tunneling: When connected via P2P, all API calls are routed
 * through the P2P WebSocket connection to the desktop.
 */

import { create } from 'zustand';

// Public Nostr relays (free to use)
const NOSTR_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band'
];

const APP_ID = 'audiio-mobile';

export type P2PConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

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

// Simple hash for Nostr event ID
async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

interface P2PState {
  status: P2PConnectionStatus;
  connectionCode: string | null;
  error: string | null;
  desktopPeerId: string | null;
  selfId: string;
  ws: WebSocket | null;
  authToken: string | null;
  localUrl: string | null;

  // Actions
  connect: (code: string, deviceName?: string) => Promise<boolean>;
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

// Generate self ID once
const selfId = randomId();

export const useP2PStore = create<P2PState>((set, get) => ({
  status: 'disconnected',
  connectionCode: null,
  error: null,
  desktopPeerId: null,
  selfId,
  ws: null,
  authToken: null,
  localUrl: null,

  connect: async (code: string, deviceName?: string) => {
    const normalizedCode = code.toUpperCase().trim();
    const roomId = `${APP_ID}:${normalizedCode}`;

    set({
      status: 'connecting',
      connectionCode: normalizedCode,
      error: null
    });

    try {
      console.log(`[P2P] Connecting to room: ${normalizedCode}`);

      // Connect to Nostr relay
      const ws = new WebSocket(NOSTR_RELAYS[0]);

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          ws.close();
          set({
            status: 'error',
            error: 'Connection timeout. Make sure the code is correct and desktop is running.'
          });
          resolve(false);
        }, 15000);

        ws.onopen = () => {
          console.log('[P2P] Connected to relay');
          set({ ws });

          // Subscribe to room events
          const subscriptionId = `sub_${randomId().substring(0, 8)}`;
          const filter = {
            kinds: [30078],
            '#d': [roomId],
            since: Math.floor(Date.now() / 1000) - 60
          };
          ws.send(JSON.stringify(['REQ', subscriptionId, filter]));

          // Send join message
          sendEvent(ws, roomId, {
            type: 'join',
            deviceName: deviceName || getDeviceName(),
            timestamp: Date.now()
          });

          // Wait for welcome message from host
          const checkConnection = setInterval(() => {
            const { desktopPeerId } = get();
            if (desktopPeerId) {
              clearInterval(checkConnection);
              clearTimeout(timeout);
              set({ status: 'connected' });
              resolve(true);
            }
          }, 500);

          // Timeout for waiting for host
          setTimeout(() => {
            clearInterval(checkConnection);
            const { desktopPeerId, status } = get();
            if (!desktopPeerId && status === 'connecting') {
              clearTimeout(timeout);
              set({
                status: 'error',
                error: 'No desktop found with this code. Make sure the code is correct and desktop is running.'
              });
              resolve(false);
            }
          }, 12000);
        };

        ws.onmessage = (event) => {
          handleRelayMessage(event.data, set, get);
        };

        ws.onclose = () => {
          clearTimeout(timeout);
          console.log('[P2P] Disconnected from relay');
          const { status } = get();
          if (status === 'connected') {
            set({
              status: 'disconnected',
              desktopPeerId: null,
              error: 'Connection lost'
            });
          }
        };

        ws.onerror = (error) => {
          console.error('[P2P] WebSocket error:', error);
          clearTimeout(timeout);
          set({
            status: 'error',
            error: 'Failed to connect to relay server'
          });
          resolve(false);
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

  disconnect: () => {
    const { ws } = get();
    if (ws) {
      ws.close();
    }
    set({
      status: 'disconnected',
      connectionCode: null,
      desktopPeerId: null,
      ws: null,
      error: null,
      authToken: null,
      localUrl: null
    });
  },

  send: (type: string, payload?: unknown) => {
    const { ws, connectionCode, desktopPeerId, selfId } = get();
    if (ws && ws.readyState === WebSocket.OPEN && connectionCode) {
      const roomId = `${APP_ID}:${connectionCode}`;
      sendEvent(ws, roomId, {
        type: 'data',
        from: selfId,
        to: desktopPeerId,
        payload: { type, payload },
        timestamp: Date.now()
      });
    } else {
      console.warn('[P2P] Cannot send - not connected');
    }
  },

  apiRequest: async (url: string, options?: { method?: string; body?: unknown }) => {
    const { ws, connectionCode, desktopPeerId, selfId, authToken } = get();

    if (!ws || ws.readyState !== WebSocket.OPEN || !connectionCode || !desktopPeerId) {
      throw new Error('Not connected via P2P');
    }

    const requestId = randomId().substring(0, 12);
    const roomId = `${APP_ID}:${connectionCode}`;

    return new Promise((resolve, reject) => {
      // Set timeout for response
      const timeout = setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(new Error('API request timeout'));
      }, 30000);

      // Store pending request
      pendingRequests.set(requestId, { resolve, reject, timeout });

      // Send API request through P2P
      sendEvent(ws, roomId, {
        type: 'data',
        from: selfId,
        to: desktopPeerId,
        payload: {
          type: 'api-request',
          requestId,
          url,
          method: options?.method || 'GET',
          body: options?.body,
          authToken
        },
        timestamp: Date.now()
      });

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
 * Send a Nostr event to the relay
 */
async function sendEvent(ws: WebSocket, roomId: string, data: unknown): Promise<void> {
  const content = JSON.stringify(data);
  const created_at = Math.floor(Date.now() / 1000);
  const kind = 30078;

  const tags = [
    ['d', roomId],
    ['p', selfId]
  ];

  const preEvent = [
    0,
    selfId,
    created_at,
    kind,
    tags,
    content
  ];

  const id = await sha256(JSON.stringify(preEvent));
  const sig = randomId() + randomId();

  const event: NostrEvent = {
    id,
    pubkey: selfId,
    created_at,
    kind,
    tags,
    content,
    sig
  };

  ws.send(JSON.stringify(['EVENT', event]));
}

/**
 * Handle messages from Nostr relay
 */
function handleRelayMessage(
  rawData: string,
  set: (state: Partial<P2PState>) => void,
  get: () => P2PState
): void {
  try {
    const msg = JSON.parse(rawData);
    if (!Array.isArray(msg)) return;

    const [type, ...args] = msg;

    if (type === 'EVENT') {
      const event = args[1] as NostrEvent;

      // Ignore our own events
      if (event.pubkey === selfId) return;

      const data = JSON.parse(event.content);
      const senderId = event.pubkey;

      // Handle message types
      if (data.type === 'data') {
        // Check if message is for us
        if (!data.to || data.to === selfId) {
          const payload = data.payload;
          if (payload?.type === 'welcome') {
            // Host acknowledged us - extract auth info
            console.log('[P2P] Desktop connected!');
            const update: Partial<P2PState> = {
              desktopPeerId: senderId,
              status: 'connected'
            };
            // Store auth token if provided
            if (payload.authToken) {
              update.authToken = payload.authToken;
              console.log('[P2P] Received auth token');
            }
            // Store local URL for API calls
            if (payload.localUrl) {
              update.localUrl = payload.localUrl;
              console.log('[P2P] Received local URL:', payload.localUrl);
            }
            set(update);
          } else if (payload?.type === 'api-response') {
            // Handle API response
            const requestId = payload.requestId as string;
            const pending = pendingRequests.get(requestId);
            if (pending) {
              clearTimeout(pending.timeout);
              pendingRequests.delete(requestId);
              pending.resolve({
                ok: payload.ok as boolean,
                status: payload.status as number,
                data: payload.data
              });
              console.log(`[P2P] API response: ${payload.status} for ${requestId}`);
            }
          } else if (messageHandler && payload?.type) {
            messageHandler(payload.type, payload.payload);
          }
        }
      }
    } else if (type === 'EOSE') {
      console.log('[P2P] Subscription ready');
    }
  } catch {
    // Ignore parse errors
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
  return state.status === 'connected' && !!state.desktopPeerId;
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
