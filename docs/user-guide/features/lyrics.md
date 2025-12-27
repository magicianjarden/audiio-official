# Lyrics

Enjoy synced lyrics that follow along with the music, with optional translation support.

## Viewing Lyrics

### In the Full Player

1. Click the album art to open full player
2. Lyrics appear on the right panel (or below on mobile)
3. Lines highlight as they're sung

### Dedicated Lyrics Panel

1. Click the lyrics icon in the player bar
2. A dedicated panel opens
3. Resize by dragging the edge

### Lyrics Keyboard Shortcut

Press `Ctrl/Cmd + Shift + L` to toggle lyrics display.

## Synced Lyrics

Synced lyrics highlight the current line in real-time.

### How Synced Lyrics Work

```
┌─────────────────────────────────────────┐
│                                          │
│   ♪ Previous line (dimmed)              │
│                                          │
│   ► CURRENT LINE (highlighted)          │
│                                          │
│   ♪ Next line (dimmed)                  │
│   ♪ Another line (dimmed)               │
│                                          │
└─────────────────────────────────────────┘
```

### Clicking to Seek

Click any lyric line to jump to that part of the song.

### Lyrics Timing

- Lines highlight 100ms before they're sung
- Smooth transitions between lines
- Visual indicator of progress within line

## Plain Lyrics

When synced lyrics aren't available, plain lyrics are shown:

- Full lyrics text
- Manual scrolling
- No time synchronization

## Translation

Translate lyrics to your language (requires translation addon).

### Enabling Translation

1. Go to **Settings** > **Lyrics**
2. Enable **Show Translations**
3. Select your target language

### Translation Display

```
┌─────────────────────────────────────────┐
│                                          │
│   ► Je t'aime                           │
│     I love you                          │
│                                          │
│   ♪ Pour toujours                       │
│     Forever                             │
│                                          │
└─────────────────────────────────────────┘
```

Original lyrics appear above, translation below.

### Translation Toggle

Click the translation icon (🌐) to toggle translations on/off.

### Supported Languages

Translation supports 100+ languages including:
- English, Spanish, French, German
- Chinese, Japanese, Korean
- Arabic, Hindi, Russian
- And many more

## Lyrics Sources

Lyrics come from lyrics provider addons:

| Addon | Features |
|-------|----------|
| LRCLib | Large database, synced lyrics |
| Musixmatch | Popular songs, translations |
| Genius | Plain lyrics, annotations |

### Provider Priority

Configure in **Settings** > **Addons** > **Lyrics**:
- Drag to reorder providers
- First match is used
- Fallback to next if no result

## Lyrics Settings

Configure in **Settings** > **Lyrics**:

| Setting | Description |
|---------|-------------|
| Auto-show Lyrics | Open lyrics when track has them |
| Font Size | Small, Medium, Large |
| Show Translations | Enable translation |
| Translation Language | Target language |
| Romanization | Show romanized text (for CJK) |
| Line Highlighting | How current line is shown |
| Background Blur | Blur album art behind lyrics |

## Display Options

### Font Size

Adjust text size for readability:
- **Small**: More lines visible
- **Medium**: Balanced (default)
- **Large**: Easier to read

### Romanization

For Japanese, Chinese, Korean tracks:
- Shows romanized pronunciation
- Helps with singing along
- Toggle with the 文A button

Example:
```
♪ 愛してる (aishiteru)
   I love you
```

### Color Themes

Lyrics adapt to your theme:
- Light mode: Dark text
- Dark mode: Light text
- Auto-color from album art

## Editing Lyrics

### Report Issues

If lyrics are incorrect:
1. Right-click the lyrics panel
2. Select **Report Issue**
3. Describe the problem

### Contribute Corrections

Some providers allow contributions:
1. Click **Edit** (if available)
2. Make corrections
3. Submit for review

## Karaoke Mode

For a karaoke experience:
1. Enable karaoke mode in player
2. Vocals are removed (or reduced)
3. Lyrics display prominently
4. Perfect for singing along!

See [Karaoke](karaoke.md) for full details.

## Fullscreen Lyrics

For presentations or parties:

1. Press `F11` or click fullscreen icon
2. Lyrics fill the screen
3. Minimal UI for clean display
4. Press `Esc` to exit

## Lyrics with Music Videos

When playing music videos:
- Lyrics overlay the video
- Position adjustable
- Toggle visibility

## Troubleshooting

### No Lyrics Available

1. Not all tracks have lyrics
2. Install additional lyrics addons
3. Try different lyrics providers
4. Check if track info is correct

### Lyrics Out of Sync

1. Report via right-click menu
2. Try a different provider
3. Some tracks have multiple versions

### Translation Not Working

1. Check translation addon is installed
2. Verify internet connection
3. Some songs may not translate well
4. Check target language setting

### Lyrics Loading Slowly

1. Check internet connection
2. Clear lyrics cache
3. Try different provider

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Shift + L` | Toggle lyrics panel |
| `T` | Toggle translation |
| `+` / `-` | Increase/decrease font |
| `Click line` | Seek to that point |

## Related

- [Karaoke](karaoke.md) - Sing along with vocal removal
- [Player](player.md) - Playback controls
- [Settings](../settings.md) - All settings

