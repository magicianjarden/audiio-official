# Karaoke Mode

Remove vocals from any track and sing along with synced lyrics.

## Requirements

Karaoke mode requires:

1. **Karaoke addon** installed and enabled
2. **Demucs server** running (local or remote)
3. Sufficient processing power for real-time separation

## Enabling Karaoke Mode

### Quick Toggle

1. While playing a track, click the **microphone icon** in the player
2. Or press `K` on your keyboard
3. Vocal removal begins processing

### From Settings

1. Go to **Settings** > **Addons**
2. Enable the **Karaoke** addon
3. Configure processing options

## How It Works

Karaoke mode uses AI-powered stem separation (Demucs) to isolate and remove vocals:

```
Original Track
     │
     ▼
┌──────────────┐
│   Demucs     │  AI Stem Separation
│   Model      │
└──────────────┘
     │
     ├──► Vocals (removed or reduced)
     ├──► Drums (kept)
     ├──► Bass (kept)
     └──► Other (kept)
          │
          ▼
    Instrumental Mix
```

## Karaoke Display

When karaoke mode is active:

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│     🎤  KARAOKE MODE                                        │
│                                                              │
│     ♪ Previous line...                                      │
│                                                              │
│     ► CURRENT LYRIC LINE ◄                                  │
│                                                              │
│     ♪ Next line...                                          │
│                                                              │
│     ────────────────────────────────○────                   │
│                                                              │
│     [100%] ━━━━━━━━━━━━━━━━━━━━━━━━━━ [🎤 On]              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

Features:
- Large, prominent lyrics
- Highlighted current line
- Word-by-word timing (when available)
- Vocal level control

## Vocal Control

### Vocal Volume Slider

Adjust how much vocals remain:

| Level | Description |
|-------|-------------|
| 0% | Complete vocal removal |
| 25% | Light vocal presence |
| 50% | Balanced mix |
| 75% | Mostly vocals |
| 100% | Original (karaoke off) |

### Default: 0%

By default, karaoke removes vocals completely. Adjust the slider to bring back some vocals for guidance.

## Stem Separation

Beyond karaoke, access individual stems:

### Available Stems

| Stem | Contains |
|------|----------|
| Vocals | Lead and backing vocals |
| Drums | Percussion |
| Bass | Bass instruments |
| Other | Everything else |

### Solo/Mute Stems

Click stem buttons to:
- **Solo**: Hear only that stem
- **Mute**: Remove that stem
- **Adjust**: Set individual levels

### Use Cases

| Purpose | Configuration |
|---------|---------------|
| Karaoke | Mute vocals |
| Practice drums | Solo drums |
| Learn bassline | Solo bass |
| Instrumental | Mute vocals |
| A cappella | Solo vocals |

## Processing

### Real-time Processing

For quick access with slight quality trade-off:

- Processes as you play
- ~5-10 second initial delay
- Good for casual use

### Pre-processing

For best quality:

1. Right-click a track
2. Select **Prepare Karaoke**
3. Track is processed in background
4. Instant playback when ready

### Batch Processing

Process multiple tracks:

1. Select tracks in library
2. Right-click > **Prepare Karaoke**
3. Queue processes in background

## Quality Settings

Configure in **Settings** > **Karaoke**:

| Setting | Options |
|---------|---------|
| Model Quality | Fast / Balanced / High |
| Real-time Mode | Enabled / Disabled |
| Cache Stems | Save processed stems |
| GPU Acceleration | Use GPU if available |

### Model Quality

| Quality | Speed | Result |
|---------|-------|--------|
| Fast | Fastest | Good separation |
| Balanced | Medium | Better separation |
| High | Slowest | Best separation |

## Karaoke Features

### Pitch Display

Optional pitch guide:
- Shows current pitch
- Helps you stay on key
- Enable in karaoke settings

### Key Change

Transpose the instrumental:
- Adjust pitch up/down
- Match your vocal range
- Doesn't affect tempo

### Tempo Control

Slow down or speed up:
- Slow down to learn
- Speed up for fun
- Pitch maintained

## Fullscreen Karaoke

For parties or practice:

1. Click fullscreen icon in karaoke view
2. Or press `F11`
3. Large lyrics, minimal UI
4. Exit with `Esc`

## Saving Karaoke Versions

### Export Instrumental

1. After processing, click **Export**
2. Choose format (MP3, WAV, FLAC)
3. Save instrumental version

### Export Stems

Export individual stems:

1. Click **Export Stems**
2. Select which stems
3. Choose format
4. Save as separate files

## Karaoke Playlists

Create karaoke-ready playlists:

1. Pre-process favorite songs
2. Create "Karaoke Night" playlist
3. All tracks ready instantly

## Performance Tips

### For Best Results

- Use headphones (prevents feedback)
- Process tracks in advance
- Use High quality for important songs

### System Requirements

| Requirement | Recommended |
|-------------|-------------|
| RAM | 8GB+ |
| CPU | Modern multi-core |
| GPU | CUDA-capable (optional) |
| Storage | 500MB+ per processed track |

### Reduce Load

- Process fewer tracks simultaneously
- Use Fast quality for real-time
- Enable GPU acceleration

## Troubleshooting

### Vocals Still Audible

1. Some songs are harder to separate
2. Try High quality model
3. Backing vocals may remain
4. Re-process the track

### Processing Fails

1. Check Demucs server is running
2. Verify internet connection (if remote)
3. Free up system resources
4. Check available storage

### Audio Glitches

1. Increase buffer size
2. Close other applications
3. Use pre-processed tracks
4. Lower quality setting

### Demucs Server Not Found

1. Check server is installed
2. Verify server URL in settings
3. Check firewall settings
4. Try restarting the server

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `K` | Toggle karaoke mode |
| `V` | Toggle vocals |
| `F11` | Fullscreen karaoke |
| `+` / `-` | Adjust vocal level |
| `←` / `→` | Seek 5 seconds |

## Related

- [Lyrics](lyrics.md) - Synced lyrics display
- [Player](player.md) - Playback controls
- [Settings](../settings.md) - Configuration options

