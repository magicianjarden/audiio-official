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

  const instrumentalRef = useRef<AudioNodes | null>(null);
  const lastEnabledRef = useRef(false);

  const [instrumentalReady, setInstrumentalReady] = useState(false);
  const [instrumentalError, setInstrumentalError] = useState(false);
  const [instrumentalEnded, setInstrumentalEnded] = useState(false);
  const [instrumentalPlaying, setInstrumentalPlaying] = useState(false);

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
      } catch {
        return null;
      }
    }

    if (nodes.context.state === 'suspended') {
      nodes.context.resume();
    }

    return nodes;
  }, [originalAudio]);

  const ensureContextRunning = useCallback(() => {
    if (!originalAudio) return;
    const nodes = connectedElements.get(originalAudio);
    if (nodes?.context.state === 'suspended') {
      nodes.context.resume();
    }
  }, [originalAudio]);

  useEffect(() => {
    if (!originalAudio || !isEnabled) return;
    getOriginalNodes();
  }, [originalAudio, isEnabled, getOriginalNodes]);

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

    let instrumentalNodes = instrumentalRef.current;

    if (!instrumentalNodes) {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';

      audio.addEventListener('error', () => {
        setInstrumentalError(true);
        setInstrumentalReady(false);
        setInstrumentalPlaying(false);
      });

      audio.addEventListener('ended', () => {
        const isStreamingChunk = audio.src.includes('_stream') || audio.src.includes('chunk=');
        if (isStreamingChunk && originalAudio && !originalAudio.paused) {
          setInstrumentalPlaying(false);
        } else {
          setInstrumentalEnded(true);
          setInstrumentalPlaying(false);
        }
      });

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
        gain.gain.value = 0;

        instrumentalNodes = { audio, source, gain };
        instrumentalRef.current = instrumentalNodes;
      } catch {
        setInstrumentalError(true);
        return;
      }
    }

    const currentSrc = instrumentalNodes.audio.src;
    let urlsMatch = currentSrc === instrumentalUrl;

    if (!urlsMatch && currentSrc && instrumentalUrl) {
      try {
        const currentBase = currentSrc.split('?')[0];
        const newBase = instrumentalUrl.split('?')[0];

        if (currentBase === newBase) {
          const currentParams = new URLSearchParams(currentSrc.split('?')[1] || '');
          const newParams = new URLSearchParams(instrumentalUrl.split('?')[1] || '');
          const currentChunk = currentParams.get('chunk');
          const newChunk = newParams.get('chunk');

          if (currentChunk !== newChunk) {
            urlsMatch = false;
          } else {
            urlsMatch = true;
          }
        }
      } catch {
        urlsMatch = currentSrc.includes(instrumentalUrl) || instrumentalUrl.includes(currentSrc);
      }
    }

    if (!urlsMatch) {
      setInstrumentalReady(false);
      setInstrumentalError(false);
      setInstrumentalEnded(false);

      let loadAttempts = 0;
      const maxLoadAttempts = 3;

      const attemptLoad = () => {
        loadAttempts++;

        const handleCanPlay = () => {
          setInstrumentalReady(true);
          setInstrumentalError(false);

          if (originalAudio && !originalAudio.paused && instrumentalNodes) {
            instrumentalNodes.audio.currentTime = originalAudio.currentTime;
            instrumentalNodes.audio.play().catch(() => {});
          }
        };

        const handleError = (e: Event) => {
          const audio = e.target as HTMLAudioElement;
          const errorCode = audio.error?.code;

          if (loadAttempts < maxLoadAttempts && (errorCode === 2 || errorCode === 4)) {
            setTimeout(() => {
              if (instrumentalNodes?.audio && instrumentalUrl) {
                instrumentalNodes.audio.removeEventListener('canplaythrough', handleCanPlay);
                instrumentalNodes.audio.removeEventListener('error', handleError);
                attemptLoad();
              }
            }, 1000);
          } else {
            setInstrumentalError(true);
            setInstrumentalReady(false);
          }
        };

        if (instrumentalNodes) {
          instrumentalNodes.audio.addEventListener('canplaythrough', handleCanPlay, { once: true });
          instrumentalNodes.audio.addEventListener('error', handleError, { once: true });
          instrumentalNodes.audio.src = instrumentalUrl;
          instrumentalNodes.audio.load();
        }
      };

      attemptLoad();

      return () => {
        if (instrumentalNodes?.audio) {
          instrumentalNodes.audio.src = '';
        }
      };
    } else {
      if (!instrumentalError) {
        setInstrumentalReady(true);
      }
    }
  }, [instrumentalUrl, isEnabled, originalAudio, getOriginalNodes, instrumentalError]);

  useEffect(() => {
    const instrumentalNodes = instrumentalRef.current;
    if (!isEnabled || !originalAudio || !instrumentalNodes || !instrumentalReady) return;

    const syncTime = () => {
      if (!instrumentalNodes.audio || instrumentalNodes.audio.paused) return;
      if (instrumentalNodes.audio.ended) return;

      const timeDiff = Math.abs(instrumentalNodes.audio.currentTime - originalAudio.currentTime);
      if (timeDiff > 0.15) {
        if (originalAudio.currentTime < instrumentalNodes.audio.duration) {
          instrumentalNodes.audio.currentTime = originalAudio.currentTime;
        }
      }
    };

    const handlePlay = async () => {
      if (!instrumentalNodes.audio || !instrumentalReady) return;
      if (instrumentalNodes.audio.duration && originalAudio.currentTime >= instrumentalNodes.audio.duration) {
        return;
      }
      instrumentalNodes.audio.currentTime = originalAudio.currentTime;
      try {
        await instrumentalNodes.audio.play();
      } catch {
        // Autoplay blocked
      }
    };

    const handlePause = () => {
      instrumentalNodes?.audio.pause();
    };

    const handleSeek = () => {
      if (instrumentalNodes?.audio) {
        if (!instrumentalNodes.audio.duration || originalAudio.currentTime < instrumentalNodes.audio.duration) {
          instrumentalNodes.audio.currentTime = originalAudio.currentTime;
        }
      }
    };

    if (!originalAudio.paused && instrumentalReady) {
      handlePlay();
    }

    originalAudio.addEventListener('play', handlePlay);
    originalAudio.addEventListener('pause', handlePause);
    originalAudio.addEventListener('seeking', handleSeek);
    originalAudio.addEventListener('seeked', handleSeek);

    const syncInterval = setInterval(syncTime, 500);

    return () => {
      originalAudio.removeEventListener('play', handlePlay);
      originalAudio.removeEventListener('pause', handlePause);
      originalAudio.removeEventListener('seeking', handleSeek);
      originalAudio.removeEventListener('seeked', handleSeek);
      clearInterval(syncInterval);
    };
  }, [isEnabled, originalAudio, instrumentalReady]);

  useEffect(() => {
    if (!originalAudio) return;

    ensureContextRunning();

    const originalNodes = connectedElements.get(originalAudio);
    const instrumentalNodes = instrumentalRef.current;

    if (!originalNodes) return;

    const now = originalNodes.context.currentTime;
    const rampTime = 0.05;

    const instrumentalUsable = instrumentalNodes &&
                               instrumentalReady &&
                               !instrumentalError &&
                               !instrumentalEnded;

    const reduction = vocalReduction;
    const easedReduction = reduction < 0.5
      ? 2 * reduction * reduction
      : 1 - Math.pow(-2 * reduction + 2, 2) / 2;

    const INSTRUMENTAL_NORMALIZATION = 0.75;
    const compensationBoost = 1 + 0.4 * Math.sin(reduction * Math.PI);

    let desiredOriginalLevel = (1 - easedReduction) * compensationBoost;
    let desiredInstrumentalLevel = easedReduction * compensationBoost * INSTRUMENTAL_NORMALIZATION;

    const maxLevel = Math.max(desiredOriginalLevel, desiredInstrumentalLevel);
    if (maxLevel > 1.0) {
      desiredOriginalLevel /= maxLevel;
      desiredInstrumentalLevel /= maxLevel;
    }

    if (isEnabled && instrumentalUsable) {
      const instrumentalActuallyProducingAudio = instrumentalPlaying &&
                                                  !instrumentalNodes.audio.paused &&
                                                  instrumentalNodes.audio.currentTime > 0;

      if (desiredInstrumentalLevel > 0.1 && !instrumentalActuallyProducingAudio) {
        originalNodes.originalGain.gain.setTargetAtTime(1, now, rampTime);

        if (instrumentalNodes.audio.paused && !originalAudio.paused) {
          if (!instrumentalNodes.audio.duration || originalAudio.currentTime < instrumentalNodes.audio.duration) {
            instrumentalNodes.audio.currentTime = originalAudio.currentTime;
            instrumentalNodes.audio.play().catch(() => {});
          }
        }
      } else {
        originalNodes.originalGain.gain.setTargetAtTime(desiredOriginalLevel, now, rampTime);
        instrumentalNodes.gain.gain.setTargetAtTime(desiredInstrumentalLevel, now, rampTime);

        if (desiredInstrumentalLevel > 0 && instrumentalNodes.audio.paused && !originalAudio.paused) {
          if (!instrumentalNodes.audio.duration || originalAudio.currentTime < instrumentalNodes.audio.duration) {
            instrumentalNodes.audio.currentTime = originalAudio.currentTime;
            instrumentalNodes.audio.play().catch(() => {});
          }
        }
      }
    } else {
      originalNodes.originalGain.gain.setTargetAtTime(1, now, rampTime);

      if (instrumentalNodes) {
        instrumentalNodes.gain.gain.setTargetAtTime(0, now, rampTime);
        setTimeout(() => {
          if (instrumentalNodes?.audio && !instrumentalNodes.audio.paused) {
            instrumentalNodes.audio.pause();
          }
        }, 100);
      }
    }
  }, [vocalReduction, isEnabled, originalAudio, instrumentalReady, instrumentalError, instrumentalEnded, instrumentalPlaying, ensureContextRunning]);

  useEffect(() => {
    if (lastEnabledRef.current === isEnabled) return;
    lastEnabledRef.current = isEnabled;

    if (!originalAudio) return;

    ensureContextRunning();

    const originalNodes = connectedElements.get(originalAudio);
    const instrumentalNodes = instrumentalRef.current;

    if (!originalNodes) return;

    const now = originalNodes.context.currentTime;
    const instrumentalUsable = instrumentalNodes && instrumentalReady && !instrumentalError && !instrumentalEnded;

    if (isEnabled) {
      if (instrumentalUsable) {
        const reduction = vocalReduction;
        const easedReduction = reduction < 0.5
          ? 2 * reduction * reduction
          : 1 - Math.pow(-2 * reduction + 2, 2) / 2;
        const compensationBoost = 1 + 0.4 * Math.sin(reduction * Math.PI);
        const INSTRUMENTAL_NORMALIZATION = 0.75;

        let originalLevel = (1 - easedReduction) * compensationBoost;
        let instrumentalLevel = easedReduction * compensationBoost * INSTRUMENTAL_NORMALIZATION;

        const maxLevel = Math.max(originalLevel, instrumentalLevel);
        if (maxLevel > 1.0) {
          originalLevel /= maxLevel;
          instrumentalLevel /= maxLevel;
        }

        const safeOriginalLevel = instrumentalPlaying ? originalLevel : 1;

        originalNodes.originalGain.gain.setTargetAtTime(safeOriginalLevel, now, 0.1);
        instrumentalNodes.gain.gain.setTargetAtTime(instrumentalLevel, now, 0.1);

        if (!originalAudio.paused && instrumentalLevel > 0) {
          instrumentalNodes.audio.currentTime = originalAudio.currentTime;
          instrumentalNodes.audio.play().catch(() => {});
        }
      } else {
        originalNodes.originalGain.gain.setTargetAtTime(1, now, 0.1);
      }
    } else {
      originalNodes.originalGain.gain.setTargetAtTime(1, now, 0.1);

      if (instrumentalNodes) {
        instrumentalNodes.gain.gain.setTargetAtTime(0, now, 0.1);
        setTimeout(() => {
          instrumentalNodes?.audio.pause();
        }, 150);
      }
    }
  }, [isEnabled, originalAudio, vocalReduction, instrumentalReady, instrumentalError, instrumentalEnded, instrumentalPlaying, ensureContextRunning]);

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
