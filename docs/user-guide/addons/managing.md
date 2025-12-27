# Managing Addons

Enable, disable, configure, and organize your installed addons.

## Addon List

View all installed addons:

1. Go to **Settings** > **Addons**
2. See list of all addons

```
┌─────────────────────────────────────────────────────────────┐
│ Installed Addons                              [+ Add Addon] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ≡ 🎵 Deezer Metadata                     [ON]  ⚙️      ││
│  │     Metadata provider • Built-in                        ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ≡ 🎵 YouTube Music                       [ON]  ⚙️      ││
│  │     Stream provider • Built-in                          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ≡ 📝 LRCLib Lyrics                       [ON]  ⚙️      ││
│  │     Lyrics provider • Built-in                          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Enabling & Disabling

### Toggle On/Off

1. Find the addon in the list
2. Click the toggle switch
3. Addon enables/disables immediately

### When to Disable

- Troubleshooting issues
- Reducing resource usage
- Temporarily suspending features
- Testing different providers

## Addon Settings

Each addon may have its own settings.

### Opening Settings

1. Click the gear icon (⚙️) next to the addon
2. Or click the addon row, then **Settings**

### Common Settings

| Setting | Description |
|---------|-------------|
| Priority | Order among same type |
| Cache | Enable caching |
| Timeout | Request timeout |
| Region | Regional preferences |

### Provider-Specific Settings

Examples:

**Deezer Metadata:**
- Preferred language
- Include explicit content
- Artwork quality

**YouTube Music:**
- Audio quality (128k, 256k, etc.)
- Prefer official audio
- Fallback behavior

**Last.fm Scrobbler:**
- Username/password
- Scrobble threshold
- Private mode

## Provider Priority

When multiple addons provide the same type (e.g., lyrics), priority determines order.

### Viewing Priority

Addons are listed in priority order:
- Top = Tried first
- Bottom = Tried last

### Changing Priority

1. Drag the ≡ handle up or down
2. Or click **Change Priority**
3. Arrange the order
4. Click **Save**

### Priority Example

For lyrics:
```
1. LRCLib (synced lyrics preferred)
2. Musixmatch (fallback)
3. Genius (plain lyrics last)
```

## Addon Details

Click an addon to see details:

```
┌─────────────────────────────────────────────────────────────┐
│ LRCLib Lyrics                                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Description:                                               │
│  Provides synced lyrics from the LRCLib database.           │
│                                                              │
│  Type: Lyrics Provider                                      │
│  Version: 1.2.0                                             │
│  Author: Audiio Team                                        │
│  Status: Enabled                                            │
│                                                              │
│  Statistics:                                                │
│  • Requests today: 47                                       │
│  • Cache hits: 89%                                          │
│  • Average response: 120ms                                  │
│                                                              │
│  [Settings]  [Disable]  [Uninstall]                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Updating Addons

### Check for Updates

1. Go to **Settings** > **Addons**
2. Click **Check for Updates**
3. Available updates are shown

### Update Individual

1. Click **Update** next to the addon
2. Wait for download
3. Restart if required

### Update All

1. Click **Update All**
2. All updates download
3. Applied on restart

### Version History

View what changed:

1. Click addon for details
2. Click **Changelog**
3. See version history

## Uninstalling Addons

### Remove Addon

1. Click the addon
2. Click **Uninstall**
3. Confirm removal

### What's Removed

- Addon code
- Addon settings
- Cached data

### What's Kept

- Data in your library (likes, etc.)
- Listening history
- Playlists created

### Built-in Addons

Built-in addons can be disabled but not uninstalled.

## Addon Categories

Filter addons by type:

| Category | Addons |
|----------|--------|
| All | Show everything |
| Metadata | Track/artist info |
| Streams | Audio sources |
| Lyrics | Lyrics providers |
| Audio | Audio processing |
| Scrobbling | Listening tracking |
| Other | Utilities, integrations |

## Bulk Operations

### Enable/Disable Multiple

1. Select addons (checkbox)
2. Click **Enable Selected** or **Disable Selected**

### Uninstall Multiple

1. Select addons
2. Click **Uninstall Selected**
3. Confirm removal

## Addon Conflicts

### Detecting Conflicts

If addons conflict:
- Warning icon appears
- Details in addon info
- Recommendation provided

### Resolving Conflicts

Options:
1. Disable one addon
2. Change priority order
3. Update addons
4. Check addon settings

## Addon Logs

For troubleshooting:

### View Logs

1. Click addon for details
2. Click **View Logs**
3. See recent activity

### Log Information

- Requests made
- Errors encountered
- Performance data
- Cache activity

### Clear Logs

1. Click **Clear Logs**
2. Logs are deleted
3. Fresh start for debugging

## Addon Permissions

### View Permissions

1. Click addon for details
2. See **Permissions** section

### Revoke Permissions

For addons with granted permissions:

1. Click **Manage Permissions**
2. Toggle permissions off
3. Addon may stop working

## Cache Management

### Per-Addon Cache

Each addon may cache results:

1. Open addon settings
2. View cache size
3. Clear cache if needed

### Global Cache

Clear all addon caches:

1. **Settings** > **Addons**
2. Click **Clear All Caches**
3. Confirm action

## Export/Import Settings

### Export Configuration

Save your addon setup:

1. **Settings** > **Addons**
2. Click **Export**
3. Save configuration file

Includes:
- Installed addons list
- Enable/disable status
- Priority order
- Addon settings

### Import Configuration

Restore on another device:

1. Click **Import**
2. Select configuration file
3. Choose what to import

## Troubleshooting

### Addon Not Working

1. Check it's enabled
2. View addon logs
3. Check settings
4. Try disabling and re-enabling
5. Update to latest version
6. Reinstall addon

### Slow Performance

1. Check addon statistics
2. Reduce cache size
3. Lower timeout values
4. Disable unused addons
5. Update addons

### Configuration Lost

1. Check backup/export
2. Reset addon to defaults
3. Reconfigure manually

## Related

- [Installing Addons](installing.md) - Get new addons
- [Addon Overview](README.md) - What addons can do
- [Troubleshooting](../troubleshooting.md) - General help

