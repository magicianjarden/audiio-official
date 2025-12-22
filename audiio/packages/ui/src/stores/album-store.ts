/**
 * Album store - manages album detail data and caching
 */

import { create } from 'zustand';
import type { UnifiedTrack, AlbumDetail as CoreAlbumDetail, AlbumCredits } from '@audiio/core';

type AlbumType = 'album' | 'single' | 'ep' | 'compilation';
import type { SearchAlbum } from './search-store';

export interface AlbumArtistInfo {
  id: string;
  name: string;
  image?: string;
  followers?: number;
  verified?: boolean;
  genres?: string[];
  bio?: string;
}

export interface AlbumDetail {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  artwork?: string;
  year?: number;
  releaseDate?: string;
  trackCount?: number;
  albumType?: AlbumType;
  label?: string;
  copyright?: string;
  credits?: AlbumCredits;
  explicit?: boolean;
  genres?: string[];
  totalDuration?: number;
  description?: string;
  source: string;
  tracks: UnifiedTrack[];
  moreByArtist: SearchAlbum[];
  // New fields for enhanced album page
  similarAlbums: SearchAlbum[];
  artistInfo?: AlbumArtistInfo;
}

interface AlbumState {
  // Cache for album data
  albumCache: Map<string, AlbumDetail>;

  // Current loading state
  loadingAlbumId: string | null;
  error: string | null;

  // Actions
  fetchAlbum: (albumId: string, albumData: SearchAlbum) => Promise<AlbumDetail | null>;
  getAlbum: (albumId: string) => AlbumDetail | null;
  clearCache: () => void;
}

