/**
 * Audiio Local Network Discovery Service
 *
 * Uses mDNS/Bonjour to advertise the server on the local network.
 * Clients can discover servers without knowing the IP address.
 *
 * Service type: _audiio._tcp
 */

import { createMdnsService, MdnsService } from './mdns-adapter';

export interface DiscoveryConfig {
  port: number;
  serverId: string;
  serverName: string;
  serverPublicKey?: string;
}

export interface DiscoveredServer {
  serverId: string;
  serverName: string;
  host: string;
  port: number;
  addresses: string[];
  serverPublicKey?: string;
  discoveredAt: number;
}

export class DiscoveryService {
  private mdns: MdnsService | null = null;
  private config: DiscoveryConfig;
  private isAdvertising = false;
  private discoveredServers = new Map<string, DiscoveredServer>();
  private onServerFound?: (server: DiscoveredServer) => void;
  private onServerLost?: (serverId: string) => void;

  constructor(config: DiscoveryConfig) {
    this.config = config;
  }

  /**
   * Start advertising this server on the local network
   */
  async startAdvertising(): Promise<void> {
    if (this.isAdvertising) {
      console.log('[Discovery] Already advertising');
      return;
    }

    try {
      this.mdns = await createMdnsService();

      if (!this.mdns) {
        console.log('[Discovery] mDNS not available on this platform');
        return;
      }

      await this.mdns.advertise({
        name: this.config.serverName,
        type: '_audiio._tcp',
        port: this.config.port,
        txt: {
          serverId: this.config.serverId,
          version: '2',
          // Don't include public key in TXT (too long), client fetches from /api/auth/identity
        }
      });

      this.isAdvertising = true;
      console.log(`[Discovery] Advertising: ${this.config.serverName} (${this.config.serverId}) on port ${this.config.port}`);
    } catch (err) {
      console.error('[Discovery] Failed to start advertising:', err);
    }
  }

  /**
   * Stop advertising
   */
  async stopAdvertising(): Promise<void> {
    if (!this.isAdvertising || !this.mdns) {
      return;
    }

    try {
      await this.mdns.stopAdvertising();
      this.isAdvertising = false;
      console.log('[Discovery] Stopped advertising');
    } catch (err) {
      console.error('[Discovery] Failed to stop advertising:', err);
    }
  }

  /**
   * Start browsing for other Audiio servers on the network
   */
  async startBrowsing(callbacks?: {
    onServerFound?: (server: DiscoveredServer) => void;
    onServerLost?: (serverId: string) => void;
  }): Promise<void> {
    this.onServerFound = callbacks?.onServerFound;
    this.onServerLost = callbacks?.onServerLost;

    try {
      if (!this.mdns) {
        this.mdns = await createMdnsService();
      }

      if (!this.mdns) {
        console.log('[Discovery] mDNS not available');
        return;
      }

      await this.mdns.browse({
        type: '_audiio._tcp',
        onServiceFound: (service) => {
          const server: DiscoveredServer = {
            serverId: service.txt?.serverId || 'unknown',
            serverName: service.name,
            host: service.host,
            port: service.port,
            addresses: service.addresses || [],
            serverPublicKey: service.txt?.publicKey,
            discoveredAt: Date.now()
          };

          // Don't discover ourselves
          if (server.serverId === this.config.serverId) {
            return;
          }

          this.discoveredServers.set(server.serverId, server);
          console.log(`[Discovery] Found server: ${server.serverName} (${server.serverId}) at ${server.addresses[0]}:${server.port}`);
          this.onServerFound?.(server);
        },
        onServiceLost: (name) => {
          // Find and remove by name
          for (const [serverId, server] of this.discoveredServers) {
            if (server.serverName === name) {
              this.discoveredServers.delete(serverId);
              console.log(`[Discovery] Lost server: ${name}`);
              this.onServerLost?.(serverId);
              break;
            }
          }
        }
      });

      console.log('[Discovery] Started browsing for servers');
    } catch (err) {
      console.error('[Discovery] Failed to start browsing:', err);
    }
  }

  /**
   * Stop browsing
   */
  async stopBrowsing(): Promise<void> {
    if (this.mdns) {
      await this.mdns.stopBrowsing();
      console.log('[Discovery] Stopped browsing');
    }
  }

  /**
   * Get list of discovered servers
   */
  getDiscoveredServers(): DiscoveredServer[] {
    return Array.from(this.discoveredServers.values());
  }

  /**
   * Get a specific discovered server
   */
  getServer(serverId: string): DiscoveredServer | undefined {
    return this.discoveredServers.get(serverId);
  }

  /**
   * Check if advertising
   */
  isActive(): boolean {
    return this.isAdvertising;
  }

  /**
   * Update server name (re-advertise)
   */
  async updateServerName(newName: string): Promise<void> {
    this.config.serverName = newName;
    if (this.isAdvertising) {
      await this.stopAdvertising();
      await this.startAdvertising();
    }
  }

  /**
   * Cleanup
   */
  async close(): Promise<void> {
    await this.stopAdvertising();
    await this.stopBrowsing();
    this.mdns = null;
  }
}

// Singleton for convenience
let discoveryServiceInstance: DiscoveryService | null = null;

export function getDiscoveryService(): DiscoveryService | null {
  return discoveryServiceInstance;
}

export function initDiscoveryService(config: DiscoveryConfig): DiscoveryService {
  if (discoveryServiceInstance) {
    return discoveryServiceInstance;
  }
  discoveryServiceInstance = new DiscoveryService(config);
  return discoveryServiceInstance;
}
