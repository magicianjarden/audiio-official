/**
 * Registry for managing addon providers
 */

import type {
  BaseAddon,
  AddonRole,
  MetadataProvider,
  StreamProvider,
  LyricsProvider,
  Scrobbler,
  Tool,
  ArtistEnrichmentProvider,
  ArtistEnrichmentType,
  SearchProvider,
  SearchResultType,
  // Library management providers
  MetadataEnricher,
  ArtworkProvider,
  FingerprintProvider,
  ISRCResolver,
  AnalyticsProvider,
  SmartPlaylistRulesProvider,
  DuplicateDetector,
  ImportProvider,
  ExportProvider,
  LibraryHook
} from '../types/addon';

interface RegisteredAddon {
  addon: BaseAddon;
  enabled: boolean;
  /** User-defined priority (overrides addon's default priority) */
  userPriority?: number;
}

export class AddonRegistry {
  private addons = new Map<string, RegisteredAddon>();
  private roleIndex = new Map<AddonRole, Set<string>>();

  /**
   * Register an addon
   */
  register(addon: BaseAddon): void {
    const { id, roles } = addon.manifest;

    console.log(`[Registry] Registering addon: ${id} with roles:`, roles);

    if (this.addons.has(id)) {
      throw new Error(`Addon "${id}" is already registered`);
    }

    this.addons.set(id, { addon, enabled: true });

    // Index by role
    for (const role of roles) {
      if (!this.roleIndex.has(role)) {
        this.roleIndex.set(role, new Set());
      }
      this.roleIndex.get(role)!.add(id);
      console.log(`[Registry] Indexed ${id} under role: ${role}`);
    }
  }

  /**
   * Unregister an addon
   */
  unregister(addonId: string): void {
    const registered = this.addons.get(addonId);
    if (!registered) return;

    // Remove from role index
    for (const role of registered.addon.manifest.roles) {
      this.roleIndex.get(role)?.delete(addonId);
    }

    this.addons.delete(addonId);
  }

  /**
   * Enable/disable an addon
   */
  setEnabled(addonId: string, enabled: boolean): void {
    const registered = this.addons.get(addonId);
    if (registered) {
      registered.enabled = enabled;
    }
  }

  /**
   * Set user-defined priority for an addon
   * Higher values = higher priority (tried first)
   */
  setAddonPriority(addonId: string, priority: number): void {
    const registered = this.addons.get(addonId);
    if (registered) {
      registered.userPriority = priority;
    }
  }

  /**
   * Set priorities for multiple addons based on their order
   * First item gets highest priority, last gets lowest
   */
  setAddonOrder(orderedIds: string[]): void {
    const baseValue = 1000;
    orderedIds.forEach((id, index) => {
      const registered = this.addons.get(id);
      if (registered) {
        // Higher index = lower priority
        registered.userPriority = baseValue - index;
      }
    });
  }

  /**
   * Get current addon priorities
   */
  getAddonPriorities(): Map<string, number> {
    const priorities = new Map<string, number>();
    for (const [id, registered] of this.addons) {
      if (registered.userPriority !== undefined) {
        priorities.set(id, registered.userPriority);
      }
    }
    return priorities;
  }

  /**
   * Get effective priority for an addon (user priority or default)
   */
  private getEffectivePriority(registered: RegisteredAddon): number {
    if (registered.userPriority !== undefined) {
      return registered.userPriority;
    }
    // Fall back to addon's default priority if it's a metadata provider
    const addon = registered.addon as MetadataProvider;
    return addon.priority ?? 50;
  }

  /**
   * Get addon by ID
   */
  get<T extends BaseAddon>(addonId: string): T | null {
    const registered = this.addons.get(addonId);
    if (!registered || !registered.enabled) return null;
    return registered.addon as T;
  }

  /**
   * Get all addons with a specific role
   */
  getByRole<T extends BaseAddon>(role: AddonRole): T[] {
    const ids = this.roleIndex.get(role) || new Set();
    return Array.from(ids)
      .map(id => this.addons.get(id))
      .filter((r): r is RegisteredAddon => r !== undefined && r.enabled)
      .map(r => r.addon as T);
  }

  /**
   * Get all metadata providers sorted by priority (user priority > default)
   */
  getMetadataProviders(): MetadataProvider[] {
    const ids = this.roleIndex.get('metadata-provider') || new Set();
    return Array.from(ids)
      .map(id => this.addons.get(id))
      .filter((r): r is RegisteredAddon => r !== undefined && r.enabled)
      .sort((a, b) => this.getEffectivePriority(b) - this.getEffectivePriority(a))
      .map(r => r.addon as MetadataProvider);
  }

