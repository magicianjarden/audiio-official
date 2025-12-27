# Audiio ML & Recommendation System

A local-first, privacy-preserving music recommendation engine that rivals cloud-based services like Spotify while keeping all data on your device.

## Architecture Overview

```
                    +-------------------+
                    |   User Listening  |
                    |      Events       |
                    +--------+----------+
                             |
              +--------------v--------------+
              |   Recommendation Store      |
              |  (Listen History, Prefs)    |
              +--------------+--------------+
                             |
         +-------------------+-------------------+
         |                   |                   |
+--------v--------+ +--------v--------+ +--------v--------+
|  Rule-Based     | |   ML Trainer    | |   Advanced      |
|  Scoring        | | (TensorFlow.js) | |   Scoring       |
+-----------------+ +-----------------+ +-----------------+
         |                   |                   |
         +-------------------+-------------------+
                             |
              +--------------v--------------+
              |      Hybrid Scoring         |
              |  (40% Base + 60% Advanced)  |
              +--------------+--------------+
                             |
         +-------------------+-------------------+
         |                   |                   |
+--------v--------+ +--------v--------+ +--------v--------+
|   Smart Queue   | |    Discover     | |     Radio       |
|   Auto-Queue    | |     Page        | |     Mode        |
+-----------------+ +-----------------+ +-----------------+
```

## Core Components

### 1. Feature Extraction (`feature-extractor.ts`)

Extracts a 22-dimensional feature vector from each track:

**Track Features (18 dims):**
- Genre one-hot encoding (8 primary genres)
- Energy & valence (0-100)
- Duration (normalized)
- Explicit flag
- Release year
- Play count, skip ratio, completion ratio
- Recency score
- Artist familiarity

**Context Features (4 dims):**
- Hour of day (cyclical sin/cos encoding)
- Day of week (cyclical encoding)

### 2. ML Trainer (`ml-trainer.ts`)

TensorFlow.js neural network for preference prediction:

```
Input(22) → Dense(64,ReLU) → Dense(128,ReLU) → Dropout(0.3)
         → Dense(64,ReLU) → Dense(32,ReLU) → Output(1,Sigmoid)
```

**Training:**
- Requires 50+ samples (listen events + disliked tracks)
- Auto-retrains every 24 hours with 10+ new events
- Persists to IndexedDB
- Binary cross-entropy loss with Adam optimizer

**Training Labels:**
- Completed listen: `1.0` (strong positive)
- Partial listen: proportional to completion (0.0-1.0)
- Skipped: `0.0` (negative)
- Disliked tracks: `0.0-0.2` based on reason weights

**Dislike Reason Weights:**
| Reason | Weight | Label |
|--------|--------|-------|
| `not_my_taste` | 0.95 | ~0.01 |
| `dont_like_artist` | 0.90 | ~0.02 |
| `explicit_content` | 0.85 | ~0.03 |
| `heard_too_much` | 0.40 | ~0.12 |
| `wrong_mood` | 0.35 | ~0.13 |
| `bad_audio_quality` | 0.30 | ~0.14 |
| `too_long/short` | 0.50 | ~0.10 |

Higher weights produce labels closer to 0, teaching the model to avoid similar tracks.

### 3. Advanced Scoring (`advanced-scoring.ts`)

Multi-dimensional scoring beyond basic preferences:

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Base Score | 40% | ML or rule-based preference |
| Exploration | 10% | Epsilon-greedy for new music discovery |
| Serendipity | 15% | Unexpected but fitting tracks |
| Diversity | 15% | Variety in artists/genres |
| Flow | 10% | Smooth energy/tempo transitions |
| Temporal | 5% | Time-of-day relevance |
| Plugin | 5% | Audio features from plugins |

### 4. Plugin Audio Providers (`plugin-audio-provider.ts`)

Plugins can contribute audio features:

```typescript
interface AudioFeatures {
  bpm?: number;           // 60-200 BPM
  key?: string;           // Musical key (C, D#, etc.)
  mode?: 'major' | 'minor';
  energy?: number;        // 0-1
  danceability?: number;  // 0-1
  acousticness?: number;  // 0-1
  instrumentalness?: number;
  valence?: number;       // 0-1 (happiness)
  loudness?: number;      // dB
  speechiness?: number;   // 0-1
}
```

## Scoring Algorithms

### Exploration vs Exploitation

Uses epsilon-greedy strategy:
- 15% chance to explore new music
- Bonus for new artists (+15) and genres (+10)
- Novelty decays with repeated plays

```typescript
// Exploration bonus calculation
if (isNewArtist) bonus += 15;
if (isNewGenre) bonus += 10;
bonus *= Math.pow(0.9, playCount); // Decay
```

### Serendipity Scoring

Rewards unexpected discoveries:

```typescript
// Genre jump: Different genre but user likes
if (isNewGenre && hasTopGenre) score += 15;

// Unknown artist in loved genre
if (!isKnownArtist && hasTopGenre) score += 20;

// Genre-bridging tracks
if (bridgesMultipleGenres) score += 10;
```

### Session Flow

Ensures smooth listening experience:

```typescript
// Energy transition scoring
const energyDiff = Math.abs(currentEnergy - previousEnergy);
if (energyDiff <= 0.3) {
  score += 15 * (1 - energyDiff / 0.3); // Smooth
} else {
  score -= 20 * (energyDiff - 0.3); // Jarring
}

// BPM compatibility
if (bpmDiff <= 15%) score += 10;

// Key compatibility (Circle of Fifths)
if (keysAdjacent) score += 10;
```

