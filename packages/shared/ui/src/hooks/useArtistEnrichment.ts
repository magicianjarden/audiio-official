/**
 * useArtistEnrichment - Hook for fetching artist enrichment data from plugins
 *
 * This hook fetches supplementary artist data (videos, concerts, setlists, etc.)
 * from installed enrichment plugins. Data is fetched lazily after initial render
 * and only if the corresponding plugin is available.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  MusicVideo,
  TimelineEntry,
  Setlist,
  Concert,
  ArtistImages,
  ArtistEnrichmentType,
} from '@audiio/core';

declare global {
  interface Window {
    api: {
      enrichment: {
        getAvailableTypes: () => Promise<ArtistEnrichmentType[]>;
        getVideos: (artistName: string, limit?: number) => Promise<{
          success: boolean;
          data: MusicVideo[];
          source?: string;
          error?: string;
        }>;
        getTimeline: (artistName: string) => Promise<{
          success: boolean;
          data: TimelineEntry[];
          source?: string;
          error?: string;
        }>;
        getSetlists: (artistName: string, mbid?: string, limit?: number) => Promise<{
          success: boolean;
          data: Setlist[];
          source?: string;
          error?: string;
        }>;
        getConcerts: (artistName: string) => Promise<{
          success: boolean;
          data: Concert[];
          source?: string;
          error?: string;
        }>;
        getGallery: (mbid?: string, artistName?: string) => Promise<{
          success: boolean;
          data: ArtistImages | null;
          source?: string;
          error?: string;
        }>;
        getMerchandise: (artistName: string) => Promise<{
          success: boolean;
          data: string | null;
          source?: string;
          error?: string;
        }>;
      };
    };
  }
}

export interface ArtistEnrichmentData {
  videos: MusicVideo[];
  timeline: TimelineEntry[];
  setlists: Setlist[];
  concerts: Concert[];
  gallery: ArtistImages | null;
  merchandiseUrl: string | null;
}

export interface ArtistEnrichmentState {
  data: ArtistEnrichmentData;
  loading: {
    videos: boolean;
    timeline: boolean;
    setlists: boolean;
    concerts: boolean;
    gallery: boolean;
    merchandise: boolean;
  };
  errors: {
    videos: string | null;
    timeline: string | null;
    setlists: string | null;
    concerts: string | null;
    gallery: string | null;
    merchandise: string | null;
  };
  availableTypes: ArtistEnrichmentType[];
}

export interface UseArtistEnrichmentOptions {
  enabled?: boolean;
  mbid?: string;
}

const initialData: ArtistEnrichmentData = {
  videos: [],
  timeline: [],
  setlists: [],
  concerts: [],
  gallery: null,
  merchandiseUrl: null,
};

const initialLoading = {
  videos: false,
  timeline: false,
  setlists: false,
  concerts: false,
  gallery: false,
  merchandise: false,
};

const initialErrors = {
  videos: null,
  timeline: null,
  setlists: null,
  concerts: null,
  gallery: null,
  merchandise: null,
};

export function useArtistEnrichment(
  artistName: string | null | undefined,
  options: UseArtistEnrichmentOptions = {}
): ArtistEnrichmentState & { refetch: () => void } {
  const { enabled = true, mbid } = options;

  const [data, setData] = useState<ArtistEnrichmentData>(initialData);
  const [loading, setLoading] = useState(initialLoading);
  const [errors, setErrors] = useState<typeof initialErrors>(initialErrors);
  const [availableTypes, setAvailableTypes] = useState<ArtistEnrichmentType[]>([]);

  const mountedRef = useRef(true);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchEnrichmentData = useCallback(async () => {
    if (!enabled || !artistName) {
      setData(initialData);
      setLoading(initialLoading);
      return;
    }

    if (!window.api?.enrichment) {
      console.warn('[useArtistEnrichment] window.api.enrichment not available');
      setData(initialData);
      setLoading(initialLoading);
      return;
    }

    const fetchId = ++fetchIdRef.current;

    try {
      // First, check what enrichment types are available
      console.log('[useArtistEnrichment] Fetching available types for artist:', artistName);
      const types = await window.api.enrichment.getAvailableTypes();
      console.log('[useArtistEnrichment] Available types:', types, 'for artist:', artistName);

      if (!mountedRef.current || fetchId !== fetchIdRef.current) return;

      setAvailableTypes(types);

      // Fetch each type in parallel if available
      const fetchPromises: Promise<void>[] = [];

      // Videos
      if (types.includes('videos')) {
        setLoading(prev => ({ ...prev, videos: true }));
        fetchPromises.push(
          window.api.enrichment.getVideos(artistName, 8).then(result => {
            if (!mountedRef.current || fetchId !== fetchIdRef.current) return;
            if (result.success) {
              setData(prev => ({ ...prev, videos: result.data }));
              setErrors(prev => ({ ...prev, videos: null }));
            } else {
              setErrors(prev => ({ ...prev, videos: result.error || 'Failed to fetch videos' }));
            }
            setLoading(prev => ({ ...prev, videos: false }));
          }).catch(err => {
            if (mountedRef.current && fetchId === fetchIdRef.current) {
              setErrors(prev => ({ ...prev, videos: String(err) }));
              setLoading(prev => ({ ...prev, videos: false }));
            }
          })
        );
      }

      // Timeline
      if (types.includes('timeline')) {
        setLoading(prev => ({ ...prev, timeline: true }));
        fetchPromises.push(
          window.api.enrichment.getTimeline(artistName).then(result => {
            if (!mountedRef.current || fetchId !== fetchIdRef.current) return;
            if (result.success) {
              setData(prev => ({ ...prev, timeline: result.data }));
              setErrors(prev => ({ ...prev, timeline: null }));
            } else {
              setErrors(prev => ({ ...prev, timeline: result.error || 'Failed to fetch timeline' }));
            }
            setLoading(prev => ({ ...prev, timeline: false }));
          }).catch(err => {
            if (mountedRef.current && fetchId === fetchIdRef.current) {
              setErrors(prev => ({ ...prev, timeline: String(err) }));
              setLoading(prev => ({ ...prev, timeline: false }));
            }
          })
        );
      }

      // Setlists
      if (types.includes('setlists')) {
        setLoading(prev => ({ ...prev, setlists: true }));
        fetchPromises.push(
          window.api.enrichment.getSetlists(artistName, mbid, 5).then(result => {
            if (!mountedRef.current || fetchId !== fetchIdRef.current) return;
            if (result.success) {
              setData(prev => ({ ...prev, setlists: result.data }));
              setErrors(prev => ({ ...prev, setlists: null }));
            } else {
              setErrors(prev => ({ ...prev, setlists: result.error || 'Failed to fetch setlists' }));
            }
            setLoading(prev => ({ ...prev, setlists: false }));
          }).catch(err => {
            if (mountedRef.current && fetchId === fetchIdRef.current) {
              setErrors(prev => ({ ...prev, setlists: String(err) }));
              setLoading(prev => ({ ...prev, setlists: false }));
            }
          })
        );
      }

      // Concerts
      if (types.includes('concerts')) {
        setLoading(prev => ({ ...prev, concerts: true }));
        fetchPromises.push(
          window.api.enrichment.getConcerts(artistName).then(result => {
            if (!mountedRef.current || fetchId !== fetchIdRef.current) return;
            if (result.success) {
              setData(prev => ({ ...prev, concerts: result.data }));
              setErrors(prev => ({ ...prev, concerts: null }));
            } else {
              setErrors(prev => ({ ...prev, concerts: result.error || 'Failed to fetch concerts' }));
            }
            setLoading(prev => ({ ...prev, concerts: false }));
          }).catch(err => {
            if (mountedRef.current && fetchId === fetchIdRef.current) {
              setErrors(prev => ({ ...prev, concerts: String(err) }));
              setLoading(prev => ({ ...prev, concerts: false }));
            }
          })
        );
      }

      // Gallery (can work with mbid OR artistName)
      if (types.includes('gallery')) {
        setLoading(prev => ({ ...prev, gallery: true }));
        fetchPromises.push(
          window.api.enrichment.getGallery(mbid, artistName).then(result => {
            if (!mountedRef.current || fetchId !== fetchIdRef.current) return;
            if (result.success) {
              setData(prev => ({ ...prev, gallery: result.data }));
              setErrors(prev => ({ ...prev, gallery: null }));
            } else {
              setErrors(prev => ({ ...prev, gallery: result.error || 'Failed to fetch gallery' }));
            }
            setLoading(prev => ({ ...prev, gallery: false }));
          }).catch(err => {
            if (mountedRef.current && fetchId === fetchIdRef.current) {
              setErrors(prev => ({ ...prev, gallery: String(err) }));
              setLoading(prev => ({ ...prev, gallery: false }));
            }
          })
        );
      }

      // Merchandise
      if (types.includes('merchandise')) {
        setLoading(prev => ({ ...prev, merchandise: true }));
        fetchPromises.push(
          window.api.enrichment.getMerchandise(artistName).then(result => {
            if (!mountedRef.current || fetchId !== fetchIdRef.current) return;
            if (result.success) {
              setData(prev => ({ ...prev, merchandiseUrl: result.data }));
              setErrors(prev => ({ ...prev, merchandise: null }));
            } else {
              setErrors(prev => ({ ...prev, merchandise: result.error || 'Failed to fetch merchandise' }));
            }
            setLoading(prev => ({ ...prev, merchandise: false }));
          }).catch(err => {
            if (mountedRef.current && fetchId === fetchIdRef.current) {
              setErrors(prev => ({ ...prev, merchandise: String(err) }));
              setLoading(prev => ({ ...prev, merchandise: false }));
            }
          })
        );
      }

      // Wait for all fetches to complete
      await Promise.allSettled(fetchPromises);

    } catch (error) {
      console.error('[useArtistEnrichment] Error fetching enrichment data:', error);
    }
  }, [artistName, enabled, mbid]);

  // Fetch when artist changes
  useEffect(() => {
    // Reset data when artist changes
    setData(initialData);
    setErrors(initialErrors);
    fetchEnrichmentData();
  }, [fetchEnrichmentData]);

  const refetch = useCallback(() => {
    fetchEnrichmentData();
  }, [fetchEnrichmentData]);

  return {
    data,
    loading,
    errors,
    availableTypes,
    refetch,
  };
}

export default useArtistEnrichment;
