# Audio Processor

Build addons that process audio in real-time or offline, such as karaoke mode or stem separation.

## Overview

Audio processors transform audio:

- **Karaoke** - Remove or reduce vocals
- **Stem separation** - Isolate drums, bass, vocals, other
- **Effects** - EQ, reverb, pitch shifting
- **Enhancement** - Noise reduction, upscaling

## Interface

```typescript
interface AudioProcessor {
  // Process audio
  process(input: AudioInput): Promise<AudioOutput>;

  // Get processing capabilities
  getCapabilities(): ProcessingCapability[];

  // Check if processor can handle format
  canProcess?(input: AudioInput): boolean;

  // Cancel ongoing processing
  cancel?(jobId: string): Promise<void>;

  // Get processing status
  getStatus?(jobId: string): Promise<ProcessingStatus>;
}

interface AudioInput {
  url: string;                    // Audio source URL
  format: 'mp3' | 'wav' | 'flac' | 'aac';
  duration: number;               // Duration in seconds
  trackId?: string;               // For caching
}

interface AudioOutput {
  stems?: {
    vocals?: string;              // URL to vocals stem
    drums?: string;               // URL to drums stem
    bass?: string;                // URL to bass stem
    other?: string;               // URL to other stem
    instrumental?: string;        // URL to instrumental mix
  };
  processed?: string;             // URL to processed audio
  jobId?: string;                 // For status tracking
  cached?: boolean;               // Was result cached
}

interface ProcessingCapability {
  id: string;
  name: string;
  description: string;
  realtime: boolean;              // Supports real-time processing
  offline: boolean;               // Supports offline processing
}

interface ProcessingStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;              // 0-100
  message?: string;
  result?: AudioOutput;
  error?: string;
}
```

## Basic Implementation

```typescript
import { BaseAddon, AudioProcessor, AudioInput, AudioOutput, ProcessingCapability } from '@audiio/sdk';

export default class KaraokeProcessor extends BaseAddon implements AudioProcessor {
  static manifest = {
    id: 'karaoke-processor',
    name: 'Karaoke Processor',
    version: '1.0.0',
    roles: ['audio-processor'],
    settings: [
      {
        key: 'serverUrl',
        type: 'string',
        label: 'Demucs Server URL',
        description: 'URL of the Demucs processing server',
        default: 'http://localhost:8000',
      },
      {
        key: 'quality',
        type: 'select',
        label: 'Processing Quality',
        options: [
          { value: 'fast', label: 'Fast (lower quality)' },
          { value: 'balanced', label: 'Balanced' },
          { value: 'high', label: 'High (slower)' },
        ],
        default: 'balanced',
      },
    ],
  };

  private serverUrl: string = '';

  async initialize(): Promise<void> {
    this.serverUrl = this.getSetting<string>('serverUrl') || 'http://localhost:8000';

    // Check server connectivity
    try {
      await this.fetch(`${this.serverUrl}/health`);
      this.log.info('Connected to Demucs server');
    } catch (error) {
      this.log.warn('Demucs server not available');
    }
  }

  getCapabilities(): ProcessingCapability[] {
    return [
      {
        id: 'vocal-removal',
        name: 'Vocal Removal',
        description: 'Remove vocals for karaoke',
        realtime: false,
        offline: true,
      },
      {
        id: 'stem-separation',
        name: 'Stem Separation',
        description: 'Separate into vocals, drums, bass, other',
        realtime: false,
        offline: true,
      },
    ];
  }

  async process(input: AudioInput): Promise<AudioOutput> {
    // Check cache first
    if (input.trackId) {
      const cached = await this.getCachedResult(input.trackId);
      if (cached) {
        return { ...cached, cached: true };
      }
    }

    const quality = this.getSetting<string>('quality') || 'balanced';

    // Submit processing job
    const response = await this.fetch(`${this.serverUrl}/process`, {
      method: 'POST',
      body: JSON.stringify({
        url: input.url,
        model: this.getModelForQuality(quality),
      }),
    });

    const jobId = response.job_id;

    // Poll for completion
    const result = await this.waitForCompletion(jobId);

    // Cache result
    if (input.trackId && result.stems) {
      await this.cacheResult(input.trackId, result);
    }

    return result;
  }

  private getModelForQuality(quality: string): string {
    const models: Record<string, string> = {
      fast: 'htdemucs_ft',
      balanced: 'htdemucs',
      high: 'htdemucs_6s',
    };
    return models[quality] || 'htdemucs';
  }

  private async waitForCompletion(jobId: string, maxWait = 300000): Promise<AudioOutput> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const status = await this.getStatus(jobId);

      if (status.status === 'completed' && status.result) {
        return status.result;
      }

      if (status.status === 'failed') {
        throw new Error(status.error || 'Processing failed');
      }

      // Wait before polling again
      await this.sleep(2000);
    }

    throw new Error('Processing timeout');
  }

  async getStatus(jobId: string): Promise<ProcessingStatus> {
    const response = await this.fetch(`${this.serverUrl}/status/${jobId}`);

    return {
      status: response.status,
      progress: response.progress,
      message: response.message,
      result: response.result ? {
        stems: {
          vocals: response.result.vocals_url,
          drums: response.result.drums_url,
          bass: response.result.bass_url,
          other: response.result.other_url,
          instrumental: response.result.instrumental_url,
        },
      } : undefined,
      error: response.error,
    };
  }

  async cancel(jobId: string): Promise<void> {
    await this.fetch(`${this.serverUrl}/cancel/${jobId}`, {
      method: 'POST',
    });
  }

  private async getCachedResult(trackId: string): Promise<AudioOutput | null> {
    return this.cache.get(`processed:${trackId}`);
  }

  private async cacheResult(trackId: string, result: AudioOutput): Promise<void> {
    // Cache for 1 week
    await this.cache.set(`processed:${trackId}`, result, 604800);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Real-time Processing

For effects that can be applied in real-time:

```typescript
interface RealtimeProcessor extends AudioProcessor {
  // Create audio processing node
  createNode(context: AudioContext): AudioNode;

