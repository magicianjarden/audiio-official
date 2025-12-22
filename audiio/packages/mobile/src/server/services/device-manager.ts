/**
 * Device Manager - Manages authorized devices for mobile access
 *
 * Supports:
 * - Device registration with friendly names
 * - Token-based authentication with expiration
 * - Device revocation
 * - Remember device functionality
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface AuthorizedDevice {
  id: string;
  name: string;
  userAgent: string;
  tokenHash: string;
  createdAt: Date;
  lastAccessAt: Date;
  expiresAt: Date | null;
  isRevoked: boolean;
}

export interface DeviceToken {
  deviceId: string;
  token: string;
  expiresAt: Date | null;
}

export interface DeviceManagerConfig {
  /** Default token expiration in days (null = never expires) */
  defaultExpirationDays: number | null;
  /** Path to persist device data */
  dataPath?: string;
}

const DEFAULT_CONFIG: DeviceManagerConfig = {
  defaultExpirationDays: 30,
  dataPath: undefined
};

export class DeviceManager {
  private devices: Map<string, AuthorizedDevice> = new Map();
  private config: DeviceManagerConfig;
  private dataFilePath: string | null = null;

  constructor(config: Partial<DeviceManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (this.config.dataPath) {
      this.dataFilePath = path.join(this.config.dataPath, 'devices.json');
      this.loadFromDisk();
    }
  }

  /**
   * Register a new device and generate an access token
   */
  registerDevice(name: string, userAgent: string, expirationDays?: number | null): DeviceToken {
    const deviceId = this.generateDeviceId();
    const token = this.generateToken();
    const tokenHash = this.hashToken(token);

    // Calculate expiration
    const expDays = expirationDays !== undefined ? expirationDays : this.config.defaultExpirationDays;
    const expiresAt = expDays ? new Date(Date.now() + expDays * 24 * 60 * 60 * 1000) : null;

    const device: AuthorizedDevice = {
      id: deviceId,
      name: name || this.generateDeviceName(userAgent),
      userAgent,
      tokenHash,
      createdAt: new Date(),
      lastAccessAt: new Date(),
      expiresAt,
      isRevoked: false
    };

    this.devices.set(deviceId, device);
    this.saveToDisk();

    console.log(`[DeviceManager] Registered device: ${device.name} (${deviceId})`);

    return {
      deviceId,
      token,
      expiresAt
    };
  }

  /**
   * Validate a device token
   */
  validateToken(deviceId: string, token: string): boolean {
    const device = this.devices.get(deviceId);

    if (!device) {
      console.log(`[DeviceManager] Device not found: ${deviceId}`);
      return false;
    }

    if (device.isRevoked) {
      console.log(`[DeviceManager] Device is revoked: ${deviceId}`);
      return false;
    }

    if (device.expiresAt && new Date() > device.expiresAt) {
      console.log(`[DeviceManager] Token expired for device: ${deviceId}`);
      return false;
    }

    const tokenHash = this.hashToken(token);
    if (tokenHash !== device.tokenHash) {
      console.log(`[DeviceManager] Invalid token for device: ${deviceId}`);
      return false;
    }

    // Update last access time
    device.lastAccessAt = new Date();
    this.saveToDisk();

    return true;
  }

  /**
   * Validate a combined token (deviceId:token format)
   */
  validateCombinedToken(combinedToken: string): { valid: boolean; deviceId?: string } {
    const parts = combinedToken.split(':');
    if (parts.length !== 2) {
      return { valid: false };
    }

    const deviceId = parts[0]!;
    const token = parts[1]!;
    const valid = this.validateToken(deviceId, token);

    return { valid, deviceId: valid ? deviceId : undefined };
  }

  /**
   * Refresh a device token (generate new token, keep device)
   */
  refreshToken(deviceId: string): DeviceToken | null {
    const device = this.devices.get(deviceId);

    if (!device || device.isRevoked) {
      return null;
    }

    const newToken = this.generateToken();
    device.tokenHash = this.hashToken(newToken);
    device.lastAccessAt = new Date();

    // Reset expiration if configured
    if (this.config.defaultExpirationDays) {
      device.expiresAt = new Date(Date.now() + this.config.defaultExpirationDays * 24 * 60 * 60 * 1000);
    }

    this.saveToDisk();

    return {
      deviceId,
      token: newToken,
      expiresAt: device.expiresAt
    };
  }