### Diversity Scoring

Prevents repetition:

```typescript
// Same artist penalty
if (artistPlayedRecently) score -= 30 * count;

// Genre balance
if (genreRatio > 0.4) score -= 10 * (ratio - 0.4);
if (genreRatio < 0.4) score += 10 * (0.4 - ratio);

// New genre bonus
if (!sessionHasGenre) score += 15;
```

## Store Integration

### Recommendation Store

Tracks all user preferences:

```typescript
interface UserProfile {
  artistPreferences: Record<string, ArtistPreference>;
  genrePreferences: Record<string, GenrePreference>;
  timePatterns: TimePattern[];
  avgSessionLength: number;
  preferredDuration: { min: number; max: number };
}
```

Key methods:
- `recordListen()` - Logs listen events with completion data
- `calculateTrackScore()` - Rule-based scoring
- `getTimePatternsForScoring()` - Hour-by-hour preferences
- `getArtistHistory()` / `getGenreHistory()` - For exploration calc

### ML Store

Manages model lifecycle:

```typescript
interface MLState {
  isModelLoaded: boolean;
  isTraining: boolean;
  modelVersion: number;
  trainingMetrics: TrainingMetrics;
}
```

Key methods:
- `initializeModel()` - Load from IndexedDB or create new
- `trainModel()` - Background training with progress
- `getHybridScore()` - ML + rule-based weighted combination
- `getHybridRecommendations()` - Batch scoring with variety

### Smart Queue Store

Auto-queue and radio mode:

```typescript
type QueueMode = 'manual' | 'auto-queue' | 'radio';

interface SmartQueueConfig {
  autoQueueEnabled: boolean;
  autoQueueThreshold: 2;    // Replenish when ≤2 tracks
  autoQueueBatchSize: 10;   // Add 10 at a time
  useMLRecommendations: true;
}
```

## Plugin System Integration

### Registering Audio Feature Providers

```typescript
import { registerPluginAudioProvider, createPluginFeatureProvider } from '@audiio/ui/ml';

const myProvider = createPluginFeatureProvider(
  'my-plugin-id',
  100, // Priority (higher = checked first)
  {
    async getAudioFeatures(trackId) {
      // Fetch from your source (Spotify, local analysis, etc.)
      return {
        bpm: 120,
        energy: 0.8,
        key: 'C',
        mode: 'major',
        // ... other features
      };
    },
    async getSimilarTracks(trackId, limit) {
      // Return array of similar track IDs
      return ['track-1', 'track-2'];
    }
  }
);

// On plugin enable:
registerPluginAudioProvider(myProvider);

// On plugin disable:
unregisterPluginAudioProvider('my-plugin-id');
```

### Provider Priority Order

| Plugin | Priority | Features Provided |
|--------|----------|-------------------|
| Spotify Metadata | 100 | Full audio features, similar tracks |
| Local Audio Analysis | 50 | BPM, energy from waveform |
| Last.fm | 75 | Similar tracks, artist similarity |

## Console Logging

The system logs scoring decisions for debugging:

```
[SmartQueue] Gathering candidates from multiple sources...
[SmartQueue] Added 15 liked tracks
[SmartQueue] Added 30 from search "electronic"
[SmartQueue] 42 unique candidates after deduplication
[SmartQueue] Using ML hybrid + advanced scoring...
[SmartQueue] Top 5 candidates:
  1. Song A by Artist X (78.5) [New discovery, Smooth transition]
  2. Song B by Artist Y (72.3) [Unexpected find, Adds variety]
  3. Song C by Artist Z (68.1) [Right time]
```

## Configuration

### Adjusting Weights

Edit `SCORING_CONFIG` in `advanced-scoring.ts`:

```typescript
export const SCORING_CONFIG = {
  weights: {
    base: 0.40,        // Original algo score
    exploration: 0.10,
    serendipity: 0.15,
    diversity: 0.15,
    flow: 0.10,
    temporal: 0.05,
    plugin: 0.05,
  },
  // ... other configs
};
```

### Training Thresholds

Edit in `ml-trainer.ts`:

```typescript
export function canTrain(listenCount: number): boolean {
  return listenCount >= 50; // Minimum events
}

export function shouldRetrain(
  lastTrained: number,
  currentEvents: number,
  eventsAtLastTrain: number
): boolean {
  const daysSince = (Date.now() - lastTrained) / (1000 * 60 * 60 * 24);
  const newEvents = currentEvents - eventsAtLastTrain;

  return daysSince >= 1 && newEvents >= 10; // Daily with 10+ new events
}
```

## Privacy

All data stays local:
- Listen history in IndexedDB
- ML model trained in browser
- No external API calls for recommendations
- Plugin features are optional enhancements

## Comparison with Spotify

| Feature | Spotify | Audiio |
|---------|---------|--------|
| Data Location | Cloud | 100% Local |
| Privacy | Tracks all activity | No external tracking |
| Customization | Limited | Full config access |
| Plugin System | None | Extensible |
| Transparency | Black box | Logged explanations |
| Cold Start | Requires listening | Rule-based fallback |
| Session Flow | Basic | Energy/key/BPM aware |
| Serendipity | Limited | Configurable |
