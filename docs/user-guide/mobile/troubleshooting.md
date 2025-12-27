# Mobile Troubleshooting

Fix common issues with mobile remote access.

## Connection Issues

### Can't Connect

**Symptoms**: "Connection failed" error when entering code.

**Solutions**:
1. Verify the connection code is correct (check for typos)
2. Ensure Audiio is running on desktop
3. Check mobile access is enabled: Settings > Mobile Access
4. Regenerate the connection code
5. Check both devices have internet (for P2P mode)
6. Check both devices are on same WiFi (for local mode)

### Connection Keeps Dropping

**Symptoms**: Connected but frequently disconnects.

**Solutions**:
1. Keep desktop Audiio in foreground
2. Check WiFi stability on both devices
3. Disable battery saver on mobile
4. Keep mobile screen on
5. Try local network instead of P2P

### Wrong Code Error

**Symptoms**: Code entered correctly but still fails.

**Solutions**:
1. Regenerate code on desktop
2. Check code hasn't expired
3. Ensure only letters and numbers, with dashes
4. Try copying code instead of typing

## Local Network Issues

### Can't Find Desktop

**Symptoms**: Local URL doesn't work.

**Solutions**:
1. Verify both devices are on same WiFi network
2. Check if guest network isolation is enabled (disable it)
3. Check desktop firewall allows port 9484
4. Try using IP address directly
5. Disable VPN on either device

### Local URL Shows Error

**Symptoms**: Browser shows error page.

**Solutions**:
1. Check Audiio is still running on desktop
2. Verify mobile access is enabled
3. Check the correct port (9484)
4. Try refreshing the page
5. Clear mobile browser cache

### Firewall Blocking

**Solutions**:

**macOS**:
1. System Preferences > Security & Privacy > Firewall
2. Click Firewall Options
3. Add Audiio to allowed apps

**Windows**:
1. Control Panel > Windows Defender Firewall
2. Allow an app through firewall
3. Add Audiio

**Linux**:
```bash
sudo ufw allow 9484
```

## P2P Connection Issues

### Relay Server Unreachable

**Symptoms**: P2P connection fails, local works.

**Solutions**:
1. Check internet connection on both devices
2. Wait and retry (server may be temporarily down)
3. Check if corporate firewall blocks WebSocket
4. Try a different network

### Slow P2P Connection

**Symptoms**: Connected but laggy/slow.

**Solutions**:
1. Use local network if on same WiFi
2. Check internet speed on both devices
3. Close other bandwidth-heavy apps
4. Move closer to WiFi router

### P2P Not Available

**Symptoms**: Only local network option shows.

**Solutions**:
1. Check relay server is configured
2. Update Audiio to latest version
3. Check Settings > Mobile Access > P2P Options

## Authentication Issues

### Device Not Authorized

**Symptoms**: Connected but can't control playback.

**Solutions**:
1. Check desktop for authorization prompt
2. Go to Settings > Mobile Access > Devices
3. Authorize the device manually
4. Remove and re-add the device

### Session Expired

**Symptoms**: Was working, now requires reconnection.

**Solutions**:
1. Sessions expire after 7 days by default
2. Reconnect using the connection code
3. Adjust session timeout in Settings

### Too Many Devices

**Symptoms**: "Device limit reached" error.

**Solutions**:
1. Go to Settings > Mobile Access > Devices
2. Revoke unused devices
3. Increase device limit if needed

## Display Issues

### Mobile UI Not Loading

**Symptoms**: Blank screen or partial loading.

**Solutions**:
1. Refresh the page
2. Clear browser cache
3. Try a different browser (Chrome, Safari, Firefox)
4. Disable browser extensions

### UI Too Small/Large

**Symptoms**: Interface doesn't fit screen.

**Solutions**:
1. Use landscape orientation
2. Adjust browser zoom
3. Try "Add to Home Screen" for app-like experience
4. Check browser desktop mode is OFF

### Album Art Not Showing

**Symptoms**: Placeholder instead of artwork.

**Solutions**:
1. Check internet connection
2. Wait for images to load
3. Artwork quality setting may be too high for connection

## Control Issues

### Controls Not Responding

**Symptoms**: Tapping buttons does nothing.

**Solutions**:
1. Check connection is still active
2. Refresh the mobile page
3. Check desktop Audiio is responsive
4. Restart mobile browser

### Delayed Response

**Symptoms**: Actions take seconds to reflect.

**Solutions**:
1. Check network latency
2. Use local network instead of P2P
3. Close other apps on mobile
4. Reduce desktop CPU usage

### Playback Out of Sync

**Symptoms**: Mobile shows different state than desktop.

**Solutions**:
1. Pull to refresh on mobile
2. WebSocket may have disconnected - refresh page
3. Check both devices' time is synced

## Browser-Specific Issues

### Safari (iOS)

**Issue**: Audio controls don't work.
**Solution**: Use the dedicated web app (Add to Home Screen).

**Issue**: Connection drops when screen locks.
**Solution**: Keep screen on while using remote.

### Chrome (Android)

**Issue**: Notifications not working.
**Solution**: Enable notifications in browser settings.

**Issue**: Battery optimization kills connection.
**Solution**: Disable battery optimization for Chrome.

### Firefox

**Issue**: WebSocket connection fails.
**Solution**: Check Firefox privacy settings, disable Enhanced Tracking Protection for the site.

## Add to Home Screen Issues

### Can't Add to Home Screen

**iOS Safari**:
1. Tap Share button
2. Scroll to find "Add to Home Screen"
3. Tap Add

**Android Chrome**:
1. Tap menu (three dots)
2. Tap "Add to Home screen"
3. Tap Add

### Home Screen App Doesn't Work

**Solutions**:
1. Remove and re-add
2. Clear browser data
3. Use browser instead temporarily

## Security Concerns

### "Not Secure" Warning

**Why**: Local connections use HTTP, not HTTPS.

**Safe because**:
- Only accessible on local network
- E2E encryption still protects P2P data

**To avoid**: Use P2P mode which is fully encrypted.

### Unknown Device Warning

**Solution**:
1. Check device name matches your phone
2. If unexpected, deny and regenerate code
3. Review authorized devices list

## Debugging

### Check Connection Status

On mobile, look for:
- Green indicator = connected
- Yellow indicator = connecting
- Red indicator = disconnected

### View Logs

On desktop:
1. Settings > Advanced > Debug Logging
2. Enable logging
3. Reproduce issue
4. Check logs at Settings > Advanced > Open Logs

### Network Debug

On mobile browser:
1. Open developer tools (if available)
2. Check Console for errors
3. Check Network tab for failed requests

## Still Having Issues?

1. **Restart everything**:
   - Close mobile browser completely
   - Restart desktop Audiio
   - Try again

2. **Update**:
   - Update Audiio to latest version
   - Update mobile browser

3. **Report issue**:
   - Include: Audiio version, OS versions, browser
   - Describe steps to reproduce
   - Include any error messages

## Related

- [Mobile Setup](setup.md) - Initial setup
- [Mobile Features](features.md) - What you can do
- [General Troubleshooting](../troubleshooting.md) - Desktop issues

