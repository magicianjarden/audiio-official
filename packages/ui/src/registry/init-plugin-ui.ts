/**
 * Plugin UI Initialization
 *
 * Registers all available plugin UIs with the central registry.
 * This is called once during app initialization.
 */

import { PluginUIRegistry } from './plugin-ui-registry';

// Import plugin UI registrations
// Each plugin exports its UI config which we register here
import { sposifyUI } from '@audiio/sposify/ui';

/**
 * Initialize all plugin UIs
 * Called once during app startup
 */
export function initializePluginUIs(): void {
  console.log('[PluginUI] Initializing plugin UIs...');

  // Register Sposify UI
  try {
    PluginUIRegistry.register({
      pluginId: sposifyUI.pluginId,
      navItems: [sposifyUI.navItem],
      views: [sposifyUI.view],
    });
  } catch (error) {
    console.warn('[PluginUI] Failed to register Sposify UI:', error);
  }

  console.log('[PluginUI] Plugin UIs initialized');
}

/**
 * Cleanup plugin UIs
 * Called during app shutdown
 */
export function cleanupPluginUIs(): void {
  PluginUIRegistry.unregister('sposify');
  console.log('[PluginUI] Plugin UIs cleaned up');
}
