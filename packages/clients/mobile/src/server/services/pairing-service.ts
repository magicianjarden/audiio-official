/**
 * Pairing Service - Unified device pairing for mobile access
 *
 * Simplifies the authentication flow to a single pairing code system:
 * 1. Desktop shows WORD-WORD-NUMBER code
 * 2. Mobile enters code (or scans QR)
 * 3. Device token issued automatically
 * 4. Device saved for future connections
 *
 * No passphrase, no approval flow - just simple pairing.
 */

import * as QRCode from 'qrcode';
import { DeviceManager, type AuthorizedDevice, type DeviceToken } from './device-manager';
import { ServerIdentityService } from './server-identity';

// Code generation (matches relay/src/shared/codes.ts format)
const ADJECTIVES = [
  'SWIFT', 'CALM', 'BOLD', 'WARM', 'COOL',
  'BLUE', 'GOLD', 'JADE', 'RUBY', 'SAGE',
  'WILD', 'SOFT', 'DEEP', 'HIGH', 'PURE',
  'DAWN', 'DUSK', 'NOON', 'STAR', 'MOON',
  'FIRE', 'WAVE', 'WIND', 'LEAF', 'SNOW',
  'IRON', 'SILK', 'AQUA', 'ROSE', 'PINE'
];

const NOUNS = [
  'TIGER', 'EAGLE', 'SHARK', 'WOLF', 'BEAR',
  'RIVER', 'OCEAN', 'STORM', 'CLOUD', 'STONE',
  'FLAME', 'FROST', 'LIGHT', 'SHADE', 'SPARK',
  'CROWN', 'BLADE', 'ARROW', 'TOWER', 'BRIDGE',
  'DREAM', 'QUEST', 'HAVEN', 'REALM', 'FORGE',
  'COMET', 'ORBIT', 'PULSE', 'ECHO', 'PRISM'
];

export interface PairingServiceConfig {
  /** Path to persist device data */
  dataPath?: string;
  /** Pairing code expiration in minutes (default: 5) */
  codeExpirationMinutes?: number;
  /** Custom relay URL (default: wss://audiio-relay.fly.dev) */
  customRelayUrl?: string;
}

export interface PairingCode {
  code: string;
  expiresAt: number;
  localUrl: string;
  qrCode?: string;
}

export interface PairingResult {
  success: boolean;
  deviceToken?: string;
  deviceId?: string;
  localUrl?: string;
  /** Persistent server ID for reconnection */
  serverId?: string;
  /** Human-friendly server name */
  serverName?: string;
  /** Relay code for remote access (derived from serverId) */
  relayCode?: string;
  error?: string;
}

export interface DeviceInfo {
  name?: string;
  userAgent: string;
}

const DEFAULT_CONFIG: Required<Omit<PairingServiceConfig, 'dataPath'>> = {
  codeExpirationMinutes: 5,
  customRelayUrl: 'wss://audiio-relay.fly.dev'
};

export class PairingService {
  private deviceManager: DeviceManager;
  private serverIdentity: ServerIdentityService | null = null;
  private config: Required<Omit<PairingServiceConfig, 'dataPath'>> & { dataPath?: string };
  private currentCode: PairingCode | null = null;
  private codeRefreshTimer: NodeJS.Timeout | null = null;
  private relayCode: string | null = null;  // Synced from P2PManager

  constructor(config: PairingServiceConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.deviceManager = new DeviceManager({
      defaultExpirationDays: null, // Never expires by default
      dataPath: config.dataPath
    });

    // Initialize server identity if data path is provided
    if (config.dataPath) {
      this.serverIdentity = new ServerIdentityService({
        dataPath: config.dataPath,
        defaultServerName: 'Audiio Server'
      });
    }
  }

