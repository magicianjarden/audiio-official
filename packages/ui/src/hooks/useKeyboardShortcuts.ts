/**
 * Global keyboard shortcuts hook
 * Handles all app-wide keyboard shortcuts in a centralized location
 */

import { useEffect, useCallback, useRef } from 'react';
import { usePlayerStore } from '../stores/player-store';
import { useUIStore } from '../stores/ui-store';
import { useNavigationStore } from '../stores/navigation-store';
import { useShortcutStore, DEFAULT_SHORTCUTS } from '../stores/shortcut-store';

// Volume adjustment step (0-1 scale)
const VOLUME_STEP = 0.05;

// Seek steps in milliseconds
const SEEK_STEP_SMALL = 5000;  // 5 seconds
const SEEK_STEP_LARGE = 10000; // 10 seconds

/**
 * Check if the event target is an input element where we should NOT intercept shortcuts
 */
function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }

  // Check for contenteditable
  if (target.isContentEditable) {
    return true;
  }

  // Check for elements with role="textbox"
  if (target.getAttribute('role') === 'textbox') {
    return true;
  }

  return false;
}

/**
 * Match keyboard event against shortcut keys
 */
function matchesShortcut(event: KeyboardEvent, keys: string[]): boolean {
  if (keys.length === 0) return false;

  // Build the set of modifiers from the shortcut
  const requiredModifiers = {
    control: keys.includes('Control'),
    meta: keys.includes('Meta'),
    alt: keys.includes('Alt'),
    shift: keys.includes('Shift'),
  };

  // Check modifiers match
  if (event.ctrlKey !== requiredModifiers.control) return false;
  if (event.metaKey !== requiredModifiers.meta) return false;
  if (event.altKey !== requiredModifiers.alt) return false;
  if (event.shiftKey !== requiredModifiers.shift) return false;

  // Get the primary key (non-modifier)
  const primaryKey = keys.find(k =>
    !['Control', 'Meta', 'Alt', 'Shift'].includes(k)
  );

  if (!primaryKey) return false;

  // Check if the pressed key matches (case-insensitive for letters)
  const pressedKey = event.key;
  return pressedKey.toLowerCase() === primaryKey.toLowerCase() || pressedKey === primaryKey;
}

/**
 * Global keyboard shortcuts hook
 * Add to App component to enable shortcuts throughout the app
 */
