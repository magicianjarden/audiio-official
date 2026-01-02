# Audiio REST API

The mobile server exposes a comprehensive REST API for remote control, streaming, and library management. This API is used by the mobile web app and can be accessed via local network or P2P relay.

## Base URL

- **Local Network**: `http://192.168.x.x:9484/api`
- **P2P Relay**: Tunneled through WebSocket (transparent to client)

## Authentication

All API endpoints (except `/api/health`) require authentication via one of:

| Method | Usage |
|--------|-------|
| **Query Parameter** | `?token=YOUR_TOKEN` |
| **Authorization Header** | `Authorization: Bearer YOUR_TOKEN` |
| **P2P Header** | `X-P2P-Request: true` (for relay connections) |
| **Device Token** | `deviceId:tokenValue` format |

---

## Endpoints Overview

| Category | Endpoints | Description |
|----------|-----------|-------------|
| [Health](#health--status) | 1 | Server status |
| [Search & Discovery](#search--discovery) | 9 | Search, browse, trending |
| [Playback Control](#playback-control) | 5 | Play, pause, seek, state |
| [Audio Streaming](#audio-streaming) | 2 | Stream resolution |
| [Queue Management](#queue-management) | 4 | Queue operations |
| [Lyrics](#lyrics) | 1 | Lyrics lookup |
| [Translation](#translation) | 1 | Text translation |
| [Library](#library-management) | 12 | Likes, dislikes, playlists |
| [Plugins/Addons](#pluginsaddons) | 5 | Addon management |
| [ML/Algorithm](#mlalgorithm) | 5 | Recommendations, features |
| [Authentication](#authentication) | 11 | Pairing, devices, tokens |
| [Sessions](#sessions) | 2 | Active sessions |
| [Access Management](#access-management) | 5 | Tokens, relay config |
| [Artist Enrichment](#artist-enrichment) | 7 | Videos, concerts, gallery |
| [WebSocket](#websocket) | 1 | Real-time sync |

**Total: 60+ endpoints**

---

## Health & Status

### Health Check

```http
GET /api/health
```

Returns server status. **No authentication required**.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1703692800000,
  "activeSessions": 2
}
```

---

## Search & Discovery

### Search

```http
GET /api/search?q={query}&type={type}&limit={limit}
```

Search for tracks, artists, and albums across all metadata providers.

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query (required) |
| `type` | string | Filter: `track`, `artist`, `album` |
| `limit` | number | Max results (default: 25) |

**Response:**
```json
{
  "tracks": [
    {
      "id": "123",
      "title": "Song Name",
      "artist": "Artist Name",
      "artists": [{ "id": "a1", "name": "Artist Name" }],
      "artwork": "https://...",
      "duration": 210
    }
  ],
  "artists": [...],
  "albums": [...]
}
```

### Get Artist

```http
GET /api/artist/{artistId}?name={name}&source={source}
```

Get artist details including top tracks, albums, and similar artists.

**Response:**
```json
{
  "id": "123",
  "name": "Artist Name",
  "image": "https://...",
  "followers": 1500000,
  "topTracks": [...],
  "albums": [...],
  "singles": [...],
  "similarArtists": [...]
}
```

### Get Album

```http
GET /api/album/{albumId}?source={source}
```

Get album details with track listing.

**Response:**
```json
{
  "id": "456",
  "title": "Album Name",
  "artist": "Artist Name",
  "artwork": "https://...",
  "year": "2024",
  "tracks": [...]
}
```

### Trending

```http
GET /api/trending
```

Get trending/chart content.

**Response:**
```json
{
  "tracks": [...],
  "artists": [...],
  "albums": [...]
}
```

### Discover Home

```http
GET /api/discover
```

Get personalized home page content.

**Response:**
```json
{
  "recentlyPlayed": [...],
  "quickPicks": [...],
  "forYou": [...],
  "mixes": [...],
  "tracks": [...],
  "artists": [...],
  "albums": [...]
}
```

### Discover Sections

```http
GET /api/discover/sections
```

Get structured sections for home page (plugin-powered).

### Genres

```http
GET /api/discover/genres
GET /api/discover/genre/{genreId}?limit={limit}
```

Get available genres and tracks by genre.

### Radio

```http
GET /api/discover/radio/{trackId}?limit={limit}
```

Get radio/similar tracks (ML or metadata powered).

---

## Playback Control

### Play Track

```http
POST /api/playback/play
Content-Type: application/json

{
  "track": {
    "id": "123",
    "title": "Song Name",
    ...
  }
}
```

### Pause

```http
POST /api/playback/pause
```

### Resume

```http
POST /api/playback/resume
```

### Seek

```http
POST /api/playback/seek
Content-Type: application/json

{
  "position": 45500
}
```

Position in milliseconds.

### Get Playback State

```http
GET /api/playback/state
```

**Response:**
```json
{
  "isPlaying": true,
  "currentTrack": {...},
  "position": 45500,
  "duration": 210000,
  "volume": 0.8
}
```

---

## Audio Streaming

### Resolve Stream

```http
POST /api/stream/resolve
Content-Type: application/json

{
  "track": { ... }
}
```

Resolve stream URL without triggering desktop playback (for local playback mode).

**Response:**
```json
{
  "url": "https://...",
  "quality": "high",
  "format": "mp3",
  "expiresAt": 1703696400000
}
```

### Get Stream

```http
GET /api/stream/{trackId}
```

Returns audio stream or redirects to stream URL.

---

## Queue Management

Queue operations are sent via WebSocket remote commands:

| Command | Description |
|---------|-------------|
| `addToQueue` | Add track to end of queue |
| `playNext` | Add track to play next |
| `playFromQueue` | Play specific track from queue |
| `clearQueue` | Clear the queue |

See [WebSocket](#websocket) section for usage.

---

## Lyrics

### Get Lyrics

```http
GET /api/lyrics?title={title}&artist={artist}&album={album}&duration={duration}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `title` | string | Track title (required) |
| `artist` | string | Artist name (required) |
| `album` | string | Album name |
| `duration` | number | Track duration in seconds |

**Response:**
```json
{
  "synced": [
    { "time": 0, "text": "First line..." },
    { "time": 3500, "text": "Second line..." }
  ],
  "plain": "Full lyrics text...",
  "source": "lrclib"
}
```

---

## Translation

### Translate Text

```http
POST /api/translate
Content-Type: application/json

{
  "text": "Hello world",
  "source": "en",
  "target": "es"
}
```

Uses MyMemory API with LibreTranslate fallback.

**Response:**
```json
{
  "translatedText": "Hola mundo"
}
```

---

## Library Management

### Liked Tracks

```http
GET /api/library/likes                    # Get all liked tracks
POST /api/library/likes                   # Like a track
DELETE /api/library/likes/{trackId}       # Unlike a track
GET /api/library/likes/{trackId}          # Check if liked
```

### Disliked Tracks

```http
GET /api/library/dislikes                 # Get all disliked tracks
POST /api/library/dislikes                # Dislike a track (with reasons)
DELETE /api/library/dislikes/{trackId}    # Remove dislike
```

**Dislike Request:**
```json
{
  "track": { ... },
  "reasons": ["dont_like_song", "too_repetitive"]
}
```

### Playlists

```http
GET /api/library/playlists                          # Get all playlists
POST /api/library/playlists                         # Create playlist
GET /api/library/playlists/{id}                     # Get playlist details
PUT /api/library/playlists/{id}                     # Rename playlist
DELETE /api/library/playlists/{id}                  # Delete playlist
POST /api/library/playlists/{id}/tracks             # Add track
DELETE /api/library/playlists/{id}/tracks/{trackId} # Remove track
```

**Create Playlist:**
```json
{
  "name": "My Playlist",
  "description": "Optional description"
}
```

---

## Plugins/Addons

### List Addons

```http
GET /api/addons
```

**Response:**
```json
{
  "addons": [
    {
      "id": "deezer",
      "name": "Deezer",
      "roles": ["metadata-provider"],
      "enabled": true,
      "priority": 50
    }
  ]
}
```

### Get/Update Settings

```http
GET /api/addons/{addonId}/settings
POST /api/addons/{addonId}/settings
```

### Enable/Disable

```http
POST /api/addons/{addonId}/enabled
Content-Type: application/json

{
  "enabled": true
}
```

### Reorder Addons

```http
POST /api/addons/order
Content-Type: application/json

{
  "orderedIds": ["deezer", "lrclib", "youtube"]
}
```

### Get Priorities

```http
GET /api/addons/priorities
```

---

## ML/Algorithm

### Status

```http
GET /api/algo/status
```

**Response:**
```json
{
  "available": true,
  "initialized": true,
  "training": null,
  "modelVersion": "1.2.0"
}
```

### Recommendations

```http
GET /api/algo/recommendations?count={count}
```

Get personalized track recommendations.

### Similar Tracks

```http
GET /api/algo/similar/{trackId}?count={count}
```

### Record Event

```http
POST /api/algo/event
Content-Type: application/json

{
  "type": "skip",
  "track": {...},
  "skipTime": 15,
  "context": "queue"
}
```

Event types: `skip`, `listen`, `like`, `dislike`

### Audio Features

```http
GET /api/algo/features/{trackId}
```

**Response:**
```json
{
  "bpm": 120,
  "key": "C",
  "mode": "major",
  "energy": 0.8,
  "danceability": 0.7,
  "valence": 0.6
}
```

---

## Authentication

### Pair with Code

```http
POST /api/auth/pair
Content-Type: application/json

{
  "pairingCode": "BLUE-TIGER-42",
  "deviceName": "My iPhone"
}
```

**Response:**
```json
{
  "success": true,
  "deviceToken": "device_xxx:token_yyy",
  "deviceId": "device_xxx"
}
```

### Check Pairing Code

```http
GET /api/auth/pair/check?code={code}
```

### Login with Password

```http
POST /api/auth/login
Content-Type: application/json

{
  "password": "blue-tiger-42",
  "deviceName": "My iPhone",
  "rememberDevice": true
}
```

### Device Token Auth

```http
POST /api/auth/device
Content-Type: application/json

{
  "deviceToken": "device_xxx:token_yyy"
}
```

### Refresh Token

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "deviceId": "device_xxx",
  "token": "token_yyy"
}
```

### Logout

```http
POST /api/auth/logout
Content-Type: application/json

{
  "deviceId": "device_xxx"
}
```

### Device Management

```http
GET /api/auth/devices              # List authorized devices
DELETE /api/auth/devices/{id}      # Revoke device
```

**Device List Response:**
```json
{
  "devices": [
    {
      "id": "device_xxx",
      "name": "My iPhone",
      "lastSeen": "2024-01-15T12:00:00Z",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Auth Settings

```http
GET /api/auth/settings
POST /api/auth/settings
```

---

## Sessions

### List Sessions

```http
GET /api/sessions
```

**Response:**
```json
{
  "sessions": [
    {
      "id": "sess_xxx",
      "deviceName": "iPhone",
      "connectedAt": "2024-01-01T12:00:00Z"
    }
  ],
  "total": 1
}
```

### End Session

```http
DELETE /api/sessions/{sessionId}
```

---

## Access Management

### Rotate Token

```http
POST /api/access/rotate
```

Rotates access token, invalidating all existing sessions.

### Get Access Info

```http
GET /api/access/info
```

**Response:**
```json
{
  "localUrl": "http://192.168.1.100:9484",
  "p2pCode": "SWIFT-EAGLE-42",
  "relayCode": "SWIFT-EAGLE-42",
  "hasRemoteAccess": true,
  "relayActive": true,
  "qrCode": "data:image/png;base64,..."
}
```

### Refresh Pairing Code

```http
POST /api/access/refresh
```

### Relay Configuration

```http
GET /api/access/relay          # Get custom relay URL
POST /api/access/relay         # Set custom relay URL
```

---

## Artist Enrichment

Plugin-powered artist enrichment endpoints.

### Available Types

```http
GET /api/enrichment/types
```

**Response:**
```json
{
  "types": ["videos", "concerts", "setlists", "gallery", "merchandise"]
}
```

### Videos

```http
GET /api/enrichment/videos/{artistName}?limit={limit}
```

**Response:**
```json
{
  "videos": [
    {
      "id": "video-1",
      "title": "Official Music Video",
      "thumbnail": "https://...",
      "duration": 240,
      "source": "youtube"
    }
  ]
}
```

### Timeline

```http
GET /api/enrichment/timeline/{artistName}
```

### Setlists

```http
GET /api/enrichment/setlists/{artistName}?mbid={mbid}&limit={limit}
```

### Concerts

```http
GET /api/enrichment/concerts/{artistName}
```

### Gallery

```http
GET /api/enrichment/gallery/{artistName}?mbid={mbid}
```

**Response:**
```json
{
  "backgrounds": ["https://..."],
  "thumbnails": ["https://..."],
  "logos": ["https://..."],
  "banners": ["https://..."]
}
```

### Merchandise

```http
GET /api/enrichment/merchandise/{artistName}
```

---

## WebSocket

### Connect

```
WS /ws?token={token}
```

### Message Types

#### Ping (Keep-alive)

```json
{ "type": "ping" }
```

#### Playback Sync

Broadcast playback state to other sessions:

```json
{
  "type": "playback-sync",
  "state": {
    "isPlaying": true,
    "currentTrack": {...},
    "position": 45500
  }
}
```

#### Remote Command

Send commands to desktop:

```json
{
  "type": "remote-command",
  "command": "play",
  "track": {...}
}
```

Available commands:

| Command | Parameters | Description |
|---------|------------|-------------|
| `play` | `track` | Play specific track |
| `pause` | - | Pause playback |
| `resume` | - | Resume playback |
| `next` | - | Skip to next track |
| `previous` | - | Go to previous track |
| `seek` | `position` | Seek to position (ms) |
| `volume` | `level` | Set volume (0-1) |
| `addToQueue` | `track` | Add to queue |
| `playNext` | `track` | Add to play next |
| `playFromQueue` | `index` | Play from queue index |
| `shuffle` | `enabled` | Toggle shuffle |
| `repeat` | `mode` | Set repeat mode |

#### Request Desktop State

```json
{ "type": "request-desktop-state" }
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error type",
  "message": "Human-readable message",
  "code": "ERROR_CODE"
}
```

### Status Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Missing/invalid parameters |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 410 | Gone - Deprecated endpoint |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Error - Server error |
| 503 | Service Unavailable - Feature not configured |

### Common Error Codes

| Code | Description |
|------|-------------|
| `INVALID_TOKEN` | Authentication token is invalid |
| `TOKEN_EXPIRED` | Token has expired |
| `DEVICE_NOT_FOUND` | Device ID not recognized |
| `TRACK_NOT_FOUND` | Track ID not found |
| `PROVIDER_ERROR` | External provider error |
| `RATE_LIMITED` | Too many requests |

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

| Endpoint Type | Limit |
|---------------|-------|
| Authentication | 10 req/min |
| Search | 30 req/min |
| Streaming | 60 req/min |
| Other | 100 req/min |

Rate limit headers:
- `X-RateLimit-Limit`: Maximum requests
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

---

## Data Transformation

Mobile API responses apply transformations for compatibility:

1. **Artwork**: Objects converted to flat URL strings
2. **Artists**: Always returned as array
3. **Track data**: Normalized with consistent fields
4. **Dates**: ISO 8601 format

---

## Next Steps

- [Mobile Server](../development/mobile-server.md) - Server internals
- [Relay](../relay/README.md) - P2P relay documentation
- [SDK](../sdk/README.md) - Build addons
- [Architecture](../development/architecture.md) - System design
