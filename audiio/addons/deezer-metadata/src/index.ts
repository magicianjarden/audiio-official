/**
 * Deezer Metadata Provider
 * Provides track, artist, and album metadata from Deezer's public API
 * Supports configurable metadata fetching to allow complementary providers
 */

import {
  BaseMetadataProvider,
  type MetadataSearchResult,
  type MetadataSearchOptions,
  type MetadataTrack,
  type Artist,
  type Album,
  type ArtworkSet,
  type ArtistDetail,
  type DeezerProviderSettings
} from '@audiio/sdk';

const DEEZER_API = 'https://api.deezer.com';

/** Default settings - fetch everything */
const DEFAULT_SETTINGS: DeezerProviderSettings = {
  fetchArtwork: true,
  fetchArtistInfo: true,
  fetchAlbumInfo: true,
  fetchExternalIds: true
};

interface DeezerArtist {
  id: number;
  name: string;
  picture?: string;
  picture_small?: string;
  picture_medium?: string;
  picture_big?: string;
  picture_xl?: string;
}

interface DeezerAlbum {
  id: number;
  title: string;
  cover?: string;
  cover_small?: string;
  cover_medium?: string;
  cover_big?: string;
  cover_xl?: string;
  release_date?: string;
  nb_tracks?: number;
  artist?: DeezerArtist;
  tracks?: { data: DeezerTrack[] };
  record_type?: 'single' | 'album' | 'ep' | 'compile';
}

interface DeezerTrack {
  id: number;
  title: string;
  duration: number;
  explicit_lyrics?: boolean;
  isrc?: string;
  artist: DeezerArtist;
  album?: DeezerAlbum;
}

interface DeezerSearchResponse {
  data: DeezerTrack[];
  total: number;
  next?: string;
}

interface DeezerArtistFull extends DeezerArtist {
  nb_fan?: number;
  nb_album?: number;
}

interface DeezerTopTracksResponse {
  data: DeezerTrack[];
}

interface DeezerArtistAlbumsResponse {
  data: DeezerAlbum[];
}

interface DeezerRelatedArtistsResponse {
  data: DeezerArtist[];
}

export class DeezerMetadataProvider extends BaseMetadataProvider {
  readonly id = 'deezer';
  readonly name = 'Deezer';
  readonly priority = 80;

  private settings: DeezerProviderSettings = { ...DEFAULT_SETTINGS };

  /**
   * Update provider settings
   */
  updateSettings(settings: Partial<DeezerProviderSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * Get current settings
   */
  getSettings(): Record<string, unknown> {
    return { ...this.settings } as Record<string, unknown>;
  }

  async search(query: string, options?: MetadataSearchOptions): Promise<MetadataSearchResult> {
    const limit = options?.limit ?? 25;
    const offset = options?.offset ?? 0;

    const url = `${DEEZER_API}/search?q=${encodeURIComponent(query)}&limit=${limit}&index=${offset}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Deezer API error: ${response.status}`);
    }

    const data = await response.json() as DeezerSearchResponse;

