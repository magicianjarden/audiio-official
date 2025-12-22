/**
 * Addon registration utilities
 */

import type { AddonManifest, BaseAddon } from '@audiio/core';

export interface AddonDefinition<T extends BaseAddon = BaseAddon> {
  manifest: AddonManifest;
  create(): T;
}

/**
 * Define an addon with validation
 */
export function defineAddon<T extends BaseAddon>(
  definition: AddonDefinition<T>
): AddonDefinition<T> {
  validateManifest(definition.manifest);
  return definition;
}

/**
 * Validate addon manifest
 */
function validateManifest(manifest: AddonManifest): void {
  if (!manifest.id) {
    throw new Error('Addon manifest must have an id');
  }

  if (!/^[a-z0-9-]+$/.test(manifest.id)) {
    throw new Error('Addon ID must be lowercase alphanumeric with dashes only');
  }

  if (!manifest.name) {
    throw new Error('Addon manifest must have a name');
  }

  if (!manifest.version) {
    throw new Error('Addon manifest must have a version');
  }

  if (!manifest.roles || manifest.roles.length === 0) {
    throw new Error('Addon manifest must specify at least one role');
  }
}
