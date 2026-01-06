# Contexts

This folder contains React Context providers that manage global UI state and provide shared functionality across the application.

---

## ThemeContext

**File:** `ThemeContext.tsx`

The ThemeContext manages the application's theming system by applying CSS variables dynamically and responding to theme changes.

### Overview

The `ThemeProvider` component wraps the application and handles:
- Applying theme colors, gradients, shadows, and other design tokens as CSS variables
- Generating derived colors (energy levels, genre colors) from the accent color
- Supporting auto light/dark mode based on system preferences
- Applying custom CSS from themes with XSS sanitization
- Cleaning up old theme styles when switching themes

### Exports

#### Components

| Export | Description |
|--------|-------------|
| `ThemeProvider` | Provider component that applies theme CSS variables to `:root` |

#### Hooks

| Hook | Return Type | Description |
|------|-------------|-------------|
| `useCurrentTheme()` | `ThemeConfig` | Returns the currently active theme configuration |
| `useColorMode()` | `'dark' \| 'light'` | Returns the effective color mode (respects auto mode) |
| `useIsDarkMode()` | `boolean` | Convenience hook to check if dark mode is active |

### Usage

```tsx
import { ThemeProvider, useCurrentTheme, useIsDarkMode } from './contexts/ThemeContext';

// Wrap your app
function App() {
  return (
    <ThemeProvider>
      <YourApp />
    </ThemeProvider>
  );
}

// Use in components
function MyComponent() {
  const theme = useCurrentTheme();
  const isDark = useIsDarkMode();

  return <div>Current theme: {theme.name}</div>;
}
```

### CSS Variables Applied

The provider sets the following CSS variable categories on `:root`:

- **Background:** `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-hover`, `--bg-elevated`, `--bg-surface`, `--bg-overlay`
- **Text:** `--text-hero`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-muted`, `--text-inverse`, `--text-on-accent`
- **Accent:** `--accent`, `--accent-hover`, `--accent-glow`, `--accent-soft`, `--accent-muted`
- **Lyrics:** `--lyrics-accent`, `--lyrics-accent-glow`
- **Border:** `--border-color`, `--border-light`, `--border-strong`
- **Semantic:** `--color-success`, `--color-warning`, `--color-error`, `--color-info`
- **Energy (derived):** `--color-energy-calm`, `--color-energy-chill`, `--color-energy-balanced`, `--color-energy-upbeat`, `--color-energy-intense`
- **Genre (derived):** `--color-genre-rock`, `--color-genre-pop`, `--color-genre-electronic`, etc.
- **Gradients, Shadows, Glass, Radius, Fonts**

### Security

Custom CSS from themes is sanitized to prevent XSS attacks:
- Blocks `expression()`, `javascript:`, `@import`, data URLs, etc.
- Limits custom CSS to 50KB
- Scopes selectors to `.app` container

---

## ContextMenuContext

**File:** `ContextMenuContext.tsx`

The ContextMenuContext provides a unified system for displaying right-click context menus on various entity types throughout the application.

### Overview

The `ContextMenuProvider` manages:
- Displaying context menus at cursor position
- Supporting multiple entity types: tracks, artists, albums, playlists, and tags
- Providing type-specific convenience hooks for backward compatibility
- Rendering the actual `ContextMenu` component with appropriate actions

### Supported Entity Types

| Type | Data Type | Description |
|------|-----------|-------------|
| `track` | `UnifiedTrack` | Individual music tracks |
| `artist` | `SearchArtist` | Artist entities |
| `album` | `SearchAlbum` | Album entities |
| `playlist` | `Playlist` | User playlists |
| `tag` | `Tag` | User-defined tags |

### Exports

#### Components

| Export | Description |
|--------|-------------|
| `ContextMenuProvider` | Provider that manages context menu state and renders the menu |

#### Hooks

| Hook | Description |
|------|-------------|
| `useEntityContextMenu()` | Generic hook returning all context menu methods |
| `useTrackContextMenu()` | Track-specific context menu (backward compatible) |
| `useArtistContextMenu()` | Artist-specific context menu |
| `useAlbumContextMenu()` | Album-specific context menu |
| `usePlaylistContextMenu()` | Playlist-specific context menu |
| `useTagContextMenu()` | Tag-specific context menu |

### Usage

```tsx
import { ContextMenuProvider, useTrackContextMenu, useEntityContextMenu } from './contexts/ContextMenuContext';

// Wrap your app with callbacks
function App() {
  return (
    <ContextMenuProvider
      onAddToPlaylist={(track) => openPlaylistModal(track)}
      onAddToCollection={(track) => openCollectionModal(track)}
      onTagTrack={(track) => openTagModal(track)}
      onDislike={(track) => handleDislike(track)}
    >
      <YourApp />
    </ContextMenuProvider>
  );
}

// Track-specific usage (backward compatible)
function TrackRow({ track }) {
  const { showContextMenu } = useTrackContextMenu();

  return (
    <div onContextMenu={(e) => showContextMenu(e, track)}>
      {track.title}
    </div>
  );
}

// Generic usage for any entity type
function EntityCard({ entity, type }) {
  const { showContextMenu } = useEntityContextMenu();

  return (
    <div onContextMenu={(e) => showContextMenu(e, { type, data: entity })}>
      {entity.name}
    </div>
  );
}
```

### Provider Props

| Prop | Type | Description |
|------|------|-------------|
| `children` | `ReactNode` | Child components |
| `onAddToPlaylist` | `(track: UnifiedTrack) => void` | Callback when "Add to Playlist" is selected |
| `onAddToCollection` | `(track: UnifiedTrack) => void` | Callback when "Add to Collection" is selected |
| `onTagTrack` | `(track: UnifiedTrack) => void` | Callback when "Tag Track" is selected |
| `onDislike` | `(track: UnifiedTrack) => void` | Callback when "Dislike" is selected |

### Context Menu State

The internal state tracks:
- `entity`: The entity being right-clicked (type + data)
- `x`, `y`: Cursor position for menu placement
