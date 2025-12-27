# Local Music

Add and play your own music files alongside streaming content.

## Supported Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| MP3 | .mp3 | Most common |
| FLAC | .flac | Lossless |
| AAC | .m4a, .aac | Apple format |
| OGG | .ogg | Open format |
| WAV | .wav | Uncompressed |
| AIFF | .aiff | Apple lossless |
| OPUS | .opus | Modern efficient |
| WMA | .wma | Windows format |

## Adding Music Folders

### Add a Folder

1. Go to **Settings** > **Local Music**
2. Click **Add Folder**
3. Select your music directory
4. Wait for scanning to complete

### Multiple Folders

Add as many folders as needed:

- Main music library
- Downloads folder
- External drives
- Network locations

### Folder Settings

For each folder:

| Setting | Description |
|---------|-------------|
| Enabled | Include in library |
| Watch | Auto-detect changes |
| Scan Subfolders | Include nested folders |

## Scanning

### Initial Scan

When you add a folder:

1. Audiio scans for audio files
2. Reads metadata (ID3 tags, etc.)
3. Generates artwork thumbnails
4. Adds tracks to library

Progress shown in status bar.

### Rescan

To rescan a folder:

1. Right-click folder in settings
2. Select **Rescan**
3. New and changed files are updated

### Automatic Watching

With "Watch" enabled:
- New files detected automatically
- Removed files are cleaned up
- Changes sync in real-time

## Metadata

### Reading Tags

Audiio reads standard tags:

| Tag | Used For |
|-----|----------|
| Title | Track name |
| Artist | Artist name |
| Album | Album grouping |
| Album Artist | Album-level artist |
| Track Number | Track ordering |
| Year | Release year |
| Genre | Genre classification |
| Artwork | Embedded album art |

### Metadata Enhancement

Improve local track info:

1. Right-click track
2. Select **Enhance Metadata**
3. Audiio searches online databases
4. Review and apply suggestions

### Manual Editing

Edit metadata directly:

1. Right-click track
2. Select **Edit Info**
3. Modify fields
4. Click **Save**

### Batch Editing

Edit multiple tracks:

1. Select multiple tracks
2. Right-click > **Edit Info**
3. Changes apply to all selected

## Artwork

### Embedded Artwork

Album art embedded in files is used automatically.

### Folder Artwork

Audiio also checks for:
- `cover.jpg`
- `folder.jpg`
- `album.jpg`
- Any image in album folder

### Artwork Fetching

For missing artwork:

1. Right-click album
2. Select **Find Artwork**
3. Choose from suggestions
4. Or add custom image

### Artwork Quality

| Source | Resolution |
|--------|------------|
| Embedded | Varies |
| Online fetch | Up to 1400x1400 |
| Custom | Any |

## Library Integration

### Unified Library

Local music appears alongside streaming:

- Same search results
- Same playlists
- Same recommendations
- Same queue

### Local Badge

Local tracks show a badge indicating they're from your files.

### Offline Guarantee

Local files always work offline, unlike cached streams.

## Organization

### Auto-Organization

Optional auto-organization:

1. **Settings** > **Local Music** > **Auto-Organize**
2. Set target folder structure
3. New files are moved automatically

Patterns available:
- `Artist/Album/Track.mp3`
- `Artist - Album/Track.mp3`
- `Genre/Artist/Album/Track.mp3`

### Duplicate Detection

Audiio detects duplicates:

- Same file in multiple locations
- Same track, different quality
- Review and remove duplicates

## Playback

### Quality

Local files play at their native quality:

- No streaming compression
- Full bitrate
- Gapless playback support

### Format Conversion

Some formats may require conversion:
- Converted in memory during playback
- No quality loss for lossless
- Original files untouched

## Syncing Devices

### Sync to Phone

Sync local files for offline mobile:

1. Enable sync in mobile settings
2. Select playlists to sync
3. Files transfer over local network
4. Play offline on mobile

### Storage Management

Monitor local file storage:

- Total library size
- By format breakdown
- Cleanup suggestions

## Import/Export

### Import from iTunes

Import iTunes library:

1. **Settings** > **Local Music** > **Import**
2. Select iTunes Library.xml
3. Playlists and ratings imported

### Import from Other Players

Supported imports:
- Windows Media Player
- MediaMonkey
- MusicBee
- foobar2000

### Export Playlists

Export playlists as:
- M3U/M3U8
- PLS
- XSPF

## Advanced Settings

### Scanning Options

| Option | Description |
|--------|-------------|
| Skip Hidden | Ignore hidden files/folders |
| Min File Size | Skip files under X MB |
| Max File Size | Skip files over X GB |
| Skip Patterns | Exclude by name pattern |

### Performance

| Setting | Description |
|---------|-------------|
| Parallel Scans | How many files to scan at once |
| Thumbnail Quality | Artwork cache quality |
| Memory Limit | Max RAM for scanning |

### File Monitoring

| Setting | Description |
|---------|-------------|
| Watch Interval | How often to check for changes |
| Deep Scan | Periodic full rescan |

## Troubleshooting

### Files Not Found

1. Check folder is added in settings
2. Verify file format is supported
3. Check file isn't corrupted
4. Rescan the folder

### Wrong Metadata

1. Check embedded tags in file
2. Use metadata enhancement
3. Edit manually
4. Fix source files with external tool

### Missing Artwork

1. Check for embedded artwork
2. Check for folder images
3. Use artwork fetching
4. Add custom artwork

### Scanning Stuck

1. Check for permission issues
2. Skip problematic folders
3. Reduce parallel scans
4. Check for very large files

### Network Drives Slow

1. Enable caching for network folders
2. Reduce scan frequency
3. Consider syncing locally

## Best Practices

### Organize Your Files

Keep files organized for best results:
- Use consistent folder structure
- Maintain accurate metadata
- Use standard file names

### Regular Maintenance

- Rescan periodically
- Clean up duplicates
- Update metadata

### Backup

Local files aren't backed up by Audiio:
- Maintain your own backups
- Export playlists separately

## Related

- [Library](library.md) - Library management
- [Player](player.md) - Playback controls
- [Settings](../settings.md) - All settings

