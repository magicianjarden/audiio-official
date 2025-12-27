/**
 * Base class for audio processors (karaoke, stem separation, etc.)
 */

import type {
  AddonManifest,
  AudioProcessor,
  AudioProcessorResult
} from '@audiio/core';

export abstract class BaseAudioProcessor implements AudioProcessor {
  abstract readonly id: string;
  abstract readonly name: string;

  get manifest(): AddonManifest {
    return {
      id: this.id,
      name: this.name,
      version: '1.0.0',
      roles: ['audio-processor']
    };
  }

  async initialize(): Promise<void> {
    // Override in subclass if needed
  }

  async dispose(): Promise<void> {
    // Override in subclass if needed
  }

  abstract isAvailable(): Promise<boolean>;
  abstract processTrack(trackId: string, audioUrl: string): Promise<AudioProcessorResult>;
  abstract hasCached(trackId: string): Promise<boolean>;
  abstract getCached(trackId: string): Promise<AudioProcessorResult | null>;
  abstract clearCache(trackId: string): Promise<void>;
}
