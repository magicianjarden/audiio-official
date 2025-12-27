# Addons Overview

Extend Audiio with addons for new music sources, features, and integrations.

## What Are Addons?

Addons are plugins that add functionality to Audiio:

- **Music Sources** - Get music from different services
- **Lyrics** - Synced lyrics from various providers
- **Scrobbling** - Track listening history
- **Audio Processing** - Karaoke, stem separation
- **Integrations** - Connect with other services

## Addon Types

### Metadata Providers

Provide track, artist, and album information:

| Addon | Description |
|-------|-------------|
| Deezer Metadata | Track info from Deezer |
| Apple Music Artwork | High-quality album art |
| MusicBrainz | Open music database |

### Stream Providers

Provide audio streams for playback:

| Addon | Description |
|-------|-------------|
| YouTube Music | Streams from YouTube |
| SoundCloud | SoundCloud tracks |
| Bandcamp | Bandcamp music |

### Lyrics Providers

Provide synced or plain lyrics:

| Addon | Description |
|-------|-------------|
| LRCLib | Large synced lyrics database |
| Musixmatch | Popular lyrics service |
| Genius | Lyrics and annotations |

### Audio Processors

Process audio in real-time:

| Addon | Description |
|-------|-------------|
| Karaoke | Vocal removal |
| Equalizer+ | Advanced EQ |
| Normalizer | Volume leveling |

### Scrobblers

Track and share listening history:

| Addon | Description |
|-------|-------------|
| Last.fm | Social music platform |
| ListenBrainz | Open-source scrobbler |
| Discord Rich Presence | Show playing in Discord |

## Built-in Addons

These addons come pre-installed:

| Addon | Enabled by Default |
|-------|-------------------|
| Deezer Metadata | ✅ Yes |
| YouTube Music | ✅ Yes |
| LRCLib Lyrics | ✅ Yes |
| Apple Music Artwork | ✅ Yes |
| Audiio Recommendations | ✅ Yes |

## Getting More Addons

### Addon Gallery

1. Go to **Settings** > **Addons**
2. Click **Browse Addons**
3. Find addons you want
4. Click **Install**

### Community Addons

Community-created addons available from:
- GitHub repositories
- Audiio community forums
- Third-party sources

### Installing Manually

For addons not in the gallery:

1. Download addon file (.audiio-addon)
2. Go to **Settings** > **Addons**
3. Click **Install from File**
4. Select the addon file

## Managing Addons

See [Managing Addons](managing.md) for:

- Enabling/disabling addons
- Configuring addon settings
- Reordering provider priority
- Updating addons
- Removing addons

## How Addons Work

### Provider Priority

When multiple addons provide the same type:

1. Audiio tries the first provider
2. If it fails, tries the next
3. First successful result is used

Example for lyrics:
```
1. LRCLib (try first)
2. Musixmatch (fallback)
3. Genius (last resort)
```

### Data Flow

```
Search Query
     │
     ▼
┌──────────────┐
│  Metadata    │ ──► Track info
│  Providers   │
└──────────────┘
     │
     ▼
┌──────────────┐
│   Stream     │ ──► Audio URL
│  Providers   │
└──────────────┘
     │
     ▼
┌──────────────┐
│   Lyrics     │ ──► Synced lyrics
│  Providers   │
└──────────────┘
```

## Addon Settings

Each addon may have its own settings:

### Common Settings

| Setting | Description |
|---------|-------------|
| Enabled | Turn addon on/off |
| Priority | Order among same type |
| API Key | If required by service |
| Cache | Enable result caching |

### Per-Addon Settings

Some addons have specific settings:
- Quality preferences
- Region settings
- Account credentials
- Behavior options

## Safety & Privacy

### Trusted Sources

Only install addons from:
- Built-in addons (verified)
- Official gallery (reviewed)
- Trusted developers

### Permissions

Addons may request:
- Network access
- File system access (limited)
- System integration

### Data Handling

- Addons see track info you play
- External services may log data
- Check addon privacy policy

## Troubleshooting

### Addon Not Working

1. Check addon is enabled
2. Verify internet connection
3. Check addon settings
4. Try reinstalling

### Conflicts

If addons conflict:
- Disable one temporarily
- Adjust priority order
- Check for updates

### Performance

If addons slow things down:
- Disable unused addons
- Reduce cache size
- Update to latest versions

## Creating Addons

Developers can create addons using the SDK.

See [Developer Guide](../../development/addons/README.md) for:

- Addon development tutorial
- SDK reference
- Publishing guide

## Next Steps

- [Installing Addons](installing.md) - Get new addons
- [Managing Addons](managing.md) - Configure and organize
- [Addon Development](../../development/addons/README.md) - Create your own

