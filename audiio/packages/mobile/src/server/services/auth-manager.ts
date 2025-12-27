/**
 * Auth Manager - Unified authentication service for mobile access
 *
 * Combines device management and passphrase generation into a single service
 * that can be used by the API routes.
 */

import { DeviceManager, type AuthorizedDevice, type DeviceToken } from './device-manager';
import {
  generatePassphrase,
  hashPassword,
  verifyPassword,
  validatePassword
} from './passphrase-generator';
import * as fs from 'fs';
import * as path from 'path';

export interface AuthManagerConfig {
  /** Path to persist auth data */
  dataPath?: string;
  /** Default expiration for new devices in days */
  defaultExpirationDays?: number | null;
}

export interface AuthSettings {
  useCustomPassword: boolean;
  defaultExpirationDays: number | null;
  requirePasswordEveryTime: boolean;
}

interface StoredAuthData {
  passphrase: string;
  passphraseHash: string;
  passphraseSalt: string;
  customPasswordHash?: string;
  customPasswordSalt?: string;
  useCustomPassword: boolean;
  requirePasswordEveryTime: boolean;
}

export class AuthManager {
  private deviceManager: DeviceManager;
  private authData: StoredAuthData;
  private dataFilePath: string | null = null;
  private currentPassphrase: string;

  constructor(config: AuthManagerConfig = {}) {
    // Initialize device manager
    this.deviceManager = new DeviceManager({
      defaultExpirationDays: config.defaultExpirationDays ?? null, // Never expires by default
      dataPath: config.dataPath
    });

    // Initialize auth data
    this.currentPassphrase = '';
    this.authData = {
      passphrase: '',
      passphraseHash: '',
      passphraseSalt: '',
      useCustomPassword: false,
      requirePasswordEveryTime: false
    };

    if (config.dataPath) {
      this.dataFilePath = path.join(config.dataPath, 'auth.json');
      this.loadFromDisk();
    }

    // Generate initial passphrase if none exists
    if (!this.authData.passphrase) {
      this.regeneratePassphrase();
    } else {
      this.currentPassphrase = this.authData.passphrase;
    }
  }

  /**
   * Pair a device via QR code (no password needed)
   * Called by AccessManager when consuming a pairing code
   */
  pairDevice(userAgent: string): { success: boolean; deviceToken?: string; deviceId?: string; error?: string } {
    try {
      // Create device token with null expiration (never expires)
      const deviceToken = this.deviceManager.registerDevice(
        '', // Will be auto-detected from userAgent
        userAgent,
        null // Never expires for QR-paired devices
      );

      console.log(`[AuthManager] Device paired via QR code: ${deviceToken.deviceId}`);

      return {
        success: true,
        deviceToken: `${deviceToken.deviceId}:${deviceToken.token}`,
        deviceId: deviceToken.deviceId
      };
    } catch (error) {
      console.error('[AuthManager] Failed to pair device:', error);
      return { success: false, error: 'Failed to register device' };
    }
  }

  /**
   * Login with passphrase or custom password
   */
  async login(
    password: string,
    deviceName: string,
    userAgent: string,
    rememberDevice: boolean
  ): Promise<{ success: boolean; error?: string; deviceToken?: string; deviceId?: string; expiresAt?: string }> {
    // Verify password
    const isValid = this.verifyCredentials(password);

    if (!isValid) {
      return { success: false, error: 'Invalid password' };
    }

    // If remember device, create device token
    if (rememberDevice) {
      const deviceToken = this.deviceManager.registerDevice(
        deviceName,
        userAgent,
        this.deviceManager.getDefaultExpiration()
      );

      return {
        success: true,
        deviceToken: `${deviceToken.deviceId}:${deviceToken.token}`,
        deviceId: deviceToken.deviceId,
        expiresAt: deviceToken.expiresAt?.toISOString()
      };
    }

    return { success: true };
  }

  /**
   * Verify credentials (passphrase or custom password)
   */
  private verifyCredentials(password: string): boolean {
    if (this.authData.useCustomPassword && this.authData.customPasswordHash && this.authData.customPasswordSalt) {
      return verifyPassword(password, this.authData.customPasswordHash, this.authData.customPasswordSalt);
    }

    // Check against passphrase
    return verifyPassword(password, this.authData.passphraseHash, this.authData.passphraseSalt);
  }

  /**
   * Validate a device token
   */
  validateDeviceToken(combinedToken: string): { valid: boolean; deviceId?: string } {
    return this.deviceManager.validateCombinedToken(combinedToken);
  }

  /**
   * Refresh a device token
   */
  refreshDeviceToken(deviceId: string, token: string): DeviceToken | null {
    // First validate the current token
    if (!this.deviceManager.validateToken(deviceId, token)) {
      return null;
    }

    return this.deviceManager.refreshToken(deviceId);
  }

