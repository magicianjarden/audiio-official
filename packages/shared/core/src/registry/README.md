# Registry Module

Central addon management system for Audiio. Handles registration, lookup, and lifecycle of all plugin providers.

## Files

---

## addon-registry.ts

### Purpose

The `AddonRegistry` class is the core registry that manages all addon providers in Audiio. It provides:

- **Registration/Unregistration**: Add and remove addons at runtime
- **Role-based Indexing**: Fast lookup of addons by their role (stream-provider, lyrics-provider, etc.)
- **Priority Management**: User-configurable priority ordering for provider fallback chains
- **Enable/Disable**: Toggle addons without unregistering them
- **Type-safe Getters**: Specialized methods for each addon role

### Exported Class

```typescript
export class AddonRegistry
```

### Usage Locations

| Consumer | Purpose |
|----------|---------|
| `packages/server/src/services/plugin-loader.ts` | Registers plugins on server startup |
| `packages/server/src/standalone-server.ts` | Accesses providers for API endpoints |
| `packages/server/src/services/library-service.ts` | Uses library management providers |
| `packages/shared/core/src/orchestrators/*` | Retrieves providers for orchestration |
| `packages/shared/ui/src/components/Plugins/PluginsView.tsx` | UI for enabling/disabling addons |
| `packages/clients/desktop/src/main.ts` | Desktop client addon info |

### Methods Reference

#### Core Registration

| Method | Description |
|--------|-------------|
| `register(addon)` | Register an addon and index by its roles |
| `unregister(addonId)` | Remove an addon from the registry |
| `setEnabled(addonId, enabled)` | Enable or disable an addon |
| `has(addonId)` | Check if addon is registered |
| `isEnabled(addonId)` | Check if addon is enabled |
| `get<T>(addonId)` | Get addon by ID (returns null if disabled) |

#### Priority Management

| Method | Description |
|--------|-------------|
| `setAddonPriority(addonId, priority)` | Set user-defined priority (higher = tried first) |
| `setAddonOrder(orderedIds)` | Set priorities based on array order |
| `getAddonPriorities()` | Get map of all user-defined priorities |

#### Provider Getters

Each getter returns providers sorted by priority (highest first).

**Content Providers:**

| Method | Returns | Used For |
|--------|---------|----------|
| `getMetadataProviders()` | `MetadataProvider[]` | Track/album/artist metadata lookup |
| `getPrimaryMetadataProvider()` | `MetadataProvider \| null` | Highest priority metadata source |
| `getStreamProviders()` | `StreamProvider[]` | Audio stream URLs |
| `getStreamProvider(id)` | `StreamProvider \| null` | Specific stream provider |
| `getLyricsProviders()` | `LyricsProvider[]` | Synced/plain lyrics |
| `getScrobblers()` | `Scrobbler[]` | Last.fm, ListenBrainz, etc. |

**Tools & Enrichment:**

| Method | Returns | Used For |
|--------|---------|----------|
| `getTools()` | `Tool[]` | Plugin-provided tools |
| `getTool(id)` | `Tool \| null` | Specific tool by ID |
| `getArtistEnrichmentProviders()` | `ArtistEnrichmentProvider[]` | Videos, concerts, images |
| `getArtistEnrichmentProvidersByType(type)` | `ArtistEnrichmentProvider[]` | Filter by enrichment type |
| `getArtistEnrichmentProvider(id)` | `ArtistEnrichmentProvider \| null` | Specific enrichment provider |
| `getAvailableEnrichmentTypes()` | `ArtistEnrichmentType[]` | List available enrichment types |

**Library Management:**

