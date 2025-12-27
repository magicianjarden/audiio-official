# Settings Reference

Complete guide to all Audiio settings.

## Accessing Settings

- Click the gear icon in the sidebar
- Press `Ctrl/Cmd + ,`
- Go to Menu > Settings

## General

### Language

| Setting | Options | Default |
|---------|---------|---------|
| Language | System, English, Spanish, French, German, Japanese, etc. | System |

### Startup

| Setting | Description | Default |
|---------|-------------|---------|
| Launch on startup | Open Audiio when computer starts | Off |
| Start minimized | Start in system tray | Off |
| Resume playback | Continue where you left off | On |

### Updates

| Setting | Description | Default |
|---------|-------------|---------|
| Auto-update | Download updates automatically | On |
| Beta updates | Receive pre-release versions | Off |
| Check now | Manually check for updates | - |

## Appearance

### Theme

| Setting | Options | Default |
|---------|---------|---------|
| Theme | Light, Dark, System | System |
| Accent color | Color picker | Blue |
| Custom theme | Select or create | - |

### Layout

| Setting | Description | Default |
|---------|-------------|---------|
| Compact mode | Reduce spacing | Off |
| Sidebar width | Narrow, Normal, Wide | Normal |
| Show album art | In sidebar | On |

### Fonts

| Setting | Options | Default |
|---------|---------|---------|
| Font family | System, Inter, Roboto, etc. | System |
| Font size | Small, Medium, Large | Medium |

### Animations

| Setting | Description | Default |
|---------|-------------|---------|
| Enable animations | UI animations | On |
| Reduce motion | Accessibility option | Off |

## Playback

### Audio

| Setting | Options | Default |
|---------|---------|---------|
| Audio quality | Low (128k), Medium (192k), High (320k), Lossless | High |
| Normalize volume | Consistent loudness | On |
| Crossfade | 0-10 seconds | 0 (off) |
| Gapless playback | No gaps between tracks | On |

### Output

| Setting | Description | Default |
|---------|-------------|---------|
| Output device | Select audio output | System default |
| Exclusive mode | Bypass system mixer | Off |

### Behavior

| Setting | Description | Default |
|---------|-------------|---------|
| Auto-play | Start playing on launch | Off |
| Play on double-click | vs single-click | On |
| Remember position | For long tracks | On |

## Library

### Organization

| Setting | Description | Default |
|---------|-------------|---------|
| Sort likes by | Date, Title, Artist | Date added |
| Group albums | By artist | On |
| Show duplicates | Highlight duplicates | On |

### Downloads

| Setting | Description | Default |
|---------|-------------|---------|
| Download location | Folder path | App default |
| Download quality | Same as streaming / Highest | Highest |
| Auto-download likes | Download liked tracks | Off |

### Local Music

| Setting | Description | Default |
|---------|-------------|---------|
| Watch folders | Auto-detect new files | On |
| Scan on startup | Scan folders at launch | On |
| Folders | Manage watched folders | - |

## Lyrics

### Display

| Setting | Description | Default |
|---------|-------------|---------|
| Show lyrics | Auto-show when available | On |
| Font size | Small, Medium, Large | Medium |
| Background blur | Behind lyrics | On |

### Translation

| Setting | Description | Default |
|---------|-------------|---------|
| Show translations | Enable translation | Off |
| Translation language | Target language | System |
| Romanization | For CJK languages | On |

## Mobile Access

### Connection

| Setting | Description | Default |
|---------|-------------|---------|
| Enable mobile access | Allow remote connections | Off |
| Connection code | Current code | - |
| Regenerate code | Get new code | - |

### Devices

| Setting | Description | Default |
|---------|-------------|---------|
| Authorized devices | List of devices | - |
| Auto-authorize | Trust new devices | Off |
| Device limit | Max connections | 5 |

### Security

| Setting | Description | Default |
|---------|-------------|---------|
| Require confirmation | For new devices | On |
| Session timeout | Auto-disconnect after | 7 days |
| Encryption | Always enabled | On |

## Privacy

### Data Collection

| Setting | Description | Default |
|---------|-------------|---------|
| Usage analytics | Anonymous usage data | Off |
| Crash reports | Send crash data | On |

### History

| Setting | Description | Default |
|---------|-------------|---------|
| Save play history | Track listening | On |
| Search history | Save searches | On |
| Clear history | Delete all history | - |

### Cache

| Setting | Description | Default |
|---------|-------------|---------|
| Cache size | Max cache storage | 1 GB |
| Clear cache | Delete cached data | - |
| Cache location | Storage path | App default |

## Addons

### Management

| Setting | Description |
|---------|-------------|
| Installed addons | View and manage |
| Browse gallery | Find new addons |
| Auto-update addons | Keep addons current |

### Per-Addon Settings

Each addon may have its own settings. Click an addon to configure.

## Notifications

### Desktop

| Setting | Description | Default |
|---------|-------------|---------|
| Track notifications | Show on track change | On |
| Download notifications | Show download complete | On |
| Update notifications | Show update available | On |

### Sound

| Setting | Description | Default |
|---------|-------------|---------|
| Notification sounds | Play sounds | Off |

## Keyboard Shortcuts

### View Shortcuts

See all current shortcuts and customize.

### Reset

Reset shortcuts to defaults.

## Advanced

### Performance

| Setting | Description | Default |
|---------|-------------|---------|
| Hardware acceleration | Use GPU | On |
| Memory limit | Max RAM usage | Auto |
| Buffer size | Audio buffer | 100ms |

### Developer

| Setting | Description | Default |
|---------|-------------|---------|
| Developer mode | Show dev tools | Off |
| Debug logging | Verbose logs | Off |
| Open logs folder | Access log files | - |

### Data

| Setting | Description |
|---------|-------------|
| Export data | Download all your data |
| Import data | Restore from backup |
| Reset app | Factory reset |

## Accessibility

### Visual

| Setting | Description | Default |
|---------|-------------|---------|
| High contrast | Increase contrast | Off |
| Large text | System font scaling | System |
| Reduce transparency | Solid backgrounds | Off |

### Motion

| Setting | Description | Default |
|---------|-------------|---------|
| Reduce motion | Less animation | Off |
| Reduce transparency | Solid backgrounds | Off |

### Audio

| Setting | Description | Default |
|---------|-------------|---------|
| Mono audio | Combine stereo | Off |
| Audio descriptions | For visualizations | Off |

## About

### Information

- Version number
- License information
- Credits

### Links

- Website
- Documentation
- Report issue
- Privacy policy

## Resetting Settings

### Reset Specific Category

1. Go to that settings section
2. Click **Reset to Defaults**
3. Confirm reset

### Reset All Settings

1. Go to **Settings** > **Advanced**
2. Click **Reset All Settings**
3. Confirm reset
4. App restarts

Note: This doesn't delete your library or playlists.

## Settings Files

Settings are stored in:

| Platform | Location |
|----------|----------|
| macOS | `~/Library/Application Support/Audiio/settings.json` |
| Windows | `%APPDATA%\Audiio\settings.json` |
| Linux | `~/.config/Audiio/settings.json` |

## Related

- [Keyboard Shortcuts](keyboard-shortcuts.md) - All shortcuts
- [Themes](features/themes.md) - Customize appearance
- [Troubleshooting](troubleshooting.md) - Common issues