  /**
   * Initialize the service (call after construction)
   */
  async initialize(): Promise<void> {
    if (this.serverIdentity) {
      await this.serverIdentity.initialize();
      // Use server's persistent relay code as the primary code
      const relayCode = this.serverIdentity.getRelayCode();
      if (relayCode) {
        this.relayCode = relayCode.toUpperCase();
        console.log(`[PairingService] Server relay code: ${this.relayCode}`);
      }
    }
  }

  /**
   * Get the server identity service
   */
  getServerIdentity(): ServerIdentityService | null {
    return this.serverIdentity;
  }

  /**
   * Get the device manager for token validation
   */
  getDeviceManager(): DeviceManager {
    return this.deviceManager;
  }

  /**
   * Generate a new pairing code (WORD-WORD-NUMBER format)
   */
  generateCode(): string {
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const number = Math.floor(Math.random() * 90) + 10; // 10-99

    return `${adjective}-${noun}-${number}`;
  }

  /**
   * Validate code format
   */
  isValidCodeFormat(code: string): boolean {
    const pattern = /^[A-Z]+-[A-Z]+-\d{2}$/;
    return pattern.test(code.toUpperCase().trim());
  }

  /**
   * Normalize a code (uppercase, trim)
   */
  normalizeCode(code: string): string {
    return code.toUpperCase().trim();
  }

  /**
   * Start the pairing service and generate initial code
   */
  async start(localUrl: string): Promise<PairingCode> {
    // Stop any existing timer
    this.stopCodeRefresh();

    // Generate initial code
    this.currentCode = await this.createPairingCode(localUrl);

    // Set up auto-refresh timer
    this.startCodeRefresh(localUrl);

    console.log(`[PairingService] Started with code: ${this.currentCode.code}`);
    return this.currentCode;
  }

  /**
   * Stop the pairing service
   */
  stop(): void {
    this.stopCodeRefresh();
    this.currentCode = null;
    console.log('[PairingService] Stopped');
  }

