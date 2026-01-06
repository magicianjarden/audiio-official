# ML Types

Core type definitions for Audiio's ML recommendation system. This directory provides the TypeScript interfaces, types, and constants that define the contract between the ML engine and algorithm plugins.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Files](#files)
- [Core Concepts](#core-concepts)
- [Type Relationships](#type-relationships)
- [Imports from @audiio/core](#imports-from-audiiocore)
- [Usage Examples](#usage-examples)
- [Deprecated Types](#deprecated-types)

## Overview

The types in this directory serve as the foundation for:

- **Algorithm Plugins**: Third-party or built-in recommendation algorithms
- **Feature Providers**: Audio analysis, emotion detection, lyrics analysis
- **Training Pipeline**: ML model training with user behavior data
- **Scoring System**: Track recommendation scoring and ranking
- **User Events**: Behavioral signal collection for preference learning

## Architecture

```
@audiio/core (shared types)
    |
    +-- AudioFeatures (base)
    +-- EmotionCategory (16 emotions)
    +-- MoodType (8 user moods)
    +-- MusicalKey
    |
    v
ml/types/ (ML-specific extensions)
    |
    +-- track.ts -----> AudioFeaturesML extends CoreAudioFeatures
    +-- mood.ts ------> MoodProfile uses MoodType
    +-- scoring.ts ---> ScoringContext uses MoodCategory
    +-- events.ts ----> ListenContext uses MoodCategory
    +-- training.ts --> FeatureVector for model training
    +-- providers.ts -> FeatureProvider interface
    +-- endpoints.ts -> MLCoreEndpoints API
    +-- algorithm.ts -> AlgorithmPlugin interface
    +-- essentia.d.ts > Type declarations for essentia.js
```

## Files

### index.ts

Barrel file that re-exports all types from this directory.

**Exports**: All types from track, scoring, algorithm, events, training, providers, endpoints, and mood modules.

**Used by**: All ML system components that need access to types.

### track.ts

Core track and audio feature types used throughout the ML system.

**Imports from @audiio/core**:
- `AudioFeatures` (as `CoreAudioFeatures`)
- `EmotionCategory`
- `MusicalKey`

**Key Exports**:

| Type | Description |
|------|-------------|
| `Track` | Base track interface with metadata (id, title, artist, duration, etc.) |
| `ScoredTrack` | Track with attached recommendation score |
| `TrackMatch` | Result from fingerprint/metadata matching |
| `AudioFeaturesML` | Extended audio features with ML-specific fields |
| `EmotionFeatures` | Russell's circumplex model (valence, arousal, dominance) |
| `LyricsFeatures` | Sentiment analysis and theme detection from lyrics |
| `GenreFeatures` | Genre classification with confidence scores |
| `AggregatedFeatures` | Combined features from all providers |
| `FeatureProviderInfo` | Metadata about which provider supplied features |

**Backwards Compatibility**:
- `MoodCategory` - Alias for `EmotionCategory` (deprecated)
- `AudioFeatures` - Alias for `AudioFeaturesML` (deprecated)

### scoring.ts

Types for the track recommendation scoring system.

**Key Exports**:

| Type | Description |
|------|-------------|
| `TrackScore` | Final score with breakdown and explanation |
| `ScoreComponents` | Individual scoring factors (preference, mood, tempo, etc.) |
| `ScoringContext` | Session state and user preferences for scoring |
| `ScoringWeights` | Configurable weights for each scoring component |
| `ScoringMode` | Discovery vs familiar balance (`'discovery'` \| `'familiar'` \| `'balanced'`) |
| `ActivityType` | User activity context (working, exercising, relaxing, etc.) |
| `QueueMode` | Queue population mode (`'manual'` \| `'auto'` \| `'radio'`) |
| `RadioSeed` | Seed configuration for radio generation |
| `ScoreExplanation` | Human-readable score breakdown |

**Constants**:
- `DEFAULT_SCORING_WEIGHTS` - Default weight configuration for all scoring components

**Score Components** (20+ factors):
- Core: `basePreference`, `mlPrediction`
- Audio: `audioMatch`, `moodMatch`, `harmonicFlow`
- Context: `temporalFit`, `sessionFlow`, `activityMatch`
- Discovery: `explorationBonus`, `serendipityScore`, `diversityScore`, `familiarityBoost`
- Sequential: `trajectoryFit`, `tempoFlow`, `genreTransition`, `energyTrend`
- Penalties: `recentPlayPenalty`, `dislikePenalty`, `repetitionPenalty`, `fatiguePenalty`

### mood.ts

Mood profile definitions for contextual music matching.

**Imports from @audiio/core**:
- `MoodType` (8 user-facing moods)

**Key Exports**:

| Type | Description |
|------|-------------|
| `MoodProfile` | Complete mood definition with features and preferences |
| `FeatureRange` | Min/max range for audio features |
| `MoodMatchResult` | Result of matching a track to a mood |

**Constants**:
- `MOOD_PROFILES` - Predefined profiles for all 8 moods (chill, workout, focus, party, sleep, happy, melancholy, energetic)

**Helper Functions**:
- `getMoodProfiles()` - Get all mood profiles as array
- `getMoodProfile(moodId)` - Get specific mood profile by ID

Each `MoodProfile` includes:
- Audio feature ranges (energy, valence, danceability, BPM, etc.)
- Preferred/excluded genres
- Search terms for API fallback
- Visual styling (icon, gradient colors)

### providers.ts

Interfaces for feature providers that supply audio analysis.

**Key Exports**:

| Type | Description |
|------|-------------|
| `FeatureProvider` | Main provider interface with all analysis methods |
| `ProviderCapabilities` | What a provider can do (audio, emotion, lyrics, etc.) |
| `DuplicateResult` | Result from duplicate track detection |
| `FeatureAggregationConfig` | How to combine features from multiple providers |

**Provider Methods** (all optional):
- Audio: `getAudioFeatures`, `analyzeAudioUrl`, `analyzeAudioFile`, `analyzeAudioBuffer`
- Emotion: `getEmotionFeatures`, `analyzeEmotionFromAudio`
- Lyrics: `getLyricsFeatures`, `analyzeLyrics`
- Genre: `getGenreFeatures`
- Similarity: `getSimilarTracks`, `getTrackSimilarity`, `getArtistSimilarity`
- Fingerprinting: `generateFingerprint`, `identifyByFingerprint`, `findDuplicates`
- Embeddings: `getEmbedding`, `generateEmbedding`, `searchByEmbedding`

**Constants**:
- `DEFAULT_AGGREGATION_CONFIG` - Default feature aggregation settings

### endpoints.ts

Public API interface that algorithm plugins use to access ML core functionality.

**Key Exports**:

| Type | Description |
|------|-------------|
| `MLCoreEndpoints` | Main API containing all endpoint groups |
| `FeatureEndpoint` | Access to track features and provider registration |
| `UserEndpoint` | User preferences, history, and affinities |
| `TrainingEndpoint` | Training data access and management |
| `QueueEndpoint` | Queue candidate retrieval |
| `ScoringEndpoint` | Score submission and retrieval |
| `StorageEndpoint` | Persistent key-value storage for algorithm state |
| `EventEndpoint` | User event subscriptions |
| `LibraryEndpoint` | Library access (tracks, playlists, search) |
| `ModelStorage` | TensorFlow.js model persistence |

**Supporting Types**:
- `UserPreferences`, `UserStats` - User profile data
- `TemporalPatterns` - Time-of-day listening habits
- `SessionStats` - Current session information
- `DislikedTrackInfo` - Disliked tracks with reasons
- `LibraryStats`, `PlaylistInfo` - Library metadata
- `ScoringStats`, `AlgorithmScoreEntry` - Scoring analytics
- `LastTrainingInfo`, `DatasetOptions` - Training management

### training.ts

Types for ML model training pipeline.

**Key Exports**:

| Type | Description |
|------|-------------|
| `TrainingDataset` | Positive, negative, and partial samples |
| `TrainingSample` | Individual training sample with features and label |
| `FeatureVector` | Normalized feature representation for model input |
| `NormalizedAudioFeatures` | Audio features normalized to 0-1 range |
| `DatasetMetadata` | Dataset statistics and feature normalization info |
| `FeatureStats` | Min/max/mean/std for each feature |
| `TrainingResult` | Training outcome with metrics |
| `TrainingMetrics` | Loss, accuracy, epoch history |
| `ModelInfo` | Model architecture and parameter info |
| `TrainingStatus` | Current training state and progress |
| `TrainingState` | Training state machine (`'idle'` \| `'preparing'` \| `'training'` \| ...) |
| `TrainingConfig` | Hyperparameters (epochs, batch size, learning rate, etc.) |
| `AutoTrainingConfig` | Automatic retraining configuration |

**Constants**:
- `DEFAULT_TRAINING_CONFIG` - Default hyperparameters (50 epochs, batch 32, lr 0.001)
- `DEFAULT_AUTO_TRAINING_CONFIG` - Auto-training settings (24h min interval)

### events.ts

User behavior event types for training and real-time updates.

**Key Exports**:

| Type | Description |
|------|-------------|
| `UserEvent` | Union of all event types |
| `ListenEvent` | Track playback with completion percentage |
| `SkipEvent` | Track skip with position and early-skip flag |
| `DislikeEvent` | Explicit dislike with reason |
| `LikeEvent` | Like/super-like actions |
| `QueueEvent` | Queue manipulation (add, remove, reorder) |
| `PlaylistEvent` | Playlist add/remove |
| `SearchEvent` | Search queries and selections |
| `DownloadEvent` | Download actions |
| `ListenSource` | Where playback originated (queue, search, radio, etc.) |
| `ListenContext` | Time, device, activity, mood context |
| `DislikeReason` | Categorized dislike reasons (10 options) |

**Constants**:
- `DISLIKE_REASON_WEIGHTS` - Impact weights for each dislike reason (0.3-1.0)

**Helper Functions**:
- `isPositiveSignal(event)` - Check if event indicates positive preference
- `isNegativeSignal(event)` - Check if event indicates negative preference
- `getEventWeight(event)` - Get numeric weight for training (-1.5 to +1.5)

### algorithm.ts

Interface contract for algorithm plugins.

**Key Exports**:

| Type | Description |
|------|-------------|
| `AlgorithmPlugin` | Main plugin interface |
| `AlgorithmManifest` | Plugin metadata and configuration |
| `AlgorithmCapabilities` | What the algorithm can do |
| `AlgorithmRequirements` | Data and resource dependencies |
| `AlgorithmSettingDefinition` | User-configurable settings |
| `AlgorithmState` | Runtime state tracking |
| `AlgorithmHealth` | Health check status |

**Required Plugin Methods**:
- `initialize(endpoints)` - Setup with ML core access
- `dispose()` - Cleanup resources
- `scoreTrack(track, features, context)` - Score individual track
- `rankCandidates(candidates, context)` - Rank tracks for queue

**Optional Plugin Methods**:
- `scoreBatch(tracks, context)` - Efficient batch scoring
- `train(data)` - Model training
- `generateRadio(seed, count, context)` - Radio playlist generation
- `findSimilar(trackId, limit)` - Similarity search
- `onUserEvent(event)` - Real-time event handling
- `explainScore(trackId)` - Score explanation

### essentia.d.ts

TypeScript declarations for the essentia.js audio analysis library.

**Declares**:
- `EssentiaWASM` interface with methods:
  - `arrayToVector` / `vectorToArray` - Array conversion
  - `RhythmExtractor` - BPM detection
  - `KeyExtractor` - Musical key detection
  - `Loudness`, `Energy`, `DynamicComplexity` - Dynamics analysis
  - `Danceability` - Danceability scoring
  - `SpectralCentroidTime`, `ZeroCrossingRate` - Spectral analysis
  - `MFCC` - Mel-frequency cepstral coefficients

## Core Concepts

### Feature Aggregation

Multiple providers can contribute features for a single track. The `AggregatedFeatures` type combines:
- Audio features (BPM, key, energy, etc.)
- Emotion features (valence, arousal, mood category)
- Lyrics features (sentiment, themes)
- Genre classification
- Embedding vectors
- Audio fingerprint

### Scoring Pipeline

1. **Context Building**: `ScoringContext` captures session state, time, user preferences
2. **Feature Retrieval**: `AggregatedFeatures` collected for each candidate
3. **Component Scoring**: Each `ScoreComponents` factor computed independently
4. **Weight Application**: `ScoringWeights` applied to combine components
5. **Final Score**: `TrackScore` with 0-100 score and explanation

### Training Loop

1. **Event Collection**: `UserEvent` instances recorded
2. **Sample Creation**: `TrainingSample` with `FeatureVector` and label
3. **Dataset Assembly**: `TrainingDataset` with class balancing
4. **Model Training**: Using `TrainingConfig` hyperparameters
5. **Result Storage**: `TrainingResult` with `TrainingMetrics`

## Type Relationships

```
Track (base metadata)
    |
    +---> ScoredTrack (with TrackScore attached)
    |
    +---> TrainingSample.track (for training)
    |
    +---> UserEvent.track (for event recording)

AudioFeatures (@audiio/core, base)
    |
    +---> AudioFeaturesML (extended with ML fields)
            |
            +---> AggregatedFeatures.audio
            |
            +---> NormalizedAudioFeatures (for training)

EmotionCategory (@audiio/core, 16 values)
    |
    +---> MoodCategory (deprecated alias)
    |
    +---> EmotionFeatures.moodCategory
    |
    +---> ListenContext.mood

MoodType (@audiio/core, 8 values)
    |
    +---> MoodProfile.id
    |
    +---> MOOD_PROFILES keys
```

## Imports from @audiio/core

The following types are imported from `@audiio/core` to ensure consistency across the application:

| Import | From | Usage in ML Types |
|--------|------|-------------------|
| `AudioFeatures` | `@audiio/core` | Base for `AudioFeaturesML` extension |
| `EmotionCategory` | `@audiio/core` | ML-detected emotions (16 values) |
| `MusicalKey` | `@audiio/core` | Musical key representation |
| `MoodType` | `@audiio/core` | User-facing mood selection (8 values) |

**Why two mood types?**

- `EmotionCategory` (16 values): Used by ML models for fine-grained emotion classification from audio analysis
- `MoodType` (8 values): User-facing mood selection for playlists and radio (simpler, more intuitive)

## Usage Examples

### Implementing an Algorithm Plugin

```typescript
import type {
  AlgorithmPlugin,
  AlgorithmManifest,
  Track,
  AggregatedFeatures,
  ScoringContext,
  TrackScore,
  MLCoreEndpoints,
} from '../types';

const manifest: AlgorithmManifest = {
  id: 'my-algorithm',
  name: 'My Custom Algorithm',
  version: '1.0.0',
  author: 'Developer',
  description: 'A custom recommendation algorithm',
  capabilities: {
    scoring: true,
    batchScoring: true,
    ranking: true,
    training: false,
    // ...
  },
  requirements: {
    needsListenHistory: true,
    needsAudioFeatures: true,
    // ...
  },
  settings: [],
};

class MyAlgorithm implements AlgorithmPlugin {
  manifest = manifest;
  private endpoints!: MLCoreEndpoints;

  async initialize(endpoints: MLCoreEndpoints) {
    this.endpoints = endpoints;
  }

  async scoreTrack(
    track: Track,
    features: AggregatedFeatures,
    context: ScoringContext
  ): Promise<TrackScore> {
    // Scoring logic here
    return {
      trackId: track.id,
      finalScore: 75,
      confidence: 0.8,
      components: { basePreference: 70, audioMatch: 80 },
      explanation: ['Matches your preferred energy level'],
    };
  }

  // ... implement other required methods
}
```

### Working with Mood Profiles

```typescript
import { getMoodProfile, MOOD_PROFILES, type MoodType } from '../types';

// Get a specific mood profile
const chillProfile = getMoodProfile('chill');
if (chillProfile) {
  console.log(chillProfile.features.energy); // { min: 0.1, max: 0.4 }
  console.log(chillProfile.preferredGenres); // ['lofi', 'chill', 'ambient', ...]
}

// Iterate all moods
Object.values(MOOD_PROFILES).forEach(profile => {
  console.log(`${profile.name}: ${profile.description}`);
});
```

### Processing User Events

```typescript
import {
  type UserEvent,
  isPositiveSignal,
  isNegativeSignal,
  getEventWeight,
} from '../types';

function handleEvent(event: UserEvent) {
  const weight = getEventWeight(event);

  if (isPositiveSignal(event)) {
    // Update positive preference
    console.log(`Positive signal: ${event.type}, weight: ${weight}`);
  } else if (isNegativeSignal(event)) {
    // Update negative preference
    console.log(`Negative signal: ${event.type}, weight: ${weight}`);
  }
}
```

## Deprecated Types

The following types are deprecated and will be removed in a future version:

| Deprecated | Replacement | Notes |
|------------|-------------|-------|
| `MoodCategory` | `EmotionCategory` | Import `EmotionCategory` from `@audiio/core` |
| `AudioFeatures` (in track.ts) | `AudioFeaturesML` | Use the explicit ML-extended type |

## Related

- [ML System Architecture](/packages/server/src/ml/README.md)
- [Core Types](/packages/shared/core/src/types/README.md)
- [Algorithm Implementation](/packages/server/src/ml/algorithm/README.md)
- [Endpoints Implementation](/packages/server/src/ml/endpoints/README.md)
