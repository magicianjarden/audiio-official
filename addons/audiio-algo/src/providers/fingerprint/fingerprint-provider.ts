/**
 * Fingerprint Provider - Audio fingerprinting using Chromaprint
 *
 * Generates audio fingerprints for track identification and duplicate detection.
 */

import type { DuplicateResult, TrackMatch, Track, MLCoreEndpoints } from '@audiio/ml-sdk';
import { MemoryCache } from '@audiio/ml-sdk';

// Chromaprint WASM will be loaded dynamically
interface ChromaprintInstance {
  fingerprint: (audioData: Float32Array, sampleRate: number) => string;
  compare: (fp1: string, fp2: string) => number;
}

export class FingerprintProvider {
  private chromaprint: ChromaprintInstance | null = null;
  private endpoints!: MLCoreEndpoints;
  private fingerprintIndex: Map<string, { fingerprint: string; trackId: string }> = new Map();
  private cache: MemoryCache<string>;
  private isLoading = false;

  constructor() {
    this.cache = new MemoryCache<string>(5000, 24 * 60 * 60 * 1000); // 24 hour cache
  }

  /**
   * Initialize the fingerprint provider
   */
  async initialize(endpoints: MLCoreEndpoints): Promise<void> {
    this.endpoints = endpoints;

    // Load fingerprint index from storage
    const savedIndex = await endpoints.storage.get<Array<[string, { fingerprint: string; trackId: string }]>>('fingerprint-index');
    if (savedIndex) {
      this.fingerprintIndex = new Map(savedIndex);
      console.log(`[FingerprintProvider] Loaded ${this.fingerprintIndex.size} fingerprints`);
    }
  }

  /**
   * Load Chromaprint WASM
   */
  private async loadChromaprint(): Promise<void> {
    if (this.chromaprint) return;
    if (this.isLoading) return;

    this.isLoading = true;

    try {
      // In production, this would load the actual Chromaprint WASM module
      // For now, we'll use a simplified fingerprinting approach
      this.chromaprint = {
        fingerprint: this.generateSimpleFingerprint.bind(this),
        compare: this.compareFingerprints.bind(this),
      };
      console.log('[FingerprintProvider] Fingerprinting ready');
    } catch (error) {
      console.error('[FingerprintProvider] Failed to load Chromaprint:', error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    // Save fingerprint index
    await this.endpoints.storage.set(
      'fingerprint-index',
      Array.from(this.fingerprintIndex.entries())
    );
    this.cache.clear();
  }

  /**
   * Generate fingerprint for audio file
   */
  async generateFingerprint(filePath: string): Promise<string | null> {
    await this.loadChromaprint();
    if (!this.chromaprint) return null;

    // In production, this would read and decode the audio file
    // For now, return a placeholder
    console.log(`[FingerprintProvider] Would generate fingerprint for: ${filePath}`);
    return null;
  }

  /**
   * Generate fingerprint from audio buffer
   */
  async generateFingerprintFromBuffer(
    buffer: ArrayBuffer,
    sampleRate: number
  ): Promise<string | null> {
    await this.loadChromaprint();
    if (!this.chromaprint) return null;

    const audioData = new Float32Array(buffer);
    return this.chromaprint.fingerprint(audioData, sampleRate);
  }

  /**
   * Index tracks for duplicate detection
   */
  async indexTracks(tracks: Track[]): Promise<void> {
    console.log(`[FingerprintProvider] Indexing ${tracks.length} tracks...`);

    for (const track of tracks) {
      // In production, would generate fingerprint from audio file
      // For now, create a pseudo-fingerprint from metadata
      const pseudoFingerprint = this.createPseudoFingerprint(track);
      this.fingerprintIndex.set(track.id, {
        fingerprint: pseudoFingerprint,
        trackId: track.id,
      });
    }

    // Save index
    await this.endpoints.storage.set(
      'fingerprint-index',
      Array.from(this.fingerprintIndex.entries())
    );

    console.log(`[FingerprintProvider] Indexed ${tracks.length} tracks`);
  }

  /**
   * Find duplicates in library
   */
  async findDuplicates(): Promise<DuplicateResult[]> {
    const duplicates: DuplicateResult[] = [];
    const entries = Array.from(this.fingerprintIndex.values());

    // Compare all pairs
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const similarity = this.compareFingerprints(
          entries[i].fingerprint,
          entries[j].fingerprint
        );

        if (similarity > 0.9) {
          duplicates.push({
            originalId: entries[i].trackId,
            duplicateId: entries[j].trackId,
            confidence: similarity,
            type: similarity > 0.99 ? 'exact' : 'similar',
          });
        }
      }
    }

    return duplicates;
  }

