/**
 * Library Service
 *
 * Orchestrates library operations with plugin support.
 * - Emits events that library hooks can subscribe to
 * - Routes enrichment/artwork/fingerprint requests to appropriate plugins
 * - Manages smart playlists with plugin-provided rule types
 * - Handles import/export through registered plugins
 *
 * STATUS: NOT CURRENTLY INTEGRATED
 * ================================
 * This service is designed to wrap LibraryDatabase and provide:
 * 1. Event emission for library hooks (track:liked, track:played, etc.)
 * 2. Plugin orchestration for metadata enrichment, artwork, fingerprinting
 * 3. Smart playlist evaluation with plugin-provided rules
 * 4. Import/export through registered plugins
 *
 * To integrate this service into standalone-server.ts:
 * 1. Instantiate LibraryService with libraryDb and registry
 * 2. Replace direct libraryDb calls with LibraryService methods
 * 3. Library hooks will automatically receive events
 *
 * This enables features like:
 * - Scrobbling (Last.fm, ListenBrainz) via track:played events
 * - Real-time sync notifications for mobile clients
 * - Plugin-based metadata auto-tagging
 * - Audio fingerprint identification (AcoustID)
 */

import { EventEmitter } from 'events';
import type {
  AddonRegistry,
  LibraryEventType,
  LibraryEvent,
  MetadataEnrichmentQuery,
  MetadataEnrichmentResult,
  ArtworkResult,
  FingerprintResult,
  ISRCLookupResult,
  TrackAnalytics,
  SmartPlaylistRuleDefinition,
  DuplicateCandidate,
  ImportResult,
  MetadataTrack
} from '@audiio/core';
import type {
  LibraryDatabase,
  Track,
  Playlist,
  SmartPlaylist,
  SmartPlaylistRule,
  PlaylistFolder
} from './library-db';

// Re-export types for convenience
export type { SmartPlaylist, SmartPlaylistRule, PlaylistFolder } from './library-db';

// ============================================
// Built-in Smart Playlist Rules
// ============================================

const BUILT_IN_RULES: SmartPlaylistRuleDefinition[] = [
  // Metadata rules
  {
    field: 'title',
    label: 'Title',
    type: 'string',
    category: 'metadata',
    operators: [
      { id: 'contains', label: 'contains' },
      { id: 'not_contains', label: 'does not contain' },
      { id: 'is', label: 'is' },
      { id: 'is_not', label: 'is not' },
      { id: 'starts_with', label: 'starts with' },
      { id: 'ends_with', label: 'ends with' }
    ]
  },
  {
    field: 'artist',
    label: 'Artist',
    type: 'string',
    category: 'metadata',
    operators: [
      { id: 'contains', label: 'contains' },
      { id: 'not_contains', label: 'does not contain' },
      { id: 'is', label: 'is' },
      { id: 'is_not', label: 'is not' }
    ]
  },
  {
    field: 'album',
    label: 'Album',
    type: 'string',
    category: 'metadata',
    operators: [
      { id: 'contains', label: 'contains' },
      { id: 'not_contains', label: 'does not contain' },
      { id: 'is', label: 'is' },
      { id: 'is_not', label: 'is not' }
    ]
  },
  {
    field: 'genre',
    label: 'Genre',
    type: 'string',
    category: 'metadata',
    operators: [
      { id: 'contains', label: 'contains' },
      { id: 'is', label: 'is' }
    ]
  },
  {
    field: 'year',
    label: 'Year',
    type: 'number',
    category: 'metadata',
    operators: [
      { id: 'is', label: 'is' },
      { id: 'is_not', label: 'is not' },
      { id: 'gt', label: 'greater than' },
      { id: 'lt', label: 'less than' },
      { id: 'between', label: 'between' }
    ]
  },
  {
    field: 'duration',
    label: 'Duration',
    type: 'duration',
    category: 'metadata',
    operators: [
      { id: 'gt', label: 'longer than' },
      { id: 'lt', label: 'shorter than' },
      { id: 'between', label: 'between' }
    ]
  },
  // Library rules
  {
    field: 'addedAt',
    label: 'Date Added',
    type: 'date',
    category: 'library',
    operators: [
      { id: 'in_last', label: 'in the last' },
      { id: 'not_in_last', label: 'not in the last' },
      { id: 'before', label: 'before' },
      { id: 'after', label: 'after' }
    ]
  },
  {
    field: 'isLiked',
    label: 'Liked',
    type: 'boolean',
    category: 'library',
    operators: [
      { id: 'is', label: 'is' }
    ]
  },
  // Playback rules
  {
    field: 'playCount',
    label: 'Play Count',
    type: 'number',
    category: 'playback',
    operators: [
      { id: 'is', label: 'is' },
      { id: 'gt', label: 'greater than' },
      { id: 'lt', label: 'less than' }
    ]
  },
  {
    field: 'lastPlayed',
    label: 'Last Played',
    type: 'date',
    category: 'playback',
    operators: [
      { id: 'in_last', label: 'in the last' },
      { id: 'not_in_last', label: 'not in the last' },
      { id: 'never', label: 'never' }
    ]
  },
  {
    field: 'skipCount',
    label: 'Skip Count',
    type: 'number',
    category: 'playback',
    operators: [
      { id: 'is', label: 'is' },
      { id: 'gt', label: 'greater than' },
      { id: 'lt', label: 'less than' }
    ]
  }
];

