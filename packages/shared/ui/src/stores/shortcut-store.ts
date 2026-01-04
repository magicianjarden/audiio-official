/**
 * Shortcut store - manages keyboard shortcut configuration and persistence
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ShortcutDefinition {
  id: string;
  keys: string[];                    // e.g., ['Space'], ['ArrowRight'], ['Control', 'k']
  description: string;
  category: 'playback' | 'navigation' | 'volume' | 'queue' | 'other';
  enabled: boolean;
}

export const DEFAULT_SHORTCUTS: Record<string, string[]> = {
  // Playback
  playPause: ['Space'],
  seekBackward5: ['ArrowLeft'],
  seekForward5: ['ArrowRight'],
  seekBackward10: ['j'],
  seekForward10: ['l'],
  next: ['n'],
  previous: ['p'],
  toggleShuffle: ['s'],
  cycleRepeat: ['r'],

  // Volume
  volumeUp: ['ArrowUp'],
  volumeDown: ['ArrowDown'],
  toggleMute: ['m'],

  // UI
  toggleFullPlayer: ['f'],
  toggleQueue: ['q'],
  toggleLyricsPanel: ['y'],
  focusSearch: ['/'],
  focusSearchAlt: ['Control', 'k'],
  focusSearchMac: ['Meta', 'k'],
  closeOverlay: ['Escape'],
};

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  // Playback
  { id: 'playPause', keys: DEFAULT_SHORTCUTS.playPause!, description: 'Play / Pause', category: 'playback', enabled: true },
  { id: 'seekBackward5', keys: DEFAULT_SHORTCUTS.seekBackward5!, description: 'Seek backward 5s', category: 'playback', enabled: true },
  { id: 'seekForward5', keys: DEFAULT_SHORTCUTS.seekForward5!, description: 'Seek forward 5s', category: 'playback', enabled: true },
  { id: 'seekBackward10', keys: DEFAULT_SHORTCUTS.seekBackward10!, description: 'Seek backward 10s', category: 'playback', enabled: true },
  { id: 'seekForward10', keys: DEFAULT_SHORTCUTS.seekForward10!, description: 'Seek forward 10s', category: 'playback', enabled: true },
  { id: 'next', keys: DEFAULT_SHORTCUTS.next!, description: 'Next track', category: 'playback', enabled: true },
  { id: 'previous', keys: DEFAULT_SHORTCUTS.previous!, description: 'Previous track', category: 'playback', enabled: true },
  { id: 'toggleShuffle', keys: DEFAULT_SHORTCUTS.toggleShuffle!, description: 'Toggle shuffle', category: 'playback', enabled: true },
  { id: 'cycleRepeat', keys: DEFAULT_SHORTCUTS.cycleRepeat!, description: 'Cycle repeat mode', category: 'playback', enabled: true },

  // Volume
  { id: 'volumeUp', keys: DEFAULT_SHORTCUTS.volumeUp!, description: 'Volume up', category: 'volume', enabled: true },
  { id: 'volumeDown', keys: DEFAULT_SHORTCUTS.volumeDown!, description: 'Volume down', category: 'volume', enabled: true },
  { id: 'toggleMute', keys: DEFAULT_SHORTCUTS.toggleMute!, description: 'Toggle mute', category: 'volume', enabled: true },

  // UI
  { id: 'toggleFullPlayer', keys: DEFAULT_SHORTCUTS.toggleFullPlayer!, description: 'Toggle full player', category: 'navigation', enabled: true },
  { id: 'toggleQueue', keys: DEFAULT_SHORTCUTS.toggleQueue!, description: 'Toggle queue', category: 'queue', enabled: true },
  { id: 'toggleLyricsPanel', keys: DEFAULT_SHORTCUTS.toggleLyricsPanel!, description: 'Toggle lyrics panel', category: 'navigation', enabled: true },
  { id: 'focusSearch', keys: DEFAULT_SHORTCUTS.focusSearch!, description: 'Focus search', category: 'navigation', enabled: true },
  { id: 'closeOverlay', keys: DEFAULT_SHORTCUTS.closeOverlay!, description: 'Close overlay / Go back', category: 'navigation', enabled: true },
];

interface ShortcutState {
  // Custom key mappings (overrides defaults)
  customMappings: Record<string, string[]>;
  // Disabled shortcuts
  disabledShortcuts: string[];
  // Show shortcut hints in UI
  showHints: boolean;

  // Actions
  setCustomMapping: (id: string, keys: string[]) => void;
  resetMapping: (id: string) => void;
  resetAllMappings: () => void;
  toggleShortcut: (id: string) => void;
  setShowHints: (show: boolean) => void;
  getEffectiveKeys: (id: string) => string[];
  isShortcutEnabled: (id: string) => boolean;
}

export const useShortcutStore = create<ShortcutState>()(
  persist(
    (set, get) => ({
      customMappings: {},
      disabledShortcuts: [],
      showHints: true,

      setCustomMapping: (id, keys) => {
        set(state => ({
          customMappings: { ...state.customMappings, [id]: keys }
        }));
      },

      resetMapping: (id) => {
        set(state => {
          const { [id]: _, ...rest } = state.customMappings;
          return { customMappings: rest };
        });
      },

      resetAllMappings: () => {
        set({ customMappings: {}, disabledShortcuts: [] });
      },

      toggleShortcut: (id) => {
        set(state => {
          const isDisabled = state.disabledShortcuts.includes(id);
          return {
            disabledShortcuts: isDisabled
              ? state.disabledShortcuts.filter(s => s !== id)
              : [...state.disabledShortcuts, id]
          };
        });
      },

      setShowHints: (show) => {
        set({ showHints: show });
      },

      getEffectiveKeys: (id) => {
        const { customMappings } = get();
        return customMappings[id] || DEFAULT_SHORTCUTS[id] || [];
      },

      isShortcutEnabled: (id) => {
        const { disabledShortcuts } = get();
        return !disabledShortcuts.includes(id);
      },
    }),
    {
      name: 'audiio-shortcuts',
      partialize: (state) => ({
        customMappings: state.customMappings,
        disabledShortcuts: state.disabledShortcuts,
        showHints: state.showHints,
      }),
    }
  )
);

/**
 * Format keys for display (e.g., ['Control', 'k'] -> 'Ctrl+K')
 */
export function formatShortcut(keys: string[]): string {
  return keys.map(key => {
    switch (key) {
      case 'Control': return 'Ctrl';
      case 'Meta': return '⌘';
      case 'Alt': return 'Alt';
      case 'Shift': return 'Shift';
      case 'ArrowLeft': return '←';
      case 'ArrowRight': return '→';
      case 'ArrowUp': return '↑';
      case 'ArrowDown': return '↓';
      case 'Space': return 'Space';
      case 'Escape': return 'Esc';
      default: return key.toUpperCase();
    }
  }).join('+');
}
