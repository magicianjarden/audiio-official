# ML System

Audiio includes a machine learning system for personalized recommendations, radio generation, and smart queue management.

## Overview

The ML system runs on the server and learns from your listening behavior:

- What you play, skip, and finish
- What you like and dislike
- When and how long you listen
- Genre and artist preferences

## Components

```
┌─────────────────────────────────────────────────────────────────┐
│                          ML Engine                              │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │   Feature    │  │  Embedding   │  │     Algorithm      │   │
│  │  Extractor   │  │   Engine     │  │     Registry       │   │
│  └──────────────┘  └──────────────┘  └────────────────────┘   │
│         │                │                    │                │
│         └────────────────┴────────────────────┘                │
│                          │                                      │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    Scoring Engine                         │ │
│  │                                                          │ │
│  │  • Neural Scorer (deep learning)                         │ │
│  │  • Hybrid Scorer (combined signals)                      │ │
│  │  • Radio Generator                                       │ │
│  └──────────────────────────────────────────────────────────┘ │
│                          │                                      │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                   Training Pipeline                       │ │
│  │                                                          │ │
│  │  • Event Recording                                       │ │
│  │  • Preference Store                                      │ │
│  │  • Model Training                                        │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Features

### Personalized Recommendations

```bash
GET /api/algo/recommendations?limit=20
```

Returns tracks based on:
- Listening history
- Liked/disliked tracks
- Similar user patterns
- Time of day preferences

### Radio Generation

Generate endless playlists:

```bash
# Based on a track
GET /api/algo/radio/track/:trackId

# Based on an artist
GET /api/algo/radio/artist/:artistId

# Based on a genre
GET /api/algo/radio/genre/rock

# Based on a mood
GET /api/algo/radio/mood/energetic
```

### Smart Queue

Automatic next-track suggestions:

```bash
POST /api/algo/queue/next
{
  "currentTrackId": "xyz",
  "count": 5
}
```

### Track Scoring

Score tracks for ranking/sorting:

```bash
# Score a single track
GET /api/algo/score/:trackId

# Score multiple tracks
POST /api/algo/score/batch
{
  "trackIds": ["a", "b", "c"]
}
```

### Similar Tracks

Find tracks similar to a given track:

```bash
GET /api/algo/similar/:trackId?limit=10
```

## How It Works

### 1. Event Collection

Every interaction is recorded:

```typescript
// Automatically tracked by clients
{
  type: 'play_start' | 'skip' | 'complete',
  trackId: string,
  position: number,      // Where in track (ms)
  duration: number,      // Track duration
  timestamp: Date,
  context: 'search' | 'playlist' | 'radio' | 'recommendation'
}
```

### 2. Feature Extraction

From each track:
- Audio features (tempo, energy, key)
- Metadata (genre, artist, year)
- Listening patterns (time of day, day of week)
- Social signals (popularity, trending)

### 3. User Profile

Built from listening history:
- Artist affinities
- Genre preferences
- Audio feature preferences
- Time-based patterns

### 4. Scoring

Tracks are scored using:

**Neural Scorer**
- Deep learning model
- Learns complex patterns
- Trained on your history

**Hybrid Scorer**
- Combines multiple signals
- Content-based filtering
- Collaborative filtering

### 5. Training

Models retrain automatically:
- After significant listening activity
- On server restart
- Manually via API

```bash
POST /api/algo/train
```

## Configuration

The ML system runs automatically when the server starts. It uses internal configuration and doesn't require manual setup in `config.yml`.

The engine auto-trains based on listening activity and can be manually triggered via:

```bash
POST /api/algo/train
```

## Data Storage

ML data is stored in:
- `data/audiio.db` - Events and preferences
- `data/ml/` - Trained models (TensorFlow.js format)

## API Reference

### GET /api/algo/status

Check ML system status:

```json
{
  "enabled": true,
  "lastTraining": "2024-01-15T12:00:00Z",
  "eventCount": 1234,
  "modelVersion": "1.0.0"
}
```

### GET /api/algo/profile

Get user taste profile:

```json
{
  "topGenres": ["rock", "electronic", "jazz"],
  "topArtists": ["Artist A", "Artist B"],
  "audioPreferences": {
    "energy": 0.7,
    "tempo": 120,
    "valence": 0.6
  },
  "listeningPatterns": {
    "peakHours": [20, 21, 22],
    "avgSessionLength": 45
  }
}
```

### POST /api/algo/event

Record listening event:

```json
{
  "type": "complete",
  "trackId": "xyz",
  "position": 180000,
  "duration": 180000
}
```

### GET /api/algo/embedding/:trackId

Get track embedding vector:

```json
{
  "trackId": "xyz",
  "embedding": [0.1, 0.2, 0.3, ...]
}
```

### POST /api/algo/embedding/similar

Find tracks by embedding similarity:

```json
{
  "embedding": [0.1, 0.2, 0.3, ...],
  "count": 10
}
```

## Privacy

All ML processing happens locally on your server:
- No data sent to external services
- Models trained on your data only
- You control your listening history

## Disabling ML

The ML system is always enabled but gracefully degrades if no training data is available. Without listening history, recommendations will use simpler algorithms (random, popularity-based).
