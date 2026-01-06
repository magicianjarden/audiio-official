/**
 * Feature Store - Persistent storage for audio analysis features
 *
 * Wraps NodeStorage to provide typed, efficient access to audio features,
 * genre predictions, and embeddings. Features survive server restarts.
 */

import type { AudioFeatures, EmotionFeatures, GenreFeatures, LyricsFeatures } from '../types';

export interface StoredFeatures {
    trackId: string;
    audio?: AudioFeatures;
    emotion?: EmotionFeatures;
    genre?: GenreFeatures;
    lyrics?: LyricsFeatures;
    embedding?: number[];
    lastUpdated: number;
    analysisVersion: number; // Increment when analysis algorithms change
}

const CURRENT_ANALYSIS_VERSION = 2; // Increment when upgrading analysis

export interface FeatureStoreAdapter {
    get<T>(key: string): T | null;
    set<T>(key: string, value: T): void;
    persist(): void;
}

export class FeatureStore {
    private storage: FeatureStoreAdapter;
    private memoryCache: Map<string, StoredFeatures> = new Map();
    private dirty: Set<string> = new Set();
    private persistTimeout: NodeJS.Timeout | null = null;

    constructor(storage: FeatureStoreAdapter) {
        this.storage = storage;
        this.loadIndex();
    }

    /**
     * Load the feature index from storage
     */
    private loadIndex(): void {
        const index = this.storage.get<string[]>('feature-index');
        if (index) {
            console.log(`[FeatureStore] Found ${index.length} cached feature entries`);
            // We'll load individual features on-demand to save memory
        }
    }

    /**
     * Get stored features for a track
     */
    get(trackId: string): StoredFeatures | null {
        // Check memory cache first
        if (this.memoryCache.has(trackId)) {
            return this.memoryCache.get(trackId)!;
        }

        // Load from storage
        const stored = this.storage.get<StoredFeatures>(`feature:${trackId}`);
        if (stored) {
            // Check if analysis is outdated
            if (stored.analysisVersion < CURRENT_ANALYSIS_VERSION) {
                console.log(`[FeatureStore] Outdated analysis for ${trackId}, will re-analyze`);
                return null;
            }
            this.memoryCache.set(trackId, stored);
            return stored;
        }

        return null;
    }

    /**
     * Get audio features for a track
     */
    getAudio(trackId: string): AudioFeatures | null {
        return this.get(trackId)?.audio ?? null;
    }

    /**
     * Get genre features for a track
     */
    getGenre(trackId: string): GenreFeatures | null {
        return this.get(trackId)?.genre ?? null;
    }

    /**
     * Get emotion features for a track
     */
    getEmotion(trackId: string): EmotionFeatures | null {
        return this.get(trackId)?.emotion ?? null;
    }

    /**
     * Get embedding for a track
     */
    getEmbedding(trackId: string): number[] | null {
        return this.get(trackId)?.embedding ?? null;
    }

    /**
     * Store features for a track (merges with existing)
     */
    set(trackId: string, features: Partial<StoredFeatures>): void {
        const existing = this.get(trackId) || {
            trackId,
            lastUpdated: Date.now(),
            analysisVersion: CURRENT_ANALYSIS_VERSION,
        };

        const updated: StoredFeatures = {
            ...existing,
            ...features,
            trackId,
            lastUpdated: Date.now(),
            analysisVersion: CURRENT_ANALYSIS_VERSION,
        };

        this.memoryCache.set(trackId, updated);
        this.dirty.add(trackId);
        this.schedulePersist();
    }

    /**
     * Store audio features
     */
    setAudio(trackId: string, audio: AudioFeatures): void {
        this.set(trackId, { audio });
    }

    /**
     * Store genre features
     */
    setGenre(trackId: string, genre: GenreFeatures): void {
        this.set(trackId, { genre });
    }

    /**
     * Store emotion features
     */
    setEmotion(trackId: string, emotion: EmotionFeatures): void {
        this.set(trackId, { emotion });
    }

    /**
     * Store embedding
     */
    setEmbedding(trackId: string, embedding: number[]): void {
        this.set(trackId, { embedding });
    }

    /**
     * Check if we have fresh features for a track
     */
    hasValidFeatures(trackId: string): boolean {
        const stored = this.get(trackId);
        return stored !== null && stored.analysisVersion >= CURRENT_ANALYSIS_VERSION;
    }

    /**
     * Schedule a persist operation
     */
    private schedulePersist(): void {
        if (this.persistTimeout) {
            clearTimeout(this.persistTimeout);
        }

        this.persistTimeout = setTimeout(() => {
            this.persist();
        }, 2000); // Debounce by 2 seconds
    }

    /**
     * Persist dirty entries to storage
     */
    persist(): void {
        if (this.dirty.size === 0) return;

        console.log(`[FeatureStore] Persisting ${this.dirty.size} feature entries...`);

        for (const trackId of this.dirty) {
            const features = this.memoryCache.get(trackId);
            if (features) {
                this.storage.set(`feature:${trackId}`, features);
            }
        }

        // Update index
        const allTrackIds = Array.from(this.memoryCache.keys());
        this.storage.set('feature-index', allTrackIds);

        this.storage.persist();
        this.dirty.clear();

        console.log(`[FeatureStore] Persisted. Total cached: ${allTrackIds.length}`);
    }

    /**
     * Get statistics
     */
    getStats(): { cached: number; dirty: number } {
        return {
            cached: this.memoryCache.size,
            dirty: this.dirty.size,
        };
    }

    /**
     * Dispose and persist
     */
    dispose(): void {
        if (this.persistTimeout) {
            clearTimeout(this.persistTimeout);
        }
        this.persist();
    }
}