| Method | Returns | Used For |
|--------|---------|----------|
| `getMetadataEnrichers()` | `MetadataEnricher[]` | Auto-tagging, metadata correction |
| `getArtworkProviders()` | `ArtworkProvider[]` | Album/artist artwork fetching |
| `getFingerprintProviders()` | `FingerprintProvider[]` | Audio fingerprinting (AcoustID) |
| `getFingerprintProvider()` | `FingerprintProvider \| null` | Primary fingerprint provider |
| `getISRCResolvers()` | `ISRCResolver[]` | ISRC code lookup |
| `getAnalyticsProviders()` | `AnalyticsProvider[]` | Play statistics, trends |
| `getSmartPlaylistRulesProviders()` | `SmartPlaylistRulesProvider[]` | Custom smart playlist rules |
| `getDuplicateDetectors()` | `DuplicateDetector[]` | Find duplicate tracks |
| `getDuplicateDetector()` | `DuplicateDetector \| null` | Primary duplicate detector |

**Import/Export:**

| Method | Returns | Used For |
|--------|---------|----------|
| `getImportProviders()` | `ImportProvider[]` | Import from external services |
| `getImportProvidersByType(type)` | `ImportProvider[]` | Filter by source type |
| `getImportProvider(id)` | `ImportProvider \| null` | Specific import provider |
| `getExportProviders()` | `ExportProvider[]` | Export library data |
| `getExportProvider(id)` | `ExportProvider \| null` | Specific export provider |
| `getAvailableExportFormats()` | `Array<{providerId, format, extension}>` | List all export formats |

**Library Hooks:**

| Method | Returns | Used For |
|--------|---------|----------|
| `getLibraryHooks()` | `LibraryHook[]` | All registered library hooks |
| `getLibraryHooksForEvent(eventType)` | `LibraryHook[]` | Hooks for specific event |

**Info & Display:**

| Method | Returns | Used For |
|--------|---------|----------|
| `getAllAddonIds()` | `string[]` | List all registered addon IDs |
| `getAddonInfo(addonId)` | `AddonInfo \| null` | Get addon details for UI |
| `getAllAddonInfo()` | `AddonInfo[]` | Get all addon details for UI |
| `getByRole<T>(role)` | `T[]` | Generic role-based lookup |

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    AddonRegistry                         │
├─────────────────────────────────────────────────────────┤
│  addons: Map<id, RegisteredAddon>                       │
│    └─ { addon, enabled, userPriority? }                 │
│                                                          │
│  roleIndex: Map<AddonRole, Set<id>>                     │
│    └─ Fast lookup by role                               │
├─────────────────────────────────────────────────────────┤
│  register() ──► Index by roles ──► Available via get*() │
│                                                          │
│  Priority Chain:                                         │
│    1. userPriority (if set)                             │
│    2. addon.priority (default)                          │
│    3. 50 (fallback)                                     │
└─────────────────────────────────────────────────────────┘
```

### Example Usage

```typescript
import { AddonRegistry } from '@audiio/core';

// Create registry instance
const registry = new AddonRegistry();

// Register a plugin
registry.register(myStreamProvider);

// Get all stream providers (sorted by priority)
const streamProviders = registry.getStreamProviders();

// Try providers in order until one succeeds
for (const provider of streamProviders) {
  const stream = await provider.getStream(track);
  if (stream) return stream;
}

// User reorders providers in settings
registry.setAddonOrder(['youtube-music', 'soundcloud', 'local']);

// Disable a provider temporarily
registry.setEnabled('soundcloud', false);

// Get addon info for UI display
const allAddons = registry.getAllAddonInfo();
```

### Role Types

The registry indexes addons by these roles (defined in `types/addon.ts`):

| Role | Description |
|------|-------------|
| `metadata-provider` | Track/album/artist metadata |
| `stream-provider` | Audio stream URLs |
| `lyrics-provider` | Synced or plain lyrics |
| `scrobbler` | Play tracking services |
| `tool` | Custom tools/utilities |
| `artist-enrichment` | Videos, concerts, images |
| `metadata-enricher` | Auto-tagging |
| `artwork-provider` | Album/artist artwork |
| `fingerprint-provider` | Audio fingerprinting |
| `isrc-resolver` | ISRC code lookup |
| `analytics-provider` | Play statistics |
| `smart-playlist-rules` | Custom playlist rules |
| `duplicate-detector` | Find duplicates |
| `import-provider` | External service import |
| `export-provider` | Library export |
| `library-hook` | Library event hooks |
