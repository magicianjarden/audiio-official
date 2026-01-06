# ML Providers

Core feature extraction providers for Audiio's machine learning system. These providers handle specialized audio analysis tasks including audio feature extraction, emotion detection, genre classification, lyrics analysis, track fingerprinting, and embedding generation.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Files](#files)
  - [index.ts](#indexts)
  - [essentia-provider.ts](#essentia-providerts)
  - [emotion-provider.ts](#emotion-providerts)
  - [embedding-provider.ts](#embedding-providerts)
  - [fingerprint-provider.ts](#fingerprint-providerts)
  - [genre-provider.ts](#genre-providerts)
  - [lyrics-provider.ts](#lyrics-providerts)
- [AudioProcessor Integration](#audioprocessor-integration)
- [Usage Examples](#usage-examples)
- [Dependencies](#dependencies)

## Overview

The providers directory contains specialized feature extraction modules that work together to analyze audio tracks. Each provider focuses on a specific aspect of audio analysis:

| Provider | Purpose | Key Features |
|----------|---------|--------------|
| `EssentiaProvider` | Low-level audio analysis | BPM, key, energy, danceability, MFCC |
| `EmotionProvider` | Mood/emotion detection | Valence, arousal, mood categories |
| `EmbeddingProvider` | Vector embeddings | 64-dim metadata embeddings, similarity search |
| `FingerprintProvider` | Audio fingerprinting | Duplicate detection, track identification |
| `GenreProvider` | Genre classification | Plugin-first approach with ML fallback |
| `LyricsSentimentProvider` | Lyrics analysis | Sentiment, themes, emotional intensity |

All providers that require audio processing delegate to `AudioProcessor` (Essentia WASM) for high-performance DSP operations with pure JavaScript fallbacks.

## Architecture

```
                    +------------------+
                    |  MLCoreEndpoints |
                    +--------+---------+
                             |
                             | initialize(endpoints)
                             v
    +--------------------------------------------------------+
    |                     Providers                           |
    |  +------------+  +-----------+  +------------------+   |
    |  |  Essentia  |  |  Emotion  |  |    Embedding     |   |
    |  |  Provider  |  |  Provider |  |    Provider      |   |
    |  +------+-----+  +-----+-----+  +--------+---------+   |
    |         |              |                 |              |
    |  +------+-----+  +-----+-----+  +--------+---------+   |
    |  | Fingerprint|  |   Genre   |  |     Lyrics       |   |
    |  |  Provider  |  |  Provider |  |    Provider      |   |
    |  +------+-----+  +-----+-----+  +--------+---------+   |
    +--------|---------------|-----------------|-------------+
             |               |                 |
             v               v                 v
    +--------------------------------------------------------+
    |                   AudioProcessor                        |
    |   (Singleton - uses Essentia WASM with JS fallback)    |
    +--------------------------------------------------------+
             |
             v
    +--------------------------------------------------------+
    |                   Essentia.js WASM                      |
    |        (High-performance DSP operations)                |
    +--------------------------------------------------------+
```

### Provider Initialization Flow

1. Provider is instantiated with configuration
2. `initialize(endpoints: MLCoreEndpoints)` is called
3. Provider loads any ML models from storage
4. Provider sets up caching via `MemoryCache`
5. Provider is ready to process requests

### AudioProcessor Consolidation

Recent consolidation work unified all audio processing through `AudioProcessor`:

**Before:** Each provider loaded its own Essentia instance
**After:** All providers use `getAudioProcessor()` singleton

Benefits:
- Single Essentia WASM instance (reduced memory)
- Consistent DSP operations across providers
- Automatic JS fallback when WASM unavailable
- Shared resampling, FFT, and mel spectrogram computation

## Files

### index.ts

**Purpose:** Barrel export file for all providers.

**Exports:**
```typescript
export { EssentiaProvider } from './essentia-provider';
export { EmotionProvider } from './emotion-provider';
export { EmbeddingProvider } from './embedding-provider';
export { LyricsSentimentProvider } from './lyrics-provider';
export { FingerprintProvider, type SpectralFingerprint } from './fingerprint-provider';
export { GenreProvider } from './genre-provider';
```

**Used by:** `packages/server/src/ml/index.ts`, ML engine components

---

### essentia-provider.ts

**Purpose:** Real-time audio analysis using Essentia.js WASM. Provides specialized music analysis algorithms for BPM detection, key extraction, danceability scoring, and MFCC computation.

**Exports:**
- `EssentiaProvider` class

**Key Methods:**
| Method | Description |
|--------|-------------|
| `initialize()` | Loads Essentia WASM module |
| `analyzeBuffer(buffer, sampleRate)` | Full audio analysis |
| `generateAudioEmbedding(buffer, sampleRate)` | 128-dim audio embedding |
| `analyzeVoiceInstrumental(buffer, sampleRate)` | Voice/instrumental detection |
| `getAdvancedDanceability(buffer, sampleRate)` | Enhanced danceability scoring |
| `getAudioFeatures(trackId)` | Get cached features |
| `cacheFeatures(trackId, features)` | Cache analysis results |

**Quality Levels:**
```typescript
type QualityLevel = 'fast' | 'balanced' | 'accurate';

// 'fast': BPM, key, energy, loudness
// 'balanced': + danceability
// 'accurate': + spectral centroid, ZCR, MFCC
```

**AudioProcessor Usage:**
```typescript
// Resampling delegated to AudioProcessor
const resampled = getAudioProcessor().resample(audioData, sampleRate, 44100);
```

**Output Features:**
```typescript
interface AudioFeatures {
  bpm?: number;
  beatStrength?: number;
  key?: MusicalKey;
  mode?: 'major' | 'minor';
  energy?: number;
  loudness?: number;
  danceability?: number;
  valence?: number;
  acousticness?: number;
  instrumentalness?: number;
  speechiness?: number;
  spectralCentroid?: number;
  zeroCrossingRate?: number;
  mfcc?: number[];
  analysisConfidence?: number;
}
```

---

### emotion-provider.ts

**Purpose:** Audio-based emotion/mood detection using a CNN model trained on mel-spectrograms to predict valence (positive/negative) and arousal (energy level).

**Exports:**
- `EmotionProvider` class

**Key Methods:**
| Method | Description |
|--------|-------------|
| `initialize(endpoints)` | Load/create emotion model |
| `analyzeAudio(audioData, sampleRate)` | Predict valence/arousal |
| `getEmotionFeatures(trackId)` | Get cached emotion features |
| `cacheFeatures(trackId, features)` | Cache results |

**Model Architecture:**
```
Input: Mel spectrogram [frames x 128 mels x 1 channel]
  |
  +-> Conv2D(32) -> BatchNorm -> MaxPool
  +-> Conv2D(64) -> BatchNorm -> MaxPool
  +-> Conv2D(128) -> BatchNorm -> GlobalAvgPool
  +-> Dense(64) -> Dropout(0.3)
  +-> Dense(2, sigmoid)  // [valence, arousal]
```

**AudioProcessor Usage:**
```typescript
const audioProcessor = getAudioProcessor();
await audioProcessor.initialize();

// Resample and compute mel spectrogram
const resampled = audioProcessor.resample(audioData, sampleRate, 22050);
const melSpec = audioProcessor.computeMelSpectrogram(segment, {
  sampleRate: 22050,
  windowSize: 2048,
  hopSize: 512,
  nMels: 128,
});
```

**Mood Categories:**
Valence/arousal values are mapped to mood categories:
- High valence, high arousal: "energetic", "happy"
- High valence, low arousal: "calm", "peaceful"
- Low valence, high arousal: "angry", "anxious"
- Low valence, low arousal: "sad", "melancholic"

---

### embedding-provider.ts

**Purpose:** Generate 64-dimensional metadata embeddings for similarity search. Embeddings capture track characteristics (BPM, key, energy, etc.) in a dense vector space.

**Exports:**
- `EmbeddingProvider` class

**Key Methods:**
| Method | Description |
|--------|-------------|
| `initialize(endpoints)` | Load model and embedding index |
| `getEmbedding(trackId)` | Get/generate embedding |
| `generateEmbedding(features)` | Generate from aggregated features |
| `findSimilar(trackId, limit)` | Find similar tracks by embedding |
| `searchByEmbedding(embedding, limit)` | Search by raw embedding |
| `indexTracks(tracks)` | Batch index tracks |

**Model Architecture:**
```
Input: Feature vector (normalized)
  |
  +-> Dense(128, relu) -> BatchNorm
  +-> Dense(64, relu) -> BatchNorm
  +-> Dense(64, linear)  // Embedding output
  |
  +-> L2 Normalize
```

**Embedding Dimensions:** 64 (metadata-based)

**Index Storage:**
```typescript
// Embeddings are persisted to storage
const savedIndex = await endpoints.storage.get<Array<[string, number[]]>>('embedding-index');
```

---

### fingerprint-provider.ts

**Purpose:** Audio fingerprinting for track identification and duplicate detection. Uses a spectral peak-based algorithm similar to Shazam's approach.

**Exports:**
- `FingerprintProvider` class
- `SpectralFingerprint` type

**Key Methods:**
| Method | Description |
|--------|-------------|
| `initialize(endpoints)` | Load fingerprint index |
| `generateFingerprintFromBuffer(buffer, sampleRate)` | Generate fingerprint |
| `compareFingerprints(fp1, fp2)` | Compare two fingerprints (0-1) |
| `findDuplicates()` | Find duplicate tracks in library |
| `identifyByBuffer(buffer, sampleRate)` | Identify track from audio |
| `indexTrackWithAudio(trackId, buffer, sampleRate)` | Index with audio |

**Fingerprint Structure:**
```typescript
interface SpectralFingerprint {
  hash: string;          // Hex hash from band energy patterns
  peaks: number[];       // Spectral peak signature
  duration: number;      // Audio duration
  method: 'chromaprint' | 'spectral';
}
```

**AudioProcessor Usage:**
```typescript
const audioProcessor = getAudioProcessor();
await audioProcessor.initialize();

// Resample to fingerprint sample rate
const resampled = audioProcessor.resample(audioData, sampleRate, 11025);

// Compute FFT for each frame
const windowed = audioProcessor.applyHannWindow(frameData);
const spectrum = audioProcessor.computeFFTMagnitude(windowed);
```

**Algorithm:**
1. Resample to 11025 Hz
2. Compute spectrogram with 2048 window, 512 hop
3. Find spectral peaks in each frame
4. Compute energy in 6 frequency bands
5. Generate hash from relative band energy patterns
6. Create peak signature from time-binned peaks

---

### genre-provider.ts

**Purpose:** Plugin-first genre classification with embedding-based fallback. Genres come from your library's metadata (plugin-provided), not hardcoded taxonomy.

**Exports:**
- `GenreProvider` class

**Key Methods:**
| Method | Description |
|--------|-------------|
| `initialize(endpoints)` | Initialize provider |
| `getGenreFeatures(trackId)` | Get genre (metadata or inferred) |
| `buildGenreCentroids()` | Build centroids from known genres |
| `classifyUsingCentroids(trackId)` | Fast classification via centroids |
| `getAvailableGenres()` | Get genres in library |
| `fromMetadata(genre)` | Create features from metadata (static) |

**Classification Strategy:**
```
1. Check track metadata for genre (source: 'metadata', confidence: 1.0)
   |
   +-> If genre found: return immediately
   |
2. Infer from embedding similarity
   |
   +-> Find similar tracks with known genres
   +-> Build weighted consensus
   +-> Return if confidence >= 0.3
   |
3. Return null (genre unknown)
```

**Configuration:**
```typescript
interface GenreInferenceConfig {
  minSimilarTracks: number;    // Default: 3
  maxSimilarTracks: number;    // Default: 20
  minSimilarity: number;       // Default: 0.6
  minConfidence: number;       // Default: 0.3
}
```

**Centroid-Based Classification:**
For faster classification, build genre centroids from tracks with known genres:
```typescript
await genreProvider.buildGenreCentroids();
const features = await genreProvider.classifyUsingCentroids(trackId);
```

---

### lyrics-provider.ts

**Purpose:** Lyrics sentiment and theme analysis using a small LSTM model with keyword-based fallback.

**Exports:**
- `LyricsSentimentProvider` class

**Key Methods:**
| Method | Description |
|--------|-------------|
| `initialize(endpoints)` | Load/create sentiment model |
| `analyzeLyrics(lyrics)` | Analyze lyrics text |
| `getLyricsFeatures(trackId)` | Get cached features |
| `cacheFeatures(trackId, features)` | Cache results |

**Model Architecture:**
```
Input: Token indices [128 tokens]
  |
  +-> Embedding(10000 vocab, 64 dim)
  +-> LSTM(64)
  +-> Dense(32, relu) -> Dropout(0.3)
  +-> Dense(1, tanh)  // Sentiment (-1 to 1)
```

**Output Features:**
```typescript
interface LyricsFeatures {
  sentiment: number;           // -1 (negative) to 1 (positive)
  sentimentConfidence: number;
  themes: LyricsTheme[];       // Detected themes
  emotionalIntensity: number;  // 0-1
  language: string;            // 'en', 'es', etc.
  lyrics?: string;
}

interface LyricsTheme {
  theme: string;      // e.g., 'love', 'heartbreak', 'party'
  confidence: number;
}
```

**Theme Detection:**
Themes are detected via keyword matching:
- `love`: love, heart, kiss, hold, touch, forever
- `heartbreak`: break, broken, gone, leave, goodbye
- `party`: dance, party, night, club, move, beat
- `nostalgia`: remember, memory, yesterday, time
- `empowerment`: strong, power, rise, fight, stand
- `nature`: sun, moon, star, sky, sea, ocean
- `spirituality`: soul, spirit, god, heaven, faith
- `rebellion`: rebel, fight, free, break, rule

## AudioProcessor Integration

All providers that perform audio processing use the `AudioProcessor` singleton:

```typescript
import { getAudioProcessor } from '../utils';

// Get singleton (creates on first call)
const audioProcessor = getAudioProcessor();

// Initialize (loads Essentia WASM)
await audioProcessor.initialize();

// Use for DSP operations
const resampled = audioProcessor.resample(audioData, fromRate, toRate);
const melSpec = audioProcessor.computeMelSpectrogram(segment, options);
const fftMag = audioProcessor.computeFFTMagnitude(frame);
const windowed = audioProcessor.applyHannWindow(frame);
```

**AudioProcessor Features:**
- Essentia WASM integration with JS fallback
- Resampling (linear interpolation fallback)
- FFT computation (Cooley-Tukey fallback)
- Mel spectrogram generation
- MFCC extraction (Essentia only)
- Full audio analysis (BPM, key, energy, etc.)

## Usage Examples

### Analyze Audio Features

```typescript
import { EssentiaProvider } from './providers';

const provider = new EssentiaProvider('balanced');
await provider.initialize();

// Analyze from buffer
const audioBuffer = await fetchAudioBuffer(url);
const features = await provider.analyzeBuffer(audioBuffer, 44100);

console.log(`BPM: ${features.bpm}, Key: ${features.key} ${features.mode}`);
console.log(`Energy: ${features.energy}, Danceability: ${features.danceability}`);
```

### Detect Emotion/Mood

```typescript
import { EmotionProvider } from './providers';

const provider = new EmotionProvider();
await provider.initialize(mlEndpoints);

const emotion = await provider.analyzeAudio(audioData, 44100);
console.log(`Valence: ${emotion.valence}, Arousal: ${emotion.arousal}`);
console.log(`Mood: ${emotion.moodCategory}`);
```

### Find Similar Tracks

```typescript
import { EmbeddingProvider } from './providers';

const provider = new EmbeddingProvider();
await provider.initialize(mlEndpoints);

// Index library
await provider.indexTracks(allTracks);

// Find similar
const similar = await provider.findSimilar(trackId, 10);
console.log('Similar tracks:', similar);
```

### Detect Duplicates

```typescript
import { FingerprintProvider } from './providers';

const provider = new FingerprintProvider();
await provider.initialize(mlEndpoints);

// Index with audio fingerprints
for (const track of tracks) {
  const buffer = await loadAudio(track.path);
  await provider.indexTrackWithAudio(track.id, buffer, 44100);
}

// Find duplicates
const duplicates = await provider.findDuplicates();
for (const dup of duplicates) {
  console.log(`${dup.originalId} <-> ${dup.duplicateId} (${dup.confidence})`);
}
```

### Classify Genre

```typescript
import { GenreProvider } from './providers';

const provider = new GenreProvider();
await provider.initialize(mlEndpoints);

// Get genre (tries metadata first, then ML)
const genre = await provider.getGenreFeatures(trackId);
if (genre) {
  console.log(`Genre: ${genre.primaryGenre} (${genre.source})`);
  console.log(`Confidence: ${genre.primaryConfidence}`);
}
```

### Analyze Lyrics

```typescript
import { LyricsSentimentProvider } from './providers';

const provider = new LyricsSentimentProvider();
await provider.initialize(mlEndpoints);

const features = await provider.analyzeLyrics(lyricsText);
console.log(`Sentiment: ${features.sentiment}`);
console.log(`Themes: ${features.themes.map(t => t.theme).join(', ')}`);
console.log(`Intensity: ${features.emotionalIntensity}`);
```

## Dependencies

### External Dependencies

| Package | Version | Used By |
|---------|---------|---------|
| `@tensorflow/tfjs` | ^4.x | EmbeddingProvider, EmotionProvider, LyricsSentimentProvider |
| `essentia.js` | ^0.1.x | EssentiaProvider (via AudioProcessor) |

### Internal Dependencies

| Module | Path | Purpose |
|--------|------|---------|
| `MemoryCache` | `../utils/cache-utils` | In-memory caching |
| `getAudioProcessor` | `../utils/audio-processor` | Audio DSP operations |
| `cosineSimilarity` | `../utils/vector-utils` | Vector similarity |
| `valenceArousalToMood` | `../utils/ml-utils` | Mood mapping |
| `buildFeatureVector` | `../utils/feature-utils` | Feature construction |
| `MLCoreEndpoints` | `../types/endpoints` | ML system endpoints |
| `AudioFeatures`, etc. | `../types/track` | Type definitions |

## Related

- [ML System Overview](../README.md) - Complete ML system documentation
- [AudioProcessor](../utils/audio-processor.ts) - Unified audio processing
- [ML Types](../types/README.md) - Type definitions
- [Feature Aggregator](../engine/README.md) - Feature aggregation engine
