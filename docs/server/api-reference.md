# API Reference

Base URL: `http://localhost:8484`

All endpoints return JSON. Authentication via `Authorization: Bearer <token>` header when pairing is required.

## Health & Info

### GET /health
Server health check.

```json
{"status": "ok", "version": "0.1.0", "uptime": 12345}
```

### GET /api/info
Server info with loaded plugins and library stats.

## Search & Discovery

### GET /api/search
Search for tracks, artists, albums.

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Search query (required) |
| `limit` | number | Max results (default: 20) |

### GET /api/trending
Get trending/chart content from metadata providers.

### GET /api/discover
Get personalized discovery content.

| Param | Type | Description |
|-------|------|-------------|
| `limit` | number | Items per section (default: 10) |

Returns: `recentlyPlayed`, `quickPicks`, `forYou`, `mixes`

### GET /api/artist/:artistId
Get artist details.

### GET /api/album/:albumId
Get album details with tracks.

## Streaming

### GET /api/stream/resolve
Resolve a playable stream URL.

| Param | Type | Description |
|-------|------|-------------|
| `trackId` | string | Track ID |
| `title` | string | Track title (alternative to trackId) |
| `artist` | string | Artist name |
| `isrc` | string | ISRC code (optional) |

### GET /api/stream/proxy
Proxy audio stream (bypasses CORS).

| Param | Type | Description |
|-------|------|-------------|
| `url` | string | Stream URL to proxy |

## Library

### GET /api/library/likes
Get liked tracks.

### POST /api/library/likes
Like a track.

```json
{"track": {...}}
```

### DELETE /api/library/likes/:trackId
Unlike a track.

### GET /api/library/likes/:trackId
Check if track is liked.

### GET /api/library/dislikes
Get disliked tracks.

### POST /api/library/dislikes
Dislike a track.

```json
{"track": {...}, "reasons": ["not my taste"]}
```

### DELETE /api/library/dislikes/:trackId
Remove dislike.

### GET /api/library/playlists
List playlists.

### POST /api/library/playlists
Create playlist.

```json
{"name": "My Playlist", "description": "..."}
```

### GET /api/library/playlists/:playlistId
Get playlist with tracks.

### PUT /api/library/playlists/:playlistId
Rename playlist.

```json
{"name": "New Name"}
```

### DELETE /api/library/playlists/:playlistId
Delete playlist.

### POST /api/library/playlists/:playlistId/tracks
Add track to playlist.

```json
{"track": {...}}
```

### DELETE /api/library/playlists/:playlistId/tracks/:trackId
Remove track from playlist.

### POST /api/library/history
Record a play event.

```json
{"track": {...}, "duration": 180}
```

## Lyrics

### GET /api/lyrics
Get lyrics for a track.

| Param | Type | Description |
|-------|------|-------------|
| `title` | string | Track title (required) |
| `artist` | string | Artist name (required) |
| `album` | string | Album name (optional) |
| `duration` | number | Track duration in seconds |

## Plugins / Addons

### GET /api/addons
List loaded plugins.

### POST /api/addons/:addonId/enabled
Enable or disable plugin.

```json
{"enabled": true}
```

### GET /api/addons/:addonId/settings
Get plugin settings.

### POST /api/addons/:addonId/settings
Update plugin settings.

```json
{"settings": {...}}
```

### GET /api/plugins/repositories
List plugin repositories.

### POST /api/plugins/repositories
Add repository.

```json
{"url": "https://plugins.example.com/registry.json"}
```

### DELETE /api/plugins/repositories/:repoId
Remove repository.

### POST /api/plugins/repositories/:repoId/refresh
Refresh repository.

### GET /api/plugins/available
List available plugins from repositories.

### GET /api/plugins/search
Search for plugins.

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Search query |

### POST /api/plugins/install
Install plugin.

```json
{"downloadUrl": "https://example.com/plugin.zip"}
```

### POST /api/plugins/:pluginId/uninstall
Uninstall plugin.

### GET /api/plugins/updates
Check for plugin updates.

### GET /api/plugins/routes
List all registered plugin routes.

### GET /api/plugins/:pluginId/routes
List routes for a specific plugin.

## ML / Recommendations

### GET /api/algo/status
Check ML system status.

```json
{"available": true, "initialized": true, "training": {...}}
```

### GET /api/algo/recommendations
Get personalized recommendations.

| Param | Type | Description |
|-------|------|-------------|
| `count` | number | Number of tracks (default: 20) |

### GET /api/algo/similar/:trackId
Find similar tracks.

| Param | Type | Description |
|-------|------|-------------|
| `count` | number | Number of tracks (default: 10) |

