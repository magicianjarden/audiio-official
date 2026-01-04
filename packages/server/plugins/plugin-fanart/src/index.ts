/**
 * Fanart Provider
 * Provides high-quality artist images from TheAudioDB (free, no auth required).
 */

import {
  BaseArtistEnrichmentProvider,
  type ArtistImages
} from '@audiio/sdk';

// TheAudioDB API - free tier, no auth required
const AUDIODB_API_URL = 'https://theaudiodb.com/api/v1/json/2';

interface AudioDBSearchResponse {
  artists: Array<{
    idArtist: string;
    strArtist: string;
    strArtistThumb: string | null;
    strArtistLogo: string | null;
    strArtistCutout: string | null;
    strArtistClearart: string | null;
    strArtistWideThumb: string | null;
    strArtistFanart: string | null;
    strArtistFanart2: string | null;
    strArtistFanart3: string | null;
    strArtistFanart4: string | null;
    strArtistBanner: string | null;
  }> | null;
}

export class FanartProvider extends BaseArtistEnrichmentProvider {
  readonly id = 'fanart';
  readonly name = 'Artist Gallery';
  readonly enrichmentType = 'gallery' as const;

  private cache = new Map<string, { data: ArtistImages; timestamp: number }>();
  private cacheTTL = 3600000; // 1 hour

  async initialize(): Promise<void> {
    console.log('[Fanart] Initializing with TheAudioDB...');
  }

  async getArtistGallery(mbid: string, artistName?: string): Promise<ArtistImages> {
    // Try by MBID first, then by artist name
    const cacheKey = mbid || artistName || '';
    if (!cacheKey) return this.emptyResult();

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      let data: AudioDBSearchResponse | null = null;

      // Try MBID lookup first
      if (mbid) {
        const mbidResponse = await fetch(`${AUDIODB_API_URL}/artist-mb.php?i=${mbid}`);
        if (mbidResponse.ok) {
          data = await mbidResponse.json();
        }
      }

      // Fall back to name search if MBID didn't work
      if (!data?.artists && artistName) {
        const nameResponse = await fetch(
          `${AUDIODB_API_URL}/search.php?s=${encodeURIComponent(artistName)}`
        );
        if (nameResponse.ok) {
          data = await nameResponse.json();
        }
      }

      if (!data?.artists || data.artists.length === 0) {
        return this.emptyResult();
      }

      const artist = data.artists[0];
      const result = this.transformResponse(artist);
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {
      console.error('[Fanart] Failed to fetch:', error);
      return this.emptyResult();
    }
  }

  private transformResponse(artist: NonNullable<AudioDBSearchResponse['artists']>[0]): ArtistImages {
    const backgrounds: Array<{ url: string; likes: number }> = [];
    const thumbs: Array<{ url: string; likes: number }> = [];
    const logos: Array<{ url: string; likes: number }> = [];
    const banners: Array<{ url: string; likes: number }> = [];

    // Collect fanart backgrounds
    if (artist.strArtistFanart) backgrounds.push({ url: artist.strArtistFanart, likes: 0 });
    if (artist.strArtistFanart2) backgrounds.push({ url: artist.strArtistFanart2, likes: 0 });
    if (artist.strArtistFanart3) backgrounds.push({ url: artist.strArtistFanart3, likes: 0 });
    if (artist.strArtistFanart4) backgrounds.push({ url: artist.strArtistFanart4, likes: 0 });

    // Collect thumbnails
    if (artist.strArtistThumb) thumbs.push({ url: artist.strArtistThumb, likes: 0 });
    if (artist.strArtistWideThumb) thumbs.push({ url: artist.strArtistWideThumb, likes: 0 });
    if (artist.strArtistCutout) thumbs.push({ url: artist.strArtistCutout, likes: 0 });
    if (artist.strArtistClearart) thumbs.push({ url: artist.strArtistClearart, likes: 0 });

    // Collect logos
    if (artist.strArtistLogo) logos.push({ url: artist.strArtistLogo, likes: 0 });

    // Collect banners
    if (artist.strArtistBanner) banners.push({ url: artist.strArtistBanner, likes: 0 });

    return {
      backgrounds,
      thumbs,
      logos,
      hdLogos: [], // AudioDB doesn't have separate HD logos
      banners,
    };
  }

  private emptyResult(): ArtistImages {
    return { backgrounds: [], thumbs: [], logos: [], hdLogos: [], banners: [] };
  }
}

export default FanartProvider;
