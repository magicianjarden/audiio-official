/**
 * Server Identity - Persistent server identification for reconnection
 *
 * Unlike ephemeral pairing codes, the Server ID is:
 * - Generated once on first run
 * - Stored persistently
 * - Used as the relay room identifier
 * - Shared with mobile during pairing for future reconnection
 *
 * This enables Plex-like "pair once, connect forever" behavior.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface ServerIdentity {
  /** Unique server identifier (UUID format) */
  serverId: string;
  /** Human-friendly server name */
  serverName: string;
  /** When the identity was created */
  createdAt: string;
  /** Short code for relay room (derived from serverId) */
  relayCode: string;
  /** Optional password hash for room protection (SHA-512) */
  passwordHash?: string;
}

export interface ServerIdentityConfig {
  /** Path to store identity file */
  dataPath: string;
  /** Default server name if not set */
  defaultServerName?: string;
}

const IDENTITY_FILENAME = 'server-identity.json';

// Word lists for generating friendly relay codes
const ADJECTIVES = [
  'swift', 'calm', 'bold', 'warm', 'cool',
  'blue', 'gold', 'jade', 'ruby', 'sage',
  'wild', 'soft', 'deep', 'high', 'pure',
  'dawn', 'dusk', 'noon', 'star', 'moon'
];

const NOUNS = [
  'tiger', 'eagle', 'shark', 'wolf', 'bear',
  'river', 'ocean', 'storm', 'cloud', 'stone',
  'flame', 'frost', 'light', 'shade', 'spark',
  'crown', 'blade', 'arrow', 'tower', 'bridge'
];

export class ServerIdentityService {
  private identity: ServerIdentity | null = null;
  private config: ServerIdentityConfig;
  private filePath: string;

  constructor(config: ServerIdentityConfig) {
    this.config = config;
    this.filePath = path.join(config.dataPath, IDENTITY_FILENAME);
  }

  /**
   * Initialize - load existing identity or create new one
   */
  async initialize(): Promise<ServerIdentity> {
    // Try to load existing identity
    this.identity = this.loadFromDisk();

    if (!this.identity) {
      // Generate new identity
      this.identity = this.generateIdentity();
      this.saveToDisk();
      console.log(`[ServerIdentity] Created new server identity: ${this.identity.serverId}`);
    } else {
      console.log(`[ServerIdentity] Loaded server identity: ${this.identity.serverId}`);
    }

    return this.identity;
  }

  /**
   * Get current server identity
   */
  getIdentity(): ServerIdentity | null {
    return this.identity;
  }

  /**
   * Get the server ID
   */
  getServerId(): string | null {
    return this.identity?.serverId ?? null;
  }

  /**
   * Get the relay code for this server
   */
  getRelayCode(): string | null {
    return this.identity?.relayCode ?? null;
  }

  /**
   * Get the server name
   */
  getServerName(): string {
    return this.identity?.serverName ?? this.config.defaultServerName ?? 'Audiio Server';
  }

  /**
   * Update the server name
   */
  setServerName(name: string): void {
    if (!this.identity) return;

    this.identity.serverName = name;
    this.saveToDisk();
    console.log(`[ServerIdentity] Server name updated to: ${name}`);
  }

  /**
   * Set a password for room protection
   * Password is hashed with SHA-512 before storage
   */
  setPassword(password: string): void {
    if (!this.identity) return;

    // Hash with SHA-512 (matches relay server expectation)
    const hash = crypto.createHash('sha512').update(password).digest('hex');
    this.identity.passwordHash = hash;
    this.saveToDisk();
    console.log('[ServerIdentity] Room password set');
  }

  /**
   * Remove the room password
   */
  removePassword(): void {
    if (!this.identity) return;

    delete this.identity.passwordHash;
    this.saveToDisk();
    console.log('[ServerIdentity] Room password removed');
  }

  /**
   * Check if room has password protection
   */
  hasPassword(): boolean {
    return !!this.identity?.passwordHash;
  }

  /**
   * Get the password hash (for relay registration)
   */
  getPasswordHash(): string | undefined {
    return this.identity?.passwordHash;
  }

  /**
   * Regenerate the server identity (use with caution - invalidates all mobile connections)
   */
  regenerate(): ServerIdentity {
    this.identity = this.generateIdentity();
    this.saveToDisk();
    console.log(`[ServerIdentity] Regenerated server identity: ${this.identity.serverId}`);
    console.warn('[ServerIdentity] All mobile devices will need to re-pair!');
    return this.identity;
  }

  /**
   * Generate a new server identity
   */
  private generateIdentity(): ServerIdentity {
    const serverId = crypto.randomUUID();
    const relayCode = this.generateRelayCode(serverId);

    return {
      serverId,
      serverName: this.config.defaultServerName ?? 'Audiio Server',
      createdAt: new Date().toISOString(),
      relayCode
    };
  }

  /**
   * Generate a deterministic, human-friendly relay code from server ID
   * Format: ADJECTIVE-NOUN-NN (e.g., SWIFT-TIGER-42)
   * Must match relay server expected format (2-digit number at end)
   */
  private generateRelayCode(serverId: string): string {
    // Use first 8 chars of server ID as seed for deterministic generation
    const seed = serverId.replace(/-/g, '').substring(0, 8);
    const seedNum = parseInt(seed, 16);

    const adjIndex = seedNum % ADJECTIVES.length;
    const nounIndex = Math.floor(seedNum / ADJECTIVES.length) % NOUNS.length;
    // Generate 2-digit number (10-99) from seed
    const number = (seedNum % 90) + 10;

    return `${ADJECTIVES[adjIndex]}-${NOUNS[nounIndex]}-${number}`;
  }

  /**
   * Check if relay code is in valid format (ADJECTIVE-NOUN-NN with 2-digit number)
   */
  private isValidRelayCodeFormat(code: string): boolean {
    const pattern = /^[A-Z]+-[A-Z]+-\d{2}$/;
    return pattern.test(code.toUpperCase());
  }

  /**
   * Load identity from disk
   */
  private loadFromDisk(): ServerIdentity | null {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(data);

        // Validate required fields
        if (parsed.serverId && parsed.relayCode) {
          // Check if relay code is in valid format
          // If not (old format like PURE-LIGHT-FBB1), regenerate it
          if (!this.isValidRelayCodeFormat(parsed.relayCode)) {
            console.log(`[ServerIdentity] Upgrading relay code format from ${parsed.relayCode}`);
            parsed.relayCode = this.generateRelayCode(parsed.serverId);
            console.log(`[ServerIdentity] New relay code: ${parsed.relayCode}`);
            // Save updated identity
            this.identity = parsed;
            this.saveToDisk();
          }
          return parsed as ServerIdentity;
        }
      }
    } catch (error) {
      console.error('[ServerIdentity] Failed to load from disk:', error);
    }
    return null;
  }

  /**
   * Save identity to disk
   */
  private saveToDisk(): void {
    if (!this.identity) return;

    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.filePath, JSON.stringify(this.identity, null, 2));
    } catch (error) {
      console.error('[ServerIdentity] Failed to save to disk:', error);
    }
  }

  /**
   * Get connection info for mobile devices
   */
  getConnectionInfo(localUrl?: string): {
    serverId: string;
    serverName: string;
    relayCode: string;
    localUrl?: string;
  } | null {
    if (!this.identity) return null;

    return {
      serverId: this.identity.serverId,
      serverName: this.identity.serverName,
      relayCode: this.identity.relayCode,
      localUrl
    };
  }
}
