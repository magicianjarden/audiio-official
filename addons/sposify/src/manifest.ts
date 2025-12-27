/**
 * Sposify Plugin Manifest
 * Defines plugin capabilities, settings, and metadata
 */

export interface SposifyManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  category: 'metadata' | 'import' | 'analysis';
  icon: string;
  capabilities: SposifyCapabilities;
  settings: SposifySetting[];
  privacyAccess: PrivacyAccess[];
}

export interface SposifyCapabilities {
  spotifyImport: boolean;
  audioFeatures: boolean;
  isrcMatching: boolean;
  playlistDiscovery: boolean;
  metadataEnrichment: boolean;
}

export interface SposifySetting {
  key: string;
  label: string;
  description: string;
  type: 'boolean' | 'string' | 'number' | 'select';
  default: boolean | string | number;
  options?: { value: string; label: string }[];
  category: string;
}

export interface PrivacyAccess {
  type: string;
  description: string;
  required: boolean;
}

export const SPOSIFY_MANIFEST: SposifyManifest = {
  id: 'sposify',
  name: 'Sposify',
  version: '1.0.0',
  author: 'Audiio',
  description: 'Import your Spotify data, enrich tracks with audio features, match local files by ISRC, and discover millions of curated playlists.',
  category: 'import',
  icon: 'spotify', // Uses existing Spotify icon

  capabilities: {
    spotifyImport: true,
    audioFeatures: true,
    isrcMatching: true,
    playlistDiscovery: true,
    metadataEnrichment: true,
  },

  settings: [
    // Import Settings
    {
      key: 'autoMatchOnImport',
      label: 'Auto-match tracks on import',
      description: 'Automatically match imported tracks to the Sposify database for audio features',
      type: 'boolean',
      default: true,
      category: 'Import',
    },
    {
      key: 'importHistoryAsListens',
      label: 'Import history as listen events',
      description: 'Add streaming history to your recommendation profile',
      type: 'boolean',
      default: true,
      category: 'Import',
    },
    {
      key: 'playlistPrefix',
      label: 'Imported playlist prefix',
      description: 'Prefix added to imported playlist names (leave empty for none)',
      type: 'string',
      default: '[Spotify] ',
      category: 'Import',
    },

    // Matching Settings
    {
      key: 'minMatchConfidence',
      label: 'Minimum match confidence',
      description: 'Only accept matches above this confidence level (0-100%)',
      type: 'number',
      default: 70,
      category: 'Matching',
    },
    {
      key: 'enableFuzzyMatching',
      label: 'Enable fuzzy matching',
      description: 'Use fuzzy string matching for tracks without exact matches',
      type: 'boolean',
      default: true,
      category: 'Matching',
    },
    {
      key: 'autoEnrichLocalFiles',
      label: 'Auto-enrich local files',
      description: 'Automatically add audio features to matched local files',
      type: 'boolean',
      default: false,
      category: 'Matching',
    },

    // Audio Features Settings
    {
      key: 'cacheAudioFeatures',
      label: 'Cache audio features',
      description: 'Cache retrieved audio features for faster access',
      type: 'boolean',
      default: true,
      category: 'Performance',
    },
    {
      key: 'maxCacheSize',
      label: 'Max cache size (MB)',
      description: 'Maximum memory for audio features cache',
      type: 'number',
      default: 50,
      category: 'Performance',
    },

    // Playlist Discovery Settings
    {
      key: 'playlistResultLimit',
      label: 'Playlist search results',
      description: 'Number of playlists to show per search',
      type: 'number',
      default: 50,
      category: 'Discovery',
    },
    {
      key: 'minPlaylistFollowers',
      label: 'Minimum playlist followers',
      description: 'Only show playlists with at least this many followers',
      type: 'number',
      default: 100,
      category: 'Discovery',
    },
  ],

  privacyAccess: [
    {
      type: 'library',
      description: 'Access your music library to match and enrich tracks',
      required: true,
    },
    {
      type: 'history',
      description: 'Access listening history to import Spotify streaming data',
      required: false,
    },
    {
      type: 'filesystem',
      description: 'Read Spotify export files from your computer',
      required: true,
    },
  ],
};

export default SPOSIFY_MANIFEST;
