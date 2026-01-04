/**
 * Player Store - Manages playback state and audio streaming
 *
 * Features:
 * - WebSocket reconnection with exponential backoff
 * - Fine-grained selectors for performance
 * - Remote/local playback modes
 */

import { create } from 'zustand';
import { tunnelFetch } from './auth-store';
import { useP2PStore, isP2PConnected } from './p2p-store';

// Reconnection configuration (Plex-style)
const RECONNECT_CONFIG = {
  initialDelay: 1000,      // Start with 1 second
  maxDelay: 30000,         // Cap at 30 seconds
  multiplier: 1.5,         // Exponential growth
  jitter: 0.3,             // Add randomness to prevent thundering herd
  maxAttempts: 20,         // Give up after 20 attempts
};

export interface Track {
  id: string;
  title: string;
  artists: { id: string; name: string }[];
  album?: {
    id: string;
    name?: string;
    title?: string;
    artwork?: {
      small?: string;
      medium?: string;
      large?: string;
      original?: string;
    };
  };
  duration?: number;
  artwork?: {
    small?: string;
    medium?: string;
    large?: string;
    original?: string;
  };
  _meta?: {
    metadataProvider?: string;
    [key: string]: unknown;
  };
}

export type RepeatMode = 'none' | 'one' | 'all';
export type PlaybackMode = 'local' | 'remote';

// Desktop playback state received via WebSocket
export interface DesktopPlaybackState {
  currentTrack: Track | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
  isShuffled: boolean;
  repeatMode: RepeatMode;
  queue: Track[];
  queueIndex: number;
}

interface PlayerState {
  // Playback mode
  playbackMode: PlaybackMode;
  desktopState: DesktopPlaybackState | null;

  // Playback state (local)
  currentTrack: Track | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
  isBuffering: boolean;

  // Shuffle & Repeat
  isShuffled: boolean;
  repeatMode: RepeatMode;
  originalQueue: Track[]; // Store original order for unshuffle

  // Queue
  queue: Track[];
  queueIndex: number;

  // Connection
  isConnected: boolean;
  wsConnection: WebSocket | null;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'reconnecting';
  reconnectAttempts: number;
  lastError: string | null;

  // Audio element
  audioElement: HTMLAudioElement | null;

  // Actions
  setTrack: (track: Track) => void;
  play: (track?: Track) => Promise<void>;
  pause: () => void;
  resume: () => void;
  seek: (position: number) => void;
  setVolume: (volume: number) => void;
  next: () => void;
  previous: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  addToQueue: (track: Track, playNext?: boolean) => void;
  playNext: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setQueue: (tracks: Track[], startIndex?: number) => void;
  playFromQueue: (index: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setPlaybackMode: (mode: PlaybackMode) => void;
  sendRemoteCommand: (command: string, payload?: unknown) => void;
  connectWebSocket: (token: string) => void;
  disconnectWebSocket: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  // Default to local mode - mobile plays audio on the device itself (Plex-like)
  // 'remote' mode controls desktop playback
  playbackMode: 'local',
  desktopState: null,

  // Local state
  currentTrack: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  volume: 1,
  isBuffering: false,
  isShuffled: false,
  repeatMode: 'none',
  originalQueue: [],
  queue: [],
  queueIndex: -1,
  isConnected: false,
  wsConnection: null,
  connectionStatus: 'disconnected',
  reconnectAttempts: 0,
  lastError: null,
  audioElement: null,

  setTrack: (track) => {
    set({ currentTrack: track });
  },

  play: async (track) => {
    const { audioElement, currentTrack, playbackMode } = get();
    const trackToPlay = track || currentTrack;

    if (!trackToPlay) return;

    // If in remote mode, send command to desktop
    if (playbackMode === 'remote') {
      get().sendRemoteCommand('play', { track: trackToPlay });
      return;
    }

    set({ isBuffering: true, currentTrack: trackToPlay });

    try {
      // Use /api/stream/resolve to get stream URL WITHOUT triggering desktop playback
      // This allows mobile-only playback without affecting desktop
      const response = await tunnelFetch('/api/stream/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track: trackToPlay })
      });

      const data = await response.json();

      if (data.success && data.streamInfo?.url) {
        // Create or reuse audio element
        let audio = audioElement;
        if (!audio) {
          audio = new Audio();
          audio.addEventListener('timeupdate', () => {
            set({ position: audio.currentTime });
          });
          audio.addEventListener('loadedmetadata', () => {
            set({ duration: audio.duration, isBuffering: false });
          });
          audio.addEventListener('ended', () => {
            get().nextTrack();
          });
          audio.addEventListener('waiting', () => {
            set({ isBuffering: true });
          });
          audio.addEventListener('playing', () => {
            set({ isBuffering: false, isPlaying: true });
          });
          set({ audioElement: audio });
        }

        audio.src = data.streamInfo.url;
        audio.volume = get().volume;
        await audio.play();

        set({ isPlaying: true });
      }
    } catch (error) {
      console.error('Play error:', error);
      set({ isBuffering: false });
    }
  },