### POST /api/algo/event
Record listening event for training.

```json
{"type": "listen", "track": {...}}
```

### GET /api/algo/features/:trackId
Get audio features for a track.

### POST /api/algo/train
Trigger model training.

### GET /api/algo/training/status
Get training status.

### GET /api/algo/training/history
Get training history.

### GET /api/algo/profile
Get user taste profile.

### POST /api/algo/preferences
Update ML preferences.

```json
{"explorationLevel": 0.5, "diversityWeight": 0.5}
```

### GET /api/algo/radio/track/:trackId
Generate track-based radio.

### GET /api/algo/radio/artist/:artistId
Generate artist-based radio.

### GET /api/algo/radio/genre/:genre
Generate genre-based radio.

### GET /api/algo/radio/mood/:mood
Generate mood-based radio.

### GET /api/algo/score/:trackId
Score a single track.

### POST /api/algo/score/batch
Score multiple tracks.

```json
{"trackIds": ["id1", "id2"]}
```

### POST /api/algo/queue/next
Get next queue candidates.

```json
{
  "count": 10,
  "currentTrackId": "...",
  "recentTrackIds": [],
  "recentArtists": [],
  "enforceVariety": true
}
```

### GET /api/algo/embedding/:trackId
Get track embedding vector.

### POST /api/algo/embedding/similar
Find tracks by embedding similarity.

```json
{"embedding": [...], "count": 10}
```

## Tracking

### POST /api/tracking/event
Record single tracking event.

```json
{"type": "play_start", "sessionId": "...", "trackId": "..."}
```

### POST /api/tracking/batch
Batch record events.

```json
{"events": [...]}
```

### POST /api/tracking/session
Start new session.

```json
{"deviceId": "...", "deviceType": "desktop", "deviceName": "My PC"}
```

### POST /api/tracking/session/:sessionId/end
End session.

### GET /api/tracking/session/:sessionId
Get session summary.

### GET /api/tracking/sessions
Get recent sessions.

### GET /api/tracking/events
Query events with filters.

| Param | Type | Description |
|-------|------|-------------|
| `startTime` | number | Start timestamp (ms) |
| `endTime` | number | End timestamp (ms) |
| `types` | string | Comma-separated event types |
| `sessionId` | string | Filter by session |
| `trackId` | string | Filter by track |
| `limit` | number | Max results |
| `offset` | number | Offset for pagination |

## Statistics

### GET /api/stats/overview
Get listening overview.

### GET /api/stats/listening
Get listening time stats.

| Param | Type | Description |
|-------|------|-------------|
| `period` | string | `day`, `week`, `month`, `year`, `all` |

### GET /api/stats/top/artists
Get top artists.

| Param | Type | Description |
|-------|------|-------------|
| `limit` | number | Max results (default: 10) |
| `period` | string | `week`, `month`, `year`, `all` |

### GET /api/stats/top/tracks
Get top tracks.

### GET /api/stats/top/genres
Get top genres.

### GET /api/stats/top/albums
Get top albums.

### GET /api/stats/patterns
Get listening patterns (by hour, day).

### GET /api/stats/streaks
Get listening streaks.

### POST /api/stats/refresh
Refresh aggregated stats.

## Artist Enrichment

### GET /api/enrichment/types
Get available enrichment types.

### GET /api/enrichment/videos/:artistName
Get music videos.

### GET /api/enrichment/timeline/:artistName
Get career timeline.

### GET /api/enrichment/setlists/:artistName
Get concert setlists.

### GET /api/enrichment/concerts/:artistName
Get upcoming concerts.

### GET /api/enrichment/gallery/:artistName
Get artist images.

## Authentication

### GET /api/auth/identity
Get server public identity.

### POST /api/auth/pairing-token
Generate pairing token and QR code.

### POST /api/auth/pair
Complete device pairing.

```json
{
  "pairingToken": "SWIFT-EAGLE-42",
  "deviceId": "unique-device-id",
  "deviceName": "My Phone",
  "publicKey": "base64-encoded-public-key"
}
```

### POST /api/auth/challenge
Get authentication challenge.

```json
{"deviceId": "unique-device-id"}
```

### POST /api/auth/verify
Verify challenge signature.

```json
{
  "deviceId": "unique-device-id",
  "signature": "signed-challenge-base64"
}
```

### POST /api/auth/validate
Validate a session token.

### GET /api/auth/devices
List trusted devices.

### DELETE /api/auth/devices/:deviceId
Revoke device.

### PATCH /api/auth/devices/:deviceId
Update device info.

### GET /api/auth/devices/:deviceId/trusted
Check if device is trusted.
