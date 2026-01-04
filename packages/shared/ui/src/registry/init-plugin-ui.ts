/**
 * Plugin UI Initialization
 *
 * Plugin UIs are now registered dynamically when plugins are loaded.
 * This file provides initialization hooks but no longer contains
 * hardcoded plugin imports.
 *
 * How plugin UIs work:
 * 1. Main process loads plugins via PluginLoader
 * 2. Plugins with UI components send registration via IPC
 * 3. PluginUIRegistry.register() is called with the UI config
 * 4. Sidebar and views update automatically via usePluginUIRegistry()
 */

import { PluginUIRegistry } from './plugin-ui-registry';

/**
 * Initialize plugin UIs
 * Called once during app startup to set up IPC listeners
 */
export function initializePluginUIs(): void {
  console.log('[PluginUI] Initializing plugin UI system...');

  // Set up IPC listener for plugin UI registration from main process
  if (typeof window !== 'undefined' && window.api?.plugins) {
    // Listen for plugin UI registrations from main process
    window.api.plugins.onPluginUIRegistered?.((registration: {
      pluginId: string;
      navItems?: Array<{
        pluginId: string;
        label: string;
        viewId: string;
        section?: 'library' | 'tools' | 'settings';
        order?: number;
      }>;
      views?: Array<{
        viewId: string;
        pluginId: string;
        title?: string;
      }>;
    }) => {
      console.log(`[PluginUI] Received registration for: ${registration.pluginId}`);
      // Note: Components need to be loaded separately - this is metadata only
      // Full dynamic component loading requires bundler support or lazy loading
    });
  }

  console.log('[PluginUI] Plugin UI system initialized');
}

/**
 * Cleanup plugin UIs
 * Called during app shutdown
 */
export function cleanupPluginUIs(): void {
  // Clear all registrations
  const allViews = PluginUIRegistry.getAllViews();
  for (const view of allViews) {
    PluginUIRegistry.unregister(view.pluginId);
  }
  console.log('[PluginUI] Plugin UIs cleaned up');
}
