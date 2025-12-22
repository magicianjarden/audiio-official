/**
 * YouTube Music Stream Provider
 * Provides audio streams from YouTube Music using youtubei.js
 */

import {
  BaseStreamProvider,
  type StreamTrack,
  type StreamSearchOptions,
  type StreamInfo,
  type Quality
} from '@audiio/sdk';

// Type for the Innertube instance - we use dynamic import since youtubei.js is ESM-only
type InnertubeType = Awaited<ReturnType<typeof import('youtubei.js')['Innertube']['create']>>;

export class YouTubeMusicProvider extends BaseStreamProvider {
  readonly id = 'youtube-music';
  readonly name = 'YouTube Music';
  readonly requiresAuth = false;
  readonly supportedQualities: Quality[] = ['high', 'medium', 'low'];

  private yt: InnertubeType | null = null;

  async initialize(): Promise<void> {
    // Use Function constructor to ensure dynamic import isn't converted to require
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const dynamicImport = new Function('specifier', 'return import(specifier)');
    const ytModule = await dynamicImport('youtubei.js');
    const { Innertube, UniversalCache, ClientType } = ytModule;

    // Try to create with Android client first (often provides direct URLs)
    try {
      console.log('[YTMusic] Trying Android client...');
      this.yt = await Innertube.create({
        client_type: ClientType.ANDROID,
        cache: new UniversalCache(true)
      });
      console.log('[YTMusic] Android client initialized');
    } catch (e) {
      console.log('[YTMusic] Android client failed, falling back to web client');
      this.yt = await Innertube.create({
        cache: new UniversalCache(true),
        generate_session_locally: true
      });
    }
  }

  async dispose(): Promise<void> {
    this.yt = null;
  }

  isAuthenticated(): boolean {
    return false; // Using public API
  }

  async search(query: string, options?: StreamSearchOptions): Promise<StreamTrack[]> {
    if (!this.yt) throw new Error('YouTube Music not initialized');

    const limit = options?.limit ?? 20;

    console.log(`[YTMusic] Searching for: "${query}"`);
    const results = await this.yt.music.search(query, { type: 'song' });

    if (!results.contents) {
      console.log('[YTMusic] No contents in results');
      return [];
    }

    const tracks: StreamTrack[] = [];

    // YouTube Music returns nested structure: contents -> MusicShelf -> contents -> items
    for (const shelf of results.contents) {
      if (tracks.length >= limit) break;

      // Check if this is a MusicShelf with contents
      const shelfObj = shelf as { type?: string; contents?: unknown[] };
      if (shelfObj.type === 'MusicShelf' && shelfObj.contents) {
        console.log(`[YTMusic] Found MusicShelf with ${shelfObj.contents.length} items`);

        for (const item of shelfObj.contents) {
          if (tracks.length >= limit) break;

          const track = this.mapSearchResult(item);
          if (track) {
            tracks.push(track);
          }
        }
      } else if ('id' in shelf) {
        // Direct item (fallback)
        const track = this.mapSearchResult(shelf);
        if (track) {
          tracks.push(track);
        }
      }
    }

    console.log(`[YTMusic] Mapped ${tracks.length} tracks`);
    return tracks;
  }

