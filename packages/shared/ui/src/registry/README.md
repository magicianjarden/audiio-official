# Plugin UI Registry

The registry system provides a centralized mechanism for plugins to register their UI components (views, navigation items, settings panels, and modals) that integrate seamlessly with the main application.

## Overview

```
registry/
├── index.ts              # Public exports
├── init-plugin-ui.ts     # Initialization and cleanup functions
├── plugin-ui-registry.ts # Core registry singleton and React hook
└── README.md             # This file
```

## How It Works

1. **App Startup**: `initializePluginUIs()` is called in `App.tsx` to set up IPC listeners
2. **Plugin Loading**: Plugins register their UI components via `PluginUIRegistry.register()`
3. **Dynamic Rendering**: Components using `usePluginUIRegistry()` hook automatically re-render when registrations change
4. **Cleanup**: `cleanupPluginUIs()` clears all registrations on shutdown

## Files

### `plugin-ui-registry.ts`

Core singleton registry that stores and manages all plugin UI registrations.

**Types:**

| Type | Description |
|------|-------------|
| `PluginNavItem` | Sidebar navigation item (icon, label, viewId, section) |
| `PluginView` | Full-page view component |
| `PluginSettingsPanel` | Settings panel for plugin detail view |
| `PluginModal` | Modal/dialog component |
| `PluginUIRegistration` | Complete registration bundle |

**Key Methods:**

```typescript
// Register all UI components for a plugin
PluginUIRegistry.register({
  pluginId: 'my-plugin',
  navItems: [{ pluginId: 'my-plugin', label: 'My Tool', icon: MyIcon, viewId: 'my-view', section: 'tools' }],
  views: [{ viewId: 'my-view', pluginId: 'my-plugin', component: MyViewComponent }],
});

// Unregister all UI for a plugin
PluginUIRegistry.unregister('my-plugin');

// Query methods
PluginUIRegistry.getNavItems();                      // All nav items, sorted
PluginUIRegistry.getNavItemsBySection('tools');      // Items for specific section
PluginUIRegistry.getView('my-view');                 // Get view by ID
PluginUIRegistry.getAllViews();                      // All registered views
PluginUIRegistry.getSettingsPanel('my-plugin');      // Settings panel for plugin
PluginUIRegistry.getModal('my-modal');               // Get modal by ID
PluginUIRegistry.hasView('my-view');                 // Check if view exists

// Subscribe to changes
const unsubscribe = PluginUIRegistry.subscribe(() => console.log('Registry updated'));
```

### `init-plugin-ui.ts`

Initialization and cleanup lifecycle functions.

```typescript
// Called once during app startup
initializePluginUIs();

// Called during app shutdown
cleanupPluginUIs();
```

## Usage Locations

### App.tsx (lines 55, 388, 475)

```typescript
import { usePluginUIRegistry, initializePluginUIs } from './registry';

// Initialize on mount
useEffect(() => {
  initializePluginUIs();
}, []);

// Render plugin views dynamically
const pluginUIRegistry = usePluginUIRegistry();
if (currentView.startsWith('plugin-view-')) {
  const viewId = currentView.replace('plugin-view-', '');
  const pluginView = pluginUIRegistry.getView(viewId);
  if (pluginView) {
    const ViewComponent = pluginView.component;
    return <ViewComponent />;
  }
}
```

### Sidebar.tsx (lines 27, 730)

```typescript
import { usePluginUIRegistry } from '../../registry';

const pluginUIRegistry = usePluginUIRegistry();
// Use pluginUIRegistry.getNavItemsBySection('tools') to render plugin nav items
```

## Integration with Plugin SDK

The `@audiio/core` package defines a `PluginUIRegistry` interface that plugins can use:

```typescript
// packages/shared/core/src/types/addon.ts
export interface Tool {
  // ...
  registerUI?(registry: PluginUIRegistry): void;
}
```

This allows plugins to register their UI components when loaded by the plugin system.

## Navigation

Plugin views are accessed via navigation with the `plugin-view-{viewId}` pattern:

```typescript
// Navigate to a plugin view
useNavigationStore.getState().setView('plugin-view-my-view');
```

## Sidebar Sections

Nav items can be placed in three sections:
- `library` - Appears in the Library section
- `tools` - Appears in the Tools section (default)
- `settings` - Appears near settings

Items are sorted first by section order (library < tools < settings), then by the `order` property.
