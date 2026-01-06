# Core Services

Shared services used across the Audiio application for audio analysis and track matching.

## Files

### audio-analyzer.ts

**Purpose:** Extracts audio features (BPM, key, energy, etc.) from audio files and streams.

**Class:** `AudioAnalyzer` (singleton)

**Key Features:**
- BPM detection using onset detection and autocorrelation
- Musical key detection using chromagram analysis and Krumhansl-Kessler profiles
- Energy features (loudness, danceability, valence)
- Vocal features (speechiness, instrumentalness, acousticness, liveness)
- Results caching for performance

**Dependencies:**
- FFmpeg (required for audio extraction)

**Usage:**
```typescript
import { AudioAnalyzer, getAudioAnalyzer } from '@audiio/core';

// Get singleton instance
const analyzer = getAudioAnalyzer();

// Analyze a local file
const features = await analyzer.analyzeFile('/path/to/audio.mp3');

// Analyze a URL/stream
const features = await analyzer.analyzeUrl('https://example.com/stream.m3u8');

// Check FFmpeg availability
const hasFFmpeg = await analyzer.checkFFmpegAvailable();
```

**Consumers:**
- `packages/shared/ui/src/hooks/usePluginAudioFeatures.ts`
- `packages/clients/desktop/src/preload.ts`
- `packages/server/src/ml/providers/emotion-provider.ts`

---

### track-matcher.ts

**Purpose:** Cross-provider track matching using ISRC and fuzzy string matching.

**Class:** `TrackMatcher`

**Key Features:**
- ISRC exact matching (highest confidence)
- Fuzzy matching on title + artist + duration
- Levenshtein distance for string similarity
- Match confidence scoring (0-1 scale)

**Matching Algorithm:**
1. Try ISRC exact match first (confidence: 1.0)
2. Fall back to fuzzy matching with weighted scoring:
   - Title similarity: 50%
   - Artist similarity: 35%
   - Duration similarity: 15% (5 second tolerance)
3. Minimum threshold: 0.7 for a valid match

**Usage:**
```typescript
import { TrackMatcher } from '@audiio/core';

const matcher = new TrackMatcher();

// Find best match from candidates
const match = matcher.findBestMatch(sourceTrack, candidates);

// Match metadata track to stream tracks
const streamMatch = matcher.findBestStreamMatch(metadataTrack, streamTracks);

// Get confidence of last match
const confidence = matcher.getLastMatchConfidence();
```

**Consumers:**
- `packages/shared/core/src/orchestrators/track-resolver.ts`
- `packages/clients/desktop/src/preload.ts`
- `packages/server/src/ml/mood/mood-matcher.ts`