export function useGlobalKeyboardShortcuts(): void {
  const {
    isPlaying,
    currentTrack,
    position,
    duration,
    volume,
    pause,
    resume,
    seek,
    next,
    previous,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
  } = usePlayerStore();

  const {
    playerMode,
    isQueueOpen,
    isLyricsPanelOpen,
    expandPlayer,
    collapsePlayer,
    togglePlayer,
    closeQueue,
    toggleLyricsPanel,
    closeLyricsPanel,
  } = useUIStore();

  const { currentView, navigate, goBack, setSearchActive } = useNavigationStore();

  const { getEffectiveKeys, isShortcutEnabled } = useShortcutStore();

  // Ref to track if we're in a debounce period for seek
  const seekDebounceRef = useRef<number | null>(null);

  // Get effective shortcut keys with custom mappings
  const getKeys = useCallback((id: string) => {
    if (!isShortcutEnabled(id)) return [];
    return getEffectiveKeys(id);
  }, [getEffectiveKeys, isShortcutEnabled]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Skip if typing in an input
    if (isInputElement(event.target)) {
      // Allow Escape to blur input
      if (event.key === 'Escape' && event.target instanceof HTMLElement) {
        event.target.blur();
      }
      return;
    }

    let handled = false;

    // Close overlay / Go back (Escape) - always check first
    if (matchesShortcut(event, getKeys('closeOverlay'))) {
      if (playerMode === 'full') {
        collapsePlayer();
        handled = true;
      } else if (isQueueOpen) {
        closeQueue();
        handled = true;
      } else if (isLyricsPanelOpen) {
        closeLyricsPanel();
        handled = true;
      } else if (currentView !== 'home') {
        goBack();
        handled = true;
      }
    }

    // Playback controls
    else if (matchesShortcut(event, getKeys('playPause'))) {
      if (currentTrack) {
        isPlaying ? pause() : resume();
        handled = true;
      }
    }

    else if (matchesShortcut(event, getKeys('seekBackward5'))) {
      if (currentTrack) {
        const newPosition = Math.max(0, position - SEEK_STEP_SMALL);
        seek(newPosition);
        handled = true;
      }
    }

    else if (matchesShortcut(event, getKeys('seekForward5'))) {
      if (currentTrack) {
        const newPosition = Math.min(duration, position + SEEK_STEP_SMALL);
        seek(newPosition);
        handled = true;
      }
    }

    else if (matchesShortcut(event, getKeys('seekBackward10'))) {
      if (currentTrack) {
        const newPosition = Math.max(0, position - SEEK_STEP_LARGE);
        seek(newPosition);
        handled = true;
      }
    }

    else if (matchesShortcut(event, getKeys('seekForward10'))) {
      if (currentTrack) {
        const newPosition = Math.min(duration, position + SEEK_STEP_LARGE);
        seek(newPosition);
        handled = true;
      }
    }

    else if (matchesShortcut(event, getKeys('next'))) {
      if (currentTrack) {
        next();
        handled = true;
      }
    }

    else if (matchesShortcut(event, getKeys('previous'))) {
      if (currentTrack) {
        previous();
        handled = true;
      }
    }

    else if (matchesShortcut(event, getKeys('toggleShuffle'))) {
      toggleShuffle();
      handled = true;
    }

    else if (matchesShortcut(event, getKeys('cycleRepeat'))) {
      cycleRepeat();
      handled = true;
    }

    // Volume controls
    else if (matchesShortcut(event, getKeys('volumeUp'))) {
      setVolume(Math.min(1, volume + VOLUME_STEP));
      handled = true;
    }

    else if (matchesShortcut(event, getKeys('volumeDown'))) {
      setVolume(Math.max(0, volume - VOLUME_STEP));
      handled = true;
    }

    else if (matchesShortcut(event, getKeys('toggleMute'))) {
      toggleMute();
      handled = true;
    }

    // UI controls
    else if (matchesShortcut(event, getKeys('toggleFullPlayer'))) {
      if (currentTrack) {
        togglePlayer();
        handled = true;
      }
    }

    else if (matchesShortcut(event, getKeys('toggleQueue'))) {
      // For queue, we need an anchor rect - use player position
      if (isQueueOpen) {
        closeQueue();
      } else {
        // Dispatch a custom event that QueuePopover can listen to
        window.dispatchEvent(new CustomEvent('audiio:toggle-queue-shortcut'));
      }
      handled = true;
    }

    else if (matchesShortcut(event, getKeys('toggleLyricsPanel'))) {
      toggleLyricsPanel();
      handled = true;
    }

    // Focus search
    else if (
      matchesShortcut(event, getKeys('focusSearch')) ||
      matchesShortcut(event, DEFAULT_SHORTCUTS.focusSearchAlt || []) ||
      matchesShortcut(event, DEFAULT_SHORTCUTS.focusSearchMac || [])
    ) {
      // Navigate to home and activate search
      if (currentView !== 'home') {
        navigate('home');
      }
      setSearchActive(true);
      // Focus the search input
      setTimeout(() => {
        const searchInput = document.querySelector<HTMLInputElement>('.floating-search-input');
        searchInput?.focus();
      }, 50);
      handled = true;
    }

    // Prevent default behavior if we handled the shortcut
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, [
    currentTrack,
    isPlaying,
    position,
    duration,
    volume,
    playerMode,
    isQueueOpen,
    isLyricsPanelOpen,
    currentView,
    pause,
    resume,
    seek,
    next,
    previous,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    expandPlayer,
    collapsePlayer,
    togglePlayer,
    closeQueue,
    toggleLyricsPanel,
    closeLyricsPanel,
    goBack,
    navigate,
    setSearchActive,
    getKeys,
  ]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (seekDebounceRef.current) {
        clearTimeout(seekDebounceRef.current);
      }
    };
  }, [handleKeyDown]);
}

/**
 * GlobalShortcutManager component
 * Add this to your App component to enable global shortcuts
 */
export const GlobalShortcutManager: React.FC = () => {
  useGlobalKeyboardShortcuts();
  return null;
};