  /**
   * Get primary metadata provider (highest priority)
   */
  getPrimaryMetadataProvider(): MetadataProvider | null {
    const providers = this.getMetadataProviders();
    return providers[0] ?? null;
  }

  /**
   * Get all stream providers sorted by priority
   */
  getStreamProviders(): StreamProvider[] {
    const ids = this.roleIndex.get('stream-provider') || new Set();
    return Array.from(ids)
      .map(id => this.addons.get(id))
      .filter((r): r is RegisteredAddon => r !== undefined && r.enabled)
      .sort((a, b) => this.getEffectivePriority(b) - this.getEffectivePriority(a))
      .map(r => r.addon as StreamProvider);
  }

  /**
   * Get stream provider by ID
   */
  getStreamProvider(id: string): StreamProvider | null {
    const provider = this.get<StreamProvider>(id);
    if (provider && provider.manifest.roles.includes('stream-provider')) {
      return provider;
    }
    return null;
  }

  /**
   * Get all lyrics providers sorted by priority
   */
  getLyricsProviders(): LyricsProvider[] {
    const ids = this.roleIndex.get('lyrics-provider') || new Set();
    return Array.from(ids)
      .map(id => this.addons.get(id))
      .filter((r): r is RegisteredAddon => r !== undefined && r.enabled)
      .sort((a, b) => this.getEffectivePriority(b) - this.getEffectivePriority(a))
      .map(r => r.addon as LyricsProvider);
  }

  /**
   * Get all scrobblers sorted by priority
   */
  getScrobblers(): Scrobbler[] {
    const ids = this.roleIndex.get('scrobbler') || new Set();
    return Array.from(ids)
      .map(id => this.addons.get(id))
      .filter((r): r is RegisteredAddon => r !== undefined && r.enabled)
      .sort((a, b) => this.getEffectivePriority(b) - this.getEffectivePriority(a))
      .map(r => r.addon as Scrobbler);
  }

  /**
   * Get all tools sorted by priority
   */
  getTools(): Tool[] {
    const ids = this.roleIndex.get('tool') || new Set();
    return Array.from(ids)
      .map(id => this.addons.get(id))
      .filter((r): r is RegisteredAddon => r !== undefined && r.enabled)
      .sort((a, b) => this.getEffectivePriority(b) - this.getEffectivePriority(a))
      .map(r => r.addon as Tool);
  }

  /**
   * Get tool by ID
   */
  getTool(id: string): Tool | null {
    const tool = this.get<Tool>(id);
    if (tool && tool.manifest.roles.includes('tool')) {
      return tool;
    }
    return null;
  }

  /**
   * Get all artist enrichment providers
   */
  getArtistEnrichmentProviders(): ArtistEnrichmentProvider[] {
    const ids = this.roleIndex.get('artist-enrichment') || new Set();
    return Array.from(ids)
      .map(id => this.addons.get(id))
      .filter((r): r is RegisteredAddon => r !== undefined && r.enabled)
      .map(r => r.addon as ArtistEnrichmentProvider);
  }

  /**
   * Get artist enrichment providers by enrichment type
   */
  getArtistEnrichmentProvidersByType(type: ArtistEnrichmentType): ArtistEnrichmentProvider[] {
    return this.getArtistEnrichmentProviders().filter(p => p.enrichmentType === type);
  }

  /**
   * Get artist enrichment provider by ID
   */
  getArtistEnrichmentProvider(id: string): ArtistEnrichmentProvider | null {
    const provider = this.get<ArtistEnrichmentProvider>(id);
    if (provider && provider.manifest.roles.includes('artist-enrichment')) {
      return provider;
    }
    return null;
  }

  /**
   * Get available enrichment types from registered providers
   */
  getAvailableEnrichmentTypes(): ArtistEnrichmentType[] {
    // Debug: log what's in the roleIndex
    const artistEnrichmentIds = this.roleIndex.get('artist-enrichment');
    console.log('[Registry] artist-enrichment roleIndex:', artistEnrichmentIds ? Array.from(artistEnrichmentIds) : 'none');

    const providers = this.getArtistEnrichmentProviders();
    console.log('[Registry] getArtistEnrichmentProviders returned:', providers.length, 'providers');

    const types = new Set<ArtistEnrichmentType>();
    for (const provider of providers) {
      console.log('[Registry] Provider:', provider.id, 'enrichmentType:', provider.enrichmentType);
      types.add(provider.enrichmentType);
    }
    return Array.from(types);
  }

