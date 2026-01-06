# Embeddings

Vector-based recommendation engine for Audiio. This module replaces traditional keyword-based search with semantic similarity, enabling high-quality music recommendations through vector embeddings, user taste profiles, collaborative filtering, and intelligent playlist generation.

## Table of Contents

- [Overview](#overview)
- [Structure](#structure)
- [Files](#files)
  - [index.ts](#indexts)
  - [types.ts](#typests)
  - [embedding-engine.ts](#embedding-enginets)
  - [vector-index.ts](#vector-indexts)
  - [taste-profile.ts](#taste-profilets)
  - [cooccurrence.ts](#cooccurrencets)
  - [playlist-generator.ts](#playlist-generatorts)
- [Architecture](#architecture)
- [Usage](#usage)
- [Dependencies](#dependencies)
- [Related](#related)

## Overview

The embeddings module provides the foundation for Audiio's ML-powered music recommendations. Instead of relying on exact keyword matches or simple metadata filtering, this system represents tracks and user preferences as dense vectors in a high-dimensional space (default: 128 dimensions). Similar tracks end up close together in this space, enabling:

- **Semantic similarity search**: Find tracks that "sound like" a seed track
- **Personalized recommendations**: Match tracks to user taste profiles
- **Contextual awareness**: Adjust recommendations based on time of day, day of week
- **Collaborative filtering**: Learn from listening patterns to find songs that go well together
- **Mood/genre-based playlists**: Generate playlists matching specific moods or genres

## Structure

```
embeddings/
├── index.ts              - Module entry point, exports all public APIs
├── types.ts              - Type definitions, genre/mood vectors, default configs
├── embedding-engine.ts   - Generates track embeddings from audio features/genres
├── vector-index.ts       - HNSW-based approximate nearest neighbor search
├── taste-profile.ts      - User preference modeling with contextual profiles
├── cooccurrence.ts       - Collaborative filtering via co-occurrence tracking
└── playlist-generator.ts - Combines all components to generate playlists
```

## Files

### index.ts

- **Purpose**: Module barrel file that exports all public APIs from the embeddings system
- **Exports**:
  - Classes: `EmbeddingEngine`, `VectorIndex`, `TasteProfileManager`, `CoOccurrenceMatrix`, `PlaylistGenerator`
  - Singletons: `getEmbeddingEngine()`, `getVectorIndex()`, `getCoOccurrenceMatrix()`, `reset*()` functions
  - Types: All interfaces and type aliases
  - Constants: `DEFAULT_*_CONFIG`, `GENRE_VECTORS`, `MOOD_VECTORS`
- **Used by**: `packages/server/src/ml/index.ts` (re-exports to the broader ML system)

### types.ts

- **Purpose**: Core type definitions and static data for the embedding system
- **Key Exports**:
  - `TrackEmbedding`: Vector representation of a track with metadata
  - `UserTasteProfile`: Aggregated user preferences as a vector
  - `SimilarityResult`: Search result with score and distance
  - `EmbeddingConfig`: Configuration for embedding generation
  - `AudioFeatureWeights`: Weights for different audio features
  - `ContextualProfiles`: Time-based taste variations (morning, evening, etc.)
  - `GENRE_VECTORS`: Pre-defined 7-dimensional vectors for 35+ genres
  - `MOOD_VECTORS`: Pre-defined vectors for 12 mood types
  - `DEFAULT_EMBEDDING_CONFIG`: Default configuration (128 dimensions)
  - `DEFAULT_AUDIO_WEIGHTS`: Feature importance weights
- **Dependencies**: None (pure type definitions)

**Genre Categories Covered**:
- Electronic: electronic, edm, house, techno, dubstep, ambient, trance, dnb
- Rock: rock, indie-rock, alt-rock, metal, punk, classic-rock
- Pop: pop, synth-pop, indie-pop, dance-pop, kpop
- Hip-Hop: hip-hop, rap, trap, lofi
- R&B/Soul: rnb, soul, funk
- Jazz: jazz, smooth-jazz, bebop
- Classical: classical, orchestral
- Folk/Acoustic: folk, acoustic, country
- World: latin, reggae, afrobeats
- Other: blues, gospel, soundtrack

**Mood Types**: chill, energetic, happy, sad, angry, romantic, focus, party, workout, sleep, melancholy, uplifting

### embedding-engine.ts

- **Purpose**: Generates dense vector embeddings for tracks from their audio features, genres, and tags
- **Key Exports**:
  - `EmbeddingEngine` class
  - `getEmbeddingEngine()`: Singleton accessor
  - `resetEmbeddingEngine()`: Reset singleton
  - `TrackData` interface: Input data for embedding generation
- **Key Methods**:
  - `generateEmbedding(track)`: Create embedding from track data
  - `getOrGenerateEmbedding(track)`: Get cached or generate new
  - `generateBatch(tracks)`: Batch processing
  - `updateEmbedding(trackId, track)`: Blend new data with existing (70/30 weight)
  - `generateMoodVector(mood)`: Create query vector for mood search
  - `generateGenreQueryVector(genre)`: Create query vector for genre search
  - `exportEmbeddings()` / `importEmbeddings()`: Persistence support
- **Dependencies**:
  - `./types` (type definitions, genre/mood vectors)
  - `../types` (AudioFeatures)
  - `../utils/vector-utils` (normalizeVector)
- **Algorithm**:
  1. Generate vector from audio features (energy, valence, danceability, etc.) using golden ratio spacing
  2. Generate vector from genres using pre-defined genre embeddings
  3. Generate vector from tags (mapped to moods or genres)
  4. Combine vectors by averaging
  5. Normalize to unit length (optional)

  Features second-order interactions (e.g., energy * valence for mood, danceability * BPM for groove).

### vector-index.ts

- **Purpose**: Fast approximate nearest neighbor (ANN) search using a simplified HNSW (Hierarchical Navigable Small World) graph
- **Key Exports**:
  - `VectorIndex` class
  - `getVectorIndex()`: Singleton accessor
  - `resetVectorIndex()`: Reset singleton
  - `VectorIndexConfig` interface
  - `DEFAULT_INDEX_CONFIG`: Default config (100k elements, 128 dimensions)
- **Key Methods**:
  - `add(id, vector)`: Insert vector into index
  - `update(id, vector)`: Update existing vector
  - `remove(id)`: Remove vector from index
  - `search(query, k)`: Find k nearest neighbors (Euclidean distance)
  - `searchByCosine(query, k)`: Find k nearest neighbors (cosine similarity)
  - `bruteForceSearch(query, k)`: Exact search for small indices (<1000)
  - `buildFromEmbeddings(map)`: Bulk build from embedding map
  - `export()` / `import()`: Persistence support
  - `getStats()`: Index statistics
- **Dependencies**:
  - `./types` (SimilarityResult, TrackEmbedding)
  - `../utils/vector-utils` (cosineSimilarity, euclideanDistance)
- **Algorithm**:
  - Multi-layer navigable small world graph
  - Configurable construction parameters (efConstruction: 200, efSearch: 50)
  - Max connections per node (mMax: 16, mMax0: 32 at layer 0)
  - Falls back to brute force for small indices

### taste-profile.ts

- **Purpose**: Builds and maintains user taste profiles from listening history, likes, and interactions
- **Key Exports**:
  - `TasteProfileManager` class
  - `TasteProfileConfig` interface
  - `TrackInteraction` interface
  - `DEFAULT_TASTE_CONFIG`: Default config (128 dims, 30-day decay)
- **Key Methods**:
  - `addInteraction(interaction)`: Record any user interaction
  - `addLike(trackId, embedding, ...)`: Record a liked track
  - `addListen(trackId, embedding, duration, ...)`: Record a listen event
  - `generateProfile()`: Build/update the user's taste profile
  - `getTasteVector()`: Get raw taste embedding
  - `getContextualVector(hour, dayOfWeek)`: Get context-aware taste vector
  - `calculateTrackSimilarity(embedding)`: Score a track against user taste
  - `calculateContextualSimilarity(embedding, hour, day)`: Context-aware scoring
  - `getTopGenres(limit)` / `getTopArtists(limit)`: Profile analytics
  - `getExplorationVector()`: Vector for discovering new music
  - `blendWithMood(moodVector, weight)`: Combine taste with mood
  - `export()` / `import()`: Persistence support
- **Dependencies**:
  - `./types` (UserTasteProfile, TasteProfileStats, ContextualProfiles)
  - `./embedding-engine` (EmbeddingEngine, TrackData)
  - `../utils/vector-utils` (normalizeVector, cosineSimilarity)
- **Features**:
  - Weighted aggregation (likes: 3x, listens: 1x, downloads: 3.6x, playlist-add: 2.4x)
  - Recency decay (exponential, half-life configurable)
  - Completion bonus for finished tracks (1.5x)
  - Contextual profiles: morning, afternoon, evening, night, weekday, weekend
  - Min 5 tracks required for valid profile
  - Max 1000 interactions stored

### cooccurrence.ts

- **Purpose**: Tracks which songs appear together in playlists, queues, and listening sessions for collaborative filtering
- **Key Exports**:
  - `CoOccurrenceMatrix` class
  - `getCoOccurrenceMatrix()`: Singleton accessor
  - `resetCoOccurrenceMatrix()`: Reset singleton
  - `CoOccurrenceConfig` interface
  - `ContextType`: 'queue' | 'playlist' | 'session' | 'radio'
  - `DEFAULT_COOCCURRENCE_CONFIG`: Default config (50k pairs, 0.98 decay)
- **Key Methods**:
  - `recordCoOccurrence(trackIds, context, weight)`: Record tracks appearing together
  - `recordSequentialPlay(prevId, currId, context)`: Record sequential plays (1.5x weight)
  - `recordLikeAfterPlay(playedId, likedId)`: Record like following play (3x weight)
  - `getScore(trackA, trackB)`: Get co-occurrence score for a pair
  - `getRelatedTracks(trackId, limit)`: Get all tracks that co-occur with given track
  - `getRelatedTracksMultiple(trackIds, limit)`: Aggregate related tracks for multiple seeds
  - `generateCollaborativeEmbedding(trackId, dims)`: Create embedding from co-occurrence patterns
  - `getStats()`: Matrix statistics
  - `export()` / `import()`: Persistence support
- **Dependencies**: None (standalone)
- **Features**:
  - Proximity-weighted scoring (closer tracks in playlist get higher weight)
  - Daily decay (0.98 factor) with minimum threshold pruning
  - Hash-based collaborative embedding generation
  - Context tracking (queue, playlist, session, radio)
  - Automatic pruning when exceeding maxPairs

### playlist-generator.ts

- **Purpose**: High-level API that combines all embedding components to generate intelligent playlists
- **Key Exports**:
  - `PlaylistGenerator` class
  - `PlaylistOptions` interface
  - `GeneratedPlaylist` interface
  - `PlaylistTrack` interface
  - `PlaylistMethod` type
  - `PlaylistStats` interface
- **Key Methods**:
  - `registerTrack(track)` / `registerTracks(tracks)`: Add tracks to the generator
  - `generateMoodPlaylist(mood, options)`: Mood-based playlist
  - `generateGenrePlaylist(genre, options)`: Genre-based playlist
  - `generateSeedPlaylist(seedTrackIds, options)`: "Song Radio" style
  - `generatePersonalizedPlaylist(options)`: Personalized for user
  - `generateArtistRadio(artistId, options)`: Artist radio
  - `generateEnergyPlaylist(energy, options)`: Energy-based (low/medium/high)
  - `generateDiscoveryPlaylist(options)`: New music discovery
  - `findSimilarTracks(trackId, limit)`: Find similar tracks
- **Dependencies**:
  - `./types` (SimilarityResult, TrackEmbedding)
  - `./embedding-engine` (EmbeddingEngine, TrackData)
  - `./vector-index` (VectorIndex)
  - `./taste-profile` (TasteProfileManager)
  - `./cooccurrence` (CoOccurrenceMatrix)
  - `../utils/vector-utils` (normalizeVector, averageVectors, blendVectors)
- **Playlist Methods**:
  - `mood`: Query by mood vector, blend with user taste
  - `genre`: Query by genre vector, blend with user taste
  - `seed-tracks`: Average seed embeddings + collaborative boost
  - `artist-radio`: Average artist's track embeddings + collaborative
  - `personalized`: User taste vector, optionally contextual
  - `discovery`: High exploration factor (0.7)
  - `collaborative`: Pure co-occurrence based
  - `hybrid`: Combination of methods
- **Features**:
  - Exploration factor (0 = familiar, 1 = new)
  - Track/artist exclusion
  - Collaborative filtering boost
  - Artist diversity limiting (max 3 tracks per artist)
  - Contextual awareness (hour, day of week)
  - Explanation generation ("Matches your taste", "Frequently played together", etc.)

## Architecture

```
                    ┌─────────────────────────────────────────┐
                    │          PlaylistGenerator              │
                    │  (High-level playlist generation API)   │
                    └─────────────────┬───────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
        v                             v                             v
┌───────────────┐          ┌─────────────────┐          ┌───────────────────┐
│EmbeddingEngine│          │  VectorIndex    │          │TasteProfileManager│
│               │          │                 │          │                   │
│ - Generate    │          │ - HNSW search   │          │ - User prefs      │
│   embeddings  │          │ - k-NN queries  │          │ - Contextual      │
│ - Mood/genre  │          │ - Fast ANN      │          │ - Decay/recency   │
│   vectors     │          │                 │          │                   │
└───────┬───────┘          └────────┬────────┘          └─────────┬─────────┘
        │                           │                             │
        │                           │                             │
        v                           v                             │
┌─────────────────────────────────────────────────────────────────┴────────┐
│                           types.ts                                       │
│  (TrackEmbedding, UserTasteProfile, GENRE_VECTORS, MOOD_VECTORS, etc.)  │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
        ┌──────────────────────────┴──────────────────────────┐
        │                                                      │
        v                                                      v
┌───────────────────┐                              ┌────────────────────┐
│ CoOccurrenceMatrix│                              │ ../utils/vector-   │
│                   │                              │      utils.ts      │
│ - Track pairs     │                              │                    │
│ - Collaborative   │                              │ - cosineSimilarity │
│   filtering       │                              │ - euclideanDistance│
│ - Session/playlist│                              │ - normalizeVector  │
│   patterns        │                              │ - blendVectors     │
└───────────────────┘                              └────────────────────┘
```

## Usage

### Basic Track Indexing

```typescript
import {
  getEmbeddingEngine,
  getVectorIndex,
  type TrackData,
} from './embeddings';

const engine = getEmbeddingEngine();
const index = getVectorIndex();

// Register a track
const track: TrackData = {
  id: 'track-123',
  title: 'Example Song',
  artist: 'Example Artist',
  genres: ['electronic', 'house'],
  audioFeatures: {
    energy: 0.8,
    valence: 0.7,
    danceability: 0.85,
    bpm: 128,
  },
};

// Generate and index embedding
const embedding = engine.generateEmbedding(track);
index.add(track.id, embedding.vector);
```

### Finding Similar Tracks

```typescript
// Find tracks similar to a seed track
const seedEmbedding = engine.getEmbedding('seed-track-id');
if (seedEmbedding) {
  const similar = index.searchByCosine(seedEmbedding.vector, 20);
  // Returns: [{ trackId, score, distance }, ...]
}

// Search by mood
const moodVector = engine.generateMoodVector('chill');
const chillTracks = index.searchByCosine(moodVector, 20);

// Search by genre
const genreVector = engine.generateGenreQueryVector('jazz');
const jazzTracks = index.searchByCosine(genreVector, 20);
```

### User Taste Profiling

```typescript
import { TasteProfileManager } from './embeddings';

const tasteManager = new TasteProfileManager('user-123', engine);

// Record user interactions
tasteManager.addLike('track-456', embedding.vector, ['electronic'], 'artist-789');
tasteManager.addListen('track-789', embedding.vector, 180, 240, ['house']);

// Get personalized recommendations
if (tasteManager.isProfileValid()) {
  const tasteVector = tasteManager.getTasteVector();
  const recommendations = index.searchByCosine(tasteVector!, 20);

  // Get contextual recommendations (evening, weekday)
  const contextVector = tasteManager.getContextualVector(20, 3);
  const eveningRecs = index.searchByCosine(contextVector, 20);
}
```

### Collaborative Filtering

```typescript
import { getCoOccurrenceMatrix } from './embeddings';

const cooccurrence = getCoOccurrenceMatrix();

// Record tracks played together
cooccurrence.recordCoOccurrence(
  ['track-1', 'track-2', 'track-3'],
  'playlist'
);

// Record sequential play
cooccurrence.recordSequentialPlay('track-1', 'track-2', 'session');

// Get related tracks
const related = cooccurrence.getRelatedTracks('track-1', 20);
```

### Generating Playlists

```typescript
import { PlaylistGenerator } from './embeddings';

const generator = new PlaylistGenerator(
  engine,
  index,
  cooccurrence,
  tasteManager
);

// Register tracks
generator.registerTracks(allTracks);

// Generate mood playlist
const chillPlaylist = generator.generateMoodPlaylist('chill', {
  limit: 30,
  explorationFactor: 0.3,
});

// Generate artist radio
const artistRadio = generator.generateArtistRadio('artist-123', {
  limit: 50,
  excludeArtistIds: ['artist-123'], // Don't include seed artist
});

// Generate personalized discovery playlist
const discovery = generator.generateDiscoveryPlaylist({
  limit: 25,
  contextHour: new Date().getHours(),
  contextDayOfWeek: new Date().getDay(),
});

// Access results
for (const track of discovery.tracks) {
  console.log(`${track.trackId}: ${track.score} - ${track.reasons.join(', ')}`);
}
```

## Dependencies

### Internal Dependencies

- `../types` - Core ML types (`AudioFeatures`, `Track`, etc.)
- `../utils/vector-utils` - Vector math utilities:
  - `normalizeVector()` - L2 normalization
  - `cosineSimilarity()` - Cosine similarity calculation
  - `euclideanDistance()` - Euclidean distance calculation
  - `averageVectors()` - Average multiple vectors
  - `blendVectors()` - Weighted combination of vectors

### External Dependencies

None - this module is self-contained and uses only standard JavaScript/TypeScript features and typed arrays (`Float32Array`).

## Related

- **Parent Module**: `packages/server/src/ml/` - The complete ML system
- **Vector Utilities**: `packages/server/src/ml/utils/vector-utils.ts` - Shared vector operations
- **ML Types**: `packages/server/src/ml/types/` - Core type definitions
- **ML Engine**: `packages/server/src/ml/engine/` - Orchestration of ML components
- **ML Providers**: `packages/server/src/ml/providers/embedding-provider.ts` - Embedding provider for the ML engine
