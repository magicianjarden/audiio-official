# Color Tokens Reference

This document lists all available color tokens in the Audiio theming system.

## Background Colors

| Token | Description | Example (Dark) | Example (Light) |
|-------|-------------|----------------|-----------------|
| `bgPrimary` | Main app background | `#0a0a0a` | `#ffffff` |
| `bgSecondary` | Sidebar, panels | `#141414` | `#f5f5f5` |
| `bgTertiary` | Cards, elevated elements | `#1c1c1c` | `#ebebeb` |
| `bgHover` | Hover state backgrounds | `#252525` | `#e0e0e0` |
| `bgElevated` | Modals, popovers | `#1a1a1a` | `#ffffff` |
| `bgSurface` | Alternate surfaces | `#121212` | `#fafafa` |
| `bgOverlay` | Modal overlays | `rgba(0,0,0,0.6)` | `rgba(0,0,0,0.4)` |

### Usage

```css
.my-card {
  background: var(--bg-secondary);
}

.my-card:hover {
  background: var(--bg-hover);
}
```

## Text Colors

| Token | Description | Example (Dark) | Example (Light) |
|-------|-------------|----------------|-----------------|
| `textPrimary` | Main text | `#ffffff` | `#1a1a1a` |
| `textSecondary` | Secondary text | `#a0a0a0` | `#666666` |
| `textMuted` | Muted/disabled text | `#606060` | `#999999` |
| `textInverse` | Text on accent backgrounds | `#000000` | `#ffffff` |

### Usage

```css
.title {
  color: var(--text-primary);
}

.subtitle {
  color: var(--text-secondary);
}

.hint {
  color: var(--text-muted);
}
```

## Accent Colors

| Token | Description | Default |
|-------|-------------|---------|
| `accent` | Primary accent/brand color | `#1db954` |
| `accentHover` | Hover state of accent | `#1ed760` |
| `accentGlow` | Glow/shadow effects | `rgba(29,185,84,0.25)` |
| `accentSoft` | Soft accent backgrounds | `rgba(29,185,84,0.1)` |
| `accentMuted` | Muted accent for borders | `rgba(29,185,84,0.5)` |

### Usage

```css
.play-button {
  background: var(--accent);
}

.play-button:hover {
  background: var(--accent-hover);
}

.active-nav-item {
  background: var(--accent-soft);
  box-shadow: 0 0 20px var(--accent-glow);
}
```

## Border Colors

| Token | Description | Example (Dark) |
|-------|-------------|----------------|
| `borderColor` | Standard borders | `rgba(255,255,255,0.08)` |
| `borderLight` | Subtle borders | `rgba(255,255,255,0.12)` |
| `borderStrong` | Emphasized borders | `rgba(255,255,255,0.18)` |

### Usage

```css
.card {
  border: 1px solid var(--border-color);
}

.card:hover {
  border-color: var(--border-strong);
}
```

## Semantic Colors

| Token | Description | Default |
|-------|-------------|---------|
| `colorSuccess` | Success states | `#1db954` |
| `colorWarning` | Warning states | `#f59e0b` |
| `colorError` | Error states | `#ef4444` |
| `colorInfo` | Info states | `#3b82f6` |

### Usage

```css
.success-message {
  color: var(--color-success);
}

.error-message {
  color: var(--color-error);
}
```

## CSS Variable Mapping

When your theme is applied, each color token becomes a CSS variable:

| Theme Token | CSS Variable |
|-------------|--------------|
| `bgPrimary` | `--bg-primary` |
| `bgSecondary` | `--bg-secondary` |
| `textPrimary` | `--text-primary` |
| `accent` | `--accent` |
| ... | ... |

## Full Theme Colors Object

```typescript
interface ThemeColors {
  // Backgrounds
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgHover: string;
  bgElevated: string;
  bgSurface: string;
  bgOverlay: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Accent
  accent: string;
  accentHover: string;
  accentGlow: string;
  accentSoft: string;
  accentMuted: string;

  // Borders
  borderColor: string;
  borderLight: string;
  borderStrong: string;

  // Semantic
  colorSuccess: string;
  colorWarning: string;
  colorError: string;
  colorInfo: string;
}
```

## Color Format Support

The theming system supports multiple color formats:

- **Hex**: `#1db954`, `#fff`
- **RGB**: `rgb(29, 185, 84)`
- **RGBA**: `rgba(29, 185, 84, 0.5)`
- **HSL**: `hsl(145, 73%, 42%)`
- **HSLA**: `hsla(145, 73%, 42%, 0.5)`

## Tips

### Generating Accent Variants

When you set the `accent` color in the visual editor, variants are auto-generated:
- `accentHover` - 15% brighter
- `accentGlow` - 25% opacity
- `accentSoft` - 10% opacity
- `accentMuted` - 50% opacity

### Transparency for Overlays

Use RGBA or HSLA for overlay colors:
```json
{
  "bgOverlay": "rgba(0, 0, 0, 0.6)"
}
```

### Contrast Ratios

For accessibility, aim for:
- **4.5:1** - Normal text on background
- **3:1** - Large text and UI components
- **7:1** - Enhanced accessibility