// ============================================
// Library Service
// ============================================

export class LibraryService extends EventEmitter {
  constructor(
    private db: LibraryDatabase,
    private registry: AddonRegistry
  ) {
    super();
  }

  // ============================================
  // Event Emission
  // ============================================

  /**
   * Emit a library event to all subscribed hooks
   */
  async emitLibraryEvent<T = unknown>(type: LibraryEventType, data: T): Promise<void> {
    const event: LibraryEvent<T> = {
      type,
      timestamp: new Date(),
      data
    };

    // Emit to internal listeners
    this.emit(type, event);
    this.emit('library-event', event);

    // Dispatch to registered library hooks
    const hooks = this.registry.getLibraryHooksForEvent(type);

    // Fire and forget - don't block on hook processing
    for (const hook of hooks) {
      hook.onEvent(event).catch(err => {
        console.error(`[LibraryService] Hook ${hook.id} error:`, err);
      });
    }
  }

  // ============================================
  // Enrichment (via plugins)
  // ============================================

  /**
   * Enrich track metadata using registered enrichers
   * Tries each enricher in priority order until one succeeds
   */
  async enrichTrack(query: MetadataEnrichmentQuery): Promise<MetadataEnrichmentResult | null> {
    const enrichers = this.registry.getMetadataEnrichers();

    if (enrichers.length === 0) {
      console.log('[LibraryService] No metadata enrichers registered');
      return null;
    }

    for (const enricher of enrichers) {
      try {
        // Check if enricher can handle this query
        if (enricher.canHandle && !enricher.canHandle(query)) {
          continue;
        }

        const result = await enricher.enrichTrack(query);
        if (result && result.confidence > 0.7) {
          console.log(`[LibraryService] Enriched via ${enricher.id} (confidence: ${result.confidence})`);
          return result;
        }
      } catch (err) {
        console.warn(`[LibraryService] Enricher ${enricher.id} failed:`, err);
      }
    }

    return null;
  }

  /**
   * Batch enrich multiple tracks
   */
  async enrichTracks(queries: Array<MetadataEnrichmentQuery & { id: string }>): Promise<Map<string, MetadataEnrichmentResult>> {
    const results = new Map<string, MetadataEnrichmentResult>();
    const enrichers = this.registry.getMetadataEnrichers();

    // Try batch enrichment first if available
    for (const enricher of enrichers) {
      if (enricher.enrichBatch) {
        try {
          const remaining = queries.filter(q => !results.has(q.id));
          if (remaining.length === 0) break;

          const batchResults = await enricher.enrichBatch(remaining);
          for (const [id, result] of batchResults) {
            if (result.confidence > 0.7) {
              results.set(id, result);
            }
          }
        } catch (err) {
          console.warn(`[LibraryService] Batch enricher ${enricher.id} failed:`, err);
        }
      }
    }

    // Fall back to individual enrichment for remaining
    for (const query of queries) {
      if (!results.has(query.id)) {
        const result = await this.enrichTrack(query);
        if (result) {
          results.set(query.id, result);
        }
      }
    }

    return results;
  }

