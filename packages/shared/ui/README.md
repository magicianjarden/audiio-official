# @audiio/ui

Shared React UI package for the Audiio music player. Used by both the desktop (Electron) and web clients.

## Package Info

| Field | Value |
|-------|-------|
| Name | `@audiio/ui` |
| Version | `0.1.0` |
| Type | ES Module |
| Framework | React 18 + Vite |

## Directory Structure

```
ui/
├── dist/               # Build output
├── src/                # Source code (see src/README.md)
├── index.html          # HTML entry point
├── package.json        # Package configuration
├── tsconfig.json       # TypeScript configuration
└── vite.config.ts      # Vite build configuration
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (port 5174) |
| `npm run build` | Build for production |
| `npm run build:check` | Type-check then build |
| `npm run preview` | Preview production build |
| `npm run clean` | Remove dist folder |

## Dependencies

### Runtime

| Package | Version | Purpose |
|---------|---------|---------|
| `@audiio/core` | workspace | Core types, orchestrators, addon registry |
| `@audiio/icons` | workspace | Icon components |
| `@dnd-kit/core` | ^6.1.0 | Drag-and-drop (queue reordering) |
| `@dnd-kit/sortable` | ^8.0.0 | Sortable lists |
| `@dnd-kit/utilities` | ^3.2.2 | DnD utilities |
| `@tensorflow/tfjs` | ^4.17.0 | ML inference (client-side) |
| `fuse.js` | ^7.0.0 | Fuzzy search |
| `react` | ^18.3.1 | UI framework |
| `react-dom` | ^18.3.1 | React DOM renderer |
| `zustand` | ^5.0.2 | State management |

### Development

| Package | Version | Purpose |
|---------|---------|---------|
| `@types/react` | ^18.3.12 | React type definitions |
| `@types/react-dom` | ^18.3.1 | React DOM types |
| `@vitejs/plugin-react` | ^4.3.4 | Vite React plugin |
| `typescript` | ^5.7.2 | TypeScript compiler |
| `vite` | ^6.0.3 | Build tool |

## Configuration

### Vite (`vite.config.ts`)

```typescript
{
  plugins: [react()],
  base: './',                    // Relative paths for Electron
  server: { port: 5174 },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      external: ['essentia.js']  // Audio analysis loaded separately
    }
  }
}
```

### TypeScript (`tsconfig.json`)

- Extends `tsconfig.base.json` from monorepo root
- JSX: `react-jsx` (automatic runtime)
- Target: ES2022 + DOM
- No emit (Vite handles bundling)

## Entry Point

### `index.html`

```html
<div id="root"></div>
<script type="module" src="/src/main.tsx"></script>
```

Loads Inter font from Google Fonts for the UI.

## Source Code

See [`src/README.md`](./src/README.md) for detailed documentation of:

- **Components** - React components organized by feature
- **Stores** - Zustand state management (22 stores)
- **Hooks** - Custom React hooks (16 hooks)
- **Contexts** - Theme and context menu providers
- **Services** - Lyrics cache, stream prefetch, search, translation
- **Utils** - Color extraction, lyrics parsing, theming
- **Types** - IPC bridge type definitions
- **ML** - Plugin audio feature integration
- **Registry** - Plugin UI registration system

## Usage

### In Desktop Client

The desktop client loads this UI in Electron's renderer process. Communication with the main process happens via `window.api` (defined in preload script).

### In Web Client

Can be served directly via Vite for development or built and served statically.

## Build Output

After `npm run build`:

```
dist/
├── assets/
│   ├── index-[hash].js     # Bundled JavaScript
│   └── index-[hash].css    # Bundled styles
└── index.html              # Entry HTML
```

## Related Packages

| Package | Description |
|---------|-------------|
| `@audiio/core` | Shared types, orchestrators, addon system |
| `@audiio/icons` | SVG icon components |
| `@audiio/sdk` | Plugin development SDK |
| `packages/clients/desktop` | Electron desktop client |
| `packages/server` | Backend server |