  /**
   * Revoke a device
   */
  revokeDevice(deviceId: string): boolean {
    return this.deviceManager.revokeDevice(deviceId);
  }

  /**
   * Revoke all devices
   */
  revokeAllDevices(): number {
    return this.deviceManager.revokeAllDevices();
  }

  /**
   * List all authorized devices
   */
  listDevices(): AuthorizedDevice[] {
    return this.deviceManager.listDevices();
  }

  /**
   * Get current passphrase (for display)
   */
  getCurrentPassphrase(): string {
    return this.currentPassphrase;
  }

  /**
   * Regenerate the passphrase
   */
  regeneratePassphrase(): string {
    const newPassphrase = generatePassphrase({
      wordCount: 3,
      includeNumber: true,
      separator: '-'
    });

    const { hash, salt } = hashPassword(newPassphrase);

    this.currentPassphrase = newPassphrase;
    this.authData.passphrase = newPassphrase;
    this.authData.passphraseHash = hash;
    this.authData.passphraseSalt = salt;

    // If not using custom password, this becomes the active credential
    if (!this.authData.useCustomPassword) {
      console.log(`[AuthManager] New passphrase generated: ${newPassphrase}`);
    }

    this.saveToDisk();
    return newPassphrase;
  }

  /**
   * Set a custom password
   */
  setCustomPassword(password: string): { success: boolean; error?: string } {
    const validation = validatePassword(password);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(', ') };
    }

    const { hash, salt } = hashPassword(password);

    this.authData.customPasswordHash = hash;
    this.authData.customPasswordSalt = salt;
    this.authData.useCustomPassword = true;

    this.saveToDisk();
    console.log('[AuthManager] Custom password set');

    return { success: true };
  }

  /**
   * Remove custom password (revert to passphrase)
   */
  removeCustomPassword(): void {
    this.authData.customPasswordHash = undefined;
    this.authData.customPasswordSalt = undefined;
    this.authData.useCustomPassword = false;

    this.saveToDisk();
    console.log('[AuthManager] Custom password removed, using passphrase');
  }

  /**
   * Get auth settings
   */
  getSettings(): AuthSettings {
    return {
      useCustomPassword: this.authData.useCustomPassword,
      defaultExpirationDays: this.deviceManager.getDefaultExpiration(),
      requirePasswordEveryTime: this.authData.requirePasswordEveryTime
    };
  }

  /**
   * Update auth settings
   */
  updateSettings(settings: Partial<AuthSettings>): void {
    if (settings.defaultExpirationDays !== undefined) {
      this.deviceManager.setDefaultExpiration(settings.defaultExpirationDays);
    }

    if (settings.requirePasswordEveryTime !== undefined) {
      this.authData.requirePasswordEveryTime = settings.requirePasswordEveryTime;
    }

    this.saveToDisk();
  }

  /**
   * Rename a device
   */
  renameDevice(deviceId: string, name: string): boolean {
    return this.deviceManager.renameDevice(deviceId, name);
  }

  /**
   * Set device expiration
   */
  setDeviceExpiration(deviceId: string, expiresAt: Date | null): boolean {
    return this.deviceManager.setDeviceExpiration(deviceId, expiresAt);
  }

  /**
   * Clean up expired devices
   */
  cleanup(): number {
    return this.deviceManager.cleanup();
  }

  // ========================================
  // Private Methods
  // ========================================

  private loadFromDisk(): void {
    if (!this.dataFilePath) return;

    try {
      if (fs.existsSync(this.dataFilePath)) {
        const data = fs.readFileSync(this.dataFilePath, 'utf-8');
        const parsed = JSON.parse(data);

        this.authData = {
          passphrase: parsed.passphrase || '',
          passphraseHash: parsed.passphraseHash || '',
          passphraseSalt: parsed.passphraseSalt || '',
          customPasswordHash: parsed.customPasswordHash,
          customPasswordSalt: parsed.customPasswordSalt,
          useCustomPassword: parsed.useCustomPassword || false,
          requirePasswordEveryTime: parsed.requirePasswordEveryTime || false
        };

        this.currentPassphrase = this.authData.passphrase;
        console.log('[AuthManager] Loaded auth data from disk');
      }
    } catch (error) {
      console.error('[AuthManager] Failed to load auth data from disk:', error);
    }
  }

  private saveToDisk(): void {
    if (!this.dataFilePath) return;

    try {
      const dir = path.dirname(this.dataFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.dataFilePath, JSON.stringify(this.authData, null, 2));
    } catch (error) {
      console.error('[AuthManager] Failed to save auth data to disk:', error);
    }
  }
}
