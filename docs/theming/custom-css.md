# Custom CSS Guide

The Audiio theming system allows you to include custom CSS for advanced styling beyond color tokens.

## Overview

Custom CSS gives you fine-grained control over the appearance of Audiio. You can:

- Override default styles
- Add animations and transitions
- Create unique visual effects
- Fine-tune spacing and layout

## Adding Custom CSS

### Via Visual Editor

1. Open the theme editor
2. Switch to the **Advanced** tab
3. Write your CSS in the textarea
4. Preview changes in real-time

### Via JSON

```json
{
  "name": "My Theme",
  "colors": { ... },
  "customCSS": ".sidebar { border-right: 2px solid var(--accent); }"
}
```

## Security

For safety, custom CSS is sanitized before being applied:

**Blocked patterns:**
- JavaScript expressions
- External imports (`@import`)
- Data URLs
- Browser-specific bindings

**Allowed:**
- All standard CSS properties
- CSS variables (`var(--name)`)
- Animations and keyframes
- Media queries

## Component Selectors

### Layout

```css
/* Main app container */
.app { }

/* Sidebar */
.sidebar { }

/* Main content area */
.main-content { }

/* Player bar */
.player { }
```

### Sidebar Elements

```css
/* Logo */
.sidebar-logo { }

/* Navigation items */
.sidebar-nav-item { }
.sidebar-nav-item.active { }

/* Section headers */
.sidebar-section-header { }

/* Playlist items */
.sidebar-playlist-item { }
```

### Content

```css
/* View headers */
.library-header { }

/* Section titles */
.discover-section-header { }

/* Track cards */
.track-card { }

/* Quick pick cards */
.quick-pick-card { }
```

### Player

```css
/* Player container */
.player { }

/* Now playing info */
.player-now-playing { }

/* Player controls */
.player-controls { }

/* Progress bar */
.player-progress { }

/* Volume controls */
.player-volume { }
```

### Modals & Overlays

```css
/* Modal overlay */
.modal-overlay { }

/* Modal container */
.modal { }

/* Context menu */
.context-menu { }
```

## Example Customizations

### Glowing Accent

```css
.sidebar-nav-item.active {
  box-shadow:
    0 0 20px var(--accent-glow),
    0 0 40px var(--accent-glow);
}

.player-controls button:hover {
  filter: drop-shadow(0 0 8px var(--accent-glow));
}
```

### Rounded Everything

```css
.sidebar,
.main-content,
.player {
  border-radius: 24px !important;
}

.track-card,
.quick-pick-card {
  border-radius: 16px !important;
}
```

### Border Accents

```css
.sidebar {
  border-right: 2px solid var(--accent);
}

.player {
  border-top: 2px solid var(--accent);
}

.track-card:hover {
  border: 1px solid var(--accent);
}
```

### Custom Scrollbar

```css
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: var(--bg-primary);
}

::-webkit-scrollbar-thumb {
  background: var(--accent-muted);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--accent);
}
```

### Glassmorphism

```css
.sidebar,
.player {
  background: rgba(20, 20, 20, 0.8) !important;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}
```

### Animations

```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.player-now-playing .now-playing-art {
  animation: pulse 2s ease-in-out infinite;
}
```

### Gradient Backgrounds

```css
.sidebar {
  background: linear-gradient(
    180deg,
    var(--bg-secondary) 0%,
    var(--bg-primary) 100%
  ) !important;
}
```

## Best Practices

### Use CSS Variables

Reference theme variables instead of hardcoded colors:

```css
/* Good */
.my-element {
  color: var(--text-primary);
  background: var(--bg-secondary);
}

/* Avoid */
.my-element {
  color: #ffffff;
  background: #141414;
}
```

### Avoid `!important` When Possible

Only use `!important` when necessary to override existing styles:

```css
/* Prefer specificity */
.sidebar .sidebar-nav-item.active {
  background: var(--accent-soft);
}

/* Only when needed */
.sidebar {
  background: transparent !important;
}
```

### Keep It Minimal

Custom CSS should complement your color choices, not replace the entire design:

```css
/* Good - subtle enhancement */
.track-card:hover {
  transform: translateY(-2px);
}

/* Excessive - hard to maintain */
.track-card {
  /* 50 lines of CSS */
}
```

### Test Responsiveness

Ensure your custom CSS works at different window sizes:

```css
@media (max-width: 900px) {
  .sidebar {
    width: 80px;
  }
}
```

## Debugging

### Browser DevTools

1. Right-click any element and select "Inspect"
2. Find the element's CSS classes
3. Test your CSS in the Styles panel
4. Copy working rules to your theme

### Common Issues

**CSS not applying:**
- Check selector specificity
- Verify the selector matches the element
- Try adding `!important`

**Broken layout:**
- Avoid changing `display`, `position`, or `flex` properties
- Be careful with `width`/`height` overrides

**Performance issues:**
- Avoid complex animations on frequently updating elements
- Limit `backdrop-filter` usage (GPU intensive)
