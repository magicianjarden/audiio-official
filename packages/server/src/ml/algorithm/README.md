# ML Algorithm Module

Core scoring and recommendation engine for Audiio. Combines rule-based heuristics with neural network predictions to generate personalized music recommendations.

## Architecture

```
algorithm/
├── index.ts             # Public exports
├── hybrid-scorer.ts     # Main scoring orchestrator
├── neural-scorer.ts     # TensorFlow.js neural network
├── sequential-scorer.ts # DJ-style session flow analysis
├── radio-generator.ts   # Infinite radio playlist generation
└── trainer.ts           # Training orchestration
```

## Types

Type definitions for the scoring system are located in `../types/scoring.ts`. Key types include:

| Type | Description |
|------|-------------|
| `TrackScore` | Complete score result with finalScore, confidence, components, and explanation |
| `ScoreComponents` | All individual scoring components (basePreference, mlPrediction, etc.) |
| `ScoringContext` | Session state, time context, user preferences, and feature flags |
| `ScoringWeights` | Weight configuration for all components |
| `ScoreExplanation` | Human-readable explanation with detailed breakdown |
| `RadioSeed` | Seed configuration for radio generation (track, artist, genre, mood, playlist) |

See `../types/scoring.ts` for full interface definitions.

## Components

### HybridScorer

The primary scoring engine that combines multiple signals into a final track score.

**Instantiation:**

HybridScorer is typically instantiated via the `MLEngine` rather than directly. The engine handles initialization of dependencies and configuration:

```typescript
import { MLEngine } from '../engine/ml-engine';

const engine = new MLEngine({
  useCoreAlgorithm: true,
  coreSettings: {
    mlWeight: 0.5,
    enableTemporalMatching: true,
    // ... other settings
  },
});
await engine.initialize();

// The HybridScorer is now available internally
// Use engine.scoreTrack() or engine.scoreBatch() instead of direct access
```

For direct instantiation (advanced usage):

```typescript
import { HybridScorer } from './algorithm';
import { NeuralScorer } from './algorithm';

const neuralScorer = new NeuralScorer();
await neuralScorer.initialize(endpoints);

const scorer = new HybridScorer(
  endpoints,        // MLCoreEndpoints - API for features, user data, library access
  neuralScorer,     // NeuralScorer instance for ML predictions
  settings          // Record<string, unknown> - configuration options
);

const score = await scorer.score(track, features, context);
// Returns: { trackId, finalScore, confidence, components, explanation }
```

**Score Components:**

| Component | Weight | Description |
|-----------|--------|-------------|
| `basePreference` | 20% | Artist and genre affinity from listening history |
| `mlPrediction` | 10-60%* | Neural network preference prediction |
| `audioMatch` | 8% | Audio feature similarity to current track |
| `moodMatch` | 6% | Match to user's current mood |
| `harmonicFlow` | 4% | Key/mode compatibility for smooth mixing |
| `temporalFit` | 8-12% | Time-of-day appropriateness |
| `sessionFlow` | 4% | Energy flow within session |
| `activityMatch` | 4% | Match to current activity (working, exercising, etc.) |
| `explorationBonus` | 8% | Bonus for discovering new artists/genres |
| `serendipityScore` | 8% | Unexpected but relevant recommendations |
| `diversityScore` | 8% | Variety within the session |
| `trajectoryFit` | ~5.6% | Sequential embedding direction (35% of sequential weight) |
| `tempoFlow` | ~4% | BPM transition smoothness (25% of sequential weight) |
| `genreTransition` | ~4% | Learned genre transition quality (25% of sequential weight) |
| `energyTrend` | ~2.4% | Energy progression continuity (15% of sequential weight) |

*ML weight scales dynamically based on model training accuracy

**Penalties:**