  pause: () => {
    const { audioElement, playbackMode } = get();

    // If in remote mode, send command to desktop
    if (playbackMode === 'remote') {
      get().sendRemoteCommand('pause');
      return;
    }

    // Local mode: only pause mobile audio, don't affect desktop
    if (audioElement) {
      audioElement.pause();
      set({ isPlaying: false });
    }
  },

  resume: () => {
    const { audioElement, playbackMode } = get();

    // If in remote mode, send command to desktop
    if (playbackMode === 'remote') {
      get().sendRemoteCommand('resume');
      return;
    }

    // Local mode: only resume mobile audio, don't affect desktop
    if (audioElement) {
      audioElement.play();
      set({ isPlaying: true });
    }
  },

  seek: (position) => {
    const { audioElement, playbackMode } = get();

    // If in remote mode, send command to desktop
    if (playbackMode === 'remote') {
      get().sendRemoteCommand('seek', { position });
      return;
    }

    // Local mode: only seek mobile audio, don't affect desktop
    if (audioElement) {
      audioElement.currentTime = position;
      set({ position });
    }
  },

  setVolume: (volume) => {
    const { audioElement, playbackMode } = get();

    // If in remote mode, send command to desktop
    if (playbackMode === 'remote') {
      get().sendRemoteCommand('volume', { volume });
      return;
    }

    if (audioElement) {
      audioElement.volume = volume;
    }
    set({ volume });
  },

  // Alias methods for action sheet
  next: () => {
    get().nextTrack();
  },

  previous: () => {
    get().previousTrack();
  },

  nextTrack: () => {
    const { queue, queueIndex, repeatMode, playbackMode } = get();

    // If in remote mode, send command to desktop
    if (playbackMode === 'remote') {
      get().sendRemoteCommand('next');
      return;
    }

    // Repeat one: replay current track
    if (repeatMode === 'one') {
      get().seek(0);
      get().resume();
      return;
    }

    // Normal next
    if (queueIndex < queue.length - 1) {
      const nextIndex = queueIndex + 1;
      set({ queueIndex: nextIndex });
      get().play(queue[nextIndex]);
    } else if (repeatMode === 'all' && queue.length > 0) {
      // Repeat all: go back to start
      set({ queueIndex: 0 });
      get().play(queue[0]);
    } else {
      set({ isPlaying: false });
    }
  },

  previousTrack: () => {
    const { queue, queueIndex, position, repeatMode, playbackMode } = get();

    // If in remote mode, send command to desktop
    if (playbackMode === 'remote') {
      get().sendRemoteCommand('previous');
      return;
    }

    // If more than 3 seconds in, restart current track
    if (position > 3) {
      get().seek(0);
      return;
    }

    if (queueIndex > 0) {
      const prevIndex = queueIndex - 1;
      set({ queueIndex: prevIndex });
      get().play(queue[prevIndex]);
    } else if (repeatMode === 'all' && queue.length > 0) {
      // Go to end of queue
      const lastIndex = queue.length - 1;
      set({ queueIndex: lastIndex });
      get().play(queue[lastIndex]);
    }
  },