  /**
   * Get all registered addon IDs
   */
  getAllAddonIds(): string[] {
    return Array.from(this.addons.keys());
  }

  /**
   * Check if an addon is registered
   */
  has(addonId: string): boolean {
    return this.addons.has(addonId);
  }

  /**
   * Check if an addon is enabled
   */
  isEnabled(addonId: string): boolean {
    return this.addons.get(addonId)?.enabled ?? false;
  }

  /**
   * Get addon info regardless of enabled state (for UI display)
   */
  getAddonInfo(addonId: string): {
    id: string;
    name: string;
    description?: string;
    version?: string;
    roles: AddonRole[];
    enabled: boolean;
    priority?: number;
  } | null {
    const registered = this.addons.get(addonId);
    if (!registered) return null;

    const { manifest } = registered.addon;
    return {
      id: manifest.id,
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      roles: manifest.roles,
      enabled: registered.enabled,
      priority: registered.userPriority ?? (registered.addon as MetadataProvider).priority,
    };
  }

  /**
   * Get all addon info (for UI display)
   */
  getAllAddonInfo(): Array<{
    id: string;
    name: string;
    description?: string;
    version?: string;
    roles: AddonRole[];
    enabled: boolean;
    priority?: number;
  }> {
    return Array.from(this.addons.entries()).map(([_id, registered]) => {
      const { manifest } = registered.addon;
      return {
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        version: manifest.version,
        roles: manifest.roles,
        enabled: registered.enabled,
        priority: registered.userPriority ?? (registered.addon as MetadataProvider).priority,
      };
    });
  }

  // ============================================
  // Library Management Provider Getters
  // ============================================

  /**
   * Get all metadata enrichers sorted by priority
   */
  getMetadataEnrichers(): MetadataEnricher[] {
    const ids = this.roleIndex.get('metadata-enricher') || new Set();
    return Array.from(ids)
      .map(id => this.addons.get(id))
      .filter((r): r is RegisteredAddon => r !== undefined && r.enabled)
      .sort((a, b) => this.getEffectivePriority(b) - this.getEffectivePriority(a))
      .map(r => r.addon as MetadataEnricher);
  }

  /**
   * Get all artwork providers sorted by priority
   */
  getArtworkProviders(): ArtworkProvider[] {
    const ids = this.roleIndex.get('artwork-provider') || new Set();
    return Array.from(ids)
      .map(id => this.addons.get(id))
      .filter((r): r is RegisteredAddon => r !== undefined && r.enabled)
      .sort((a, b) => this.getEffectivePriority(b) - this.getEffectivePriority(a))
      .map(r => r.addon as ArtworkProvider);
  }

  /**
   * Get all fingerprint providers
   */
  getFingerprintProviders(): FingerprintProvider[] {
    const ids = this.roleIndex.get('fingerprint-provider') || new Set();
    return Array.from(ids)
      .map(id => this.addons.get(id))
      .filter((r): r is RegisteredAddon => r !== undefined && r.enabled)
      .map(r => r.addon as FingerprintProvider);
  }

  /**
   * Get primary fingerprint provider (first available)
   */
  getFingerprintProvider(): FingerprintProvider | null {
    const providers = this.getFingerprintProviders();
    return providers[0] ?? null;
  }

  /**
   * Get all ISRC resolvers sorted by priority
   */
  getISRCResolvers(): ISRCResolver[] {
    const ids = this.roleIndex.get('isrc-resolver') || new Set();
    return Array.from(ids)
      .map(id => this.addons.get(id))
      .filter((r): r is RegisteredAddon => r !== undefined && r.enabled)
      .sort((a, b) => this.getEffectivePriority(b) - this.getEffectivePriority(a))
      .map(r => r.addon as ISRCResolver);
  }

  /**
   * Get all analytics providers
   */
  getAnalyticsProviders(): AnalyticsProvider[] {
    const ids = this.roleIndex.get('analytics-provider') || new Set();
    return Array.from(ids)
      .map(id => this.addons.get(id))
      .filter((r): r is RegisteredAddon => r !== undefined && r.enabled)
      .map(r => r.addon as AnalyticsProvider);
  }

  /**
   * Get all smart playlist rule providers
   */
  getSmartPlaylistRulesProviders(): SmartPlaylistRulesProvider[] {
    const ids = this.roleIndex.get('smart-playlist-rules') || new Set();
    return Array.from(ids)
      .map(id => this.addons.get(id))
      .filter((r): r is RegisteredAddon => r !== undefined && r.enabled)
      .map(r => r.addon as SmartPlaylistRulesProvider);
  }

