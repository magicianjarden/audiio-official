/**
 * useArtwork - Hook for resolving track artwork URLs
 *
 * Handles:
 * - Regular HTTP/HTTPS artwork URLs
 * - Embedded artwork from local files (embedded-art:// protocol)
 * - Caching of resolved embedded artwork
 */

import { useState, useEffect, useRef } from 'react';
import type { UnifiedTrack } from '@audiio/core';

// Cache for resolved embedded artwork to avoid repeated IPC calls
const embeddedArtworkCache = new Map<string, string | null>();

/**
 * Get the best available artwork URL for a track
 */
function getArtworkUrl(track: UnifiedTrack | null | undefined): string | undefined {
  if (!track) return undefined;

  // Try track artwork first, then album artwork
  // Ensure we return strings only (artwork could be an object in some cases)
  const artwork = track.artwork?.medium || track.artwork?.small || track.artwork?.large;
  if (typeof artwork === 'string') return artwork;

  const albumArt = track.album?.artwork?.medium || track.album?.artwork?.small || track.album?.artwork?.large;
  if (typeof albumArt === 'string') return albumArt;

  return undefined;
}

/**
 * Check if artwork URL is embedded (requires resolution via IPC)
 */
function isEmbeddedArtwork(url: string | undefined): boolean {
  return typeof url === 'string' && url.startsWith('embedded-art://');
}

/**
 * Resolve embedded artwork via IPC
 */
async function resolveEmbeddedArtwork(trackId: string): Promise<string | null> {
  // Check cache first
  if (embeddedArtworkCache.has(trackId)) {
    return embeddedArtworkCache.get(trackId) ?? null;
  }

  try {
    // Call the Electron API to get embedded artwork
    if (typeof window !== 'undefined' && (window as any).api?.getEmbeddedArtwork) {
      const dataUrl = await (window as any).api.getEmbeddedArtwork(trackId);
      embeddedArtworkCache.set(trackId, dataUrl);
      return dataUrl;
    }
    return null;
  } catch (error) {
    console.error('[useArtwork] Failed to resolve embedded artwork:', error);
    embeddedArtworkCache.set(trackId, null);
    return null;
  }
}

/**
 * Hook to get resolved artwork URL for a track
 * Automatically resolves embedded artwork if needed
 */
export function useArtwork(track: UnifiedTrack | null | undefined): {
  artworkUrl: string | undefined;
  isLoading: boolean;
} {
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const rawUrl = getArtworkUrl(track);

    // If it's a regular URL, use it directly
    if (!rawUrl || !isEmbeddedArtwork(rawUrl)) {
      setResolvedUrl(rawUrl);
      setIsLoading(false);
      return;
    }

    // For embedded artwork, we need to resolve it
    const trackId = track?.id;
    if (!trackId) {
      setResolvedUrl(undefined);
      return;
    }

    // Check cache first for immediate response
    if (embeddedArtworkCache.has(trackId)) {
      setResolvedUrl(embeddedArtworkCache.get(trackId) ?? undefined);
      setIsLoading(false);
      return;
    }

    // Resolve via IPC
    setIsLoading(true);
    resolveEmbeddedArtwork(trackId).then((dataUrl) => {
      if (mountedRef.current) {
        setResolvedUrl(dataUrl ?? undefined);
        setIsLoading(false);
      }
    });
  }, [track?.id, track?.artwork?.medium, track?.album?.artwork?.medium]);

  return { artworkUrl: resolvedUrl, isLoading };
}

/**
 * Batch resolve embedded artwork for multiple tracks
 * Useful for playlist views
 */
export async function batchResolveArtwork(tracks: UnifiedTrack[]): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();
  const toResolve: string[] = [];

  // Check cache and collect tracks that need resolution
  for (const track of tracks) {
    const url = getArtworkUrl(track);
    if (url && isEmbeddedArtwork(url)) {
      if (embeddedArtworkCache.has(track.id)) {
        results.set(track.id, embeddedArtworkCache.get(track.id) ?? null);
      } else {
        toResolve.push(track.id);
      }
    }
  }

  // Resolve in parallel (with concurrency limit)
  const concurrency = 5;
  for (let i = 0; i < toResolve.length; i += concurrency) {
    const batch = toResolve.slice(i, i + concurrency);
    const resolved = await Promise.all(batch.map(id => resolveEmbeddedArtwork(id)));
    batch.forEach((id, idx) => {
      results.set(id, resolved[idx] ?? null);
    });
  }

  return results;
}

/**
 * Clear the artwork cache (e.g., when tracks are re-scanned)
 */
export function clearArtworkCache(): void {
  embeddedArtworkCache.clear();
}

export default useArtwork;
