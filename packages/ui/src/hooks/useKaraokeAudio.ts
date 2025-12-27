/**
 * useKaraokeAudio - Real-time audio mixing for karaoke mode
 *
 * Uses Web Audio API to play both original and instrumental audio
 * simultaneously, allowing real-time control of vocal levels.
 *
 * This creates the "live" Apple Music Sing feel where the vocal
 * slider smoothly crossfades between original and instrumental.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useKaraokeStore } from '../stores/karaoke-store';

// Track which audio elements have already been connected to Web Audio
// Important: Once a MediaElementAudioSourceNode is created, it cannot be
// disconnected and reconnected - the audio element is permanently routed through Web Audio
const connectedElements = new WeakMap<HTMLAudioElement, {
  context: AudioContext;
  source: MediaElementAudioSourceNode;
  originalGain: GainNode;
}>();

interface UseKaraokeAudioOptions {
  originalAudio: HTMLAudioElement | null;
  instrumentalUrl: string | null;
  isEnabled: boolean;
}

interface AudioNodes {
  audio: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
}

export function useKaraokeAudio({
  originalAudio,
  instrumentalUrl,
  isEnabled
}: UseKaraokeAudioOptions) {
  const { vocalReduction } = useKaraokeStore();

  // Refs for instrumental audio management
  const instrumentalRef = useRef<AudioNodes | null>(null);
  const lastEnabledRef = useRef(false);

  // State for tracking instrumental status
  const [instrumentalReady, setInstrumentalReady] = useState(false);
  const [instrumentalError, setInstrumentalError] = useState(false);
  // Track if instrumental has ended (for partial segments) - NOW REACTIVE!
  const [instrumentalEnded, setInstrumentalEnded] = useState(false);
  // Track if instrumental is actually producing audio
  const [instrumentalPlaying, setInstrumentalPlaying] = useState(false);

  // Get or create Web Audio nodes for original audio
  const getOriginalNodes = useCallback(() => {
    if (!originalAudio) return null;

    let nodes = connectedElements.get(originalAudio);
    if (!nodes) {
      try {
        const context = new AudioContext();
        const source = context.createMediaElementSource(originalAudio);
        const originalGain = context.createGain();

        source.connect(originalGain);
        originalGain.connect(context.destination);
        originalGain.gain.value = 1;

        nodes = { context, source, originalGain };
        connectedElements.set(originalAudio, nodes);
        console.log('[KaraokeAudio] Original audio connected to Web Audio');
      } catch (e) {
        console.error('[KaraokeAudio] Failed to create audio source:', e);
        return null;
      }
    }

    // Resume context if suspended (browser autoplay policy)
    if (nodes.context.state === 'suspended') {
      nodes.context.resume();
    }

    return nodes;
  }, [originalAudio]);

  // Ensure AudioContext is running (call this before any gain changes)
  const ensureContextRunning = useCallback(() => {
    if (!originalAudio) return;
    const nodes = connectedElements.get(originalAudio);
    if (nodes?.context.state === 'suspended') {
      nodes.context.resume();
    }
  }, [originalAudio]);

  // Initialize Web Audio for original when enabled
  useEffect(() => {
    if (!originalAudio || !isEnabled) return;
    getOriginalNodes();
  }, [originalAudio, isEnabled, getOriginalNodes]);

  // Create and load instrumental audio
  useEffect(() => {
    if (!instrumentalUrl || !isEnabled || !originalAudio) {
      setInstrumentalReady(false);
      setInstrumentalError(false);
      setInstrumentalEnded(false);
      setInstrumentalPlaying(false);
      return;
    }

    const originalNodes = getOriginalNodes();
    if (!originalNodes) return;

    // Check if we already have instrumental nodes
    let instrumentalNodes = instrumentalRef.current;

    // Create instrumental audio element and Web Audio nodes if needed
    if (!instrumentalNodes) {
      console.log('[KaraokeAudio] Creating instrumental audio element');
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';

      // Add error handler
      audio.addEventListener('error', () => {
        console.error('[KaraokeAudio] Instrumental audio error:', audio.error?.message);
        setInstrumentalError(true);
        setInstrumentalReady(false);
        setInstrumentalPlaying(false);
      });

      // Handle when instrumental ends (important for partial segments!)
      // This is now REACTIVE - sets state that triggers re-render
      audio.addEventListener('ended', () => {
        console.log('[KaraokeAudio] Instrumental ended - setting ended state for reactive update');
        setInstrumentalEnded(true);
        setInstrumentalPlaying(false);
        // The gain effect will now re-run because instrumentalEnded changed
      });

      // Track play/pause state
      audio.addEventListener('play', () => {
        setInstrumentalPlaying(true);
        setInstrumentalEnded(false);
      });
      audio.addEventListener('pause', () => {
        setInstrumentalPlaying(false);
      });

      try {
        const source = originalNodes.context.createMediaElementSource(audio);
        const gain = originalNodes.context.createGain();
        source.connect(gain);
        gain.connect(originalNodes.context.destination);
        gain.gain.value = 0; // Start silent

        instrumentalNodes = { audio, source, gain };
        instrumentalRef.current = instrumentalNodes;
      } catch (e) {
        console.error('[KaraokeAudio] Failed to create instrumental source:', e);
        setInstrumentalError(true);
        return;
      }
    }

    // Load the instrumental URL if it changed
    if (instrumentalNodes.audio.src !== instrumentalUrl) {
      console.log('[KaraokeAudio] Loading instrumental:', instrumentalUrl.substring(0, 60));
      setInstrumentalReady(false);
      setInstrumentalError(false);

      const handleCanPlay = () => {
        console.log('[KaraokeAudio] Instrumental ready to play');
        setInstrumentalReady(true);
        setInstrumentalError(false);

        // If original is playing, start instrumental too
        if (originalAudio && !originalAudio.paused && instrumentalNodes) {
          instrumentalNodes.audio.currentTime = originalAudio.currentTime;
          instrumentalNodes.audio.play().catch(e => console.log('[KaraokeAudio] Autoplay blocked:', e));
        }
      };

      const handleError = () => {
        console.error('[KaraokeAudio] Instrumental failed to load');
        setInstrumentalError(true);
        setInstrumentalReady(false);
      };

      instrumentalNodes.audio.addEventListener('canplaythrough', handleCanPlay, { once: true });
      instrumentalNodes.audio.addEventListener('error', handleError, { once: true });
      instrumentalNodes.audio.src = instrumentalUrl;
      instrumentalNodes.audio.load();

      return () => {
        instrumentalNodes?.audio.removeEventListener('canplaythrough', handleCanPlay);
        instrumentalNodes?.audio.removeEventListener('error', handleError);
      };
    } else {
      // URL hasn't changed, mark as ready if not errored
      if (!instrumentalError) {
        setInstrumentalReady(true);
      }
    }
  }, [instrumentalUrl, isEnabled, originalAudio, getOriginalNodes, instrumentalError]);

  // Sync instrumental playback with original
  useEffect(() => {
    const instrumentalNodes = instrumentalRef.current;
    if (!isEnabled || !originalAudio || !instrumentalNodes || !instrumentalReady) return;

    const syncTime = () => {
      if (!instrumentalNodes.audio || instrumentalNodes.audio.paused) return;
      // Don't sync if instrumental has ended (duration reached)
      if (instrumentalNodes.audio.ended) return;

      const timeDiff = Math.abs(instrumentalNodes.audio.currentTime - originalAudio.currentTime);
      if (timeDiff > 0.15) { // 150ms tolerance
        // Only sync if within instrumental duration
        if (originalAudio.currentTime < instrumentalNodes.audio.duration) {
          instrumentalNodes.audio.currentTime = originalAudio.currentTime;
        }
      }
    };

    const handlePlay = async () => {
      if (!instrumentalNodes.audio || !instrumentalReady) return;
      // Only play if original position is within instrumental duration
      if (instrumentalNodes.audio.duration && originalAudio.currentTime >= instrumentalNodes.audio.duration) {
        console.log('[KaraokeAudio] Original past instrumental duration, not starting instrumental');
        return;
      }
      instrumentalNodes.audio.currentTime = originalAudio.currentTime;
      try {
        await instrumentalNodes.audio.play();
        console.log('[KaraokeAudio] Instrumental playback started');
      } catch (e) {
        console.log('[KaraokeAudio] Autoplay blocked:', e);
      }
    };

    const handlePause = () => {
      instrumentalNodes?.audio.pause();
    };

    const handleSeek = () => {
      if (instrumentalNodes?.audio) {
        // Only seek if within instrumental duration
        if (!instrumentalNodes.audio.duration || originalAudio.currentTime < instrumentalNodes.audio.duration) {
          instrumentalNodes.audio.currentTime = originalAudio.currentTime;
        }
      }
    };

    // Initial sync
    if (!originalAudio.paused && instrumentalReady) {
      handlePlay();
    }

    originalAudio.addEventListener('play', handlePlay);
    originalAudio.addEventListener('pause', handlePause);
    originalAudio.addEventListener('seeking', handleSeek);
    originalAudio.addEventListener('seeked', handleSeek);

    // Periodic sync to prevent drift
    const syncInterval = setInterval(syncTime, 500);

    return () => {
      originalAudio.removeEventListener('play', handlePlay);
      originalAudio.removeEventListener('pause', handlePause);
      originalAudio.removeEventListener('seeking', handleSeek);
      originalAudio.removeEventListener('seeked', handleSeek);
      clearInterval(syncInterval);
    };
  }, [isEnabled, originalAudio, instrumentalReady]);

  // Update gain levels based on vocal reduction slider
  // This is the critical effect that creates the crossfade
  useEffect(() => {
    if (!originalAudio) return;

    // Ensure context is running before adjusting gains
    ensureContextRunning();

    const originalNodes = connectedElements.get(originalAudio);
    const instrumentalNodes = instrumentalRef.current;

    if (!originalNodes) return;

    const now = originalNodes.context.currentTime;
    const rampTime = 0.05; // 50ms smooth transition

    // Check if instrumental is ACTUALLY usable (ready, no error, not ended, and playing)
    // instrumentalEnded and instrumentalPlaying are now reactive state variables
    const instrumentalUsable = instrumentalNodes &&
                               instrumentalReady &&
                               !instrumentalError &&
                               !instrumentalEnded;

    // Calculate the desired mix levels
    const angle = vocalReduction * Math.PI / 2;
    const desiredOriginalLevel = Math.cos(angle);
    const desiredInstrumentalLevel = Math.sin(angle);

    if (isEnabled && instrumentalUsable) {
      // Instrumental is ready and available

      // SAFETY CHECK: If we want to use instrumental but it's not actually producing audio,
      // don't set original to 0 - that would cause silence!
      const instrumentalActuallyProducingAudio = instrumentalPlaying &&
                                                  !instrumentalNodes.audio.paused &&
                                                  instrumentalNodes.audio.currentTime > 0;

      if (desiredInstrumentalLevel > 0.1 && !instrumentalActuallyProducingAudio) {
        // We want instrumental audio but it's not playing - keep original at safe level
        const safeOriginalLevel = Math.max(0.5, desiredOriginalLevel);
        console.log(`[KaraokeAudio] Instrumental not producing audio - keeping original at ${(safeOriginalLevel * 100).toFixed(0)}%`);
        originalNodes.originalGain.gain.setTargetAtTime(safeOriginalLevel, now, rampTime);

        // Try to start instrumental
        if (instrumentalNodes.audio.paused && !originalAudio.paused) {
          if (!instrumentalNodes.audio.duration || originalAudio.currentTime < instrumentalNodes.audio.duration) {
            instrumentalNodes.audio.currentTime = originalAudio.currentTime;
            instrumentalNodes.audio.play().catch(e => console.error('[KaraokeAudio] Play failed:', e));
          }
        }
      } else {
        // Instrumental is producing audio OR we don't need it (slider near 100% vocals)
        console.log(`[KaraokeAudio] Mix: vocals=${(desiredOriginalLevel * 100).toFixed(0)}%, instrumental=${(desiredInstrumentalLevel * 100).toFixed(0)}%`);

        originalNodes.originalGain.gain.setTargetAtTime(desiredOriginalLevel, now, rampTime);
        instrumentalNodes.gain.gain.setTargetAtTime(desiredInstrumentalLevel, now, rampTime);

        // Ensure instrumental is playing if we want to hear it
        if (desiredInstrumentalLevel > 0 && instrumentalNodes.audio.paused && !originalAudio.paused) {
          // Only play if within instrumental duration
          if (!instrumentalNodes.audio.duration || originalAudio.currentTime < instrumentalNodes.audio.duration) {
            instrumentalNodes.audio.currentTime = originalAudio.currentTime;
            instrumentalNodes.audio.play().catch(e => console.error('[KaraokeAudio] Play failed:', e));
          }
        }
      }
    } else {
      // Karaoke disabled, not ready, errored, or instrumental ended - use original audio
      // ALWAYS apply a minimum level to prevent silence if user was at low vocals
      const safeOriginalLevel = isEnabled ? Math.max(0.5, desiredOriginalLevel) : 1;

      if (isEnabled) {
        console.log(`[KaraokeAudio] Instrumental not usable (ready=${instrumentalReady}, error=${instrumentalError}, ended=${instrumentalEnded}) - using original at ${(safeOriginalLevel * 100).toFixed(0)}%`);
      }

      originalNodes.originalGain.gain.setTargetAtTime(safeOriginalLevel, now, rampTime);

      if (instrumentalNodes) {
        instrumentalNodes.gain.gain.setTargetAtTime(0, now, rampTime);
        // Pause instrumental after fade completes
        setTimeout(() => {
          if (instrumentalNodes?.audio && !instrumentalNodes.audio.paused) {
            instrumentalNodes.audio.pause();
          }
        }, 100);
      }
    }
  }, [vocalReduction, isEnabled, originalAudio, instrumentalReady, instrumentalError, instrumentalEnded, instrumentalPlaying, ensureContextRunning]);

  // Handle enable/disable transitions
  useEffect(() => {
    if (lastEnabledRef.current === isEnabled) return;
    lastEnabledRef.current = isEnabled;

    if (!originalAudio) return;

    ensureContextRunning();

    const originalNodes = connectedElements.get(originalAudio);
    const instrumentalNodes = instrumentalRef.current;

    if (!originalNodes) return;

    const now = originalNodes.context.currentTime;
    // Use reactive state for checking usability
    const instrumentalUsable = instrumentalNodes && instrumentalReady && !instrumentalError && !instrumentalEnded;

    if (isEnabled) {
      console.log('[KaraokeAudio] Karaoke enabled - applying current mix');

      if (instrumentalUsable) {
        // Re-apply current mix when enabling
        const angle = vocalReduction * Math.PI / 2;
        const originalLevel = Math.cos(angle);
        const instrumentalLevel = Math.sin(angle);

        // Safety: don't set original to 0 if instrumental isn't actually playing
        const safeOriginalLevel = instrumentalPlaying ? originalLevel : Math.max(0.5, originalLevel);

        originalNodes.originalGain.gain.setTargetAtTime(safeOriginalLevel, now, 0.1);
        instrumentalNodes.gain.gain.setTargetAtTime(instrumentalLevel, now, 0.1);

        // Start instrumental if original is playing
        if (!originalAudio.paused && instrumentalLevel > 0) {
          instrumentalNodes.audio.currentTime = originalAudio.currentTime;
          instrumentalNodes.audio.play().catch(e => console.log('[KaraokeAudio] Resume blocked:', e));
        }
      } else {
        // Instrumental not ready yet - keep original at safe level
        console.log('[KaraokeAudio] Karaoke enabled but instrumental not ready - keeping original audible');
        originalNodes.originalGain.gain.setTargetAtTime(1, now, 0.1);
      }
    } else {
      console.log('[KaraokeAudio] Karaoke disabled - restoring original audio');
      // Fade to full original
      originalNodes.originalGain.gain.setTargetAtTime(1, now, 0.1);

      if (instrumentalNodes) {
        instrumentalNodes.gain.gain.setTargetAtTime(0, now, 0.1);
        setTimeout(() => {
          instrumentalNodes?.audio.pause();
        }, 150);
      }
    }
  }, [isEnabled, originalAudio, vocalReduction, instrumentalReady, instrumentalError, instrumentalEnded, instrumentalPlaying, ensureContextRunning]);

  // Cleanup instrumental on unmount
  useEffect(() => {
    return () => {
      const instrumentalNodes = instrumentalRef.current;
      if (instrumentalNodes) {
        instrumentalNodes.audio.pause();
        instrumentalNodes.audio.src = '';
        instrumentalRef.current = null;
      }
      setInstrumentalReady(false);
      setInstrumentalError(false);
      setInstrumentalEnded(false);
      setInstrumentalPlaying(false);
    };
  }, []);

  // Reset ended state when instrumental URL changes (new track or full track ready)
  useEffect(() => {
    if (instrumentalUrl) {
      setInstrumentalEnded(false);
    }
  }, [instrumentalUrl]);

  return {
    isReady: instrumentalReady,
    hasError: instrumentalError,
    hasEnded: instrumentalEnded,
    isPlaying: instrumentalPlaying
  };
}

export default useKaraokeAudio;
