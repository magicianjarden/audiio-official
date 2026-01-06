/**
 * useScrobbling Hook
 *
 * Automatically handles scrobbling via enabled scrobbler plugins.
 * Watches the player store and triggers scrobbles based on plugin settings.
 *
 * This hook works with any scrobbler plugin (ListenBrainz, Last.fm, etc.)
 * by using the plugin system rather than hardcoded integrations.
 *
 * Usage: Call useScrobbling() in your App or Player component to enable auto-scrobbling.
 */

import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../stores/player-store';
import { usePluginStore } from '../stores/plugin-store';
import type { UnifiedTrack } from '../types/api';

interface ScrobbleState {
  trackId: string | null;
  startTime: number;
  accumulatedTime: number;
  lastPositionUpdate: number;
  nowPlayingSent: boolean;
  scrobbled: boolean;
}

// Default scrobble settings if plugin doesn't specify
const DEFAULT_SCROBBLE_THRESHOLD = 50; // 50% of track
const DEFAULT_NOW_PLAYING_ENABLED = true;

export function useScrobbling() {
  const { currentTrack, position, isPlaying, duration } = usePlayerStore();
  const { getPluginsByRole, getPluginSettings } = usePluginStore();

  const scrobbleStateRef = useRef<ScrobbleState>({
    trackId: null,
    startTime: 0,
    accumulatedTime: 0,
    lastPositionUpdate: 0,
    nowPlayingSent: false,
    scrobbled: false,
  });

  // Get enabled scrobbler plugins
  const getEnabledScrobblers = () => {
    const scrobblers = getPluginsByRole('scrobbler');
    return scrobblers.filter((p) => p.enabled);
  };

  // Get scrobbler settings
  const getScrobblerSettings = (pluginId: string) => {
    const settings = getPluginSettings(pluginId) || {};
    return {
      enabled: settings.scrobblingEnabled !== false, // Default true
      threshold: (settings.scrobbleThreshold as number) || DEFAULT_SCROBBLE_THRESHOLD,
      nowPlayingEnabled: settings.nowPlayingEnabled !== false, // Default true
    };
  };

  // Send now playing to all enabled scrobblers
  const sendNowPlaying = async (track: UnifiedTrack) => {
    const scrobblers = getEnabledScrobblers();

    for (const plugin of scrobblers) {
      const settings = getScrobblerSettings(plugin.id);
      if (!settings.enabled || !settings.nowPlayingEnabled) continue;

      try {
        await window.api?.scrobble?.updateNowPlaying?.(plugin.id, {
          title: track.title,
          artist: track.artists[0]?.name || 'Unknown Artist',
          album: track.album || undefined,
          duration: track.duration,
        });
      } catch (error) {
        console.warn(`[Scrobbling] Failed to send now playing to ${plugin.id}:`, error);
      }
    }
  };

  // Submit scrobble to all enabled scrobblers
  const submitScrobble = async (track: UnifiedTrack, playedMs: number, timestamp: number) => {
    const scrobblers = getEnabledScrobblers();

    for (const plugin of scrobblers) {
      const settings = getScrobblerSettings(plugin.id);
      if (!settings.enabled) continue;

      try {
        const result = await window.api?.scrobble?.submit?.(plugin.id, {
          title: track.title,
          artist: track.artists[0]?.name || 'Unknown Artist',
          album: track.album || undefined,
          duration: track.duration,
          timestamp,
          playedMs,
        });

        if (result?.success) {
          console.log(`[Scrobbling] Scrobbled to ${plugin.id}:`, track.title);
        }
      } catch (error) {
        console.warn(`[Scrobbling] Failed to scrobble to ${plugin.id}:`, error);
      }
    }
  };

  // Handle track changes
  useEffect(() => {
    const state = scrobbleStateRef.current;

    if (!currentTrack) {
      // Reset state when track is cleared
      state.trackId = null;
      state.startTime = 0;
      state.accumulatedTime = 0;
      state.lastPositionUpdate = 0;
      state.nowPlayingSent = false;
      state.scrobbled = false;
      return;
    }

    // New track started
    if (state.trackId !== currentTrack.id) {
      console.log('[Scrobbling] New track detected:', currentTrack.title);
      state.trackId = currentTrack.id;
      state.startTime = Date.now();
      state.accumulatedTime = 0;
      state.lastPositionUpdate = position;
      state.nowPlayingSent = false;
      state.scrobbled = false;

      // Send "now playing" update
      const enabledScrobblers = getEnabledScrobblers();
      console.log('[Scrobbling] Enabled scrobblers:', enabledScrobblers.length);
      if (isPlaying && enabledScrobblers.length > 0) {
        console.log('[Scrobbling] Sending now playing...');
        sendNowPlaying(currentTrack);
        state.nowPlayingSent = true;
      }
    }
  }, [currentTrack?.id, isPlaying]);

  // Track accumulated play time and handle scrobbling
  useEffect(() => {
    const state = scrobbleStateRef.current;
    const scrobblers = getEnabledScrobblers();

    if (!currentTrack || scrobblers.length === 0) {
      return;
    }

    // Only accumulate time when actually playing
    if (!isPlaying) {
      state.lastPositionUpdate = position;
      return;
    }

    // Calculate time delta from last update
    const positionDelta = position - state.lastPositionUpdate;

    // Only count forward progress (not seeks backward)
    // Also cap at 2 seconds to prevent jumps from counting too much
    if (positionDelta > 0 && positionDelta < 2000) {
      state.accumulatedTime += positionDelta;
    }

    state.lastPositionUpdate = position;

    // Check if we should scrobble
    if (!state.scrobbled && duration > 0) {
      const playedPercent = (state.accumulatedTime / duration) * 100;

      // Get minimum threshold from all enabled scrobblers
      let minThreshold = DEFAULT_SCROBBLE_THRESHOLD;
      for (const plugin of scrobblers) {
        const settings = getScrobblerSettings(plugin.id);
        if (settings.enabled && settings.threshold < minThreshold) {
          minThreshold = settings.threshold;
        }
      }

      // Scrobble if:
      // 1. Played more than threshold %
      // 2. Or played more than 4 minutes (standard last.fm rule)
      // 3. And at least 30 seconds played (standard rule)
      const shouldScrobble =
        state.accumulatedTime >= 30000 && // At least 30 seconds
        (playedPercent >= minThreshold || state.accumulatedTime >= 240000); // threshold% or 4 minutes

      if (shouldScrobble) {
        const scrobbleTimestamp = Math.floor((state.startTime + state.accumulatedTime / 2) / 1000);
        submitScrobble(currentTrack, state.accumulatedTime, scrobbleTimestamp);
        state.scrobbled = true;
      }
    }
  }, [currentTrack, position, duration, isPlaying]);

  // Send "now playing" when playback starts/resumes
  useEffect(() => {
    const state = scrobbleStateRef.current;

    if (!currentTrack || getEnabledScrobblers().length === 0) {
      return;
    }

    // Send now playing when starting to play (if not already sent for this track)
    if (isPlaying && !state.nowPlayingSent) {
      sendNowPlaying(currentTrack);
      state.nowPlayingSent = true;
    }
  }, [currentTrack, isPlaying]);

  // Handle track end - ensure scrobble happens even if threshold wasn't exactly met
  useEffect(() => {
    const state = scrobbleStateRef.current;
    const scrobblers = getEnabledScrobblers();

    if (!currentTrack || scrobblers.length === 0 || state.scrobbled) {
      return;
    }

    // Check if track is near the end (within last 5 seconds)
    const isNearEnd = duration > 0 && duration - position < 5000;

    if (isNearEnd && state.accumulatedTime >= 30000) {
      const playedPercent = (state.accumulatedTime / duration) * 100;

      // Get minimum threshold from all enabled scrobblers
      let minThreshold = DEFAULT_SCROBBLE_THRESHOLD;
      for (const plugin of scrobblers) {
        const settings = getScrobblerSettings(plugin.id);
        if (settings.enabled && settings.threshold < minThreshold) {
          minThreshold = settings.threshold;
        }
      }

      // Give a little more leeway at the end
      if (playedPercent >= minThreshold - 5) {
        const scrobbleTimestamp = Math.floor((state.startTime + state.accumulatedTime / 2) / 1000);
        submitScrobble(currentTrack, state.accumulatedTime, scrobbleTimestamp);
        state.scrobbled = true;
      }
    }
  }, [currentTrack, position, duration]);

  // Return nothing - this hook is just for side effects
  return null;
}
