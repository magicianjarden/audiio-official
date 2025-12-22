# Publishing Your Theme

This guide explains how to share your Audiio theme with the community.

## Overview

There are two main ways to share your theme:

1. **JSON Export** - Share the theme file directly
2. **GitHub Repository** - Host your theme for easy installation

## Method 1: JSON Export

### Exporting Your Theme

1. Go to **Settings > Appearance**
2. Make sure your theme is active
3. Click **Export Current**
4. The JSON is copied to your clipboard

### Sharing

Share the JSON file via:
- Direct message/email
- Pastebin or GitHub Gist
- Community forums/Discord

### Users Installing

Recipients can install by:
1. Going to **Settings > Appearance**
2. Clicking **Import JSON**
3. Pasting the JSON content

## Method 2: GitHub Repository

Hosting on GitHub allows users to install with just a repository URL.

### Creating a Theme Repository

1. **Create a new GitHub repository**
   - Name it descriptively (e.g., `audiio-midnight-theme`)
   - Add a description

2. **Create the theme manifest**

   Create a file named `audiio-theme.json` in the root:

   ```json
   {
     "name": "Midnight Theme",
     "author": "Your GitHub Username",
     "version": "1.0.0",
     "description": "A deep, dark theme with purple accents",
     "mode": "dark",
     "colors": {
       "bgPrimary": "#0a0a12",
       "bgSecondary": "#12121f",
       "bgTertiary": "#1a1a2e",
       "bgHover": "#25253d",
       "bgElevated": "#16162a",
       "bgSurface": "#0e0e1a",
       "bgOverlay": "rgba(0, 0, 0, 0.7)",
       "textPrimary": "#ffffff",
       "textSecondary": "#a0a0c0",
       "textMuted": "#606080",
       "textInverse": "#0a0a12",
       "accent": "#8b5cf6",
       "accentHover": "#a78bfa",
       "accentGlow": "rgba(139, 92, 246, 0.3)",
       "accentSoft": "rgba(139, 92, 246, 0.12)",
       "accentMuted": "rgba(139, 92, 246, 0.5)",
       "borderColor": "rgba(139, 92, 246, 0.15)",
       "borderLight": "rgba(139, 92, 246, 0.2)",
       "borderStrong": "rgba(139, 92, 246, 0.3)",
       "colorSuccess": "#10b981",
       "colorWarning": "#f59e0b",
       "colorError": "#ef4444",
       "colorInfo": "#3b82f6"
     }
   }
   ```

3. **Add a README**

   Create a `README.md` with:
   - Theme preview screenshot
   - Installation instructions
   - Color palette overview

   Example:

   ```markdown
   # Midnight Theme for Audiio

   A deep, dark theme with purple accents.

   ![Preview](./preview.png)

   ## Installation

   1. Open Audiio Settings
   2. Click "From GitHub"
   3. Enter: `yourusername/audiio-midnight-theme`
   4. Click Import

   ## Colors

   - Background: Deep navy
   - Accent: Purple (#8b5cf6)
   - Text: White and lavender
   ```

4. **Add a preview image** (optional but recommended)

   - Take a screenshot of Audiio with your theme
   - Save as `preview.png` in the repo

### Repository Structure

```
audiio-midnight-theme/
├── audiio-theme.json    # Required - theme manifest
├── README.md            # Recommended - documentation
└── preview.png          # Recommended - screenshot
```

### Users Installing

Users can install your theme by:
1. Going to **Settings > Appearance**
2. Clicking **From GitHub**
3. Entering your repo URL:
   - `github.com/username/repo`
   - `username/repo` (shorthand)

## Theme Manifest Schema

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name of the theme |
| `colors` | object | Color token values |

### Recommended Fields

| Field | Type | Description |
|-------|------|-------------|
| `author` | string | Your name or username |
| `version` | string | Semantic version (e.g., "1.0.0") |
| `description` | string | Brief theme description |
| `mode` | string | "light" or "dark" |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `customCSS` | string | Additional CSS rules |
| `preview` | string | URL to preview image |

## Versioning

Use semantic versioning for your theme:

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes, complete redesign
- **MINOR** (1.0.0 → 1.1.0): New features, color additions
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, small adjustments

## Best Practices

### Naming

- Use descriptive names: "Sunset", "Ocean", "Neon"
- Include "Audiio" or "theme" for discoverability
- Avoid generic names: "Dark Theme", "My Theme"

### Documentation

- Include screenshots in your README
- List the accent color
- Mention any custom CSS features
- Credit inspirations if applicable

### Testing

Before publishing:
- Test all views (Home, Library, Settings, Player)
- Check modal dialogs
- Verify text readability
- Test in different window sizes

### Maintenance

- Respond to user issues
- Update for Audiio version changes
- Keep the version number current

## Promoting Your Theme

- Share on Audiio community forums
- Post on social media with screenshots
- Submit to theme galleries (when available)
- Create a demo video