| Penalty | Weight | Description |
|---------|--------|-------------|
| `recentPlayPenalty` | 1.0 | Reduces score for recently played tracks |
| `dislikePenalty` | 1.5 | Heavy penalty for disliked tracks/artists |
| `repetitionPenalty` | 1.0 | Reduces score for repeated artists in session |
| `fatiguePenalty` | 0.8 | Penalty for similar sound fatigue |

**Batch Scoring:**

For better performance when scoring multiple tracks, use `scoreBatch()` which parallelizes feature fetching:

```typescript
// Score multiple tracks efficiently
const tracks: Track[] = [...]; // Array of tracks to score
const context: ScoringContext = { ... };

const scores = await scorer.scoreBatch(tracks, context);
// Returns: TrackScore[] in same order as input tracks

// Features are fetched in parallel, then all tracks scored
for (const score of scores) {
  console.log(`${score.trackId}: ${score.finalScore}`);
}
```

**Real-time Event Handling:**

The `handleEvent()` method invalidates caches when user preferences change:

```typescript
// Called when user likes/dislikes a track
scorer.handleEvent({
  type: 'like',
  trackId: 'track-123',
  timestamp: Date.now(),
});

// This immediately invalidates the preferences cache (preferencesExpiry = 0)
// Next score() call will fetch fresh preferences
```

**Learning Genre Transitions:**

The `learnTransition()` method teaches the scorer about user-preferred genre flows:

```typescript
// When user completes a track after a genre transition
scorer.learnTransition('rock', 'indie', true);  // User liked this transition

// When user skips after a genre transition
scorer.learnTransition('jazz', 'metal', false); // User didn't like this

// Transition probabilities are adjusted by +/- 0.05 per event
// Values are clamped to [0, 1] range
```

### NeuralScorer

TensorFlow.js neural network for preference prediction.

```typescript
import { NeuralScorer } from './algorithm';

const scorer = new NeuralScorer();
await scorer.initialize(endpoints);

const prediction = await scorer.predictSingle(featureVector);
// Returns: 0-1 preference score
```

**Model Architecture:**
- Input: Feature vector (audio, temporal, user context)
- Hidden layers: 64 -> 128 -> 64 -> 32
- Output: Single sigmoid (binary classification)
- Optimizer: Adam with binary crossentropy loss

**Dynamic Weighting:**
- New model: 10% weight in hybrid scoring
- Trained model: Scales up to 60% based on accuracy
- Weight formula: `0.1 + 0.5 * confidence`

### SequentialScorer

Session-aware scoring that considers the sequence of recently played tracks.

```typescript
import { SequentialScorer } from './algorithm';

const scorer = new SequentialScorer();
const result = scorer.score(candidateTrack, {
  recentTracks: [...],
  timestamp: Date.now(),
  sessionDuration: 15, // minutes
});
```

**Scoring Dimensions:**

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Trajectory Fit | 30% | Predicts next track position in embedding space based on session velocity |
| Tempo Flow | 25% | Rewards smooth BPM transitions |
| Genre Transition | 25% | Uses learned transition matrix |
| Energy Progression | 20% | Continues detected energy trends |

**Tempo Flow Scoring:**
- +/- 5 BPM: 100%
- +/- 10 BPM: 90%
- +/- 20 BPM: 70%
- +/- 40 BPM: 50%
- > 40 BPM: 30%

**Default Genre Transitions:**

The scorer ships with learned transition probabilities for common genre pairs:

```typescript
// Sample from DEFAULT_GENRE_TRANSITIONS
{
  'rock':       { 'rock': 0.7, 'metal': 0.5, 'indie': 0.6, 'pop': 0.4, 'electronic': 0.3 },
  'pop':        { 'pop': 0.7, 'rock': 0.4, 'r&b': 0.5, 'electronic': 0.5, 'indie': 0.4 },
  'electronic': { 'electronic': 0.7, 'pop': 0.5, 'ambient': 0.4, 'hip-hop': 0.4 },
  'hip-hop':    { 'hip-hop': 0.7, 'r&b': 0.6, 'pop': 0.4, 'electronic': 0.4 },
  'jazz':       { 'jazz': 0.7, 'blues': 0.6, 'soul': 0.5, 'classical': 0.4 },
  'classical':  { 'classical': 0.8, 'ambient': 0.5, 'jazz': 0.4 },
  'ambient':    { 'ambient': 0.8, 'electronic': 0.5, 'classical': 0.4, 'new-age': 0.5 },
}
// Unknown transitions default to 0.4
```

