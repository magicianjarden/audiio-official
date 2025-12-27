# Frequently Asked Questions

Common questions about Audiio.

## General

### What is Audiio?

Audiio is a desktop music streaming application that aggregates music from various sources through addons. It provides a unified interface for discovering, playing, and managing music.

### Is Audiio free?

Yes, Audiio is free and open source. Some addons may require accounts with external services.

### What platforms does Audiio support?

- macOS 10.15 (Catalina) or later
- Windows 10 or later
- Linux (Ubuntu 18.04 or equivalent)

### Is there a mobile app?

Audiio has a mobile remote feature that lets you control the desktop app from your phone's browser. There isn't a standalone mobile app.

## Music & Playback

### Where does the music come from?

Music comes from various sources through addons. Built-in addons include providers for YouTube Music, Deezer metadata, and more. The addon system allows adding new sources.

### Can I play my own music files?

Yes! Go to Settings > Local Music and add folders containing your music files. Audiio supports MP3, FLAC, AAC, OGG, WAV, and more.

### What audio quality is available?

Quality depends on the stream provider addon. Most support:
- Low (128 kbps)
- Medium (192 kbps)
- High (320 kbps)
- Lossless (where available)

### Why can't I find a specific song?

Not all music is available through all sources. Try:
- Different search terms
- Enabling additional metadata/stream addons
- The song may have regional restrictions

### Can I download music for offline?

Yes. Right-click any track, album, or playlist and select Download. Downloaded music is available in Library > Downloads.

## Library & Playlists

### How do I create a playlist?

1. Go to Library > Playlists
2. Click "New Playlist"
3. Name your playlist
4. Add tracks via right-click > Add to Playlist

### Can I import playlists from Spotify/Apple Music?

Direct import isn't built-in, but community addons may provide this feature. Check the addon gallery.

### Where is my data stored?

Your library, playlists, and settings are stored locally:
- macOS: `~/Library/Application Support/Audiio/`
- Windows: `%APPDATA%\Audiio\`
- Linux: `~/.config/Audiio/`

### How do I backup my library?

Go to Settings > Advanced > Export Data to create a backup. To restore, use Import Data.

## Mobile Remote

### How does mobile remote work?

The desktop app runs a server that your phone connects to. You can use either:
- **Local Network**: Direct connection on same WiFi
- **P2P**: Connection through relay server from anywhere

### Is mobile remote secure?

Yes. P2P connections use end-to-end encryption (NaCl X25519 + XSalsa20-Poly1305). Even the relay server cannot see your data.

### Why do I need a connection code?

The code authenticates your mobile device. It's a memorable phrase that's easier to type than a long password.

### Can multiple phones connect?

Yes! Multiple devices can connect and control playback simultaneously.

## Addons

### What are addons?

Addons extend Audiio's functionality. They can provide:
- Music sources (streams)
- Metadata (track info)
- Lyrics
- Audio processing (karaoke)
- Integrations (scrobbling)

### Are addons safe?

Built-in addons are verified by the Audiio team. Community addons should be reviewed before installing. Only install from trusted sources.

### How do I install addons?

Go to Settings > Addons > Browse Addons, or install from a file.

### Can I create my own addon?

Yes! See the [Addon Development Guide](../development/addons/README.md).

## Features

### Does Audiio have lyrics?

Yes, with lyrics provider addons. Synced lyrics scroll with the music. Translation is also available.

### What is karaoke mode?

Karaoke mode uses AI to remove vocals from songs, letting you sing along. Requires the karaoke addon and processing server.

### How do recommendations work?

Audiio learns from your listening history:
- Tracks you like/dislike
- How long you listen
- What you skip
- Your playlists

The more you use Audiio, the better recommendations become.

### Can I customize the theme?

Yes! Go to Settings > Appearance > Themes. You can use built-in themes or create custom ones with the Theme Editor.

## Privacy

### Does Audiio collect my data?

Audiio doesn't collect personal data by default. Optional anonymous usage analytics can be enabled.

### Is my listening history private?

Your listening history is stored locally on your computer. It's only shared if you enable scrobbling addons (Last.fm, ListenBrainz, etc.).

### What data do addons access?

Addons can access:
- Track information you're playing
- Your library (for some features)
- Network (to fetch data)

They cannot access other files on your computer.

## Technical

### Why is Audiio using a lot of memory?

Possible causes:
- Large library
- Many addons
- Audio caching

Try clearing cache in Settings > Privacy.

### Does Audiio work offline?

Partially. You can play downloaded music and local files offline. Streaming requires internet.

### Can I use Audiio with a VPN?

Yes, but some content may become unavailable or different based on the VPN's location.

### Is there an API?

Yes! See the [API documentation](../api/README.md) for the REST API used by the mobile remote.

## Troubleshooting

### Audiio won't start

See [Installation Troubleshooting](installation.md#troubleshooting-installation).

### No sound

Check volume, audio output device, and that the track is actually playing. See [Troubleshooting](troubleshooting.md#no-sound).

### Mobile remote won't connect

Check that mobile access is enabled, the code is correct, and both devices have network access. See [Mobile Troubleshooting](mobile/troubleshooting.md).

## Contributing

### How can I contribute?

- Report bugs on GitHub
- Suggest features
- Contribute code
- Create addons
- Improve documentation

See [CONTRIBUTING.md](../../CONTRIBUTING.md).

### Is Audiio open source?

Yes, Audiio is open source under the MIT license.

### Where's the source code?

GitHub: [github.com/magicianjarden/audiio-official](https://github.com/magicianjarden/audiio-official)

## Getting Help

### Where can I get help?

1. This documentation
2. [GitHub Issues](https://github.com/magicianjarden/audiio-official/issues)
3. GitHub Discussions

### How do I report a bug?

1. Check if it's already reported on GitHub
2. If not, create a new issue with:
   - Audiio version
   - Operating system
   - Steps to reproduce
   - Expected vs actual behavior

### How do I request a feature?

Open a GitHub issue with the "feature request" label describing what you'd like and why.

