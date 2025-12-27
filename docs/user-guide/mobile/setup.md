# Mobile Setup

Connect your phone or tablet to control Audiio remotely.

## Prerequisites

Before starting:

- Audiio desktop app running
- Phone/tablet with modern browser
- Same WiFi network (for local) OR internet connection (for P2P)

## Step 1: Enable Mobile Access

On your desktop:

1. Open Audiio
2. Go to **Settings** (gear icon)
3. Select **Mobile Access**
4. Click **Enable Mobile Access**

```
┌─────────────────────────────────────────────────────────────┐
│ Mobile Access Settings                                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Status: ● Enabled                                          │
│                                                              │
│  Connection Code:                                           │
│  ┌─────────────────────────────────────┐                   │
│  │     SWIFT-EAGLE-42                  │   [Copy]          │
│  └─────────────────────────────────────┘                   │
│                                                              │
│  Local URL: http://192.168.1.100:9484                       │
│                                                              │
│  [Regenerate Code]  [Disable]                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Step 2: Note Your Connection Code

The connection code is a memorable phrase like:

- `SWIFT-EAGLE-42`
- `HAPPY-TIGER-77`
- `BLUE-OCEAN-15`

This code lets your phone connect securely.

## Step 3: Connect from Mobile

### Option A: Quick Connect (P2P)

1. On your phone, open a browser
2. Go to **audiio.app/remote**
3. Enter your connection code
4. Tap **Connect**

### Option B: Local Network

If you're on the same WiFi:

1. On your phone, open a browser
2. Enter the local URL shown (e.g., `http://192.168.1.100:9484`)
3. The mobile interface loads directly

## Step 4: Authorize the Device

First-time connections need approval:

1. On desktop, a notification appears
2. Review the device name
3. Click **Authorize** to allow
4. Connection completes

```
┌─────────────────────────────────────────────────────────────┐
│ New Device Connection                                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📱 iPhone wants to connect                                 │
│                                                              │
│  IP: 192.168.1.105                                          │
│  Browser: Safari                                            │
│                                                              │
│          [Deny]           [Authorize]                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Connection Verified

Once connected, you'll see:

**On Mobile:**
- Now playing information
- Playback controls
- Library access

**On Desktop:**
- Connected device indicator
- Device in Mobile Access settings

## Connection Methods Compared

### Local Network

Best when on same WiFi:

| Pros | Cons |
|------|------|
| Fastest response | Same network required |
| No internet needed | May not work on guest WiFi |
| Direct connection | IP can change |

### P2P via Relay

Best for remote access:

| Pros | Cons |
|------|------|
| Works anywhere | Requires internet |
| Easy to remember code | Slightly higher latency |
| Firewall-friendly | Depends on relay server |

## Add to Home Screen

For quick access, add the mobile web app to your home screen:

### iOS (Safari)

1. Tap the Share button
2. Select **Add to Home Screen**
3. Tap **Add**

### Android (Chrome)

1. Tap the menu (⋮)
2. Select **Add to Home Screen**
3. Tap **Add**

The app icon appears on your home screen for instant access.

## Managing Connected Devices

View and manage devices in Settings > Mobile Access:

```
┌─────────────────────────────────────────────────────────────┐
│ Connected Devices                                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📱 iPhone                            Connected now          │
│     Last seen: Just now                          [Revoke]   │
│                                                              │
│  📱 iPad                              Connected 2h ago       │
│     Last seen: 2 hours ago                       [Revoke]   │
│                                                              │
│  [Revoke All]                                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Revoke Access

To remove a device:

1. Find the device in the list
2. Click **Revoke**
3. Device is disconnected immediately

### Regenerate Code

If you think the code is compromised:

1. Click **Regenerate Code**
2. New code is generated
3. Existing connections continue
4. New connections need new code

## Security Settings

Configure mobile access security:

| Setting | Description |
|---------|-------------|
| Auto-lock | Require re-auth after inactivity |
| Allowed Actions | Limit what mobile can do |
| Notifications | Alert on new connections |
| Device Limit | Max simultaneous devices |

## Multiple Devices

Connect multiple phones/tablets:

1. Each device needs to authorize
2. All see the same playback
3. Any device can control

### Conflict Handling

If two devices send commands simultaneously:
- Last command wins
- Both see the result
- No data loss

## Troubleshooting Quick Fixes

### Can't Connect

1. Check desktop Audiio is running
2. Verify mobile access is enabled
3. Ensure devices are on same network (local) or have internet (P2P)
4. Try regenerating the code

### Connection Drops

1. Check WiFi/internet stability
2. Keep desktop Audiio in focus
3. Disable battery saver on mobile

### Wrong Code Error

1. Double-check the code spelling
2. Regenerate code on desktop
3. Try the new code

See [Troubleshooting](troubleshooting.md) for more solutions.

## Next Steps

- [Mobile Features](features.md) - Explore what you can do
- [Troubleshooting](troubleshooting.md) - Fix issues
- [Settings](../settings.md) - Configure mobile access

