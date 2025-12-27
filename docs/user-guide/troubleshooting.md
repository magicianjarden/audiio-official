# Troubleshooting

Solutions to common issues with Audiio.

## Playback Issues

### No Sound

**Symptoms**: Track appears to play but no audio.

**Solutions**:
1. Check volume isn't muted (press `M` to toggle)
2. Check system volume
3. Verify correct audio output in Settings > Playback > Output Device
4. Check headphones/speakers are connected
5. Restart Audiio

### Playback Stuttering

**Symptoms**: Audio cuts in and out, skips.

**Solutions**:
1. Check internet connection
2. Lower streaming quality in Settings > Playback > Audio Quality
3. Close other bandwidth-heavy applications
4. Clear cache: Settings > Privacy > Clear Cache
5. Increase buffer size in Settings > Advanced

### Tracks Won't Play

**Symptoms**: Clicking play does nothing, or track immediately skips.

**Solutions**:
1. Check if addon (stream provider) is enabled
2. Try a different track
3. Check if track is region-restricted
4. Restart Audiio
5. Check addon logs for errors

### Wrong Track Plays

**Symptoms**: Search result plays different song than expected.

**Solutions**:
1. Verify track details before playing
2. Try a different stream provider addon
3. Report the issue via right-click > Report Issue

## Search Issues

### No Search Results

**Symptoms**: Search returns empty.

**Solutions**:
1. Check internet connection
2. Verify metadata addon is enabled
3. Try different search terms
4. Check if service is down

### Search is Slow

**Symptoms**: Results take a long time to appear.

**Solutions**:
1. Check internet speed
2. Reduce number of addons
3. Clear cache
4. Check addon status

## Library Issues

### Likes Not Saving

**Symptoms**: Liked tracks disappear after restart.

**Solutions**:
1. Check disk space
2. Verify app has write permissions
3. Check database integrity: Settings > Advanced > Check Database
4. Export and reimport library

### Playlists Missing

**Symptoms**: Created playlists gone.

**Solutions**:
1. Check if logged into correct profile
2. Look in Settings > Library > Restore from Backup
3. Check playlist file location

### Downloads Failing

**Symptoms**: Downloads start but never complete.

**Solutions**:
1. Check disk space
2. Verify download location exists and is writable
3. Check internet connection
4. Try downloading a different track
5. Check if original track is still available

## Addon Issues

### Addon Won't Load

**Symptoms**: Addon shows error or won't enable.

**Solutions**:
1. Check addon compatibility with your Audiio version
2. Update the addon
3. Reinstall the addon
4. Check addon logs: Settings > Addons > [Addon] > View Logs

### Addon Conflicts

**Symptoms**: App behaves strangely with multiple addons.

**Solutions**:
1. Disable addons one by one to identify conflict
2. Update all addons
3. Adjust addon priority order
4. Report conflict to addon developers

### Missing Addon Features

**Symptoms**: Features described in addon don't work.

**Solutions**:
1. Check addon settings are configured correctly
2. Verify API keys are entered (if required)
3. Check addon documentation
4. Update addon

## Performance Issues

### Slow Startup

**Symptoms**: App takes long time to open.

**Solutions**:
1. Disable unused addons
2. Clear cache
3. Reduce library size if very large
4. Disable "Resume playback" in Settings
5. Check disk health

### High Memory Usage

**Symptoms**: App uses too much RAM.

**Solutions**:
1. Close unused panels (queue, lyrics)
2. Reduce cache size
3. Disable unused addons
4. Limit queue length
5. Restart app periodically

### High CPU Usage

**Symptoms**: App uses too much CPU, fans spin up.

**Solutions**:
1. Disable visualizations
2. Disable hardware acceleration (try both on/off)
3. Close lyrics panel
4. Reduce audio processing addons

## Mobile Access Issues

See [Mobile Troubleshooting](mobile/troubleshooting.md) for mobile-specific issues.

## Display Issues

### UI Elements Missing

**Symptoms**: Buttons, panels, or text not visible.

**Solutions**:
1. Reset theme to default
2. Restart app
3. Check display scaling settings
4. Reset window layout: View > Reset Layout

### Blurry Interface

**Symptoms**: Text or images appear blurry.

**Solutions**:
1. Check display scaling in system settings
2. Toggle hardware acceleration
3. Update graphics drivers
4. Adjust display resolution

### Wrong Colors

**Symptoms**: Colors look incorrect.

**Solutions**:
1. Reset theme
2. Check system color profile
3. Disable any color filters
4. Update graphics drivers

## Installation Issues

### macOS: "App is damaged"

```bash
xattr -cr /Applications/Audiio.app
```

### macOS: "Unidentified developer"

1. Open **System Preferences** > **Security & Privacy**
2. Click **Open Anyway** next to the Audiio message

### Windows: Installation fails

1. Run installer as Administrator
2. Temporarily disable antivirus
3. Clear temp files
4. Download fresh installer

### Linux: AppImage won't start

1. Make executable: `chmod +x Audiio.AppImage`
2. Install FUSE: `sudo apt install fuse libfuse2`
3. Run from terminal to see errors

## Database Issues

### Corrupted Database

**Symptoms**: Random errors, missing data.

**Solutions**:
1. Settings > Advanced > Repair Database
2. Export data, reset app, reimport
3. Restore from backup

### Database Locked

**Symptoms**: "Database locked" errors.

**Solutions**:
1. Close other Audiio instances
2. Restart app
3. Check for hung processes
4. Restart computer

## Network Issues

### Connection Refused

**Symptoms**: Can't connect to services.

**Solutions**:
1. Check internet connection
2. Check firewall settings
3. Disable VPN temporarily
4. Check if service is blocked in your region

### SSL/Certificate Errors

**Symptoms**: Security warnings, connection failures.

**Solutions**:
1. Check system date/time is correct
2. Update Audiio
3. Check antivirus isn't intercepting
4. Update system certificates

## Crash Recovery

### App Crashes on Start

**Solutions**:
1. Try starting with Shift held (safe mode)
2. Delete settings file (see Settings > About for location)
3. Reinstall app
4. Check crash logs

### Crash Logs

Find crash logs at:

| Platform | Location |
|----------|----------|
| macOS | `~/Library/Logs/Audiio/` |
| Windows | `%APPDATA%\Audiio\logs\` |
| Linux | `~/.config/Audiio/logs/` |

## Getting More Help

### Check Documentation

- [FAQ](faq.md) - Frequently asked questions
- [Features](features/README.md) - Feature guides

### Report Issues

1. Go to [GitHub Issues](https://github.com/magicianjarden/audiio-official/issues)
2. Search for existing issues
3. Create new issue with:
   - Audiio version
   - OS and version
   - Steps to reproduce
   - Error messages/logs

### Debug Information

To get debug info:
1. Settings > Advanced > Enable Debug Logging
2. Reproduce the issue
3. Settings > Advanced > Open Logs Folder
4. Include relevant logs in issue report