  /**
   * Create a new pairing code configuration
   */
  private async createPairingCode(localUrl: string): Promise<PairingCode> {
    const code = this.generateCode();
    const expiresAt = Date.now() + this.config.codeExpirationMinutes * 60 * 1000;

    // Build pairing URL with code
    const pairingUrl = `${localUrl}?pair=${code}`;

    // Generate QR code
    let qrCode: string | undefined;
    try {
      qrCode = await QRCode.toDataURL(pairingUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#ffffff',
          light: '#00000000' // Transparent background
        },
        errorCorrectionLevel: 'M'
      });
    } catch (error) {
      console.error('[PairingService] Failed to generate QR code:', error);
    }

    return {
      code,
      expiresAt,
      localUrl,
      qrCode
    };
  }

  /**
   * Start code auto-refresh timer
   */
  private startCodeRefresh(localUrl: string): void {
    const refreshMs = this.config.codeExpirationMinutes * 60 * 1000;

    this.codeRefreshTimer = setInterval(async () => {
      this.currentCode = await this.createPairingCode(localUrl);
      console.log(`[PairingService] Code refreshed: ${this.currentCode.code}`);
    }, refreshMs);
  }

  /**
   * Stop code auto-refresh timer
   */
  private stopCodeRefresh(): void {
    if (this.codeRefreshTimer) {
      clearInterval(this.codeRefreshTimer);
      this.codeRefreshTimer = null;
    }
  }

  /**
   * Manually refresh the pairing code
   */
  async refreshCode(): Promise<PairingCode | null> {
    if (!this.currentCode) {
      return null;
    }

    this.currentCode = await this.createPairingCode(this.currentCode.localUrl);
    console.log(`[PairingService] Code manually refreshed: ${this.currentCode.code}`);
    return this.currentCode;
  }

  /**
   * Get current pairing code info
   */
  getCurrentCode(): PairingCode | null {
    return this.currentCode;
  }

  /**
   * Set the relay code (synced from P2PManager)
   * This allows pairing with the relay code in addition to the local code
   */
  setRelayCode(code: string | null): void {
    this.relayCode = code ? this.normalizeCode(code) : null;
    console.log(`[PairingService] Relay code synced: ${this.relayCode || 'none'}`);
  }

  /**
   * Check if a code is valid (matches current pairing code OR relay code)
   */
  isCodeValid(code: string): boolean {
    const normalized = this.normalizeCode(code);

    console.log(`[PairingService] Validating code: "${normalized}"`);
    console.log(`[PairingService] Stored relay code: "${this.relayCode || 'none'}"`);
    console.log(`[PairingService] Current local code: "${this.currentCode?.code || 'none'}"`);

    // Check relay code first (primary code for both local and remote)
    if (this.relayCode && normalized === this.relayCode) {
      console.log('[PairingService] Code matches relay code');
      return true;
    }

    // Check local pairing code
    if (!this.currentCode) {
      console.log('[PairingService] No current code available');
      return false;
    }

    const isMatch = normalized === this.currentCode.code;
    const isNotExpired = Date.now() < this.currentCode.expiresAt;

    console.log(`[PairingService] Local code match: ${isMatch}, not expired: ${isNotExpired}`);

    return isMatch && isNotExpired;
  }

  /**
   * Pair a device using the pairing code
   * Returns device token on success
   */
  pair(code: string, deviceInfo: DeviceInfo): PairingResult {
    // Validate code
    if (!this.isCodeValid(code)) {
      console.log(`[PairingService] Invalid or expired pairing code: ${code}`);
      return {
        success: false,
        error: 'Invalid or expired pairing code'
      };
    }

    // Register device
    try {
      const deviceToken = this.deviceManager.registerDevice(
        deviceInfo.name || '',
        deviceInfo.userAgent,
        null // Never expires
      );

      console.log(`[PairingService] Device paired: ${deviceToken.deviceId}`);

      // Include server identity for persistent reconnection
      const serverInfo = this.serverIdentity?.getConnectionInfo(this.currentCode?.localUrl);

      return {
        success: true,
        deviceToken: `${deviceToken.deviceId}:${deviceToken.token}`,
        deviceId: deviceToken.deviceId,
        localUrl: this.currentCode?.localUrl,
        serverId: serverInfo?.serverId,
        serverName: serverInfo?.serverName,
        relayCode: serverInfo?.relayCode
      };
    } catch (error) {
      console.error('[PairingService] Failed to register device:', error);
      return {
        success: false,
        error: 'Failed to register device'
      };
    }
  }

  /**
   * Validate an existing device token
   */
  validateDeviceToken(combinedToken: string): { valid: boolean; deviceId?: string } {
    return this.deviceManager.validateCombinedToken(combinedToken);
  }

  /**
   * Refresh a device token
   */
  refreshDeviceToken(deviceId: string, token: string): DeviceToken | null {
    if (!this.deviceManager.validateToken(deviceId, token)) {
      return null;
    }
    return this.deviceManager.refreshToken(deviceId);
  }

  /**
   * Get all paired devices
   */
  getDevices(): AuthorizedDevice[] {
    return this.deviceManager.listDevices();
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
   * Rename a device
   */
  renameDevice(deviceId: string, name: string): boolean {
    return this.deviceManager.renameDevice(deviceId, name);
  }

  /**
   * Clean up expired/revoked devices
   */
  cleanup(): number {
    return this.deviceManager.cleanup();
  }

  /**
   * Get custom relay URL
   */
  getRelayUrl(): string {
    return this.config.customRelayUrl;
  }

  /**
   * Set custom relay URL
   */
  setRelayUrl(url: string): void {
    this.config.customRelayUrl = url;
    console.log(`[PairingService] Relay URL set to: ${url}`);
  }

  /**
   * Get the local URL from current pairing code
   */
  getLocalUrl(): string | null {
    return this.currentCode?.localUrl ?? null;
  }
}
