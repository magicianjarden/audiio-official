/**
 * useAlbumEnrichment - Hook for fetching album-specific enrichment data
 *
 * Currently supports fetching videos that match the album title and track names.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { MusicVideo } from '@audiio/core';

// Extend the global Window type to include album videos API
declare global {
  interface Window {
    api: {
      enrichment: {
        getAlbumVideos?: (
          albumTitle: string,
          artistName: string,
          trackNames?: string[],
          limit?: number
        ) => Promise<{
          success: boolean;
          data: MusicVideo[];
          source?: string;
          error?: string;
        }>;
      };
    };
  }
}

export interface AlbumEnrichmentData {
  videos: MusicVideo[];
}

export interface AlbumEnrichmentState {
  data: AlbumEnrichmentData;
  loading: {
    videos: boolean;
  };
  errors: {
    videos: string | null;
  };
}

export interface UseAlbumEnrichmentOptions {
  enabled?: boolean;
  trackNames?: string[];
  limit?: number;
}

const initialData: AlbumEnrichmentData = {
  videos: [],
};

const initialLoading = {
  videos: false,
};

const initialErrors = {
  videos: null as string | null,
};

export function useAlbumEnrichment(
  albumTitle: string | undefined,
  artistName: string | undefined,
  options: UseAlbumEnrichmentOptions = {}
): AlbumEnrichmentState {
  const { enabled = true, trackNames, limit = 8 } = options;

  const [data, setData] = useState<AlbumEnrichmentData>(initialData);
  const [loading, setLoading] = useState(initialLoading);
  const [errors, setErrors] = useState(initialErrors);

  // Refs to track component mount state and prevent race conditions
  const mountedRef = useRef(true);
  const fetchIdRef = useRef(0);

  const fetchVideos = useCallback(async () => {
    if (!albumTitle || !artistName || !window.api?.enrichment?.getAlbumVideos) {
      return;
    }

    const fetchId = ++fetchIdRef.current;

    setLoading(prev => ({ ...prev, videos: true }));
    setErrors(prev => ({ ...prev, videos: null }));

    try {
      const result = await window.api.enrichment.getAlbumVideos(
        albumTitle,
        artistName,
        trackNames,
        limit
      );

      // Check if this is still the current request and component is mounted
      if (fetchId !== fetchIdRef.current || !mountedRef.current) {
        return;
      }

      if (result.success && result.data) {
        setData(prev => ({ ...prev, videos: result.data }));
      } else if (result.error) {
        setErrors(prev => ({ ...prev, videos: result.error || null }));
      }
    } catch (error) {
      if (fetchId === fetchIdRef.current && mountedRef.current) {
        setErrors(prev => ({
          ...prev,
          videos: error instanceof Error ? error.message : 'Failed to fetch videos',
        }));
      }
    } finally {
      if (fetchId === fetchIdRef.current && mountedRef.current) {
        setLoading(prev => ({ ...prev, videos: false }));
      }
    }
  }, [albumTitle, artistName, trackNames, limit]);

  // Fetch videos when album/artist changes
  useEffect(() => {
    mountedRef.current = true;

    if (enabled && albumTitle && artistName) {
      // Reset state for new album
      setData(initialData);
      setLoading(initialLoading);
      setErrors(initialErrors);

      // Fetch videos
      fetchVideos();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [enabled, albumTitle, artistName, fetchVideos]);

  return { data, loading, errors };
}

export default useAlbumEnrichment;
