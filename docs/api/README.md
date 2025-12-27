# Audiio REST API

The mobile server exposes a REST API for remote control and streaming. This API is used by the mobile web app and can be accessed via local network or P2P relay.

## Base URL

- **Local Network**: `http://192.168.x.x:9484/api`
- **P2P Relay**: Tunneled through WebSocket (transparent to client)

## Authentication

All API endpoints (except `/api/health`) require authentication via:

- **Query Parameter**: `?token=YOUR_TOKEN`
- **Authorization Header**: `Authorization: Bearer YOUR_TOKEN`
- **P2P Header**: `X-P2P-Request: true` (for relay connections)

## Endpoints

### Health Check

```http
GET /api/health
```

Returns server status. No authentication required.

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

Search for tracks, artists, and albums.

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query (required) |
| `type` | string | Filter by type: `track`, `artist`, `album` |
| `limit` | number | Max results (default: 25) |

**Response:**
```json
{
  "tracks": [
    {
      "id": "123",
      "title": "Song Name",
      "artist": "Artist Name",
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
GET /api/artist/{artistId}?source={source}&name={name}
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

### Discover

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
  "position": 45.5
}
```

### Get State

```http
GET /api/playback/state
```

**Response:**
```json
{
  "isPlaying": true,
  "currentTrack": {...},
  "position": 45.5,
  "duration": 210,
  "volume": 0.8
}
```

---

## Audio Streaming

### Get Stream

```http
GET /api/stream/{trackId}
```

Returns audio stream or redirects to stream URL.

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

**Response:**
```json
{
  "translatedText": "Hola mundo"
}
```

---

## Library

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
POST /api/library/dislikes                # Dislike a track
DELETE /api/library/dislikes/{trackId}    # Remove dislike
```

### Playlists

```http
GET /api/library/playlists                # Get all playlists
POST /api/library/playlists               # Create playlist
GET /api/library/playlists/{id}           # Get playlist details
PUT /api/library/playlists/{id}           # Rename playlist
DELETE /api/library/playlists/{id}        # Delete playlist
POST /api/library/playlists/{id}/tracks   # Add track
DELETE /api/library/playlists/{id}/tracks/{trackId}  # Remove track
```

---

## Addons/Plugins

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
      "enabled": true
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

### Reorder

```http
POST /api/addons/order
Content-Type: application/json

{
  "orderedIds": ["deezer", "lrclib", "youtube"]
}
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
  "training": null
}
```

### Recommendations

```http
GET /api/algo/recommendations?count={count}
```

### Similar Tracks

```http
GET /api/algo/similar/{trackId}?count={count}
```

### Record Event

```http
POST /api/algo/event
Content-Type: application/json

{
  "type": "skip",       // skip | listen | like | dislike
  "track": {...},
  "skipTime": 15
}
```

### Audio Features

```http
GET /api/algo/features/{trackId}
```

---

## Authentication

### Pair via QR Code

```http
POST /api/auth/pair
Content-Type: application/json

{
  "pairingCode": "ABC123",
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

### Passphrase Management

```http
GET /api/auth/passphrase           # Get current passphrase
POST /api/auth/passphrase/regenerate  # Generate new passphrase
POST /api/auth/password            # Set custom password
```

### Settings

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
  "relayActive": true
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error type",
  "message": "Human-readable message"
}
```

Common status codes:

| Code | Description |
|------|-------------|
| 400 | Bad Request - Missing/invalid parameters |
| 401 | Unauthorized - Invalid or missing token |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Error - Server error |
| 503 | Service Unavailable - Feature not configured |
