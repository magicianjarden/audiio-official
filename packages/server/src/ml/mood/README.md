# Mood

Mood matching system for scoring tracks against predefined mood profiles. This module enables activity-based music selection by matching audio features and genres to curated mood profiles like "workout", "chill", "focus", etc.

## Table of Contents

- [Overview](#overview)
- [Structure](#structure)
- [Files](#files)
- [Mood Types](#mood-types)
- [Mood Profiles](#mood-profiles)
- [MoodMatcher Class](#moodmatcher-class)
- [Integration with HybridScorer](#integration-with-hybridscorer)
- [MoodCategory vs MoodType Mapping](#moodcategory-vs-moodtype-mapping)
- [Usage](#usage)
- [Dependencies](#dependencies)
- [Related](#related)

## Overview

The mood system provides activity-oriented music matching by defining mood profiles that specify:

1. **Audio Feature Ranges** - Acceptable ranges for energy, valence, danceability, BPM, acousticness, and instrumentalness
2. **Genre Preferences** - Genres that fit the mood and genres to avoid
3. **Search Terms** - Fallback search queries for API-based discovery

Unlike the emotion-based `MoodCategory` type (happy, sad, angry, etc.) used in `EmotionFeatures`, the `MoodType` in this module is activity-based (workout, focus, party, sleep, etc.), making it suitable for contextual playlist generation.

## Structure

```
mood/
└── mood-matcher.ts   - MoodMatcher class for scoring tracks against mood profiles
```

**Note**: The mood type definitions (`MoodType`, `MoodProfile`, `MOOD_PROFILES`) are located in `../types/mood.ts` and re-exported through `../utils/index.ts`.

## Files

### mood-matcher.ts

- **Purpose**: Provides the `MoodMatcher` class for scoring tracks against predefined mood profiles
- **Exports**:
  - `MoodMatcher` - Class for mood matching operations
  - `getMoodMatcher()` - Singleton accessor function
  - `MoodTrack` - Interface for tracks with features
- **Used by**:
  - `../algorithm/hybrid-scorer.ts` - For mood-based scoring in the recommendation engine
  - Main ML index (`../index.ts`) - Exported for external use
- **Dependencies**:
  - `../types` - Type definitions (`MoodType`, `MoodProfile`, `MoodMatchResult`, `FeatureRange`, `AudioFeatures`)
  - `../utils` - `MOOD_PROFILES` constant

## Mood Types

The system defines 8 activity-based mood types in `../types/mood.ts`:

| MoodType | Description | Use Case |
|----------|-------------|----------|
| `chill` | Relaxed vibes for unwinding | Background music, relaxation |
| `workout` | High energy for exercise | Gym, running, sports |
| `focus` | Concentration and productivity | Studying, working, deep focus |
| `party` | Get the party started | Social gatherings, dancing |
| `sleep` | Peaceful sounds for rest | Bedtime, meditation |
| `happy` | Uplifting and joyful tunes | Mood boost, positive energy |
| `melancholy` | Emotional and introspective | Rainy days, reflection |
| `energetic` | High-octane excitement | Motivation, adrenaline |

## Mood Profiles

Each mood profile (`MoodProfile`) contains:

```typescript
interface MoodProfile {
  id: MoodType;              // Unique identifier
  name: string;              // Display name
  description: string;       // Short description
  icon: string;              // Emoji representation
  gradient: [string, string]; // UI gradient colors
  features: {
    energy?: FeatureRange;        // Energy level (0-1)
    valence?: FeatureRange;       // Musical positiveness (0-1)
    danceability?: FeatureRange;  // Danceability score (0-1)
    bpm?: FeatureRange;           // Tempo in BPM
    acousticness?: FeatureRange;  // Acousticness (0-1)
    instrumentalness?: FeatureRange; // Instrumentalness (0-1)
  };
  preferredGenres?: string[];  // Genres that match this mood
  excludedGenres?: string[];   // Genres to avoid
  searchTerms: string[];       // API fallback search queries
}
```

### Profile Examples

**Workout Profile**:
- Energy: 0.7 - 1.0 (high)
- BPM: 120 - 180 (fast)
- Preferred genres: edm, hip-hop, electronic, pop, dance, dubstep
- Excluded genres: ambient, classical, sleep

**Focus Profile**:
- Energy: 0.2 - 0.5 (moderate-low)
- BPM: 80 - 120 (moderate)
- Instrumentalness: 0.5 - 1.0 (high)
- Preferred genres: ambient, classical, lofi, electronic, post-rock
- Excluded genres: metal, hip-hop, pop

## MoodMatcher Class

The `MoodMatcher` class provides methods for matching tracks to mood profiles:

### Methods

| Method | Description |
|--------|-------------|
| `getProfiles()` | Returns all available mood profiles |
| `getProfile(moodId)` | Get a specific mood profile by ID |
| `matchTrack(track, moodId)` | Score a single track against a mood profile |
| `findBestMood(track)` | Find the best matching mood for a track |
| `filterByMood(tracks, moodId, options?)` | Filter and sort tracks by mood match score |
| `getSearchTerms(moodId)` | Get search terms for API fallback |
| `getRandomSearchQuery(moodId)` | Get a random search query for discovery |

### Scoring Algorithm

The `matchTrack` method calculates a match score (0-1) by:

1. **Feature Scoring**: For each audio feature (energy, valence, danceability, bpm, acousticness, instrumentalness):
   - Returns 1.0 if the value falls within the profile's range
   - Returns a decreasing score based on distance from the range (minimum 0)
   - Features scoring >= 0.7 are marked as "matched"
   - Features scoring < 0.4 are marked as "mismatched"

2. **Genre Scoring**:
   - Default score: 0.5 (neutral)
   - Boost for matching preferred genres: 0.7 + (0.1 * match count)
   - Penalty for excluded genres: -0.2 per excluded genre match

3. **Final Score**: Average of all feature and genre scores

### MoodMatchResult

```typescript
interface MoodMatchResult {
  mood: MoodType;           // The mood being matched
  score: number;            // Match score 0-1 (1 = perfect match)
  matchedFeatures: string[]; // Features that contributed positively
  mismatchedFeatures: string[]; // Features that didn't match well
}
```

## Integration with HybridScorer

The `MoodMatcher` was recently integrated into the `HybridScorer` class (`../algorithm/hybrid-scorer.ts`) to provide mood-based scoring as part of the hybrid recommendation algorithm.

### How It's Used

In `HybridScorer.calculateMoodMatch()`:

1. The user's current mood (`MoodCategory`) is mapped to a `MoodType`
2. `getMoodMatcher()` retrieves the singleton instance
3. Track data is converted to `MoodTrack` format
4. `matcher.matchTrack()` scores the track against the mood profile
5. If emotion features are available, the score is blended:
   - 70% weight: MoodMatcher score (audio + genre)
   - 30% weight: Emotion valence match

### Scoring Weight

The mood match score contributes to the final track score with a weight of 0.06 (6%) in the rule-based portion of the hybrid scoring system:

```typescript
moodMatch: 0.06 * ruleWeight
```

## MoodCategory vs MoodType Mapping

The system uses two different mood type systems that serve different purposes:

### MoodCategory (Emotion-Based)

Defined in `../types/track.ts`, used in `EmotionFeatures`:
- Represents emotional states derived from audio analysis
- Examples: `happy`, `sad`, `angry`, `fearful`, `calm`, `euphoric`, `romantic`, `nostalgic`

### MoodType (Activity-Based)

Defined in `../types/mood.ts`, used in `MoodMatcher`:
- Represents listening contexts and activities
- Examples: `chill`, `workout`, `focus`, `party`, `sleep`

### Mapping Table

The `HybridScorer` maps `MoodCategory` to `MoodType`:

| MoodCategory | MoodType |
|--------------|----------|
| `happy` | `happy` |
| `energetic` | `energetic` |
| `melancholic` | `melancholy` |
| `calm` | `chill` |
| `peaceful` | `chill` |
| `euphoric` | `party` |
| `uplifting` | `happy` |
| `sad` | `melancholy` |
| `dark` | `melancholy` |
| `hopeful` | `happy` |
| `romantic` | `chill` |

Unmapped moods (like `angry`, `fearful`, `tense`, `aggressive`, `nostalgic`) fall back to valence/arousal-based scoring.

## Usage

### Basic Usage

```typescript
import { getMoodMatcher } from '../ml/mood/mood-matcher';

const matcher = getMoodMatcher();

// Score a track against a mood
const track = {
  id: 'track-123',
  title: 'Summer Vibes',
  artist: 'DJ Chill',
  genres: ['lofi', 'electronic'],
  features: {
    energy: 0.3,
    valence: 0.6,
    bpm: 85,
    danceability: 0.4,
  },
};

const result = matcher.matchTrack(track, 'chill');
console.log(result.score); // e.g., 0.85
console.log(result.matchedFeatures); // ['energy', 'bpm', 'genre']
```

### Filter Tracks by Mood

```typescript
const chillTracks = matcher.filterByMood(allTracks, 'chill', {
  minScore: 0.5,  // Only tracks scoring >= 0.5
  limit: 20,      // Top 20 matches
});
```

### Find Best Mood for a Track

```typescript
const bestMatch = matcher.findBestMood(track);
console.log(`Best mood: ${bestMatch.mood} (score: ${bestMatch.score})`);
```

### Get Search Terms for API Fallback

```typescript
const searchQuery = matcher.getRandomSearchQuery('workout');
// Returns something like "gym motivation" or "high energy"
```

## Dependencies

### Internal Dependencies

- `../types` - Type definitions for mood system
- `../utils` - `MOOD_PROFILES` constant definition

### Used By

- `../algorithm/hybrid-scorer.ts` - Mood-based scoring component
- `../index.ts` - Public API export

## Related

- [Algorithm Module](../algorithm/README.md) - HybridScorer integration
- [Types Module](../types/README.md) - MoodType and MoodProfile definitions
- [Utils Module](../utils/README.md) - MOOD_PROFILES constant
- [Embeddings Module](../embeddings/README.md) - MOOD_VECTORS for embedding-based mood similarity
