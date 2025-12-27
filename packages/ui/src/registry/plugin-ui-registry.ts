/**
 * Plugin UI Registry
 *
 * Central registry for plugin UI components. Plugins register their views,
 * sidebar items, and other UI extensions here. The core app dynamically
 * renders registered plugin UIs without hardcoding plugin-specific components.
 */

import React from 'react';

/**
 * Sidebar navigation item registered by a plugin
 */
export interface PluginNavItem {
  /** Unique ID matching the plugin ID */
  pluginId: string;
  /** Display label in sidebar */
  label: string;
  /** Icon component to render */
  icon: React.ComponentType<{ size?: number }>;
  /** View ID to navigate to (will be prefixed with 'plugin-view-') */
  viewId: string;
  /** Section in sidebar: 'library', 'tools', 'settings' */
  section?: 'library' | 'tools' | 'settings';
  /** Sort order within section */
  order?: number;
}

/**
 * Full-page view registered by a plugin
 */
export interface PluginView {
  /** Unique view ID (used in navigation as 'plugin-view-{viewId}') */
  viewId: string;
  /** Plugin ID that owns this view */
  pluginId: string;
  /** React component to render */
  component: React.ComponentType;
  /** Optional title for the view */
  title?: string;
}

/**
 * Settings panel extension for plugin detail view
 */
export interface PluginSettingsPanel {
  /** Plugin ID */
  pluginId: string;
  /** React component to render in plugin detail */
  component: React.ComponentType<{ pluginId: string }>;
  /** Order in settings list */
  order?: number;
}

/**
 * Modal/dialog registered by a plugin
 */
export interface PluginModal {
  /** Unique modal ID */
  modalId: string;
  /** Plugin ID that owns this modal */
  pluginId: string;
  /** React component to render */
  component: React.ComponentType<{ onClose: () => void; data?: unknown }>;
}

/**
 * Complete plugin UI registration
 */
export interface PluginUIRegistration {
  pluginId: string;
  navItems?: PluginNavItem[];
  views?: PluginView[];
  settingsPanels?: PluginSettingsPanel[];
  modals?: PluginModal[];
}

/**
 * Plugin UI Registry singleton
 */
class PluginUIRegistryClass {
  private navItems: Map<string, PluginNavItem> = new Map();
  private views: Map<string, PluginView> = new Map();
  private settingsPanels: Map<string, PluginSettingsPanel> = new Map();
  private modals: Map<string, PluginModal> = new Map();
  private listeners: Set<() => void> = new Set();

  /**
   * Register a plugin's UI components
   */
  register(registration: PluginUIRegistration): void {
    const { pluginId, navItems, views, settingsPanels, modals } = registration;

    // Register nav items
    navItems?.forEach(item => {
      this.navItems.set(`${pluginId}:${item.viewId}`, { ...item, pluginId });
    });

    // Register views
    views?.forEach(view => {
      this.views.set(view.viewId, { ...view, pluginId });
    });

    // Register settings panels
    settingsPanels?.forEach(panel => {
      this.settingsPanels.set(pluginId, { ...panel, pluginId });
    });

    // Register modals
    modals?.forEach(modal => {
      this.modals.set(modal.modalId, { ...modal, pluginId });
    });

    console.log(`[PluginUIRegistry] Registered UI for plugin: ${pluginId}`);
    this.notifyListeners();
  }

  /**
   * Unregister all UI components for a plugin
   */
  unregister(pluginId: string): void {
    // Remove nav items
    for (const [key, item] of this.navItems) {
      if (item.pluginId === pluginId) {
        this.navItems.delete(key);
      }
    }

    // Remove views
    for (const [key, view] of this.views) {
      if (view.pluginId === pluginId) {
        this.views.delete(key);
      }
    }

    // Remove settings panels
    this.settingsPanels.delete(pluginId);

    // Remove modals
    for (const [key, modal] of this.modals) {
      if (modal.pluginId === pluginId) {
        this.modals.delete(key);
      }
    }

    console.log(`[PluginUIRegistry] Unregistered UI for plugin: ${pluginId}`);
    this.notifyListeners();
  }

  /**
   * Get all registered nav items, sorted by section and order
   */
  getNavItems(): PluginNavItem[] {
    const items = Array.from(this.navItems.values());
    return items.sort((a, b) => {
      // Sort by section first
      const sectionOrder = { library: 0, tools: 1, settings: 2 };
      const aSectionOrder = sectionOrder[a.section || 'tools'] ?? 1;
      const bSectionOrder = sectionOrder[b.section || 'tools'] ?? 1;
      if (aSectionOrder !== bSectionOrder) return aSectionOrder - bSectionOrder;
      // Then by order
      return (a.order ?? 0) - (b.order ?? 0);
    });
  }

  /**
   * Get nav items for a specific section
   */
  getNavItemsBySection(section: 'library' | 'tools' | 'settings'): PluginNavItem[] {
    return this.getNavItems().filter(item => (item.section || 'tools') === section);
  }

  /**
   * Get a view by ID
   */
  getView(viewId: string): PluginView | undefined {
    return this.views.get(viewId);
  }

  /**
   * Get all registered views
   */
  getAllViews(): PluginView[] {
    return Array.from(this.views.values());
  }

  /**
   * Get settings panel for a plugin
   */
  getSettingsPanel(pluginId: string): PluginSettingsPanel | undefined {
    return this.settingsPanels.get(pluginId);
  }

  /**
   * Get a modal by ID
   */
  getModal(modalId: string): PluginModal | undefined {
    return this.modals.get(modalId);
  }

  /**
   * Check if a view exists
   */
  hasView(viewId: string): boolean {
    return this.views.has(viewId);
  }

  /**
   * Subscribe to registry changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}

// Export singleton instance
export const PluginUIRegistry = new PluginUIRegistryClass();

/**
 * React hook to use the plugin UI registry with automatic re-renders
 */
export function usePluginUIRegistry() {
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  React.useEffect(() => {
    return PluginUIRegistry.subscribe(forceUpdate);
  }, []);

  return PluginUIRegistry;
}