    return {
      tracks: data.data.map(track => this.mapTrack(track)),
      artists: [],
      albums: []
    };
  }

  async getTrack(id: string): Promise<MetadataTrack | null> {
    try {
      const response = await fetch(`${DEEZER_API}/track/${id}`);
      if (!response.ok) return null;

      const data = await response.json() as DeezerTrack;
      return this.mapTrack(data);
    } catch {
      return null;
    }
  }

  async getArtist(id: string): Promise<ArtistDetail | null> {
    if (!this.settings.fetchArtistInfo) {
      return null;
    }

    try {
      // Fetch artist info, top tracks, albums, and related artists in parallel
      const [artistRes, topTracksRes, albumsRes, relatedRes] = await Promise.all([
        fetch(`${DEEZER_API}/artist/${id}`),
        fetch(`${DEEZER_API}/artist/${id}/top?limit=10`),
        fetch(`${DEEZER_API}/artist/${id}/albums?limit=50`),
        fetch(`${DEEZER_API}/artist/${id}/related?limit=10`)
      ]);

      if (!artistRes.ok) return null;

      const artistData = await artistRes.json() as DeezerArtistFull;
      const topTracksData = topTracksRes.ok ? await topTracksRes.json() as DeezerTopTracksResponse : { data: [] };
      const albumsData = albumsRes.ok ? await albumsRes.json() as DeezerArtistAlbumsResponse : { data: [] };
      const relatedData = relatedRes.ok ? await relatedRes.json() as DeezerRelatedArtistsResponse : { data: [] };

      // Map top tracks
      const topTracks = topTracksData.data.map(track => this.mapTrack(track));

      // Categorize albums (Deezer includes record_type in album response)
      const albums: Album[] = [];
      const singles: Album[] = [];
      const eps: Album[] = [];
      const compilations: Album[] = [];
      const appearsOn: Album[] = [];

      for (const album of albumsData.data) {
        const mappedAlbum = this.mapAlbumBasic(album);

        // Check if this is an album where the artist appears but isn't the main artist
        const isAppearance = album.artist && album.artist.id !== parseInt(id);

        if (isAppearance) {
          appearsOn.push(mappedAlbum);
        } else {
          switch (album.record_type) {
            case 'single':
              singles.push(mappedAlbum);
              break;
            case 'ep':
              eps.push(mappedAlbum);
              break;
            case 'compile':
              compilations.push(mappedAlbum);
              break;
            default:
              albums.push(mappedAlbum);
          }
        }
      }

      // Map similar artists
      const similarArtists = relatedData.data.map(a => this.mapArtist(a));

      const result: ArtistDetail = {
        id: String(artistData.id),
        name: artistData.name,
        followers: artistData.nb_fan,
        topTracks,
        albums,
        singles,
        eps,
        compilations,
        appearsOn,
        similarArtists
      };

      // Add artwork if enabled
      if (this.settings.fetchArtwork && artistData.picture_medium) {
        result.artwork = {
          small: artistData.picture_small,
          medium: artistData.picture_medium,
          large: artistData.picture_big,
          original: artistData.picture_xl
        };
      }

      return result;
    } catch (error) {
      console.error('Deezer getArtist error:', error);
      return null;
    }
  }

  async getAlbum(id: string): Promise<(Album & { tracks: MetadataTrack[] }) | null> {
    if (!this.settings.fetchAlbumInfo) {
      return null;
    }

    try {
      const response = await fetch(`${DEEZER_API}/album/${id}`);
      if (!response.ok) return null;

      const data = await response.json() as DeezerAlbum;
      return this.mapAlbumWithTracks(data);
    } catch {
      return null;
    }
  }

  private mapTrack(track: DeezerTrack): MetadataTrack {
    const result: MetadataTrack = {
      id: String(track.id),
      title: track.title,
      artists: this.settings.fetchArtistInfo
        ? [this.mapArtist(track.artist)]
        : [{ id: String(track.artist.id), name: track.artist.name }],
      duration: track.duration,
      explicit: track.explicit_lyrics,
      _provider: 'deezer'
    };

    // Conditionally add album info
    if (this.settings.fetchAlbumInfo && track.album) {
      result.album = this.mapAlbumBasic(track.album);
    }

    // Conditionally add artwork
    if (this.settings.fetchArtwork && track.album) {
      result.artwork = this.mapAlbumArtwork(track.album);
    }

    // Conditionally add external IDs
    if (this.settings.fetchExternalIds) {
      result.externalIds = {
        deezer: String(track.id),
        isrc: track.isrc
      };
    }

    return result;
  }

  private mapArtist(artist: DeezerArtist): Artist {
    const result: Artist = {
      id: String(artist.id),
      name: artist.name
    };

    // Conditionally add artist artwork
    if (this.settings.fetchArtwork && artist.picture_medium) {
      result.artwork = {
        small: artist.picture_small,
        medium: artist.picture_medium,
        large: artist.picture_big,
        original: artist.picture_xl
      };
    }

    return result;
  }

  private mapAlbumBasic(album: DeezerAlbum): Album {
    const result: Album = {
      id: String(album.id),
      title: album.title
    };

    // Conditionally add artwork
    if (this.settings.fetchArtwork) {
      result.artwork = this.mapAlbumArtwork(album);
    }

    // Always include basic album metadata if fetchAlbumInfo is enabled
    if (this.settings.fetchAlbumInfo) {
      result.releaseDate = album.release_date;
      result.trackCount = album.nb_tracks;
      if (album.artist && this.settings.fetchArtistInfo) {
        result.artists = [this.mapArtist(album.artist)];
      }
    }

    return result;
  }

  private mapAlbumWithTracks(album: DeezerAlbum): Album & { tracks: MetadataTrack[] } {
    return {
      ...this.mapAlbumBasic(album),
      tracks: album.tracks?.data.map(track => this.mapTrack(track)) ?? []
    };
  }

  private mapAlbumArtwork(album: DeezerAlbum): ArtworkSet {
    return {
      small: album.cover_small,
      medium: album.cover_medium,
      large: album.cover_big,
      original: album.cover_xl
    };
  }

  /**
   * Get chart/trending data from Deezer
   * Uses Deezer's /chart endpoint for real trending content
   */
  async getCharts(limit = 20): Promise<{
    tracks: MetadataTrack[];
    artists: Artist[];
    albums: Album[];
  }> {
    try {
      // Fetch charts data in parallel
      const [tracksRes, artistsRes, albumsRes] = await Promise.all([
        fetch(`${DEEZER_API}/chart/0/tracks?limit=${limit}`),
        fetch(`${DEEZER_API}/chart/0/artists?limit=${limit}`),
        fetch(`${DEEZER_API}/chart/0/albums?limit=${limit}`)
      ]);

      const tracksData = tracksRes.ok
        ? await tracksRes.json() as { data: DeezerTrack[] }
        : { data: [] };

      const artistsData = artistsRes.ok
        ? await artistsRes.json() as { data: DeezerArtist[] }
        : { data: [] };

      const albumsData = albumsRes.ok
        ? await albumsRes.json() as { data: DeezerAlbum[] }
        : { data: [] };

      return {
        tracks: tracksData.data.map(track => this.mapTrack(track)),
        artists: artistsData.data.map(artist => this.mapArtist(artist)),
        albums: albumsData.data.map(album => this.mapAlbumBasic(album))
      };
    } catch (error) {
      console.error('[Deezer] Failed to fetch charts:', error);
      return { tracks: [], artists: [], albums: [] };
    }
  }
}

// Default export for addon loading
export default DeezerMetadataProvider;
