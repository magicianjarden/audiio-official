/**
 * Plugins & Addons API type definitions
 */

import type { SuccessResponse, Timestamp } from './common.types';

/** Addon/Plugin role */
export type AddonRole =
  | 'metadata-provider'
  | 'stream-provider'
  | 'lyrics-provider'
  | 'scrobbler'
  | 'audio-processor'
  | 'enrichment-provider'
  | 'discovery-provider'
  | 'import-provider'
  | 'export-provider';

/** Addon status */
export type AddonStatus = 'enabled' | 'disabled' | 'error' | 'updating';

/** Addon entity */
export interface Addon {
  id: string;
  name: string;
  description?: string;
  version: string;
  author?: string;
  homepage?: string;
  roles: AddonRole[];
  status: AddonStatus;
  enabled: boolean;
  priority?: number;
  settings?: Record<string, unknown>;
  settingsSchema?: SettingsSchema;
  error?: string;
  installedAt: Timestamp;
  updatedAt: Timestamp;
}

/** Settings schema for addon configuration */
export interface SettingsSchema {
  type: 'object';
  properties: Record<string, SettingProperty>;
  required?: string[];
}

/** Setting property definition */
export interface SettingProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  enumLabels?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: 'password' | 'email' | 'url' | 'uri';
  items?: SettingProperty;
}

/** Plugin repository */
export interface PluginRepository {
  id: string;
  url: string;
  name?: string;
  description?: string;
  enabled: boolean;
  pluginCount: number;
  lastRefreshedAt?: Timestamp;
  addedAt: Timestamp;
}

/** Available plugin (from repository) */
export interface AvailablePlugin {
  id: string;
  name: string;
  description?: string;
  version: string;
  author?: string;
  homepage?: string;
  downloadUrl: string;
  roles: AddonRole[];
  repository: string;
  installed: boolean;
  installedVersion?: string;
  hasUpdate: boolean;
  downloads?: number;
  rating?: number;
}

/** Plugin update */
export interface PluginUpdate {
  pluginId: string;
  currentVersion: string;
  newVersion: string;
  changelog?: string;
  downloadUrl: string;
}

/** Plugin route (custom API endpoint) */
export interface PluginRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  pluginId: string;
  description?: string;
}

/** Plugin install source type */
export type PluginInstallType = 'npm' | 'git' | 'local' | 'url';

// Response types
export interface AddonsGetAllResponse {
  addons: Addon[];
}

export interface AddonSettingsResponse {
  settings: Record<string, unknown>;
  schema?: SettingsSchema;
}

export interface AddonSetEnabledResponse extends SuccessResponse {
  addonId: string;
  enabled: boolean;
}

export interface PluginRepositoriesResponse {
  repositories: PluginRepository[];
}

export interface PluginRepositoryAddResponse extends SuccessResponse {
  repository?: PluginRepository;
}

export interface AvailablePluginsResponse {
  plugins: AvailablePlugin[];
}

export interface PluginSearchResponse {
  plugins: AvailablePlugin[];
}

export interface PluginInstallResponse extends SuccessResponse {
  plugin?: Addon;
}

export interface PluginUpdatesResponse {
  updates: PluginUpdate[];
}

export interface PluginRoutesResponse {
  routes: PluginRoute[];
}

// Scrobble types
export interface ScrobbleData {
  title: string;
  artist: string;
  album?: string;
  duration: number;
  timestamp: Timestamp;
  playedMs: number;
}

export interface NowPlayingData {
  title: string;
  artist: string;
  album?: string;
  duration: number;
}

export interface ScrobbleResponse extends SuccessResponse {
  scrobbled?: boolean;
}
