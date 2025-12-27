# Player

Master Audiio's playback controls, queue management, and audio settings.

## Player Bar

The player bar at the bottom of the screen shows:

```
┌─────────────────────────────────────────────────────────────────┐
│ [Album Art] Track Title            ◄◄ ▶/❚❚ ►► [━━━━━━○━━━━] 🔊 │
│             Artist Name                        2:34 / 4:12      │
└─────────────────────────────────────────────────────────────────┘
```

### Track Info

- **Album Art**: Click to open full player
- **Track Title**: Currently playing song
- **Artist Name**: Click to go to artist page

### Transport Controls

| Button | Action | Shortcut |
|--------|--------|----------|
| ◄◄ | Previous track | `←` |
| ▶ | Play | `Space` |
| ❚❚ | Pause | `Space` |
| ►► | Next track | `→` |

### Progress Bar

- **Click** anywhere to seek
- **Drag** the handle to scrub
- Shows elapsed / total time

### Volume

- **Click** the speaker icon to mute
- **Drag** the slider to adjust
- Use `↑` / `↓` for 5% increments

## Full Player

Click the album art or press `F` to open the full player view:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│                        [Large Album Art]                         │
│                                                                  │
│                          Track Title                             │
│                          Artist Name                             │
│                                                                  │
│        [━━━━━━━━━━━━━━━━━○━━━━━━━━━━━━━━━━━]                     │
│                      2:34 / 4:12                                 │
│                                                                  │
│              ◄◄        ▶        ►►                               │
│                                                                  │
│        🔀 Shuffle     🔁 Repeat     ♡ Like     📃 Queue         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Full Player Features

- **Large album artwork** with color extraction
- **Lyrics panel** (if available)
- **Queue access** button
- **Like/dislike** buttons
- **Additional controls**

## Queue

The queue shows upcoming tracks.

### Opening the Queue

- Click the queue icon (📃) in the player bar
- Press `Q` to toggle queue panel

### Queue Actions

| Action | How |
|--------|-----|
| Play a track | Click on it |
| Remove track | Click X or swipe |
| Reorder | Drag and drop |
| Clear queue | Click Clear All |
| Save as playlist | Click Save |

### Adding to Queue

- **Play Next**: Right-click > Play Next
- **Add to Queue**: Right-click > Add to Queue
- **Play All**: Click play on an album or playlist

### Queue Behavior

- **Shuffle**: Randomizes upcoming tracks
- **Repeat One**: Loops current track
- **Repeat All**: Loops entire queue
- **Clear on new**: Starting new music clears queue

## Playback Modes

### Shuffle

Randomizes playback order.

- Press `S` to toggle
- Applied to current queue/playlist
- Reshuffles when toggled off/on

### Repeat

Cycle through repeat modes with `R`:

| Mode | Icon | Behavior |
|------|------|----------|
| Off | - | Stop after queue ends |
| Repeat All | 🔁 | Loop the queue |
| Repeat One | 🔂 | Loop current track |

## Audio Settings

Access via **Settings** > **Audio**.

### Quality

| Setting | Description |
|---------|-------------|
| High (320kbps) | Best quality, more data |
| Medium (192kbps) | Balanced |
| Low (128kbps) | Data saver |

### Normalization

- **Enable**: All tracks play at similar loudness
- **Disable**: Original volume levels

### Crossfade

Smoothly blend between tracks:
- Off, 1s, 2s, 3s, 5s, 10s options
- Creates seamless transitions

### Gapless Playback

- **Enable**: No gap between tracks (for live albums, mixes)
- **Disable**: Brief pause between tracks

### Equalizer

Adjust frequency bands:
- Presets: Flat, Bass Boost, Treble, etc.
- Custom: Adjust individual bands
- Per-track memory (optional)

## Keyboard Shortcuts

### Playback

| Shortcut | Action |
|----------|--------|
| `Space` | Play/Pause |
| `→` | Next track |
| `←` | Previous track |
| `Shift + →` | Seek forward 10s |
| `Shift + ←` | Seek backward 10s |

### Volume

| Shortcut | Action |
|----------|--------|
| `↑` | Volume up |
| `↓` | Volume down |
| `M` | Mute/Unmute |

### Modes

| Shortcut | Action |
|----------|--------|
| `S` | Toggle shuffle |
| `R` | Cycle repeat modes |
| `F` | Toggle full player |
| `Q` | Toggle queue panel |

### Track Actions

| Shortcut | Action |
|----------|--------|
| `L` | Like current track |
| `D` | Dislike current track |
| `Cmd/Ctrl + C` | Copy track info |

## Media Keys

Audiio responds to keyboard media keys:

- **Play/Pause** button
- **Next Track** button
- **Previous Track** button

Also supports:
- AirPods tap controls
- Bluetooth headset buttons
- Car audio controls

## Now Playing Notifications

When tracks change:
- System notification shows track info
- Notification center displays artwork
- Lock screen controls (macOS)

Configure in **Settings** > **Notifications**.

## Troubleshooting

### Audio Not Playing

1. Check volume isn't muted
2. Verify speaker/headphone connection
3. Check audio output device in Settings
4. Restart Audiio

### Playback Stuttering

1. Lower audio quality setting
2. Close other applications
3. Check network connection
4. Clear audio cache

### Crossfade Not Working

- Requires tracks to be cached
- May not work with some audio processors

## Related

- [Library](library.md) - Managing your music
- [Discovery](discovery.md) - Finding new music
- [Keyboard Shortcuts](../keyboard-shortcuts.md) - All shortcuts
- [Lyrics](lyrics.md) - Synced lyrics display

