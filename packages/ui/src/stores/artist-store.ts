/**
 * Artist store - manages artist detail data and caching
 */

import { create } from 'zustand';
import type { UnifiedTrack, ArtistDetail as CoreArtistDetail } from '@audiio/core';
import type { SearchAlbum } from './search-store';

export interface ArtistDetail {
  id: string;
  name: string;
  image?: string;
  followers?: number;
  genres?: string[];
  bio?: string;
  verified?: boolean;
  externalUrls?: Record<string, string>;
  source: string;
  topTracks: UnifiedTrack[];
  // Categorized discography
  albums: SearchAlbum[];
  singles: SearchAlbum[];
  eps: SearchAlbum[];
  compilations: SearchAlbum[];
  appearsOn: SearchAlbum[];
  similarArtists: Array<{
    id: string;
    name: string;
    image?: string;
    source: string;
  }>;
  // Latest release (within last year)
  latestRelease?: SearchAlbum;
}

interface ArtistState {
  // Cache for artist data
  artistCache: Map<string, ArtistDetail>;

  // Current loading state
  loadingArtistId: string | null;
  error: string | null;

  // Actions
  fetchArtist: (artistId: string, artistName: string, initialData?: Partial<ArtistDetail>) => Promise<ArtistDetail | null>;
  getArtist: (artistId: string) => ArtistDetail | null;
  clearCache: () => void;
}

/**
 * Map core Album to SearchAlbum format
 */
function mapToSearchAlbum(album: {
  id: string;
  title: string;
  artists?: Array<{ name: string }>;
  artwork?: { medium?: string; small?: string };
  releaseDate?: string;
  trackCount?: number;
  albumType?: string;
}, artistName: string, source: string): SearchAlbum & { albumType?: string } {
  return {
    id: album.id,
    title: album.title,
    artist: album.artists?.[0]?.name || artistName,
    artwork: album.artwork?.medium || album.artwork?.small,
    year: album.releaseDate ? parseInt(album.releaseDate.substring(0, 4)) : undefined,
    trackCount: album.trackCount,
    albumType: album.albumType,
    source
  };
}

