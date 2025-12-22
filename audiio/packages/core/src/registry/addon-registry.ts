/**
 * Registry for managing addon providers
 */

import type {
  BaseAddon,
  AddonRole,
  MetadataProvider,
  StreamProvider,
  LyricsProvider,
  Scrobbler
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
}
