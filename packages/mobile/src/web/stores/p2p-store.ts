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
import { schnorr } from '@noble/curves/secp256k1';
import { bytesToHex } from '@noble/curves/abstract/utils';

// Public Nostr relays (free to use, no PoW required)
const NOSTR_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://nostr.wine',
  'wss://relay.nostr.band',
  'wss://purplepag.es'
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

// Generate secp256k1 keypair for Nostr signing
const privateKey = schnorr.utils.randomPrivateKey();
const publicKey = bytesToHex(schnorr.getPublicKey(privateKey));
// For backwards compatibility, export publicKey as selfId
const selfId = publicKey;

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

      // Try relays in sequence until one works
      let ws: WebSocket | null = null;
      let relayIndex = 0;

      const tryNextRelay = (): Promise<WebSocket> => {
        return new Promise((resolve, reject) => {
          if (relayIndex >= NOSTR_RELAYS.length) {
            reject(new Error('All relays failed'));
            return;
          }

          const relayUrl = NOSTR_RELAYS[relayIndex];
          console.log(`[P2P] Trying relay: ${relayUrl}`);
          const testWs = new WebSocket(relayUrl);

          const timeout = setTimeout(() => {
            testWs.close();
            relayIndex++;
            tryNextRelay().then(resolve).catch(reject);
          }, 5000);

          testWs.onopen = () => {
            clearTimeout(timeout);
            console.log(`[P2P] Connected to relay: ${relayUrl}`);
            resolve(testWs);
          };

          testWs.onerror = () => {
            clearTimeout(timeout);
            console.log(`[P2P] Relay ${relayUrl} failed, trying next...`);
            relayIndex++;
            tryNextRelay().then(resolve).catch(reject);
          };
        });
      };

      ws = await tryNextRelay();

      // Socket is already connected at this point - set up handlers immediately
      set({ ws });

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          ws!.close();
          set({
            status: 'error',
            error: 'Connection timeout. Make sure the code is correct and desktop is running.'
          });
          resolve(false);
        }, 15000);

        // Set up message handler first (before subscribing)
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

        // Socket already open - subscribe and join immediately
        console.log('[P2P] Subscribing to room:', roomId);

        // Subscribe to room events
        const subscriptionId = `sub_${randomId().substring(0, 8)}`;
        const filter = {
          kinds: [30078],
          '#d': [roomId],
          since: Math.floor(Date.now() / 1000) - 60
        };
        ws.send(JSON.stringify(['REQ', subscriptionId, filter]));

        // Send join message
        console.log('[P2P] Sending join message');
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
 * Send a Nostr event to the relay with proper Schnorr signature
 */
async function sendEvent(ws: WebSocket, roomId: string, data: unknown): Promise<void> {
  const content = JSON.stringify(data);
  const created_at = Math.floor(Date.now() / 1000);
  const kind = 30078;

  const tags = [
    ['d', roomId],
    ['p', publicKey]
  ];

  // Create serialized event for hashing (NIP-01 format)
  const preEvent = [
    0,
    publicKey,
    created_at,
    kind,
    tags,
    content
  ];

  // Hash the serialized event to get the event ID
  const eventHash = await sha256(JSON.stringify(preEvent));

  // Sign the event hash with our private key using Schnorr signature
  const signature = schnorr.sign(eventHash, privateKey);
  const sig = bytesToHex(signature);

  const event: NostrEvent = {
    id: eventHash,
    pubkey: publicKey,
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
      if (data.type === 'host-announce') {
        // Desktop is announcing its presence - connect to it!
        const { desktopPeerId, connectionCode, ws } = get();
        if (!desktopPeerId && senderId) {
          console.log('[P2P] Found desktop via announce!');
          const update: Partial<P2PState> = {
            desktopPeerId: senderId,
            status: 'connected'
          };
          // Store auth token if provided
          if (data.authToken) {
            update.authToken = data.authToken;
            console.log('[P2P] Received auth token from announce');
          }
          // Store local URL for API calls
          if (data.localUrl) {
            update.localUrl = data.localUrl;
            console.log('[P2P] Received local URL:', data.localUrl);
          }
          set(update);

          // Send join message to confirm we received the announce
          if (ws && connectionCode) {
            const roomId = `${APP_ID}:${connectionCode}`;
            sendEvent(ws, roomId, {
              type: 'join',
              deviceName: getDeviceName(),
              timestamp: Date.now()
            });
          }
        }
      } else if (data.type === 'data') {
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
