# Getting Started with Themes

This guide will walk you through creating your first Audiio theme.

## Method 1: Using the Visual Editor

The easiest way to create a theme is using the built-in visual editor.

### Steps

1. **Open Settings**
   - Click the Settings/Appearance icon in the sidebar

2. **Create a New Theme**
   - Click the "Create Theme" button in the Theme Actions section

3. **Configure Basic Settings**
   - Enter a name for your theme
   - Choose the base mode (Light or Dark)

4. **Customize Colors**
   - Use the color pickers to adjust each color token
   - The live preview updates in real-time
   - Colors are organized by category:
     - **Background** - Primary, secondary, tertiary surfaces
     - **Text** - Primary, secondary, muted text colors
     - **Accent** - Brand/highlight colors
     - **Semantic** - Success, warning, error, info

5. **Add Custom CSS (Optional)**
   - Switch to the "Advanced" tab
   - Add custom CSS rules for fine-tuning

6. **Save Your Theme**
   - Click "Create Theme" to save and apply

## Method 2: Writing JSON

For more control, you can write theme JSON directly.

### Minimal Theme

```json
{
  "name": "My Theme",
  "mode": "dark",
  "colors": {
    "bgPrimary": "#0a0a0a",
    "bgSecondary": "#141414",
    "bgTertiary": "#1c1c1c",
    "bgHover": "#252525",
    "bgElevated": "#1a1a1a",
    "bgSurface": "#121212",
    "textPrimary": "#ffffff",
    "textSecondary": "#a0a0a0",
    "textMuted": "#606060",
    "accent": "#1db954",
    "accentHover": "#1ed760"
  }
}
```

### Complete Theme

```json
{
  "name": "Cyberpunk",
  "author": "Your Name",
  "version": "1.0.0",
  "description": "A neon cyberpunk theme",
  "mode": "dark",
  "colors": {
    "bgPrimary": "#0d0d0d",
    "bgSecondary": "#1a1a2e",
    "bgTertiary": "#16213e",
    "bgHover": "#0f3460",
    "bgElevated": "#1a1a2e",
    "bgSurface": "#0d0d0d",
    "bgOverlay": "rgba(0, 0, 0, 0.8)",
    "textPrimary": "#e94560",
    "textSecondary": "#00fff5",
    "textMuted": "#533483",
    "textInverse": "#0d0d0d",
    "accent": "#e94560",
    "accentHover": "#ff6b6b",
    "accentGlow": "rgba(233, 69, 96, 0.4)",
    "accentSoft": "rgba(233, 69, 96, 0.15)",
    "accentMuted": "rgba(233, 69, 96, 0.6)",
    "borderColor": "rgba(233, 69, 96, 0.2)",
    "borderLight": "rgba(233, 69, 96, 0.3)",
    "borderStrong": "rgba(233, 69, 96, 0.5)",
    "colorSuccess": "#00ff88",
    "colorWarning": "#ffbe0b",
    "colorError": "#ff006e",
    "colorInfo": "#00fff5"
  },
  "customCSS": ".sidebar { border-right: 1px solid var(--accent); }"
}
```

### Importing Your Theme

1. Go to **Settings > Appearance**
2. Click **Import JSON**
3. Paste your theme JSON
4. Click **Import**

## Tips for Great Themes

### Color Contrast

Ensure sufficient contrast between text and backgrounds:
- Primary text should have at least 4.5:1 contrast ratio
- Use muted colors for less important text

### Consistency

- Keep the accent color consistent across the theme
- Use variations (hover, glow, soft) rather than different colors

### Testing

Test your theme with:
- All views (Home, Library, Settings, etc.)
- Player in all states (playing, paused)
- Modal dialogs
- Light and dark room conditions

## Next Steps

- Learn about all available [Color Tokens](./color-tokens.md)
- Add [Custom CSS](./custom-css.md) for advanced styling
- [Publish your theme](./publishing.md) to share with others