  addToQueue: (track, playNext = false) => {
    const { playbackMode, queue, queueIndex, isShuffled, originalQueue } = get();

    // If in remote mode, send command to desktop
    if (playbackMode === 'remote') {
      get().sendRemoteCommand(playNext ? 'playNext' : 'addToQueue', { track });
      return;
    }

    if (playNext) {
      const insertIndex = queueIndex + 1;
      const newQueue = [...queue];
      newQueue.splice(insertIndex, 0, track);
      const newOriginalQueue = isShuffled ? [...originalQueue, track] : newQueue;
      set({ queue: newQueue, originalQueue: newOriginalQueue });
    } else {
      set((state) => ({
        queue: [...state.queue, track],
        originalQueue: state.isShuffled ? state.originalQueue : [...state.queue, track]
      }));
    }
  },

  playNext: (track) => {
    const { queue, queueIndex, isShuffled, originalQueue } = get();
    const insertIndex = queueIndex + 1;
    const newQueue = [...queue];
    newQueue.splice(insertIndex, 0, track);

    const newOriginalQueue = isShuffled ? [...originalQueue, track] : newQueue;

    set({
      queue: newQueue,
      originalQueue: newOriginalQueue
    });
  },

  removeFromQueue: (index) => {
    const { queue, queueIndex, isShuffled, originalQueue } = get();
    const trackToRemove = queue[index];
    const newQueue = queue.filter((_, i) => i !== index);

    // Adjust queueIndex if needed
    let newQueueIndex = queueIndex;
    if (index < queueIndex) {
      newQueueIndex = queueIndex - 1;
    } else if (index === queueIndex && newQueue.length > 0) {
      newQueueIndex = Math.min(queueIndex, newQueue.length - 1);
    }

    // Also remove from original queue if shuffled
    const newOriginalQueue = isShuffled
      ? originalQueue.filter(t => t.id !== trackToRemove.id)
      : newQueue;

    set({
      queue: newQueue,
      queueIndex: newQueueIndex,
      originalQueue: newOriginalQueue
    });
  },

  clearQueue: () => {
    set({ queue: [], queueIndex: -1, originalQueue: [], isShuffled: false });
  },

  setQueue: (tracks, startIndex = 0) => {
    set({
      queue: tracks,
      originalQueue: tracks,
      queueIndex: startIndex,
      isShuffled: false
    });
    if (tracks[startIndex]) {
      get().play(tracks[startIndex]);
    }
  },

  playFromQueue: (index) => {
    const { queue, playbackMode } = get();

    if (index < 0 || index >= queue.length) return;

    // If in remote mode, send command to desktop
    if (playbackMode === 'remote') {
      get().sendRemoteCommand('playFromQueue', { index });
      return;
    }

    set({ queueIndex: index });
    get().play(queue[index]);
  },