export const useArtistStore = create<ArtistState>((set, get) => ({
  artistCache: new Map(),
  loadingArtistId: null,
  error: null,

  fetchArtist: async (artistId, artistName, initialData) => {
    // Check cache first
    const cached = get().artistCache.get(artistId);
    if (cached && cached.topTracks.length > 0) {
      return cached;
    }

    set({ loadingArtistId: artistId, error: null });

    try {
      if (!window.api) {
        throw new Error('API not available');
      }

      // Try the new getArtist API first (via plugin system)
      if (window.api.getArtist) {
        try {
          const apiArtist = await window.api.getArtist(artistId, initialData?.source);

          if (apiArtist) {
            // Use pre-categorized albums from API response
            const categorized = {
              albums: (apiArtist.albums || []).map(album =>
                mapToSearchAlbum(album, artistName, initialData?.source || 'addon')
              ),
              singles: (apiArtist.singles || []).map(album =>
                mapToSearchAlbum(album, artistName, initialData?.source || 'addon')
              ),
              eps: (apiArtist.eps || []).map(album =>
                mapToSearchAlbum(album, artistName, initialData?.source || 'addon')
              ),
              compilations: (apiArtist.compilations || []).map(album =>
                mapToSearchAlbum(album, artistName, initialData?.source || 'addon')
              )
            };

            // Map similar artists
            const similarArtists = (apiArtist.similarArtists || []).map(a => ({
              id: a.id,
              name: a.name,
              image: a.artwork?.medium || a.artwork?.small,
              source: initialData?.source || 'addon'
            }));

            // Map appears on albums
            const appearsOn = (apiArtist.appearsOn || []).map(album =>
              mapToSearchAlbum(album, artistName, initialData?.source || 'addon')
            );

            // Convert top tracks to UnifiedTrack format if needed
            const topTracks: UnifiedTrack[] = (apiArtist.topTracks || []).map(track => ({
              ...track,
              streamSources: [],
              _meta: {
                metadataProvider: initialData?.source || 'addon',
                matchConfidence: 1,
                externalIds: {},
                lastUpdated: new Date()
              }
            })) as UnifiedTrack[];

            // Find latest release (within last year)
            const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
            const allReleases = [...categorized.albums, ...categorized.singles, ...categorized.eps];
            const recentReleases = allReleases
              .filter(album => {
                if (!album.year) return false;
                const releaseTime = new Date(`${album.year}-01-01`).getTime();
                return releaseTime > oneYearAgo;
              })
              .sort((a, b) => (b.year || 0) - (a.year || 0));
            const latestRelease = recentReleases[0];

            const artistDetail: ArtistDetail = {
              id: artistId,
              name: apiArtist.name || artistName,
              image: apiArtist.artwork?.large || apiArtist.artwork?.medium || initialData?.image,
              followers: apiArtist.followers || initialData?.followers,
              genres: apiArtist.genres || initialData?.genres,
              bio: apiArtist.bio,
              verified: apiArtist.verified,
              externalUrls: apiArtist.externalUrls,
              source: initialData?.source || 'addon',
              topTracks: topTracks.slice(0, 10),
              albums: categorized.albums.slice(0, 10),
              singles: categorized.singles.slice(0, 10),
              eps: categorized.eps.slice(0, 10),
              compilations: categorized.compilations.slice(0, 10),
              appearsOn: appearsOn.slice(0, 10),
              similarArtists: similarArtists.slice(0, 10),
              latestRelease
            };

            // Cache and return
            const newCache = new Map(get().artistCache);
            newCache.set(artistId, artistDetail);
            set({ artistCache: newCache, loadingArtistId: null });
            return artistDetail;
          }
        } catch (apiError) {
          console.warn('getArtist API failed, falling back to search:', apiError);
        }
      }

      // Fallback: Search for tracks by this artist
      const tracks = await window.api.search({ query: artistName, type: 'track' });

      // Filter tracks to only include those by this artist
      const artistTracks = (tracks || []).filter((track: UnifiedTrack) =>
        track.artists.some(a =>
          a.name.toLowerCase() === artistName.toLowerCase() ||
          a.id === artistId
        )
      );

      // Get albums for this artist
      const albumResults = await window.api.search({ query: artistName, type: 'album' }).catch(() => []);

      // Map and filter albums
      const artistAlbums: SearchAlbum[] = (albumResults || [])
        .filter((album: { artists?: Array<{ name: string; id?: string }> }) => {
          const albumArtist = album.artists?.[0];
          return albumArtist && (
            albumArtist.name.toLowerCase() === artistName.toLowerCase() ||
            albumArtist.id === artistId
          );
        })
        .map((album: { id: string; title: string; artists?: Array<{ name: string }>; artwork?: { medium?: string }; releaseDate?: string; trackCount?: number; albumType?: string }) =>
          mapToSearchAlbum(album, artistName, 'addon')
        );

      // Also extract albums from tracks
      const trackAlbums = new Map<string, SearchAlbum>();
      for (const track of artistTracks) {
        if (track.album && !trackAlbums.has(track.album.id)) {
          trackAlbums.set(track.album.id, {
            id: track.album.id,
            title: track.album.title,
            artist: artistName,
            artwork: track.album.artwork?.medium,
            year: track.album.releaseDate ? parseInt(track.album.releaseDate.substring(0, 4)) : undefined,
            trackCount: track.album.trackCount,
            source: track._meta?.metadataProvider || 'unknown'
          });
        }
      }

      // Merge albums (prioritize search results)
      const mergedAlbums = artistAlbums.length > 0
        ? artistAlbums
        : Array.from(trackAlbums.values());

      const artistDetail: ArtistDetail = {
        id: artistId,
        name: artistName,
        image: initialData?.image,
        followers: initialData?.followers,
        genres: initialData?.genres,
        bio: undefined,
        verified: undefined,
        externalUrls: undefined,
        source: initialData?.source || 'addon',
        topTracks: artistTracks.slice(0, 10),
        albums: mergedAlbums.slice(0, 10),
        singles: [],
        eps: [],
        compilations: [],
        appearsOn: [],
        similarArtists: []
      };

      // Cache the result
      const newCache = new Map(get().artistCache);
      newCache.set(artistId, artistDetail);

      set({
        artistCache: newCache,
        loadingArtistId: null
      });

      return artistDetail;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch artist',
        loadingArtistId: null
      });
      return null;
    }
  },

  getArtist: (artistId) => {
    return get().artistCache.get(artistId) || null;
  },

  clearCache: () => {
    set({ artistCache: new Map() });
  }
}));