  // Update parameters
  setParameter(name: string, value: number): void;

  // Get current parameter values
  getParameters(): Record<string, number>;
}

class EqualizerProcessor extends BaseAddon implements RealtimeProcessor {
  private filters: BiquadFilterNode[] = [];

  createNode(context: AudioContext): AudioNode {
    // Create EQ band filters
    const frequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];

    this.filters = frequencies.map(freq => {
      const filter = context.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1;
      filter.gain.value = 0;
      return filter;
    });

    // Chain filters
    for (let i = 0; i < this.filters.length - 1; i++) {
      this.filters[i].connect(this.filters[i + 1]);
    }

    return this.filters[0];
  }

  setParameter(name: string, value: number): void {
    // name format: "band_N" where N is 0-9
    const match = name.match(/band_(\d+)/);
    if (match) {
      const index = parseInt(match[1], 10);
      if (this.filters[index]) {
        this.filters[index].gain.value = value;
      }
    }
  }

  getParameters(): Record<string, number> {
    const params: Record<string, number> = {};
    this.filters.forEach((filter, i) => {
      params[`band_${i}`] = filter.gain.value;
    });
    return params;
  }
}
```

## Offline Processing with Progress

```typescript
async process(input: AudioInput): Promise<AudioOutput> {
  // Emit progress events
  this.emit('processing:start', { trackId: input.trackId });

  try {
    const response = await this.submitJob(input);
    const jobId = response.job_id;

    // Poll with progress updates
    while (true) {
      const status = await this.getStatus(jobId);

      this.emit('processing:progress', {
        trackId: input.trackId,
        progress: status.progress,
        message: status.message,
      });

      if (status.status === 'completed') {
        this.emit('processing:complete', { trackId: input.trackId });
        return status.result!;
      }

      if (status.status === 'failed') {
        throw new Error(status.error);
      }

      await this.sleep(1000);
    }
  } catch (error) {
    this.emit('processing:error', {
      trackId: input.trackId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
```

## Batch Processing

Process multiple tracks:

```typescript
async processBatch(inputs: AudioInput[]): Promise<Map<string, AudioOutput>> {
  const results = new Map<string, AudioOutput>();
  const jobs: { trackId: string; jobId: string }[] = [];

  // Submit all jobs
  for (const input of inputs) {
    const response = await this.submitJob(input);
    jobs.push({ trackId: input.trackId!, jobId: response.job_id });
  }

  // Wait for all to complete
  const pending = new Set(jobs.map(j => j.jobId));

  while (pending.size > 0) {
    for (const job of jobs) {
      if (!pending.has(job.jobId)) continue;

      const status = await this.getStatus(job.jobId);

      if (status.status === 'completed' && status.result) {
        results.set(job.trackId, status.result);
        pending.delete(job.jobId);
      } else if (status.status === 'failed') {
        pending.delete(job.jobId);
        // Handle failure
      }
    }

    if (pending.size > 0) {
      await this.sleep(2000);
    }
  }

  return results;
}
```

## Caching Strategy

```typescript
class ProcessorWithCache extends BaseAddon implements AudioProcessor {
  async process(input: AudioInput): Promise<AudioOutput> {
    if (!input.trackId) {
      return this.processWithoutCache(input);
    }

    // Check memory cache
    const memCached = this.memoryCache.get(input.trackId);
    if (memCached) return { ...memCached, cached: true };

    // Check persistent cache
    const diskCached = await this.cache.get<AudioOutput>(`stems:${input.trackId}`);
    if (diskCached) {
      // Validate URLs still work
      if (await this.validateUrls(diskCached)) {
        this.memoryCache.set(input.trackId, diskCached);
        return { ...diskCached, cached: true };
      }
    }

    // Process fresh
    const result = await this.processWithoutCache(input);

    // Cache result
    this.memoryCache.set(input.trackId, result);
    await this.cache.set(`stems:${input.trackId}`, result, 604800);

    return result;
  }

  private async validateUrls(output: AudioOutput): Promise<boolean> {
    try {
      if (output.stems?.instrumental) {
        const response = await fetch(output.stems.instrumental, { method: 'HEAD' });
        return response.ok;
      }
      return false;
    } catch {
      return false;
    }
  }
}
```

## Settings

```typescript
static manifest = {
  // ...
  settings: [
    {
      key: 'serverUrl',
      type: 'string',
      label: 'Processing Server',
      description: 'URL of the audio processing server',
      required: true,
    },
    {
      key: 'model',
      type: 'select',
      label: 'Model Quality',
      options: [
        { value: 'fast', label: 'Fast (2-stem)' },
        { value: 'standard', label: 'Standard (4-stem)' },
        { value: 'high', label: 'High Quality (6-stem)' },
      ],
      default: 'standard',
    },
    {
      key: 'autoProcess',
      type: 'boolean',
      label: 'Auto-process Liked Tracks',
      description: 'Automatically process tracks when liked',
      default: false,
    },
    {
      key: 'cacheSize',
      type: 'number',
      label: 'Cache Size (MB)',
      min: 100,
      max: 10000,
      default: 1000,
    },
  ],
};
```

## Testing

```typescript
import { describe, it, expect } from 'vitest';
import KaraokeProcessor from './index';

describe('KaraokeProcessor', () => {
  const processor = new KaraokeProcessor();

  describe('getCapabilities', () => {
    it('returns supported capabilities', () => {
      const caps = processor.getCapabilities();

      expect(caps).toBeInstanceOf(Array);
      expect(caps.find(c => c.id === 'vocal-removal')).toBeDefined();
    });
  });

  describe('process', () => {
    it('processes audio and returns stems', async () => {
      const input = {
        url: 'https://example.com/test.mp3',
        format: 'mp3' as const,
        duration: 180,
        trackId: 'test-track',
      };

      const output = await processor.process(input);

      expect(output.stems).toBeDefined();
      expect(output.stems?.instrumental).toBeDefined();
    }, 60000); // Long timeout for processing

    it('returns cached result on subsequent calls', async () => {
      const input = {
        url: 'https://example.com/test.mp3',
        format: 'mp3' as const,
        duration: 180,
        trackId: 'cached-track',
      };

      // First call
      await processor.process(input);

      // Second call should be cached
      const output = await processor.process(input);
      expect(output.cached).toBe(true);
    });
  });

  describe('cancel', () => {
    it('cancels pending job', async () => {
      // Start processing
      const input = {
        url: 'https://example.com/long.mp3',
        format: 'mp3' as const,
        duration: 600,
      };

      const jobPromise = processor.process(input);

      // Cancel after 1 second
      setTimeout(() => processor.cancel('job-id'), 1000);

      await expect(jobPromise).rejects.toThrow();
    });
  });
});
```

## Best Practices

### 1. Server Health Checks

```typescript
async initialize(): Promise<void> {
  try {
    const health = await this.fetch(`${this.serverUrl}/health`);
    if (!health.ok) {
      throw new Error('Server unhealthy');
    }
  } catch (error) {
    this.log.error('Processing server unavailable', error);
    // Don't fail - allow graceful degradation
  }
}
```

### 2. Resource Management

```typescript
private activeJobs = new Set<string>();
private maxConcurrent = 3;

async process(input: AudioInput): Promise<AudioOutput> {
  // Limit concurrent processing
  while (this.activeJobs.size >= this.maxConcurrent) {
    await this.sleep(1000);
  }

  const jobId = generateId();
  this.activeJobs.add(jobId);

  try {
    return await this.doProcess(input);
  } finally {
    this.activeJobs.delete(jobId);
  }
}
```

### 3. Graceful Degradation

```typescript
async process(input: AudioInput): Promise<AudioOutput> {
  try {
    return await this.processWithServer(input);
  } catch (error) {
    if (this.isServerUnavailable(error)) {
      this.log.warn('Server unavailable, returning original');
      return { processed: input.url };
    }
    throw error;
  }
}
```

## Related

- [Stream Provider](stream-provider.md) - Provide audio streams
- [SDK Reference](../../sdk/README.md) - Full API