**Learning:**
```typescript
// Learn from user behavior
scorer.learnTransition('rock', 'indie', true);  // User completed track
scorer.learnTransition('jazz', 'metal', false); // User skipped

// User transitions are stored separately and checked first
// Values adjust by +/- 0.05 per success/failure
```

### RadioGenerator

Generates infinite radio playlists from seed tracks, artists, genres, moods, or playlists.

```typescript
import { RadioGenerator } from './algorithm';

const generator = new RadioGenerator(endpoints, hybridScorer);

const tracks = await generator.generate(
  { type: 'artist', id: 'artist-123', name: 'Artist Name' },
  10, // count
  context
);
```

**Seed Types:**
- `track`: Similar tracks to seed
- `artist`: Artist tracks + discovery
- `genre`: Tracks matching genre
- `mood`: Mood-based selection
- `playlist`: Playlist tracks + similar

**Drift Mechanism:**
- Initial seed weight: 70%
- Decay rate: 2% per track
- Minimum weight: 30%

This allows radio to gradually explore beyond the seed while maintaining relevance.

**Session Reset:**

Call `resetSession()` to restart a radio session from the beginning:

```typescript
const seed: RadioSeed = { type: 'artist', id: 'artist-123', name: 'Artist Name' };

// Generate some tracks
const tracks1 = await generator.generate(seed, 10, context);

// Later, user wants to restart the radio
generator.resetSession(seed);  // Clears played tracks and resets drift to 0

// Now generation starts fresh
const tracks2 = await generator.generate(seed, 10, context);
// tracks2 may include tracks from tracks1 since session was reset
```

### Trainer

Orchestrates model training with progress tracking.

```typescript
import { Trainer } from './algorithm';

const trainer = new Trainer(endpoints, neuralScorer);

const result = await trainer.train({
  positive: [...],  // Liked/completed tracks
  negative: [...],  // Skipped/disliked tracks
  partial: [...],   // Partial listens
});

const status = trainer.getStatus();
// { state: 'training', progress: 0.5, currentEpoch: 25, totalEpochs: 50 }
```

**Training States:**
1. `idle` - Not training
2. `preparing` - Validating and enriching dataset
3. `training` - Running epochs
4. `saving` - Persisting model
5. `complete` - Training finished
6. `error` - Training failed

**Requirements:**
- Minimum 50 training samples
- Automatic class weight balancing for imbalanced data
- 20% validation split

## Configuration

The HybridScorer accepts settings to customize behavior:

```typescript
const settings = {
  mlWeight: 0.5,                    // ML prediction influence (0-1)
  enableTemporalMatching: true,     // Time-of-day awareness
  timeOfDayMode: 'auto',            // 'auto' | 'strong' | 'off'
  enableSessionFlow: true,          // Energy flow scoring
  enableSequentialScoring: true,    // DJ-style transitions
  explorationLevel: 'balanced',     // 'low' | 'balanced' | 'high'
};
```

**Temporal Weights by Mode:**
- `off`: 0% (disabled)
- `auto`: 8% (default)
- `strong`: 12% (emphasized)

**Exploration Epsilon by Level:**
- `low`: 0.05
- `balanced`: 0.15 (default)
- `high`: 0.25

## Data Flow