export const useAlbumStore = create<AlbumState>((set, get) => ({
  albumCache: new Map(),
  loadingAlbumId: null,
  error: null,

  fetchAlbum: async (albumId, albumData) => {
    // Check cache first
    const cached = get().albumCache.get(albumId);
    if (cached && cached.tracks.length > 0) {
      return cached;
    }

    set({ loadingAlbumId: albumId, error: null });

    try {
      if (!window.api) {
        throw new Error('API not available');
      }

      // Try the new getAlbum API first (via plugin system)
      if (window.api.getAlbum) {
        try {
          const apiAlbum = await window.api.getAlbum(albumId, albumData.source);

          if (apiAlbum) {
            // Convert tracks to UnifiedTrack format
            const tracks: UnifiedTrack[] = (apiAlbum.tracks || []).map(track => ({
              ...track,
              streamSources: [],
              _meta: {
                metadataProvider: albumData.source || 'addon',
                matchConfidence: 1,
                externalIds: {},
                lastUpdated: new Date()
              }
            })) as UnifiedTrack[];

            // Map more by artist albums
            const moreByArtist: SearchAlbum[] = (apiAlbum.moreByArtist || []).map(album => ({
              id: album.id,
              title: album.title,
              artist: album.artists?.[0]?.name || albumData.artist,
              artwork: album.artwork?.medium || album.artwork?.small,
              year: album.releaseDate ? parseInt(album.releaseDate.substring(0, 4)) : undefined,
              trackCount: album.trackCount,
              source: albumData.source
            }));

            // Calculate total duration from tracks
            const totalDuration = tracks.reduce((acc, track) => acc + (track.duration || 0), 0);

            // Fetch similar albums if API available
            let similarAlbums: SearchAlbum[] = [];
            if (window.api?.getSimilarAlbums) {
              try {
                const similar = await window.api.getSimilarAlbums(albumId, albumData.source);
                similarAlbums = (similar || [])
                  .filter(album => album.id !== albumId)
                  .slice(0, 8)
                  .map(album => ({
                    id: album.id,
                    title: album.title,
                    artist: album.artists?.[0]?.name || '',
                    artwork: album.artwork?.medium || album.artwork?.small,
                    year: album.releaseDate ? parseInt(album.releaseDate.substring(0, 4)) : undefined,
                    trackCount: album.trackCount,
                    source: albumData.source
                  }));
              } catch (e) {
                console.warn('Failed to fetch similar albums:', e);
              }
            }

            // Fetch artist info if we have an artist ID
            let artistInfo: AlbumArtistInfo | undefined;
            const primaryArtist = apiAlbum.artists?.[0];
            if (primaryArtist?.id && window.api?.getArtist) {
              try {
                const artist = await window.api.getArtist(primaryArtist.id, albumData.source);
                if (artist) {
                  artistInfo = {
                    id: artist.id,
                    name: artist.name,
                    image: artist.artwork?.large || artist.artwork?.medium,
                    followers: artist.followers,
                    verified: artist.verified,
                    genres: artist.genres,
                    bio: artist.bio
                  };
                }
              } catch (e) {
                console.warn('Failed to fetch artist info:', e);
              }
            }

            const albumDetail: AlbumDetail = {
              id: albumId,
              title: apiAlbum.title || albumData.title,
              artist: apiAlbum.artists?.[0]?.name || albumData.artist,
              artistId: apiAlbum.artists?.[0]?.id,
              artwork: apiAlbum.artwork?.large || apiAlbum.artwork?.medium || albumData.artwork,
              year: apiAlbum.releaseDate ? parseInt(apiAlbum.releaseDate.substring(0, 4)) : albumData.year,
              releaseDate: apiAlbum.releaseDate,
              trackCount: tracks.length || apiAlbum.trackCount || albumData.trackCount,
              albumType: apiAlbum.albumType,
              label: apiAlbum.label,
              copyright: apiAlbum.copyright,
              credits: apiAlbum.credits,
              explicit: apiAlbum.explicit,
              genres: apiAlbum.genres,
              totalDuration: apiAlbum.totalDuration || totalDuration,
              description: apiAlbum.description,
              source: albumData.source,
              tracks,
              moreByArtist,
              similarAlbums,
              artistInfo
            };

            // Cache and return
            const newCache = new Map(get().albumCache);
            newCache.set(albumId, albumDetail);
            set({ albumCache: newCache, loadingAlbumId: null });
            return albumDetail;
          }
        } catch (apiError) {
          console.warn('getAlbum API failed, falling back to search:', apiError);
        }
      }

      // Fallback: Search for tracks from this album
      const searchQuery = `${albumData.title} ${albumData.artist}`;
      const tracks = await window.api.search({ query: searchQuery, type: 'track' });

      // Filter tracks to only include those from this album
      const albumTracks = (tracks || []).filter((track: UnifiedTrack) => {
        if (!track.album) return false;
        // Match by album ID or title
        return track.album.id === albumId ||
          track.album.title.toLowerCase() === albumData.title.toLowerCase();
      });

      // Sort tracks by track number if available
      albumTracks.sort((a: UnifiedTrack, b: UnifiedTrack) => {
        const aNum = (a as { trackNumber?: number }).trackNumber || 999;
        const bNum = (b as { trackNumber?: number }).trackNumber || 999;
        return aNum - bNum;
      });

      // Get more albums by this artist
      const artistAlbums = await window.api.search({ query: albumData.artist, type: 'album' }).catch(() => []);

      const moreByArtist: SearchAlbum[] = (artistAlbums || [])
        .filter((album: { id: string; artists?: Array<{ name: string }> }) => {
          // Exclude current album and only include albums by same artist
          if (album.id === albumId) return false;
          const albumArtist = album.artists?.[0]?.name;
          return albumArtist && albumArtist.toLowerCase() === albumData.artist.toLowerCase();
        })
        .slice(0, 8)
        .map((album: { id: string; title: string; artists?: Array<{ name: string }>; artwork?: { medium?: string }; releaseDate?: string; trackCount?: number }) => ({
          id: album.id,
          title: album.title,
          artist: album.artists?.[0]?.name || albumData.artist,
          artwork: album.artwork?.medium,
          year: album.releaseDate ? parseInt(album.releaseDate.substring(0, 4)) : undefined,
          trackCount: album.trackCount,
          source: 'addon'
        }));

      // Also extract more albums from the tracks we found
      if (moreByArtist.length < 4) {
        const trackAlbumsMap = new Map<string, SearchAlbum>();
        for (const track of tracks || []) {
          if (track.album && track.album.id !== albumId) {
            const matchesArtist = track.artists.some(
              (a: { name: string }) => a.name.toLowerCase() === albumData.artist.toLowerCase()
            );
            if (matchesArtist && !trackAlbumsMap.has(track.album.id)) {
              trackAlbumsMap.set(track.album.id, {
                id: track.album.id,
                title: track.album.title,
                artist: albumData.artist,
                artwork: track.album.artwork?.medium,
                year: track.album.releaseDate ? parseInt(track.album.releaseDate.substring(0, 4)) : undefined,
                trackCount: track.album.trackCount,
                source: track._meta?.metadataProvider || 'unknown'
              });
            }
          }
        }
        // Merge, avoiding duplicates
        const existingIds = new Set(moreByArtist.map(a => a.id));
        for (const album of trackAlbumsMap.values()) {
          if (!existingIds.has(album.id) && moreByArtist.length < 8) {
            moreByArtist.push(album);
          }
        }
      }

      // Calculate total duration
      const totalDuration = albumTracks.reduce((acc, track) => acc + (track.duration || 0), 0);

      const albumDetail: AlbumDetail = {
        id: albumId,
        title: albumData.title,
        artist: albumData.artist,
        artwork: albumData.artwork,
        year: albumData.year,
        releaseDate: undefined,
        trackCount: albumTracks.length || albumData.trackCount,
        albumType: undefined,
        label: undefined,
        copyright: undefined,
        credits: undefined,
        explicit: undefined,
        genres: undefined,
        totalDuration,
        description: undefined,
        source: albumData.source,
        tracks: albumTracks,
        moreByArtist,
        similarAlbums: [],
        artistInfo: undefined
      };

      // Cache the result
      const newCache = new Map(get().albumCache);
      newCache.set(albumId, albumDetail);

      set({
        albumCache: newCache,
        loadingAlbumId: null
      });

      return albumDetail;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch album',
        loadingAlbumId: null
      });
      return null;
    }
  },

  getAlbum: (albumId) => {
    return get().albumCache.get(albumId) || null;
  },

  clearCache: () => {
    set({ albumCache: new Map() });
  }
}));
