# Audiio Theming System

Welcome to the Audiio theming documentation! This guide will help you customize the look and feel of Audiio, create your own themes, and share them with the community.

## Overview

Audiio features a powerful theming system that allows you to:

- **Switch between built-in themes** - 8 carefully crafted themes (5 dark, 3 light)
- **Create custom themes** - Use the visual theme editor or write JSON
- **Import community themes** - Install themes from GitHub repositories or JSON files
- **Export and share** - Share your creations with others

## Quick Start

### Changing Themes

1. Click the **Settings** icon in the sidebar (or go to Appearance)
2. Select **Mode** (Auto, Light, or Dark)
3. Click on any theme preview card to apply it

### Creating a Custom Theme

1. Go to **Settings > Appearance**
2. Click **Create Theme**
3. Use the visual editor to customize colors
4. Click **Create Theme** to save

### Installing from GitHub

1. Go to **Settings > Appearance**
2. Click **From GitHub**
3. Enter the repository URL (e.g., `username/audiio-my-theme`)
4. Click **Import**

## Built-in Themes

### Dark Themes
- **Default Dark** - Spotify-inspired with green accent
- **Midnight** - Deep blues and purples
- **Sunset** - Warm oranges and reds
- **Ocean** - Teal and cyan accents
- **Monochrome Dark** - Elegant grayscale

### Light Themes
- **Default Light** - Clean white with green accent
- **Paper** - Warm cream/beige tones
- **Monochrome Light** - Pure white minimalism

## Documentation

- [Getting Started](./getting-started.md) - Create your first theme
- [Color Tokens](./color-tokens.md) - Complete color variable reference
- [Custom CSS](./custom-css.md) - Advanced CSS customization
- [Publishing](./publishing.md) - Share your theme on GitHub
- [API Reference](./api-reference.md) - Full SDK documentation

## Theme File Format

Themes are defined as JSON files with the following structure:

```json
{
  "name": "My Theme",
  "author": "Your Name",
  "version": "1.0.0",
  "description": "A beautiful custom theme",
  "mode": "dark",
  "colors": {
    "bgPrimary": "#0a0a0a",
    "bgSecondary": "#141414",
    "bgTertiary": "#1c1c1c",
    "textPrimary": "#ffffff",
    "textSecondary": "#a0a0a0",
    "accent": "#1db954"
  }
}
```

See [Color Tokens](./color-tokens.md) for the complete list of available color variables.

## Support

Having issues or questions?

- Check the [API Reference](./api-reference.md) for technical details
- Report issues on GitHub