  async searchByMetadata(metadata: {
    title: string;
    artist: string;
    album?: string;
    duration?: number;
    isrc?: string;
  }): Promise<StreamTrack | null> {
    if (!this.yt) throw new Error('YouTube Music not initialized');

    // Build search query
    const query = `${metadata.artist} ${metadata.title}`.trim();
    console.log(`[YTMusic] searchByMetadata query: "${query}"`);

    const results = await this.search(query, { limit: 10 });
    console.log(`[YTMusic] Search returned ${results.length} results`);

    if (results.length === 0) return null;

    // Score and find best match
    let bestMatch: StreamTrack | null = null;
    let bestScore = 0;

    for (const candidate of results) {
      const score = this.calculateMatchScore(
        {
          title: candidate.title,
          artists: candidate.artists,
          duration: candidate.duration
        },
        {
          title: metadata.title,
          artist: metadata.artist,
          duration: metadata.duration
        }
      );

      console.log(`[YTMusic] Candidate "${candidate.title}" by ${candidate.artists.join(', ')} - score: ${score.toFixed(2)}`);

      if (score > bestScore && score >= 0.6) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    console.log(`[YTMusic] Best match: ${bestMatch ? bestMatch.title : 'none'} (score: ${bestScore.toFixed(2)})`);
    return bestMatch;
  }

  async getStream(trackId: string, quality?: Quality): Promise<StreamInfo> {
    if (!this.yt) throw new Error('YouTube Music not initialized');

    console.log(`[YTMusic] Getting stream for video: ${trackId}`);

    // Choose format based on quality preference
    const selectedQuality = this.selectQuality(this.supportedQualities, quality);

    // Try multiple approaches to get the stream URL
    let url: string | undefined;
    let mimeType = 'audio/mp4';
    let bitrate = 128000;

    // Approach 1: Try YouTube Music specific getInfo
    try {
      console.log('[YTMusic] Trying music.getInfo()...');
      const musicInfo = await this.yt.music.getInfo(trackId);

      if (musicInfo) {
        console.log('[YTMusic] Got music info, checking streaming data...');
        const streamingData = (musicInfo as unknown as { streaming_data?: unknown }).streaming_data as {
          adaptive_formats?: Array<{
            url?: string;
            signatureCipher?: string;
            mime_type?: string;
            bitrate?: number;
            audio_quality?: string;
            decipher?: (player: unknown) => Promise<string>;
          }>;
        } | undefined;

        if (streamingData?.adaptive_formats) {
          // Sort audio formats by bitrate (descending for high quality, ascending for low)
          const audioFormats = streamingData.adaptive_formats
            .filter(f => f.mime_type?.includes('audio'))
            .sort((a, b) => {
              const bitrateA = a.bitrate ?? 0;
              const bitrateB = b.bitrate ?? 0;
              return selectedQuality === 'low' ? bitrateA - bitrateB : bitrateB - bitrateA;
            });

          console.log(`[YTMusic] Found ${audioFormats.length} audio formats`);

          for (const format of audioFormats) {
            // Try direct URL first
            if (format.url && !format.signatureCipher) {
              console.log('[YTMusic] Found format with direct URL');
              url = format.url;
              mimeType = format.mime_type ?? 'audio/mp4';
              bitrate = format.bitrate ?? 128000;
              break;
            }

            // Try to decipher if needed
            if (format.decipher && this.yt.session?.player) {
              try {
                console.log('[YTMusic] Attempting to decipher format...');
                url = await format.decipher(this.yt.session.player);
                mimeType = format.mime_type ?? 'audio/mp4';
                bitrate = format.bitrate ?? 128000;
                console.log('[YTMusic] Decipher successful');
                break;
              } catch (e) {
                console.log('[YTMusic] Decipher failed for this format, trying next...');
              }
            }
          }
        }
      }
    } catch (musicInfoError) {
      console.log('[YTMusic] music.getInfo() failed:', musicInfoError);
    }

    // Approach 2: Try regular getInfo with full player context
    if (!url) {
      try {
        console.log('[YTMusic] Trying getInfo()...');
        const videoInfo = await this.yt.getInfo(trackId);

        const format = videoInfo.chooseFormat({
          type: 'audio',
          quality: selectedQuality === 'high' ? 'best' : selectedQuality === 'low' ? 'worst' : undefined
        });

        if (format) {
          mimeType = format.mime_type;
          bitrate = format.bitrate ?? 128000;

          const formatAny = format as unknown as { url?: string; signatureCipher?: string };
          if (formatAny.url && !formatAny.signatureCipher) {
            console.log('[YTMusic] Found direct URL from getInfo');
            url = formatAny.url;
          } else {
            try {
              console.log('[YTMusic] Deciphering from getInfo...');
              url = await format.decipher(this.yt.session.player);
              console.log('[YTMusic] Decipher from getInfo successful');
            } catch (e) {
              console.log('[YTMusic] Decipher from getInfo failed');
            }
          }
        }
      } catch (infoError) {
        console.log('[YTMusic] getInfo() failed:', infoError);
      }
    }

    // Approach 3: Try getBasicInfo as last resort
    if (!url) {
      try {
        console.log('[YTMusic] Trying getBasicInfo() as fallback...');
        const basicInfo = await this.yt.getBasicInfo(trackId);

        const streamingData = basicInfo.streaming_data;
        console.log('[YTMusic] Streaming data formats count:',
          streamingData?.adaptive_formats?.length ?? 0,
          'Has HLS:', !!streamingData?.hls_manifest_url,
          'Has DASH:', !!streamingData?.dash_manifest_url
        );

        // Try HLS manifest URL if available
        if (!url && streamingData?.hls_manifest_url) {
          console.log('[YTMusic] Using HLS manifest URL');
          url = streamingData.hls_manifest_url;
          mimeType = 'application/x-mpegURL';
        }

        // Try DASH manifest URL if available
        if (!url && streamingData?.dash_manifest_url) {
          console.log('[YTMusic] Using DASH manifest URL');
          url = streamingData.dash_manifest_url;
          mimeType = 'application/dash+xml';
        }

        // Try adaptive formats with direct URLs
        if (!url && streamingData?.adaptive_formats) {
          for (const format of streamingData.adaptive_formats) {
            const f = format as unknown as { url?: string; mime_type?: string; bitrate?: number; signatureCipher?: string };
            console.log('[YTMusic] Format:', f.mime_type, 'Has URL:', !!f.url, 'Has cipher:', !!f.signatureCipher);
            if (f.url && f.mime_type?.includes('audio')) {
              console.log('[YTMusic] Found direct URL from basicInfo');
              url = f.url;
              mimeType = f.mime_type ?? 'audio/mp4';
              bitrate = f.bitrate ?? 128000;
              break;
            }
          }
        }
      } catch (basicInfoError) {
        console.log('[YTMusic] getBasicInfo() failed:', basicInfoError);
      }
    }

    // Approach 4: Try using the download method to get a stream URL
    if (!url) {
      try {
        console.log('[YTMusic] Trying download approach...');
        const info = await this.yt.getBasicInfo(trackId);

        // Use toDash() or toM3U8() which might give us usable URLs
        const streamingData = info.streaming_data;
        if (streamingData) {
          // Check if there's a way to get deciphered URLs
          const ytAny = this.yt as unknown as {
            download?: (videoId: string, options: unknown) => Promise<{ url: string }>;
          };

          if (ytAny.download) {
            console.log('[YTMusic] Using download method...');
            const result = await ytAny.download(trackId, { type: 'audio' });
            if (result?.url) {
              url = result.url;
              console.log('[YTMusic] Got URL from download method');
            }
          }
        }
      } catch (downloadError) {
        console.log('[YTMusic] Download approach failed:', downloadError);
      }
    }

    if (!url) {
      throw new Error('Could not extract stream URL from any source');
    }

    console.log(`[YTMusic] Got stream URL: ${url.slice(0, 100)}...`);

    return {
      url,
      format: this.mapMimeType(mimeType),
      bitrate,
      expiresAt: Date.now() + (6 * 60 * 60 * 1000) // ~6 hours
    };
  }

  private mapSearchResult(item: unknown): StreamTrack | null {
    console.log('[YTMusic] Mapping item:', JSON.stringify(item, null, 2).slice(0, 1500));

    // Handle MusicResponsiveListItem structure from youtubei.js
    const musicItem = item as {
      type?: string;
      id?: string;
      video_id?: string;
      title?: { text?: string } | string;
      name?: string;
      artists?: Array<{ name?: string }>;
      author?: { name?: string };
      authors?: Array<{ name?: string }>;
      duration?: { seconds?: number; text?: string };
      thumbnail?: Array<{ url?: string }> | { contents?: Array<{ url?: string }> };
      thumbnails?: Array<{ url?: string }>;
      playlistItemData?: { videoId?: string };
      flex_columns?: unknown[];
    };

    // Extract ID - try multiple locations
    let id = musicItem.id || musicItem.video_id || musicItem.playlistItemData?.videoId;
    if (!id) {
      console.log('[YTMusic] No ID found in item');
      return null;
    }

    // Extract title
    let title = '';
    if (typeof musicItem.title === 'string') {
      title = musicItem.title;
    } else if (musicItem.title?.text) {
      title = musicItem.title.text;
    } else if (musicItem.name) {
      title = musicItem.name;
    }

    if (!title) {
      console.log('[YTMusic] No title found');
      return null;
    }

    // Extract artists - try multiple locations
    const artists: string[] = [];
    if (musicItem.artists && Array.isArray(musicItem.artists)) {
      for (const artist of musicItem.artists) {
        if (artist.name) {
          artists.push(artist.name);
        }
      }
    } else if (musicItem.authors && Array.isArray(musicItem.authors)) {
      for (const author of musicItem.authors) {
        if (author.name) {
          artists.push(author.name);
        }
      }
    } else if (musicItem.author?.name) {
      artists.push(musicItem.author.name);
    }

    // Extract duration
    let duration = 0;
    if (musicItem.duration?.seconds) {
      duration = musicItem.duration.seconds;
    } else if (musicItem.duration?.text) {
      duration = this.parseDurationText(musicItem.duration.text);
    }

    // Extract thumbnail - handle multiple structures
    let thumbnail: string | undefined;
    if (Array.isArray(musicItem.thumbnail) && musicItem.thumbnail.length > 0) {
      thumbnail = musicItem.thumbnail[0]?.url;
    } else if (musicItem.thumbnails && musicItem.thumbnails.length > 0) {
      thumbnail = musicItem.thumbnails[0]?.url;
    }

    console.log(`[YTMusic] Mapped track: "${title}" by ${artists.join(', ')} (${id})`);

    return {
      id,
      title,
      artists: artists.length > 0 ? artists : ['Unknown Artist'],
      duration,
      availableQualities: this.supportedQualities,
      thumbnail
    };
  }

  private parseDurationText(text: string): number {
    // Parse "3:45" or "1:23:45" format
    const parts = text.split(':').map(p => parseInt(p, 10));

    if (parts.length === 2) {
      return (parts[0]! * 60) + parts[1]!;
    } else if (parts.length === 3) {
      return (parts[0]! * 3600) + (parts[1]! * 60) + parts[2]!;
    }

    return 0;
  }

  private mapMimeType(mimeType: string): StreamInfo['format'] {
    if (mimeType.includes('opus')) return 'opus';
    if (mimeType.includes('mp4')) return 'mp4';
    if (mimeType.includes('webm')) return 'webm';
    if (mimeType.includes('mp3')) return 'mp3';
    if (mimeType.includes('aac')) return 'aac';
    return 'mp4';
  }
}

// Default export for addon loading
export default YouTubeMusicProvider;
