/**
 * useKaraoke v3 - Premium Streaming Karaoke Hook
 *
 * Features:
 * - INSTANT PLAYBACK: First chunk ready in ~3-4 seconds, playback starts immediately
 * - SEAMLESS UPGRADE: Automatically swaps to full track when ready
 * - PROGRESS WITH ETA: Real-time progress updates with time remaining
 * - PREDICTIVE PREFETCH: Queue upcoming tracks for background processing
 * - HTTP STREAMING: Direct URLs, no base64 overhead
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useKaraokeStore } from '../stores/karaoke-store';

interface UseKaraokeOptions {
  trackId: string | null;
  audioUrl: string | null;
  onInstrumentalReady?: (url: string) => void;
  onFullTrackReady?: (url: string) => void;
  onProgress?: (progress: number, stage: string, eta?: number) => void;
  // Queue of upcoming tracks for predictive processing
  upcomingTracks?: Array<{ id: string; url: string }>;
}

// Simple URL cache - HTTP URLs don't need blob conversion
const urlCache = new Map<string, { url: string; isComplete: boolean }>();

export function useKaraoke({
  trackId,
  audioUrl,
  onInstrumentalReady,
  onFullTrackReady,
  onProgress,
  upcomingTracks
}: UseKaraokeOptions) {
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
  const [isPartial, setIsPartial] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [eta, setEta] = useState<number | undefined>(undefined);
  const failedTracksRef = useRef<Map<string, number>>(new Map());

  // Store callbacks in refs
  const onFullTrackReadyRef = useRef(onFullTrackReady);
  onFullTrackReadyRef.current = onFullTrackReady;
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const onInstrumentalReadyRef = useRef(onInstrumentalReady);
  onInstrumentalReadyRef.current = onInstrumentalReady;

  // Check availability and subscribe to events
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

    // Subscribe to FIRST CHUNK ready (instant playback!)
    let unsubscribeFirstChunk: (() => void) | undefined;
    if (typeof window.api?.karaoke?.onFirstChunkReady === 'function') {
      unsubscribeFirstChunk = window.api.karaoke.onFirstChunkReady(({ trackId: readyTrackId, url }) => {
        if (readyTrackId === lastTrackIdRef.current && url) {
          // Verify the URL is accessible before setting it
          fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3000) })
            .then(response => {
              if (response.ok) {
                urlCache.set(readyTrackId, { url, isComplete: false });
                setIsPartial(true);
                setCurrentInstrumentalUrl(url);
                onInstrumentalReadyRef.current?.(url);
              }
            })
            .catch(() => {
              // Still try to set it - the audio element may succeed where HEAD failed
              urlCache.set(readyTrackId, { url, isComplete: false });
              setIsPartial(true);
              setCurrentInstrumentalUrl(url);
              onInstrumentalReadyRef.current?.(url);
            });
        }
      });
    }

    // Subscribe to full track ready
    let unsubscribeFullTrack: (() => void) | undefined;
    if (typeof window.api?.karaoke?.onFullTrackReady === 'function') {
      unsubscribeFullTrack = window.api.karaoke.onFullTrackReady(({ trackId: readyTrackId, result }) => {
        if (readyTrackId === lastTrackIdRef.current && result?.instrumentalUrl) {
          urlCache.set(readyTrackId, { url: result.instrumentalUrl, isComplete: true });
          setIsPartial(false);
          setProgress(100);
          setStage('Complete');
          setEta(undefined);
          setCurrentInstrumentalUrl(result.instrumentalUrl);
          onFullTrackReadyRef.current?.(result.instrumentalUrl);
        }
      });
    }

    // Subscribe to progress updates with ETA
    let unsubscribeProgress: (() => void) | undefined;
    if (typeof window.api?.karaoke?.onProgress === 'function') {
      unsubscribeProgress = window.api.karaoke.onProgress(({ trackId: progressTrackId, progress: p, stage: s, eta: e }) => {
        if (progressTrackId === lastTrackIdRef.current) {
          setProgress(p);
          setStage(s);
          setEta(e);
          onProgressRef.current?.(p, s, e);
        }
      });
    }

    // Subscribe to CHUNK UPDATED (progressive streaming - audio grew longer)
    let unsubscribeChunkUpdated: (() => void) | undefined;
    if (typeof window.api?.karaoke?.onChunkUpdated === 'function') {
      unsubscribeChunkUpdated = window.api.karaoke.onChunkUpdated(({ trackId: chunkTrackId, url, chunkNumber }) => {
        if (chunkTrackId === lastTrackIdRef.current && url) {
          // Add cache-buster to force reload of longer audio file
          const cacheBustedUrl = `${url}?chunk=${chunkNumber}&t=${Date.now()}`;
          urlCache.set(chunkTrackId, { url: cacheBustedUrl, isComplete: false });
          setCurrentInstrumentalUrl(cacheBustedUrl);
          onInstrumentalReadyRef.current?.(cacheBustedUrl);
        }
      });
    }

    return () => {
      unsubscribeAvailability();
      unsubscribeFirstChunk?.();
      unsubscribeFullTrack?.();
      unsubscribeProgress?.();
      unsubscribeChunkUpdated?.();
    };
  }, [setAvailable, setCurrentInstrumentalUrl]);

  // Process track
  const processTrack = useCallback(async () => {
    if (!trackId || !audioUrl || !isEnabled || !isAvailable) {
      return;
    }

    // Check failure cooldown
    const lastFailure = failedTracksRef.current.get(trackId);
    if (lastFailure && Date.now() - lastFailure < 30000) {
      return;
    }

    // Check cache - if complete, use immediately
    const cached = urlCache.get(trackId);
    if (cached?.isComplete) {
      setCurrentInstrumentalUrl(cached.url);
      setIsPartial(false);
      setProgress(100);
      setStage('Complete');
      setEta(undefined);
      onInstrumentalReady?.(cached.url);
      return;
    }

    // Check main process cache
    if (processedTracks.has(trackId)) {
      try {
        const result = await window.api.karaoke.getCached(trackId);
        if (result.success && result.result?.instrumentalUrl) {
          const isComplete = !result.result.isPartial;
          const isFirstChunk = result.result.isFirstChunk;

          // If it's just the first chunk placeholder, don't load yet
          if (isFirstChunk && !isComplete) {
            return;
          }

          urlCache.set(trackId, { url: result.result.instrumentalUrl, isComplete });
          setCurrentInstrumentalUrl(result.result.instrumentalUrl);
          setIsPartial(!isComplete);
          if (isComplete) {
            setProgress(100);
            setStage('Complete');
          }
          onInstrumentalReady?.(result.result.instrumentalUrl);
          return;
        }
      } catch {
        // Ignore cache errors
      }
    }

    // Avoid duplicate processing
    if (processingPromiseRef.current) {
      return;
    }

    setProcessing(true);
    setCurrentInstrumentalUrl(null);
    setIsPartial(false);
    setProgress(0);
    setStage('Starting...');
    setEta(undefined);

    processingPromiseRef.current = (async () => {
      try {
        const result = await window.api.karaoke.processTrack(trackId, audioUrl);

        if (result.success && result.result) {
          addProcessedTrack(trackId);

          if (result.result.instrumentalUrl) {
            const isComplete = !result.result.isPartial;
            const isFirstChunk = result.result.isFirstChunk;

            if (isComplete) {
              urlCache.set(trackId, { url: result.result.instrumentalUrl, isComplete: true });
              setCurrentInstrumentalUrl(result.result.instrumentalUrl);
              setIsPartial(false);
              setProgress(100);
              setStage('Complete');
              onInstrumentalReady?.(result.result.instrumentalUrl);
            } else if (isFirstChunk) {
              setIsPartial(true);
              setProgress(10);
              setStage('Processing...');
              if (result.result.eta) {
                setEta(result.result.eta);
              }
            } else {
              urlCache.set(trackId, { url: result.result.instrumentalUrl, isComplete: false });
              setCurrentInstrumentalUrl(result.result.instrumentalUrl);
              setIsPartial(true);
              setProgress(10);
              setStage('Processing...');
              if (result.result.eta) {
                setEta(result.result.eta);
              }
              onInstrumentalReady?.(result.result.instrumentalUrl);
            }
          }
        } else {
          failedTracksRef.current.set(trackId, Date.now());
        }
      } catch {
        failedTracksRef.current.set(trackId, Date.now());
      } finally {
        setProcessing(false);
        processingPromiseRef.current = null;
      }
    })();

    await processingPromiseRef.current;
  }, [trackId, audioUrl, isEnabled, isAvailable, processedTracks, setProcessing, addProcessedTrack, setCurrentInstrumentalUrl, onInstrumentalReady]);

  // Trigger processing on track change
  useEffect(() => {
    if (trackId !== lastTrackIdRef.current) {
      if (lastTrackIdRef.current) {
        failedTracksRef.current.delete(lastTrackIdRef.current);
      }

      lastTrackIdRef.current = trackId;
      setCurrentInstrumentalUrl(null);
      setIsPartial(false);
      setProgress(0);
      setStage('');
      setEta(undefined);
      processingPromiseRef.current = null;

      if (isEnabled && trackId && audioUrl) {
        processTrack();
      }
    } else if (isEnabled && trackId && audioUrl && !currentInstrumentalUrl && !isProcessing) {
      processTrack();
    }
  }, [trackId, isEnabled, audioUrl, processTrack, currentInstrumentalUrl, isProcessing, setCurrentInstrumentalUrl]);

  // Predictive prefetch for upcoming tracks
  useEffect(() => {
    if (!isEnabled || !isAvailable || !upcomingTracks?.length) {
      return;
    }

    const tracksToPredict = upcomingTracks.filter(t =>
      !urlCache.has(t.id) && !processedTracks.has(t.id)
    ).slice(0, 3);

    if (tracksToPredict.length > 0 && typeof window.api?.karaoke?.predictivePrefetch === 'function') {
      window.api.karaoke.predictivePrefetch(tracksToPredict).catch(() => {});
    }
  }, [isEnabled, isAvailable, upcomingTracks, processedTracks]);

  // Clear state when disabled
  useEffect(() => {
    if (!isEnabled) {
      setCurrentInstrumentalUrl(null);
      setIsPartial(false);
      setProgress(0);
      setStage('');
      setEta(undefined);
    }
  }, [isEnabled, setCurrentInstrumentalUrl]);

  return {
    isAvailable,
    isEnabled,
    isProcessing,
    isPartial,
    progress,
    stage,
    eta,
    instrumentalUrl: currentInstrumentalUrl,
    toggle: useKaraokeStore.getState().toggle
  };
}

export default useKaraoke;