  /**
   * Revoke a device
   */
  revokeDevice(deviceId: string): boolean {
    const device = this.devices.get(deviceId);

    if (!device) {
      return false;
    }

    device.isRevoked = true;
    this.saveToDisk();

    console.log(`[DeviceManager] Revoked device: ${device.name} (${deviceId})`);
    return true;
  }

  /**
   * Revoke all devices
   */
  revokeAllDevices(): number {
    let count = 0;
    for (const device of this.devices.values()) {
      if (!device.isRevoked) {
        device.isRevoked = true;
        count++;
      }
    }
    this.saveToDisk();
    console.log(`[DeviceManager] Revoked ${count} devices`);
    return count;
  }

  /**
   * Delete a device completely
   */
  deleteDevice(deviceId: string): boolean {
    const deleted = this.devices.delete(deviceId);
    if (deleted) {
      this.saveToDisk();
    }
    return deleted;
  }

  /**
   * Get all devices (for management UI)
   */
  listDevices(): AuthorizedDevice[] {
    return Array.from(this.devices.values())
      .filter(d => !d.isRevoked)
      .sort((a, b) => b.lastAccessAt.getTime() - a.lastAccessAt.getTime());
  }

  /**
   * Get a specific device
   */
  getDevice(deviceId: string): AuthorizedDevice | null {
    return this.devices.get(deviceId) || null;
  }

  /**
   * Update device expiration
   */
  setDeviceExpiration(deviceId: string, expiresAt: Date | null): boolean {
    const device = this.devices.get(deviceId);
    if (!device) return false;

    device.expiresAt = expiresAt;
    this.saveToDisk();
    return true;
  }

  /**
   * Update device name
   */
  renameDevice(deviceId: string, name: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) return false;

    device.name = name;
    this.saveToDisk();
    return true;
  }

  /**
   * Set default expiration for new devices
   */
  setDefaultExpiration(days: number | null): void {
    this.config.defaultExpirationDays = days;
  }

  /**
   * Get default expiration setting
   */
  getDefaultExpiration(): number | null {
    return this.config.defaultExpirationDays;
  }

  /**
   * Clean up expired and revoked devices
   */
  cleanup(): number {
    const now = new Date();
    let removed = 0;

    for (const [id, device] of this.devices) {
      if (device.isRevoked || (device.expiresAt && now > device.expiresAt)) {
        this.devices.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      this.saveToDisk();
      console.log(`[DeviceManager] Cleaned up ${removed} expired/revoked devices`);
    }

    return removed;
  }

  // ========================================
  // Private Methods
  // ========================================

  private generateDeviceId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  private generateToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateDeviceName(userAgent: string): string {
    // Try to extract device info from user agent
    const ua = userAgent.toLowerCase();

    if (ua.includes('iphone')) return 'iPhone';
    if (ua.includes('ipad')) return 'iPad';
    if (ua.includes('android')) {
      if (ua.includes('mobile')) return 'Android Phone';
      return 'Android Tablet';
    }
    if (ua.includes('mac')) return 'Mac';
    if (ua.includes('windows')) return 'Windows PC';
    if (ua.includes('linux')) return 'Linux Device';

    return 'Unknown Device';
  }

  private loadFromDisk(): void {
    if (!this.dataFilePath) return;

    try {
      if (fs.existsSync(this.dataFilePath)) {
        const data = fs.readFileSync(this.dataFilePath, 'utf-8');
        const parsed = JSON.parse(data);

        for (const device of parsed.devices || []) {
          // Convert date strings back to Date objects
          device.createdAt = new Date(device.createdAt);
          device.lastAccessAt = new Date(device.lastAccessAt);
          device.expiresAt = device.expiresAt ? new Date(device.expiresAt) : null;

          this.devices.set(device.id, device);
        }

        if (parsed.config?.defaultExpirationDays !== undefined) {
          this.config.defaultExpirationDays = parsed.config.defaultExpirationDays;
        }

        console.log(`[DeviceManager] Loaded ${this.devices.size} devices from disk`);
      }
    } catch (error) {
      console.error('[DeviceManager] Failed to load devices from disk:', error);
    }
  }

  private saveToDisk(): void {
    if (!this.dataFilePath) return;

    try {
      const dir = path.dirname(this.dataFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data = {
        devices: Array.from(this.devices.values()),
        config: {
          defaultExpirationDays: this.config.defaultExpirationDays
        }
      };

      fs.writeFileSync(this.dataFilePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[DeviceManager] Failed to save devices to disk:', error);
    }
  }
}
