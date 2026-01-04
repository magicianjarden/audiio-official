/**
 * Registry exports
 */

export {
  PluginUIRegistry,
  usePluginUIRegistry,
  type PluginNavItem,
  type PluginView,
  type PluginSettingsPanel,
  type PluginModal,
  type PluginUIRegistration,
} from './plugin-ui-registry';

export { initializePluginUIs, cleanupPluginUIs } from './init-plugin-ui';