  // ============================================
  // Artwork (via plugins)
  // ============================================

  /**
   * Fetch artwork for an album using registered artwork providers
   */
  async fetchAlbumArtwork(artist: string, album: string, mbid?: string): Promise<ArtworkResult | null> {
    const providers = this.registry.getArtworkProviders();

    if (providers.length === 0) {
      console.log('[LibraryService] No artwork providers registered');
      return null;
    }

    for (const provider of providers) {
      try {
        const result = await provider.getAlbumArtwork({ artist, album, mbid });
        if (result?.images.front || result?.thumbnails.medium) {
          console.log(`[LibraryService] Got artwork from ${provider.id}`);
          return result;
        }
      } catch (err) {
        console.warn(`[LibraryService] Artwork provider ${provider.id} failed:`, err);
      }
    }

    return null;
  }

  /**
   * Fetch artwork for an artist
   */
  async fetchArtistArtwork(artistName: string, mbid?: string): Promise<{
    photos: string[];
    logos?: string[];
    backgrounds?: string[];
    banners?: string[];
  } | null> {
    const providers = this.registry.getArtworkProviders();

    for (const provider of providers) {
      if (!provider.getArtistArtwork) continue;

      try {
        const result = await provider.getArtistArtwork(artistName, mbid);
        if (result && result.photos.length > 0) {
          return result;
        }
      } catch (err) {
        console.warn(`[LibraryService] Artist artwork provider ${provider.id} failed:`, err);
      }
    }

    return null;
  }

  // ============================================
  // Fingerprinting (via plugins)
  // ============================================