  /**
   * Get all duplicate detectors
   */
  getDuplicateDetectors(): DuplicateDetector[] {
    const ids = this.roleIndex.get('duplicate-detector') || new Set();
    return Array.from(ids)
      .map(id => this.addons.get(id))
      .filter((r): r is RegisteredAddon => r !== undefined && r.enabled)
      .map(r => r.addon as DuplicateDetector);
  }

  /**
   * Get primary duplicate detector
   */
  getDuplicateDetector(): DuplicateDetector | null {
    const detectors = this.getDuplicateDetectors();
    return detectors[0] ?? null;
  }

  /**
   * Get all import providers
   */
  getImportProviders(): ImportProvider[] {
    const ids = this.roleIndex.get('import-provider') || new Set();
    return Array.from(ids)
      .map(id => this.addons.get(id))
      .filter((r): r is RegisteredAddon => r !== undefined && r.enabled)
      .map(r => r.addon as ImportProvider);
  }

  /**
   * Get import providers by source type
   */
  getImportProvidersByType(type: 'file' | 'url' | 'service'): ImportProvider[] {
    return this.getImportProviders().filter(p => p.source.type === type);
  }

  /**
   * Get import provider by ID
   */
  getImportProvider(id: string): ImportProvider | null {
    const provider = this.get<ImportProvider>(id);
    if (provider && provider.manifest.roles.includes('import-provider')) {
      return provider;
    }
    return null;
  }

  /**
   * Get all export providers
   */
  getExportProviders(): ExportProvider[] {
    const ids = this.roleIndex.get('export-provider') || new Set();
    return Array.from(ids)
      .map(id => this.addons.get(id))
      .filter((r): r is RegisteredAddon => r !== undefined && r.enabled)
      .map(r => r.addon as ExportProvider);
  }

  /**
   * Get export provider by ID
   */
  getExportProvider(id: string): ExportProvider | null {
    const provider = this.get<ExportProvider>(id);
    if (provider && provider.manifest.roles.includes('export-provider')) {
      return provider;
    }
    return null;
  }

  /**
   * Get all available export formats from all providers
   */
  getAvailableExportFormats(): Array<{ providerId: string; format: string; extension: string }> {
    const formats: Array<{ providerId: string; format: string; extension: string }> = [];
    for (const provider of this.getExportProviders()) {
      for (const format of provider.formats) {
        formats.push({
          providerId: provider.id,
          format: format.id,
          extension: format.extension
        });
      }
    }
    return formats;
  }

  /**
   * Get all library hooks
   */
  getLibraryHooks(): LibraryHook[] {
    const ids = this.roleIndex.get('library-hook') || new Set();
    return Array.from(ids)
      .map(id => this.addons.get(id))
      .filter((r): r is RegisteredAddon => r !== undefined && r.enabled)
      .map(r => r.addon as LibraryHook);
  }

  /**
   * Get library hooks subscribed to a specific event
   */
  getLibraryHooksForEvent(eventType: string): LibraryHook[] {
    return this.getLibraryHooks().filter(h =>
      h.subscribedEvents.includes(eventType as any)
    );
  }

  // ============================================
  // Search Provider Getters
  // ============================================

  /**
   * Get all search providers
   */
  getSearchProviders(): SearchProvider[] {
    const ids = this.roleIndex.get('search-provider') || new Set();
    return Array.from(ids)
      .map(id => this.addons.get(id))
      .filter((r): r is RegisteredAddon => r !== undefined && r.enabled)
      .map(r => r.addon as SearchProvider);
  }

  /**
   * Get search providers that support a specific result type
   */
  getSearchProvidersByType(type: SearchResultType): SearchProvider[] {
    return this.getSearchProviders().filter(p =>
      p.supportedSearchTypes.includes(type)
    );
  }

  /**
   * Get search provider by ID
   */
  getSearchProvider(id: string): SearchProvider | null {
    const provider = this.get<SearchProvider>(id);
    if (provider && provider.manifest.roles.includes('search-provider')) {
      return provider;
    }
    return null;
  }

  /**
   * Get all available search result types from registered providers
   */
  getAvailableSearchTypes(): SearchResultType[] {
    const providers = this.getSearchProviders();
    const types = new Set<SearchResultType>();
    for (const provider of providers) {
      for (const type of provider.supportedSearchTypes) {
        types.add(type);
      }
    }
    return Array.from(types);
  }
}