```
+-------------------------------------------------------------+
|                    HybridScorer.score()                      |
+-------------------------------------------------------------+
|                                                              |
|  Track + Features + Context                                  |
|          |                                                   |
|          +---> NeuralScorer.predict()     ---> mlPrediction  |
|          |                                                   |
|          +---> SequentialScorer.score()   ---> trajectory,   |
|          |                                     tempo, genre, |
|          |                                     energy        |
|          |                                                   |
|          +---> Rule-based calculations    ---> preference,   |
|          |                                     mood,         |
|          |                                     temporal,     |
|          |                                     diversity,    |
|          |                                     etc.          |
|          |                                                   |
|          +---> Weighted combination       ---> TrackScore    |
|                                                              |
+-------------------------------------------------------------+
```

## Cache Management

### Preferences Cache

User preferences are cached for 5 minutes to reduce database queries:

```typescript
// Cache is refreshed via ensurePreferences()
private async ensurePreferences(): Promise<void> {
  if (Date.now() < this.preferencesExpiry) return;  // Still valid

  this.userPreferences = await this.endpoints.user.getPreferences();
  this.temporalPatterns = await this.endpoints.user.getTemporalPatterns();
  this.preferencesExpiry = Date.now() + 5 * 60 * 1000;  // 5 minute TTL
}
```

Cache is invalidated immediately on `like` or `dislike` events via `handleEvent()`.

### Score Cache

Recent scores are cached for the `explain()` method:

- **Maximum entries**: 100 scores
- **Eviction policy**: FIFO (first-in, first-out)
- **Purpose**: Enable score explanations without re-scoring

```typescript
// After scoring, the result is cached
this.recentScores.set(track.id, score);

// FIFO eviction when cache exceeds limit
if (this.recentScores.size > 100) {
  const firstKey = this.recentScores.keys().next().value;
  if (firstKey) {
    this.recentScores.delete(firstKey);
  }
}
```

## Explainability

Every score includes human-readable explanations:

```typescript
const explanation = await scorer.explain(trackId);
// {
//   trackId: '...',
//   score: { ... },
//   summary: 'Highly recommended: Artist match, smooth tempo transition',
//   details: [
//     { component: 'basePreference', label: 'Preference Match', value: 85, impact: 'positive', reason: 'Artist and genre match your taste' },
//     { component: 'tempoFlow', label: 'Tempo Flow', value: 92, impact: 'positive', reason: 'Smooth tempo transition' },
//     ...
//   ],
//   comparison: { vsSessionAverage: +12, vsHistoricalAverage: +8 }
// }
```

**Note:** `explain()` requires the track to have been recently scored (within the last 100 tracks). If the track is not in cache, an error is thrown.

## Error Handling

### Common Errors

```typescript
// explain() - Track not in recent scores cache
try {
  const explanation = await scorer.explain('unknown-track-id');
} catch (error) {
  // Error: "No recent score for track unknown-track-id"
  // Solution: Score the track first, then call explain()
}

// Missing features - Components gracefully default
// If features.audio is undefined, audio-based components return 0.5 (neutral)
// If context.currentTrack is undefined, comparison-based components are skipped
```

### Graceful Degradation

The scorer handles missing data gracefully:

| Missing Data | Behavior |
|-------------|----------|
| No audio features | Audio-based components return 0.5 (neutral) |
| No embeddings | Trajectory fit returns 0.5 |
| No current track | Harmonic flow and audio match skipped |
| No session tracks | Sequential scoring returns neutral values |
| No user preferences | Uses empty preference lists |
| NeuralScorer not ready | ML prediction skipped, rule-based only |

## Performance Considerations

- **Batch Scoring**: Use `scoreBatch()` for multiple tracks to parallelize feature fetching
- **Preference Caching**: User preferences cached for 5 minutes
- **Score Caching**: Recent scores cached for explanations (max 100, FIFO eviction)
- **Feature Prefetching**: Trainer prefetches all features before training
- **Parallel Processing**: `scoreBatch()` fetches features in parallel, then scores sequentially

## Dependencies

- `@tensorflow/tfjs` - Neural network operations
- `../types` - Type definitions (see `../types/scoring.ts`)
- `../utils` - Scoring utilities, feature extraction, model helpers
