# ML Module

Client-side plugin audio feature system. Allows plugins to register as providers of audio analysis data (BPM, key, energy, etc.) for the recommendation system.

> **Note:** ML training and scoring happen server-side via `ml-store.ts`. This module only handles plugin-provided audio features on the client.

---

## Files

### `plugin-audio-provider.ts`

Registry system for plugins that provide audio features.

**Exports:**

| Export | Type | Description |
|--------|------|-------------|
| `PluginFeatureProvider` | interface | Contract for audio feature providers |
| `createPluginFeatureProvider` | function | Factory to create a provider from handlers |
| `registerPluginAudioProvider` | function | Register a plugin as a feature provider |
| `unregisterPluginAudioProvider` | function | Remove a plugin's provider |
| `normalizeBpm` | function | Convert BPM (60-200) to 0-1 range |
| `keyNumberToString` | function | Convert numeric key (0-11) + mode to string (e.g., "C", "Am") |
| `estimateEnergyFromFeatures` | function | Calculate energy score from partial features |
| `initializeAudioProviders` | function | Lifecycle: called on app start |
| `cleanupAudioProviders` | function | Lifecycle: called on app close |

**Used by:**
- `hooks/usePluginAudioFeatures.ts` - Registers providers when plugins are enabled/disabled

**Provider Priority:**
| Type | Priority | Notes |
|------|----------|-------|
| Metadata providers | 100 | Highest - external API data |
| Scrobblers | 75 | Similarity data only |
| Local analysis | 25-50 | FFmpeg-based fallback |

---

### `index.ts`

Barrel file that re-exports from `plugin-audio-provider.ts` and `AudioFeatures` type from `@audiio/core`.

**Used by:**
- `hooks/usePluginAudioFeatures.ts`

---

## Data Flow

```
Plugin enabled
    │
    ▼
usePluginAudioFeatures (App.tsx)
    │
    ▼
createPluginFeatureProvider()
    │
    ▼
registerPluginAudioProvider()
    │
    ▼
featureProviders[] (sorted by priority)
    │
    ▼
window.api.getAudioFeatures() ──► Server
```

---

## AudioFeatures Type

Defined in `@audiio/core` (`packages/shared/core/src/types/audio-features.ts`):

```typescript
interface AudioFeatures {
  bpm?: number;           // 60-200
  key?: string;           // "C", "Am", etc.
  mode?: 'major' | 'minor';
  energy?: number;        // 0-1
  danceability?: number;  // 0-1
  acousticness?: number;  // 0-1
  instrumentalness?: number; // 0-1
  valence?: number;       // 0-1 (mood)
  loudness?: number;      // dB (-60 to 0)
  speechiness?: number;   // 0-1
}
```

---

## Usage Example

```typescript
import {
  createPluginFeatureProvider,
  registerPluginAudioProvider
} from '../ml';

const provider = createPluginFeatureProvider('my-plugin', 80, {
  async getAudioFeatures(trackId) {
    const data = await myApi.getFeatures(trackId);
    return {
      bpm: data.tempo,
      energy: data.energy,
      key: data.key
    };
  },
  async getSimilarTracks(trackId, limit) {
    return myApi.getSimilar(trackId, limit);
  }
});

registerPluginAudioProvider(provider);
```
