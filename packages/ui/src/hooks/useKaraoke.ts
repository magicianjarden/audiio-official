/**
 * useKaraoke - Streaming karaoke hook
 *
 * Features:
 * - Quick start: First 15 seconds available in ~3-5 seconds
 * - Full track processes in background
 * - Seamless swap to full track when ready (no interruption)
 * - Handles base64 to blob URL conversion in browser
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useKaraokeStore } from '../stores/karaoke-store';

interface UseKaraokeOptions {
  trackId: string | null;
  audioUrl: string | null;
  onInstrumentalReady?: (url: string) => void;
  onFullTrackReady?: (url: string) => void;
}

// Cache of blob URLs created from base64 data
const blobUrlCache = new Map<string, { url: string; isPartial: boolean }>();

// Track which tracks have full versions ready
const fullTrackReady = new Set<string>();

/**
 * Convert base64 audio data to a blob URL
 */
function base64ToBlobUrl(base64: string, mimeType: string): string {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Get or create blob URL from base64 data
 */
function getOrCreateBlobUrl(trackId: string, base64: string, mimeType: string, isPartial: boolean): string {
  const cached = blobUrlCache.get(trackId);

  // If we have a full track cached, always return it
  if (cached && !cached.isPartial) {
    return cached.url;
  }

  // If we're getting a full track (not partial), revoke old partial URL
  if (cached && cached.isPartial && !isPartial) {
    URL.revokeObjectURL(cached.url);
  }

  // Create new blob URL
  const blobUrl = base64ToBlobUrl(base64, mimeType);
  blobUrlCache.set(trackId, { url: blobUrl, isPartial });

  if (!isPartial) {
    fullTrackReady.add(trackId);
  }

  return blobUrl;
}

export function useKaraoke({ trackId, audioUrl, onInstrumentalReady, onFullTrackReady }: UseKaraokeOptions) {
  const {
    isAvailable,
    isEnabled,
    isProcessing,
    processedTracks,
    currentInstrumentalUrl,
    setAvailable,
    setProcessing,
    addProcessedTrack,
    setCurrentInstrumentalUrl
  } = useKaraokeStore();

  const lastTrackIdRef = useRef<string | null>(null);
  const processingPromiseRef = useRef<Promise<void> | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isPartial, setIsPartial] = useState(false);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Store callbacks in refs so they don't cause effect re-runs
  const onFullTrackReadyRef = useRef(onFullTrackReady);
  onFullTrackReadyRef.current = onFullTrackReady;

  // Check initial availability on mount and subscribe to events
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const result = await window.api.karaoke.isAvailable();
        setAvailable(result.available);
      } catch {
        setAvailable(false);
      }
    };

    checkAvailability();

    const unsubscribeAvailability = window.api.karaoke.onAvailabilityChange(({ available }) => {
      setAvailable(available);
    });

    // Subscribe to full track ready push notifications
    // This replaces polling - when the addon finishes processing, we get notified immediately
    let unsubscribeFullTrack: (() => void) | undefined;

    if (typeof window.api?.karaoke?.onFullTrackReady === 'function') {
      console.log('[Karaoke] Subscribing to full track ready events');
      unsubscribeFullTrack = window.api.karaoke.onFullTrackReady(({ trackId: readyTrackId, result }) => {
        console.log('[Karaoke] Received full track ready event:', readyTrackId, 'current:', lastTrackIdRef.current);

        // Only update if this is the current track
        if (readyTrackId === lastTrackIdRef.current && result?.audioBase64) {
          console.log('[Karaoke] Applying full track from push notification');
          const blobUrl = getOrCreateBlobUrl(
            readyTrackId,
            result.audioBase64,
            result.mimeType || 'audio/mpeg',
            false
          );

          setIsPartial(false);
          setCurrentInstrumentalUrl(blobUrl);
          onFullTrackReadyRef.current?.(blobUrl);

          // Clear polling since we got the result via push
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      });
    } else {
      console.warn('[Karaoke] onFullTrackReady API not available - falling back to polling only');
    }

    return () => {
      unsubscribeAvailability();
      unsubscribeFullTrack?.();
    };
  }, [setAvailable, setCurrentInstrumentalUrl]);

  // Poll for full track completion - now a BACKUP mechanism
  // Primary notification comes via IPC push event (onFullTrackReady)
  // This polling is just a safety net in case the IPC event is missed
  const startPollingForFullTrack = useCallback((currentTrackId: string) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    let attempts = 0;
    const maxAttempts = 60; // 2 minutes at 2-second intervals (reduced from 120 at 1-second)

    pollingIntervalRef.current = setInterval(async () => {
      attempts++;

      if (attempts > maxAttempts || currentTrackId !== lastTrackIdRef.current) {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        return;
      }

      try {
        const result = await window.api.karaoke.getCached(currentTrackId);
        if (result.success && result.result?.audioBase64 && !result.result.isPartial) {
          console.log('[Karaoke] Full track ready (via backup polling):', currentTrackId);

          const blobUrl = getOrCreateBlobUrl(
            currentTrackId,
            result.result.audioBase64,
            result.result.mimeType || 'audio/mpeg',
            false
          );

          setIsPartial(false);
          setCurrentInstrumentalUrl(blobUrl);
          onFullTrackReady?.(blobUrl);

          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      } catch (error) {
        console.error('[Karaoke] Backup polling error:', error);
      }
    }, 2000); // Reduced frequency - every 2 seconds instead of 1
  }, [setCurrentInstrumentalUrl, onFullTrackReady]);

  // Process track when karaoke is enabled
  const processTrack = useCallback(async () => {
    if (!trackId || !audioUrl || !isEnabled || !isAvailable) {
      return;
    }

    // Check if we already have the full track cached
    const cached = blobUrlCache.get(trackId);
    if (cached && !cached.isPartial) {
      setCurrentInstrumentalUrl(cached.url);
      setIsPartial(false);
      onInstrumentalReady?.(cached.url);
      return;
    }

    // Check if in main process cache
    if (processedTracks.has(trackId)) {
      try {
        const result = await window.api.karaoke.getCached(trackId);
        if (result.success && result.result?.audioBase64) {
          const blobUrl = getOrCreateBlobUrl(
            trackId,
            result.result.audioBase64,
            result.result.mimeType || 'audio/mpeg',
            result.result.isPartial ?? false
          );
          setCurrentInstrumentalUrl(blobUrl);
          setIsPartial(result.result.isPartial ?? false);
          onInstrumentalReady?.(blobUrl);

          // If partial, start polling for full track
          if (result.result.isPartial) {
            startPollingForFullTrack(trackId);
          }
          return; // Successfully got cached, exit
        } else {
          // processedTracks said we have it but cache returned nothing
          // This is stale state - clear and retry processing
          console.log('[Karaoke] Stale processedTracks entry, reprocessing:', trackId);
          // Don't return - fall through to reprocess
        }
      } catch (error) {
        console.error('[Karaoke] Failed to get cached, will reprocess:', error);
        // Don't return - fall through to reprocess
      }
    }

    // Avoid duplicate processing
    if (processingPromiseRef.current) {
      return;
    }

    setProcessing(true);
    setCurrentInstrumentalUrl(null);
    setIsPartial(false);

    processingPromiseRef.current = (async () => {
      try {
        console.log('[Karaoke] Processing track (streaming):', trackId);
        const result = await window.api.karaoke.processTrack(trackId, audioUrl);

        if (result.success && result.result?.audioBase64) {
          const isResultPartial = result.result.isPartial ?? false;

          // Convert base64 to blob URL
          const blobUrl = getOrCreateBlobUrl(
            trackId,
            result.result.audioBase64,
            result.result.mimeType || 'audio/mpeg',
            isResultPartial
          );

          addProcessedTrack(trackId);
          setCurrentInstrumentalUrl(blobUrl);
          setIsPartial(isResultPartial);
          onInstrumentalReady?.(blobUrl);

          console.log('[Karaoke] First segment ready:', trackId, 'partial:', isResultPartial);

          // If this is just the first segment, poll for full track
          if (isResultPartial) {
            startPollingForFullTrack(trackId);
          }
        } else {
          console.error('[Karaoke] Processing failed:', result.error);
        }
      } catch (error) {
        console.error('[Karaoke] Processing error:', error);
      } finally {
        setProcessing(false);
        processingPromiseRef.current = null;
      }
    })();

    await processingPromiseRef.current;
  }, [trackId, audioUrl, isEnabled, isAvailable, processedTracks, setProcessing, addProcessedTrack, setCurrentInstrumentalUrl, onInstrumentalReady, startPollingForFullTrack]);

  // Trigger processing when track changes or karaoke is enabled
  useEffect(() => {
    if (trackId !== lastTrackIdRef.current) {
      lastTrackIdRef.current = trackId;
      setCurrentInstrumentalUrl(null);
      setIsPartial(false);

      // Clear polling for old track
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      // IMPORTANT: Clear the processing promise ref to prevent stale state
      // This allows a new processing attempt for the new track
      processingPromiseRef.current = null;

      if (isEnabled && trackId && audioUrl) {
        processTrack();
      }
    } else if (isEnabled && trackId && audioUrl && !currentInstrumentalUrl && !isProcessing) {
      processTrack();
    }
  }, [trackId, isEnabled, audioUrl, processTrack, currentInstrumentalUrl, isProcessing, setCurrentInstrumentalUrl]);

  // Clear instrumental URL when karaoke is disabled
  useEffect(() => {
    if (!isEnabled) {
      setCurrentInstrumentalUrl(null);
      setIsPartial(false);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
  }, [isEnabled, setCurrentInstrumentalUrl]);

  return {
    isAvailable,
    isEnabled,
    isProcessing,
    isPartial, // True if currently playing partial segment
    instrumentalUrl: currentInstrumentalUrl,
    toggle: useKaraokeStore.getState().toggle
  };
}

export default useKaraoke;
