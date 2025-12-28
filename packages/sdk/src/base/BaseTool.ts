/**
 * Base class for tools (data transfer, cloud mounts, integrations, utilities)
 */

import type {
  AddonManifest,
  Tool,
  ToolType,
  PluginUIRegistry
} from '@audiio/core';

export abstract class BaseTool implements Tool {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly toolType: ToolType;
  readonly icon?: string;

  get manifest(): AddonManifest {
    return {
      id: this.id,
      name: this.name,
      version: '1.0.0',
      roles: ['tool']
    };
  }

  async initialize(): Promise<void> {
    // Override in subclass if needed
  }

  async dispose(): Promise<void> {
    // Override in subclass if needed
  }

  /**
   * Register UI components (sidebar items, views, settings, player controls)
   * Override in subclass to add UI elements
   */
  registerUI?(registry: PluginUIRegistry): void;

  /**
   * Register IPC handlers for Electron main process
   * Override in subclass to handle IPC communication
   * @param ipcMain - Electron.IpcMain instance
   * @param app - Electron.App instance
   */
  registerHandlers?(ipcMain: unknown, app: unknown): void;

  /**
   * Unregister IPC handlers
   * Override in subclass to clean up IPC handlers
   */
  unregisterHandlers?(): void;

  /**
   * Execute the tool's main action
   * Override in subclass if the tool has a primary action
   */
  async execute?(): Promise<void>;

  /**
   * Check if the tool is available/ready
   * Override in subclass to check dependencies, authentication, etc.
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Helper: Log with tool prefix
   */
  protected log(message: string, ...args: unknown[]): void {
    console.log(`[Tool:${this.id}] ${message}`, ...args);
  }

  /**
   * Helper: Log error with tool prefix
   */
  protected logError(message: string, ...args: unknown[]): void {
    console.error(`[Tool:${this.id}] ${message}`, ...args);
  }
}