  /**
   * Identify track from fingerprint
   */
  async identify(filePath: string): Promise<TrackMatch[]> {
    const fingerprint = await this.generateFingerprint(filePath);
    if (!fingerprint) return [];

    return this.searchByFingerprint(fingerprint);
  }

  /**
   * Search library by fingerprint
   */
  private searchByFingerprint(fingerprint: string): TrackMatch[] {
    const matches: TrackMatch[] = [];

    for (const entry of this.fingerprintIndex.values()) {
      const similarity = this.compareFingerprints(fingerprint, entry.fingerprint);

      if (similarity > 0.7) {
        // Would need to fetch full track info
        matches.push({
          track: { id: entry.trackId, title: '', artist: '', duration: 0 },
          confidence: similarity,
          matchType: 'fingerprint',
        });
      }
    }

    return matches.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
  }

  /**
   * Generate simple fingerprint (placeholder for real Chromaprint)
   */
  private generateSimpleFingerprint(audioData: Float32Array, sampleRate: number): string {
    // Simple spectral fingerprint
    const chunkSize = Math.floor(sampleRate * 0.1); // 100ms chunks
    const numChunks = Math.min(30, Math.floor(audioData.length / chunkSize));
    const fingerprint: number[] = [];

    for (let i = 0; i < numChunks; i++) {
      const start = i * chunkSize;
      const chunk = audioData.slice(start, start + chunkSize);

      // Compute energy
      let energy = 0;
      for (let j = 0; j < chunk.length; j++) {
        energy += chunk[j] * chunk[j];
      }
      energy = Math.sqrt(energy / chunk.length);

      // Compute zero crossing rate
      let zcr = 0;
      for (let j = 1; j < chunk.length; j++) {
        if ((chunk[j] >= 0) !== (chunk[j - 1] >= 0)) {
          zcr++;
        }
      }
      zcr /= chunk.length;

      // Encode as bytes
      fingerprint.push(Math.floor(energy * 255));
      fingerprint.push(Math.floor(zcr * 255));
    }

    // Convert to base64
    return btoa(String.fromCharCode(...fingerprint));
  }

  /**
   * Compare two fingerprints
   */
  private compareFingerprints(fp1: string, fp2: string): number {
    try {
      const bytes1 = atob(fp1).split('').map(c => c.charCodeAt(0));
      const bytes2 = atob(fp2).split('').map(c => c.charCodeAt(0));

      const minLength = Math.min(bytes1.length, bytes2.length);
      if (minLength === 0) return 0;

      let sumDiff = 0;
      for (let i = 0; i < minLength; i++) {
        sumDiff += Math.abs(bytes1[i] - bytes2[i]);
      }

      // Normalize to 0-1 similarity
      const avgDiff = sumDiff / minLength;
      return 1 - avgDiff / 255;
    } catch {
      return 0;
    }
  }

  /**
   * Create pseudo-fingerprint from metadata
   */
  private createPseudoFingerprint(track: Track): string {
    // Create a fingerprint-like hash from metadata
    const str = `${track.title}|${track.artist}|${track.duration}`;
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }

    // Convert to base64-like string
    return btoa(String.fromCharCode(
      (hash >> 0) & 255,
      (hash >> 8) & 255,
      (hash >> 16) & 255,
      (hash >> 24) & 255,
    ));
  }
}
