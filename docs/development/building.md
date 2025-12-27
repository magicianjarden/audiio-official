# Building Audiio

Build Audiio from source for development or distribution.

## Prerequisites

Ensure you have the development environment set up. See [Setup Guide](setup.md).

Required:
- Node.js 20.x LTS
- npm 10.x+
- Git 2.x+

## Build Commands

### Build All Packages

```bash
npm run build:all
```

This builds packages in dependency order:
1. `@audiio/core` - Types and base services
2. `@audiio/sdk` - Addon development SDK
3. `@audiio/ml-sdk` - ML SDK
4. `@audiio/ml-core` - ML core functionality
5. `@audiio/algo` - Recommendation algorithms
6. All other packages via Turbo

### Build Individual Packages

```bash
# Core packages
npm run build:core      # @audiio/core
npm run build:sdk       # @audiio/sdk

# ML packages
npm run build:ml        # All ML packages

# Turbo handles the rest
npm run build           # All packages via Turbo
```

### Build Specific Package

```bash
# Using npm workspace
npm run build --workspace=@audiio/ui
npm run build --workspace=@audiio/desktop
npm run build --workspace=@audiio/mobile
```

## Development Mode

### Run All in Dev Mode

```bash
npm run dev
```

This starts all packages in development mode with hot reload.

### Run Specific Package

```bash
npm run dev:ui        # UI components
npm run dev:desktop   # Desktop app
npm run dev:landing   # Landing page
```

### Watch Mode

For continuous rebuilding during development:

```bash
cd packages/ui
npm run watch
```

## Package Distribution

### Desktop App (Electron)

#### macOS

```bash
cd packages/desktop
npm run package:mac
```

Produces:
- `Audiio-arm64.dmg` (Apple Silicon)
- `Audiio-x64.dmg` (Intel)

#### Windows

```bash
cd packages/desktop
npm run package:win
```

Produces:
- `Audiio-Setup.exe`

#### Linux

```bash
cd packages/desktop
npm run package:linux
```

Produces:
- `Audiio.AppImage`
- `Audiio.deb`

#### All Platforms

```bash
cd packages/desktop
npm run package
```

### Mobile Server

The mobile server is bundled with the desktop app. No separate distribution needed.

### Landing Page

```bash
cd packages/landing
npm run build
```

Output in `packages/landing/dist/`. Deploy to any static host.

## Build Configuration

### Turbo Configuration

`turbo.json` defines the build pipeline:

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

- `dependsOn: ["^build"]` - Build dependencies first
- `outputs: ["dist/**"]` - Cache dist directories
- `cache: false` - Dev mode doesn't cache

### TypeScript Configuration

Base config in `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true
  }
}
```

Packages extend this with their own `tsconfig.json`.

### Build Output

Each package outputs to `dist/`:

```
packages/core/dist/
├── index.js        # CommonJS
├── index.mjs       # ESM
├── index.d.ts      # TypeScript declarations
└── ...
```

## Code Signing

### macOS

For distribution, you need Apple Developer credentials:

```bash
# Set environment variables
export APPLE_ID="your-apple-id"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="your-team-id"

# Build with signing
npm run package:mac
```

### Windows

For signed Windows builds:

```bash
# Set certificate path
export CSC_LINK="path/to/certificate.pfx"
export CSC_KEY_PASSWORD="certificate-password"

# Build with signing
npm run package:win
```

### Skip Signing (Development)

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:mac
```

## Troubleshooting Builds

### TypeScript Errors

```bash
# Rebuild all packages
npm run build:all

# Check specific package
cd packages/ui
npx tsc --noEmit
```

### Dependency Issues

```bash
# Clean and reinstall
npm run clean
rm -rf node_modules
npm install
npm run build:all
```

### Native Module Issues

```bash
# Rebuild native modules for Electron
cd packages/desktop
npm run rebuild
```

### Turbo Cache Issues

```bash
# Clear Turbo cache
rm -rf .turbo
npm run build:all
```

## Continuous Integration

### GitHub Actions

Build runs automatically on:
- Push to `main`
- Pull requests

See `.github/workflows/` for CI configuration.

### Build Matrix

| OS | Architecture | Artifact |
|----|--------------|----------|
| macOS | arm64 | `Audiio-arm64.dmg` |
| macOS | x64 | `Audiio-x64.dmg` |
| Windows | x64 | `Audiio-Setup.exe` |
| Linux | x64 | `Audiio.AppImage` |

## Build Performance

### Speed Up Builds

1. **Use Turbo caching**: Default, no action needed
2. **Parallel builds**: Turbo handles automatically
3. **Incremental builds**: Only rebuild changed packages

### Build Times (Approximate)

| Build | Time |
|-------|------|
| Full build (cold) | ~2-3 min |
| Full build (cached) | ~10-20 sec |
| Single package | ~5-15 sec |
| Package (with signing) | ~5-10 min |

## Next Steps

- [Architecture](architecture.md) - Understand the system design
- [Packages](packages.md) - Package structure and relationships
- [Testing](testing.md) - Run and write tests

