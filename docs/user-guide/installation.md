# Installation

Download and install Audiio on your computer.

## System Requirements

### Minimum Requirements

| Platform | Requirement |
|----------|-------------|
| macOS | 10.15 (Catalina) or later |
| Windows | Windows 10 or later |
| Linux | Ubuntu 18.04 or equivalent |
| RAM | 4 GB |
| Storage | 200 MB for app |

### Recommended

- 8 GB RAM for smooth performance
- SSD for faster loading
- Stable internet connection for streaming

## Download

Download the latest version from [GitHub Releases](https://github.com/magicianjarden/audiio-official/releases/latest).

### macOS

**Apple Silicon (M1/M2/M3):**
- Download `Audiio-arm64.dmg`

**Intel Mac:**
- Download `Audiio-x64.dmg`

### Windows

- Download `Audiio-Setup.exe`

### Linux

- Download `Audiio.AppImage`

## Installation Steps

### macOS

1. Download the `.dmg` file for your Mac type
2. Double-click to open the disk image
3. Drag **Audiio** to the **Applications** folder
4. Eject the disk image
5. Open Audiio from Applications

**First Launch:**
If you see "Audiio can't be opened because it is from an unidentified developer":
1. Open **System Preferences** > **Security & Privacy**
2. Click **Open Anyway** next to the Audiio message
3. Click **Open** in the confirmation dialog

### Windows

1. Download `Audiio-Setup.exe`
2. Double-click to run the installer
3. Follow the installation wizard
4. Audiio will be added to your Start menu

**SmartScreen Warning:**
If Windows SmartScreen shows a warning:
1. Click **More info**
2. Click **Run anyway**

### Linux

1. Download the `.AppImage` file
2. Make it executable:
   ```bash
   chmod +x Audiio.AppImage
   ```
3. Run the AppImage:
   ```bash
   ./Audiio.AppImage
   ```

**Desktop Integration:**
To add Audiio to your application menu, use a tool like `appimaged` or manually create a `.desktop` file.

## First Run

When you first open Audiio:

1. **Welcome Screen**: You'll see a brief introduction
2. **Theme Selection**: Choose light or dark mode
3. **Ready to Go**: Start searching for music!

See [Getting Started](getting-started.md) for next steps.

## Updating

Audiio checks for updates automatically. When an update is available:

1. You'll see a notification
2. Click to download the update
3. Restart Audiio to apply

### Manual Update

To update manually:
1. Download the latest version from GitHub
2. Install over your existing installation
3. Your settings and library will be preserved

## Uninstalling

### macOS

1. Quit Audiio
2. Drag Audiio from Applications to Trash
3. Empty Trash

To remove all data:
```bash
rm -rf ~/Library/Application\ Support/Audiio
```

### Windows

1. Open Settings > Apps
2. Find Audiio in the list
3. Click Uninstall

### Linux

Simply delete the AppImage file. To remove data:
```bash
rm -rf ~/.config/Audiio
```

## Troubleshooting Installation

### macOS: "Damaged and can't be opened"

Run in Terminal:
```bash
xattr -cr /Applications/Audiio.app
```

### Windows: Installation fails

- Ensure you have administrator privileges
- Temporarily disable antivirus
- Try running the installer as administrator

### Linux: AppImage won't start

Ensure FUSE is installed:
```bash
# Ubuntu/Debian
sudo apt install fuse libfuse2

# Fedora
sudo dnf install fuse
```

## Next Steps

- [Getting Started](getting-started.md) - Set up Audiio for first use
- [Mobile Access](mobile/setup.md) - Connect your phone
- [Features](features/README.md) - Explore what Audiio can do
