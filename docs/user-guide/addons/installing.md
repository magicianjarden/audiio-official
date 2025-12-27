# Installing Addons

Find and install addons to extend Audiio's functionality.

## Addon Gallery

The easiest way to find addons.

### Browsing the Gallery

1. Open Audiio
2. Go to **Settings** > **Addons**
3. Click **Browse Addons** or **+ Add Addon**

### Gallery Interface

```
┌─────────────────────────────────────────────────────────────┐
│ Addon Gallery                                    🔍 Search  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Categories: [All] [Music] [Lyrics] [Scrobbling] [Audio]    │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 🎵 Spotify Integration                      [Install] │  │
│  │    Stream and sync with Spotify                       │  │
│  │    ⭐⭐⭐⭐⭐ (128)  Downloads: 5.2k                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 📝 Genius Lyrics                            [Install] │  │
│  │    Lyrics with annotations from Genius                │  │
│  │    ⭐⭐⭐⭐☆ (89)   Downloads: 3.8k                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Finding Addons

**By Category:**
- Music Sources
- Lyrics Providers
- Scrobblers
- Audio Processing
- Integrations
- Utilities

**By Search:**
- Search by name
- Search by function
- Search by keyword

**By Popularity:**
- Most installed
- Highest rated
- Recently updated

## Installing from Gallery

### Install Process

1. Find the addon you want
2. Click **Install**
3. Review permissions (if any)
4. Click **Confirm**
5. Addon downloads and installs

### After Installation

- Addon appears in your list
- May be enabled automatically
- Configure settings if needed

## Manual Installation

For addons not in the gallery.

### From File

1. Download the addon file (`.audiio-addon`)
2. Go to **Settings** > **Addons**
3. Click **Install from File**
4. Select the downloaded file
5. Confirm installation

### From URL

1. Copy the addon URL
2. Go to **Settings** > **Addons**
3. Click **Install from URL**
4. Paste the URL
5. Confirm installation

### From GitHub

Many addons are hosted on GitHub:

1. Find the addon repository
2. Go to Releases
3. Download the `.audiio-addon` file
4. Install from file (above)

Or use the GitHub URL directly in "Install from URL".

## Addon Sources

### Official Sources

| Source | Trust Level |
|--------|-------------|
| Built-in | ✅ Verified |
| Gallery | ✅ Reviewed |
| Official GitHub | ✅ Verified |

### Community Sources

| Source | Trust Level |
|--------|-------------|
| Known developers | ⚠️ Community trust |
| Forums | ⚠️ Check reputation |
| Unknown sources | ❌ Caution |

## Installation Requirements

### System Requirements

Some addons may require:

- Specific Audiio version
- Additional software (e.g., Python for Demucs)
- System permissions

### Dependencies

Addons may depend on:

- Other addons
- System libraries
- External services

Dependencies are installed automatically when possible.

## Verifying Addons

### Check Before Installing

- Author reputation
- Download count
- User ratings
- Last update date
- Open source (view code)

### Warning Signs

Be cautious if:
- Unknown author
- No ratings/downloads
- Very old (unmaintained)
- Requests unusual permissions
- Closed source with no reputation

## Permissions

Addons may request various permissions:

| Permission | Description | Risk |
|------------|-------------|------|
| Network | Access internet | Low |
| File Read | Read specific files | Low |
| File Write | Write to disk | Medium |
| System | Access system APIs | High |

### Permission Prompt

```
┌─────────────────────────────────────────────────────────────┐
│ Addon Permissions                                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  "My Addon" requests the following permissions:             │
│                                                              │
│  ✓ Network Access                                           │
│    Connect to external services                              │
│                                                              │
│  ✓ File System (Limited)                                    │
│    Read and write to addon folder                           │
│                                                              │
│           [Cancel]           [Allow]                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Updating Addons

### Automatic Updates

By default, addons update automatically:

1. Update downloaded in background
2. Applied on next Audiio restart
3. Notification shown

### Manual Updates

To update manually:

1. Go to **Settings** > **Addons**
2. Click **Check for Updates**
3. Click **Update** on available updates

### Disable Auto-Update

Per addon:
1. Click addon settings
2. Disable **Auto-update**

Globally:
1. **Settings** > **Addons**
2. Disable **Auto-update all**

## Troubleshooting Installation

### Installation Fails

1. Check internet connection
2. Try redownloading
3. Check Audiio version compatibility
4. Look at error message details

### Addon Won't Enable

1. Check for missing dependencies
2. Verify permissions granted
3. Check addon logs
4. Try reinstalling

### Incompatible Version

If an addon requires newer Audiio:

1. Update Audiio to latest version
2. Or find older addon version
3. Or wait for addon update

## Bulk Operations

### Install Multiple

1. Select addons in gallery
2. Click **Install All Selected**
3. Confirm permissions
4. All install at once

### Export Addon List

Save your addon configuration:

1. Go to **Settings** > **Addons**
2. Click **Export List**
3. Save the file

### Import Addon List

Restore on another machine:

1. Click **Import List**
2. Select exported file
3. Missing addons are installed

## Related

- [Managing Addons](managing.md) - Configure installed addons
- [Addon Overview](README.md) - What addons can do
- [Troubleshooting](../troubleshooting.md) - General troubleshooting