  toggleShuffle: () => {
    const { isShuffled, queue, queueIndex, currentTrack, originalQueue, playbackMode } = get();

    // If in remote mode, send command to desktop
    if (playbackMode === 'remote') {
      get().sendRemoteCommand('toggleShuffle');
      return;
    }

    if (isShuffled) {
      // Unshuffle: restore original order
      const currentTrackIndex = originalQueue.findIndex(t => t.id === currentTrack?.id);
      set({
        queue: originalQueue,
        queueIndex: currentTrackIndex >= 0 ? currentTrackIndex : 0,
        isShuffled: false
      });
    } else {
      // Shuffle: save original order and shuffle
      const currentTrackItem = queue[queueIndex];
      const remainingTracks = queue.filter((_, i) => i !== queueIndex);

      // Fisher-Yates shuffle
      for (let i = remainingTracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remainingTracks[i], remainingTracks[j]] = [remainingTracks[j], remainingTracks[i]];
      }

      // Put current track at the beginning
      const shuffledQueue = currentTrackItem
        ? [currentTrackItem, ...remainingTracks]
        : remainingTracks;

      set({
        originalQueue: queue,
        queue: shuffledQueue,
        queueIndex: 0,
        isShuffled: true
      });
    }
  },

  toggleRepeat: () => {
    const { repeatMode, playbackMode } = get();

    // If in remote mode, send command to desktop
    if (playbackMode === 'remote') {
      get().sendRemoteCommand('toggleRepeat');
      return;
    }

    const modes: RepeatMode[] = ['none', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    set({ repeatMode: nextMode });
  },

  setPlaybackMode: (mode) => {
    const { playbackMode, audioElement, wsConnection } = get();

    if (playbackMode === mode) return;

    // If switching from local to remote, pause local playback
    if (playbackMode === 'local' && mode === 'remote' && audioElement) {
      audioElement.pause();
    }

    set({ playbackMode: mode });

    // Request current desktop state when switching to remote
    if (mode === 'remote' && wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      wsConnection.send(JSON.stringify({
        type: 'request-desktop-state'
      }));
    }
  },

  sendRemoteCommand: (command, payload) => {
    const { wsConnection } = get();

    // Try P2P first if connected (for remote mode from GitHub Pages, etc.)
    if (isP2PConnected()) {
      console.log(`[Remote] Sending command via P2P: ${command}`);
      useP2PStore.getState().send('remote-command', { command, ...payload });
      return;
    }

    // Fall back to WebSocket for local network
    if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
      console.warn('[Remote] Neither P2P nor WebSocket connected');
      return;
    }

    wsConnection.send(JSON.stringify({
      type: 'remote-command',
      payload: { command, ...payload }
    }));
  },

  connectWebSocket: (token) => {
    const { wsConnection, connectionStatus } = get();

    // Check if we're in remote mode (GitHub Pages, etc.)
    // In remote mode, we use P2P for all communication - no direct WebSocket
    const host = window.location.hostname;
    const isRemoteMode = host.includes('github.io') ||
                         host.includes('netlify') ||
                         host.includes('vercel') ||
                         host.includes('pages.dev');

    if (isRemoteMode) {
      console.log('[WebSocket] Remote mode detected - using P2P instead of direct WebSocket');
      // In remote mode, connection is handled by P2P store
      // Just mark as needing P2P connection
      set({ connectionStatus: 'disconnected', lastError: 'Use P2P to connect in remote mode' });
      return;
    }

    // Prevent duplicate connections
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      return;
    }

    // Close existing connection if any
    if (wsConnection) {
      wsConnection.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;

    set({ connectionStatus: 'connecting', lastError: null });
    console.log('[WebSocket] Connecting...');

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      set({
        isConnected: true,
        wsConnection: ws,
        connectionStatus: 'connected',
        reconnectAttempts: 0,
        lastError: null
      });
      console.log('[WebSocket] Connected');

      // Trigger haptic feedback on reconnect success
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message, set, get);
      } catch {
        // Invalid message
      }
    };

    ws.onclose = (event) => {
      const { reconnectAttempts } = get();
      set({ isConnected: false, wsConnection: null });

      // Don't reconnect if this was a clean close (code 1000) or auth failure (4001)
      if (event.code === 1000 || event.code === 4001) {
        set({ connectionStatus: 'disconnected' });
        console.log('[WebSocket] Closed cleanly');
        return;
      }

      // Check if we should retry
      if (reconnectAttempts >= RECONNECT_CONFIG.maxAttempts) {
        set({
          connectionStatus: 'disconnected',
          lastError: 'Connection lost. Please refresh the page.'
        });
        console.log('[WebSocket] Max reconnect attempts reached');
        return;
      }

      // Calculate delay with exponential backoff + jitter
      const baseDelay = Math.min(
        RECONNECT_CONFIG.initialDelay * Math.pow(RECONNECT_CONFIG.multiplier, reconnectAttempts),
        RECONNECT_CONFIG.maxDelay
      );
      const jitter = baseDelay * RECONNECT_CONFIG.jitter * (Math.random() * 2 - 1);
      const delay = Math.round(baseDelay + jitter);

      set({
        connectionStatus: 'reconnecting',
        reconnectAttempts: reconnectAttempts + 1
      });

      console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${RECONNECT_CONFIG.maxAttempts})`);

      setTimeout(() => {
        const { connectionStatus } = get();
        if (connectionStatus === 'reconnecting') {
          get().connectWebSocket(token);
        }
      }, delay);
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      set({ lastError: 'Connection error' });
    };
  },

  disconnectWebSocket: () => {
    const { wsConnection } = get();
    if (wsConnection) {
      wsConnection.close();
      set({ wsConnection: null, isConnected: false });
    }
  }
}));

function handleWebSocketMessage(
  message: { type: string; payload?: any },
  set: any,
  get: any
) {
  const { playbackMode } = get();

  switch (message.type) {
    case 'desktop-state':
      // Full desktop state update (for remote mode)
      if (message.payload) {
        set({ desktopState: message.payload });

        // If in remote mode, update visible state from desktop
        if (playbackMode === 'remote') {
          const state = message.payload;
          set({
            currentTrack: state.currentTrack,
            isPlaying: state.isPlaying,
            position: state.position,
            duration: state.duration,
            volume: state.volume,
            isShuffled: state.isShuffled,
            repeatMode: state.repeatMode,
            queue: state.queue,
            queueIndex: state.queueIndex
          });
        }
      }
      break;

    case 'playback-sync':
      // Sync playback state from host
      if (message.payload) {
        const { isPlaying, position, currentTrack, duration } = message.payload;

        // Update desktop state
        set((prev: any) => ({
          desktopState: {
            ...prev.desktopState,
            ...message.payload
          }
        }));

        // If in remote mode, update visible state
        if (playbackMode === 'remote') {
          if (currentTrack) set({ currentTrack });
          if (typeof isPlaying === 'boolean') set({ isPlaying });
          if (typeof position === 'number') set({ position });
          if (typeof duration === 'number') set({ duration });
        } else {
          // Local mode - sync position if needed
          if (typeof position === 'number') {
            const { audioElement } = get();
            if (audioElement && Math.abs(audioElement.currentTime - position) > 2) {
              audioElement.currentTime = position;
            }
          }
        }
      }
      break;

    case 'track-change':
      if (message.payload?.track) {
        set((prev: any) => ({
          desktopState: {
            ...prev.desktopState,
            currentTrack: message.payload.track
          }
        }));

        if (playbackMode === 'remote') {
          set({ currentTrack: message.payload.track });
        }
      }
      break;

    case 'queue-update':
      if (message.payload?.queue) {
        set((prev: any) => ({
          desktopState: {
            ...prev.desktopState,
            queue: message.payload.queue,
            queueIndex: message.payload.queueIndex ?? prev.desktopState?.queueIndex
          }
        }));

        if (playbackMode === 'remote') {
          set({ queue: message.payload.queue });
          if (typeof message.payload.queueIndex === 'number') {
            set({ queueIndex: message.payload.queueIndex });
          }
        }
      }
      break;

    case 'pong':
      // Heartbeat response
      break;
  }
}

// ============================================
// Fine-grained selectors for performance
// Use these instead of destructuring the entire store
// ============================================

/** Select only playback state - prevents re-renders when queue changes */
export const usePlaybackState = () => usePlayerStore((state) => ({
  currentTrack: state.currentTrack,
  isPlaying: state.isPlaying,
  isBuffering: state.isBuffering,
  position: state.position,
  duration: state.duration,
}));

/** Select only current track */
export const useCurrentTrack = () => usePlayerStore((state) => state.currentTrack);

/** Select only playing status */
export const useIsPlaying = () => usePlayerStore((state) => state.isPlaying);

/** Select only connection status */
export const useConnectionStatus = () => usePlayerStore((state) => ({
  isConnected: state.isConnected,
  connectionStatus: state.connectionStatus,
  reconnectAttempts: state.reconnectAttempts,
  lastError: state.lastError,
}));

/** Select only queue state */
export const useQueueState = () => usePlayerStore((state) => ({
  queue: state.queue,
  queueIndex: state.queueIndex,
}));

/** Select only shuffle/repeat state */
export const usePlaybackModes = () => usePlayerStore((state) => ({
  isShuffled: state.isShuffled,
  repeatMode: state.repeatMode,
  playbackMode: state.playbackMode,
}));

/** Select only volume */
export const useVolume = () => usePlayerStore((state) => state.volume);

/** Select playback controls (stable references) */
export const usePlaybackControls = () => usePlayerStore((state) => ({
  play: state.play,
  pause: state.pause,
  resume: state.resume,
  seek: state.seek,
  nextTrack: state.nextTrack,
  previousTrack: state.previousTrack,
  setVolume: state.setVolume,
  toggleShuffle: state.toggleShuffle,
  toggleRepeat: state.toggleRepeat,
}));

/** Select queue controls (stable references) */
export const useQueueControls = () => usePlayerStore((state) => ({
  addToQueue: state.addToQueue,
  playNext: state.playNext,
  removeFromQueue: state.removeFromQueue,
  clearQueue: state.clearQueue,
  setQueue: state.setQueue,
}));
