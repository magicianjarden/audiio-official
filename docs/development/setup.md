# Development Environment Setup

Set up your development environment to contribute to Audiio.

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 20.x LTS | Runtime |
| npm | 10.x+ | Package manager |
| Git | 2.x+ | Version control |

### Optional (Recommended)

| Software | Purpose |
|----------|---------|
| VS Code | Recommended editor |
| FFmpeg | Audio processing (for karaoke addon) |
| Docker | Running relay server locally |

## Installing Prerequisites

### Node.js

**macOS (with Homebrew):**
```bash
brew install node@20
```

**Windows:**
Download from [nodejs.org](https://nodejs.org/) (LTS version)

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Git

**macOS:**
```bash
xcode-select --install
# or
brew install git
```

**Windows:**
Download from [git-scm.com](https://git-scm.com/)

**Linux:**
```bash
sudo apt-get install git
```

## Clone the Repository

```bash
git clone https://github.com/magicianjarden/audiio-official.git
cd audiio-official
```

## Install Dependencies

```bash
npm install
```

This installs dependencies for all packages in the monorepo.

## Build All Packages

```bash
npm run build:all
```

This builds packages in the correct order:
1. `@audiio/core` - Types and base services
2. `@audiio/sdk` - Addon SDK
3. `@audiio/icons` - Icon library
4. `@audiio/ui` - React components
5. `@audiio/desktop` - Electron app
6. `@audiio/mobile` - Mobile server
7. `@audiio/relay` - Relay server

## Running in Development

### Desktop App

```bash
npm run dev
```

This starts the Electron app with hot reload for the renderer process.

### Individual Packages

```bash
# Build specific package
npm run build:core
npm run build:sdk
npm run build:ui
npm run build:desktop
npm run build:mobile
npm run build:relay

# Watch mode (auto-rebuild on changes)
cd packages/ui && npm run watch
```

## Project Structure

```
audiio-official/
├── packages/
│   ├── core/          # @audiio/core - Types and base services
│   │   └── src/
│   │       ├── types/     # Type definitions
│   │       ├── registry/  # Addon registry
│   │       └── index.ts
│   │
│   ├── sdk/           # @audiio/sdk - Addon development SDK
│   │   └── src/
│   │       ├── base/      # Base classes for addons
│   │       └── index.ts
│   │
│   ├── ui/            # @audiio/ui - React UI
│   │   └── src/
│   │       ├── components/  # React components
│   │       ├── stores/      # Zustand stores
│   │       ├── hooks/       # Custom hooks
│   │       └── App.tsx
│   │
│   ├── desktop/       # @audiio/desktop - Electron app
│   │   └── src/
│   │       ├── main.ts      # Main process
│   │       ├── preload.ts   # Preload script
│   │       └── services/    # IPC handlers
│   │
│   ├── mobile/        # @audiio/mobile - Mobile server
│   │   └── src/
│   │       ├── server/      # Fastify server
│   │       └── web/         # React web app
│   │
│   ├── relay/         # @audiio/relay - P2P relay
│   │   └── src/
│   │       ├── server/      # Relay server
│   │       ├── client/      # Desktop client
│   │       └── shared/      # Shared types
│   │
│   ├── icons/         # @audiio/icons - Icon library
│   └── landing/       # @audiio/landing - Marketing site
│
├── addons/            # Built-in addons
│   ├── deezer-metadata/
│   ├── lrclib-lyrics/
│   ├── youtube-music/
│   └── ...
│
├── docs/              # Documentation
└── package.json       # Root package.json
```

## VS Code Setup

### Recommended Extensions

- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense (if using Tailwind)

### Workspace Settings

Create `.vscode/settings.json`:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

## Environment Variables

Create a `.env` file in the root (optional):

```bash
# Development
NODE_ENV=development

# Relay server URL (for mobile)
AUDIIO_RELAY_URL=wss://audiio-relay.fly.dev

# Debug logging
DEBUG=audiio:*
```

## Common Issues

### `npm install` fails

Try clearing the cache:
```bash
npm cache clean --force
rm -rf node_modules
npm install
```

### Electron won't start

Rebuild native modules:
```bash
npm run rebuild
```

### TypeScript errors

Rebuild all packages:
```bash
npm run build:all
```

### Port already in use

The mobile server uses port 9484. If it's in use:
```bash
# Find process using the port
lsof -i :9484

# Kill it
kill -9 <PID>
```

## Next Steps

- [Building](building.md) - Build and package for distribution
- [Architecture](architecture.md) - Understand the system design
- [Addon Tutorial](addons/tutorial.md) - Build your first addon
