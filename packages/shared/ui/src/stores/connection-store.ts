/**
 * Connection Store
 *
 * Manages connection state between the UI and the backend.
 * In "client mode" (thin client + remote server), tracks server connection.
 * In "desktop mode" (full desktop app), always reports connected.
 */

import { create } from 'zustand';

export interface ConnectionState {
  connected: boolean;
  serverUrl: string | null;
  serverName?: string;
  serverVersion?: string;
  latency?: number;
  error?: string;
}

interface ConnectionStore {
  // State
  state: ConnectionState;
  isClientMode: boolean;
  isLoading: boolean;

  // Actions
  setConnectionState: (state: ConnectionState) => void;
  setIsClientMode: (isClient: boolean) => void;
  connect: (serverUrl: string, token?: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  checkConnection: () => Promise<void>;
}

// Check if we're in client mode by looking for client-specific API
const detectClientMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  const api = (window as any).api;
  return !!(api?.connection?.getState);
};

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  state: {
    connected: false,
    serverUrl: null
  },
  isClientMode: detectClientMode(),
  isLoading: true,

  setConnectionState: (state) => {
    set({ state, isLoading: false });
  },

  setIsClientMode: (isClient) => {
    set({ isClientMode: isClient });
  },

  connect: async (serverUrl: string, token?: string) => {
    const api = (window as any).api;
    if (!api?.connection?.connect) {
      console.warn('[ConnectionStore] No connection API available');
      return false;
    }

    set({ isLoading: true });

    try {
      const success = await api.connection.connect(serverUrl, token);
      if (success) {
        const state = await api.connection.getState();
        set({ state, isLoading: false });
      } else {
        set({
          state: { connected: false, serverUrl, error: 'Connection failed' },
          isLoading: false
        });
      }
      return success;
    } catch (error) {
      set({
        state: {
          connected: false,
          serverUrl,
          error: error instanceof Error ? error.message : 'Connection failed'
        },
        isLoading: false
      });
      return false;
    }
  },

  disconnect: async () => {
    const api = (window as any).api;
    if (api?.connection?.disconnect) {
      await api.connection.disconnect();
    }
    set({
      state: { connected: false, serverUrl: null },
      isLoading: false
    });
  },

  checkConnection: async () => {
    const api = (window as any).api;

    // If not in client mode (full desktop), assume connected
    if (!api?.connection?.getState) {
      set({
        state: { connected: true, serverUrl: null },
        isClientMode: false,
        isLoading: false
      });
      return;
    }

    set({ isLoading: true, isClientMode: true });

    try {
      const state = await api.connection.getState();
      set({ state, isLoading: false });

      // Subscribe to state changes
      if (api.connection.onStateChange) {
        api.connection.onStateChange((newState: ConnectionState) => {
          set({ state: newState });
        });
      }
    } catch (error) {
      set({
        state: { connected: false, serverUrl: null },
        isLoading: false
      });
    }
  }
}));

// Initialize on load
if (typeof window !== 'undefined') {
  // Delay to ensure API is ready
  setTimeout(() => {
    useConnectionStore.getState().checkConnection();
  }, 100);
}