  /**
   * Check if fingerprinting is available
   */
  async isFingerprintingAvailable(): Promise<boolean> {
    const provider = this.registry.getFingerprintProvider();
    if (!provider) return false;

    try {
      return await provider.isAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Identify a track by audio fingerprint
   */
  async identifyTrack(filePath: string): Promise<FingerprintResult | null> {
    const provider = this.registry.getFingerprintProvider();
    if (!provider) {
      console.log('[LibraryService] No fingerprint provider registered');
      return null;
    }

    try {
      const isAvailable = await provider.isAvailable();
      if (!isAvailable) {
        console.log('[LibraryService] Fingerprint provider not available');
        return null;
      }

      return await provider.identifyTrack(filePath);
    } catch (err) {
      console.error('[LibraryService] Fingerprint identification failed:', err);
      return null;
    }
  }

  /**
   * Generate fingerprint without lookup
   */
  async generateFingerprint(filePath: string): Promise<{ fingerprint: string; duration: number } | null> {
    const provider = this.registry.getFingerprintProvider();
    if (!provider) return null;

    try {
      return await provider.generateFingerprint(filePath);
    } catch (err) {
      console.error('[LibraryService] Fingerprint generation failed:', err);
      return null;
    }
  }

  // ============================================
  // ISRC Resolution (via plugins)
  // ============================================

  /**
   * Lookup track by ISRC
   */
  async lookupISRC(isrc: string): Promise<ISRCLookupResult | null> {
    const resolvers = this.registry.getISRCResolvers();

    for (const resolver of resolvers) {
      try {
        const result = await resolver.lookupISRC(isrc);
        if (result) {
          return result;
        }
      } catch (err) {
        console.warn(`[LibraryService] ISRC resolver ${resolver.id} failed:`, err);
      }
    }

    return null;
  }

  /**
   * Find ISRC for a track by metadata
   */
  async findISRC(title: string, artist: string, album?: string): Promise<string | null> {
    const resolvers = this.registry.getISRCResolvers();

    for (const resolver of resolvers) {
      if (!resolver.findISRC) continue;

      try {
        const isrc = await resolver.findISRC({ title, artist, album });
        if (isrc) {
          return isrc;
        }
      } catch (err) {
        console.warn(`[LibraryService] ISRC finder ${resolver.id} failed:`, err);
      }
    }

    return null;
  }

  // ============================================
  // Analytics (via plugins)
  // ============================================

  /**
   * Get analytics for a track (requires analytics plugin)
   */
  async getTrackAnalytics(query: {
    isrc?: string;
    spotifyId?: string;
    title?: string;
    artist?: string;
  }): Promise<TrackAnalytics | null> {
    const providers = this.registry.getAnalyticsProviders();

    if (providers.length === 0) {
      return null;
    }

    for (const provider of providers) {
      try {
        const result = await provider.getTrackAnalytics(query);
        if (result) {
          return result;
        }
      } catch (err) {
        console.warn(`[LibraryService] Analytics provider ${provider.id} failed:`, err);
      }
    }

    return null;
  }

  // ============================================
  // Smart Playlists
  // ============================================

  /**
   * Get all available smart playlist rule definitions
   * Combines built-in rules with plugin-provided rules
   */
  getSmartPlaylistRuleDefinitions(): SmartPlaylistRuleDefinition[] {
    const providers = this.registry.getSmartPlaylistRulesProviders();
    const customRules = providers.flatMap(p => p.getRuleDefinitions());

    return [...BUILT_IN_RULES, ...customRules];
  }

  /**
   * Evaluate a smart playlist and return matching track IDs
   * Uses the database's evaluation engine for built-in rules
   * Plugin-provided rules are evaluated separately
   */
  async evaluateSmartPlaylist(playlist: SmartPlaylist): Promise<string[]> {
    console.log('[LibraryService] Evaluating smart playlist:', playlist.name);

    // Separate built-in rules from plugin rules
    const builtInRules = playlist.rules.filter(r => !r.pluginId);
    const pluginRules = playlist.rules.filter(r => r.pluginId);

    // Get matching track IDs from built-in rules via database
    let trackIds = this.db.evaluateSmartPlaylistRules(
      builtInRules,
      playlist.combinator,
      playlist.orderBy,
      playlist.orderDirection,
      playlist.limit
    );

    // If there are plugin rules, apply them as post-filters
    if (pluginRules.length > 0 && trackIds.length > 0) {
      const providers = this.registry.getSmartPlaylistRulesProviders();

      for (const rule of pluginRules) {
        const provider = providers.find(p => p.id === rule.pluginId);
        if (provider?.evaluateRule) {
          // Filter track IDs through plugin evaluator
          const passedIds = new Set<string>();
          for (const trackId of trackIds) {
            try {
              const passed = await provider.evaluateRule(rule, trackId);
              if (passed) {
                passedIds.add(trackId);
              }
            } catch (err) {
              console.warn(`[LibraryService] Plugin rule evaluation failed:`, err);
            }
          }

          if (playlist.combinator === 'and') {
            // For AND, keep only tracks that passed plugin rule
            trackIds = trackIds.filter(id => passedIds.has(id));
          } else {
            // For OR, add tracks that passed plugin rule
            trackIds = [...new Set([...trackIds, ...passedIds])];
          }
        }
      }
    }

    return trackIds;
  }

  /**
   * Get smart playlist with evaluated tracks
   */
  async getSmartPlaylistWithTracks(playlistId: string): Promise<{
    playlist: SmartPlaylist;
    trackIds: string[];
    evaluatedAt: number;
  } | null> {
    const playlist = this.db.getSmartPlaylist(playlistId);
    if (!playlist) return null;

    const trackIds = await this.evaluateSmartPlaylist(playlist);
    const evaluatedAt = Date.now();

    // Update the playlist with evaluation metadata
    this.db.updateSmartPlaylist(playlistId, {
      lastEvaluated: evaluatedAt,
      trackCount: trackIds.length
    });

    return { playlist, trackIds, evaluatedAt };
  }

  // ============================================
  // Duplicate Detection (via plugins)
  // ============================================

  /**
   * Scan library for duplicates
   */
  async* findDuplicates(options?: {
    threshold?: number;
    useFingerprint?: boolean;
    useMetadata?: boolean;
    folderId?: string;
  }): AsyncGenerator<DuplicateCandidate, void, unknown> {
    const detector = this.registry.getDuplicateDetector();

    if (!detector) {
      console.log('[LibraryService] No duplicate detector registered');
      return;
    }

    yield* detector.findDuplicates(options);
  }

  // ============================================
  // Import/Export (via plugins)
  // ============================================

  /**
   * Get available import providers
   */
  getImportProviders(): Array<{ id: string; name: string; type: 'file' | 'url' | 'service'; formats?: string[] }> {
    return this.registry.getImportProviders().map(p => ({
      id: p.id,
      name: p.name,
      type: p.source.type,
      formats: p.source.formats
    }));
  }

  /**
   * Import from a file using the appropriate provider
   */
  async importFile(providerId: string, filePath: string, options?: {
    targetPlaylist?: string;
    createPlaylist?: boolean;
    matchStrategy?: 'exact' | 'fuzzy' | 'fingerprint';
  }): Promise<ImportResult> {
    const provider = this.registry.getImportProvider(providerId);

    if (!provider?.importFile) {
      throw new Error(`Import provider ${providerId} not found or doesn't support file import`);
    }

    const result = await provider.importFile(filePath, options);

    // Emit import completed event
    await this.emitLibraryEvent('import:completed', {
      providerId,
      filePath,
      result
    });

    return result;
  }

  /**
   * Get available export formats
   */
  getExportFormats(): Array<{ providerId: string; format: string; extension: string; name: string }> {
    return this.registry.getExportProviders().flatMap(p =>
      p.formats.map(f => ({
        providerId: p.id,
        format: f.id,
        extension: f.extension,
        name: f.name
      }))
    );
  }

  /**
   * Export a playlist
   */
  async exportPlaylist(playlistId: string, providerId: string, format: string, options?: {
    includeMetadata?: boolean;
    relativePaths?: boolean;
  }): Promise<{ filename: string; content: string | Buffer; mimeType: string }> {
    const provider = this.registry.getExportProvider(providerId);

    if (!provider) {
      throw new Error(`Export provider ${providerId} not found`);
    }

    const result = await provider.exportPlaylist(playlistId, format, options);

    // Emit export completed event
    await this.emitLibraryEvent('export:completed', {
      providerId,
      playlistId,
      format
    });

    return result;
  }

  // ============================================
  // Library Operations (with events)
  // ============================================

  /**
   * Like a track and emit event
   */
  async likeTrack(track: Track): Promise<void> {
    this.db.likeTrack(track);
    await this.emitLibraryEvent('track:liked', { track });
  }

  /**
   * Unlike a track and emit event
   */
  async unlikeTrack(trackId: string): Promise<void> {
    this.db.unlikeTrack(trackId);
    await this.emitLibraryEvent('track:unliked', { trackId });
  }

  /**
   * Dislike a track and emit event
   */
  async dislikeTrack(track: Track, reasons: string[] = []): Promise<void> {
    this.db.dislikeTrack(track, reasons);
    await this.emitLibraryEvent('track:disliked', { track, reasons });
  }

  /**
   * Create a playlist and emit event
   */
  async createPlaylist(name: string, description?: string): Promise<Playlist> {
    const playlist = this.db.createPlaylist(name, description);
    await this.emitLibraryEvent('playlist:created', { playlist });
    return playlist;
  }

  /**
   * Delete a playlist and emit event
   */
  async deletePlaylist(playlistId: string): Promise<void> {
    this.db.deletePlaylist(playlistId);
    await this.emitLibraryEvent('playlist:deleted', { playlistId });
  }

  /**
   * Add track to playlist and emit event
   */
  async addToPlaylist(playlistId: string, track: Track): Promise<void> {
    this.db.addToPlaylist(playlistId, track);
    await this.emitLibraryEvent('playlist:tracks-added', { playlistId, tracks: [track] });
  }

  /**
   * Remove track from playlist and emit event
   */
  async removeFromPlaylist(playlistId: string, trackId: string): Promise<void> {
    this.db.removeFromPlaylist(playlistId, trackId);
    await this.emitLibraryEvent('playlist:tracks-removed', { playlistId, trackIds: [trackId] });
  }

  /**
   * Record a play and emit event
   */
  async recordPlay(track: Track, duration: number = 0): Promise<void> {
    this.db.recordPlay(track, duration);
    await this.emitLibraryEvent('track:played', { track, duration });
  }
}
