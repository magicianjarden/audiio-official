/**
 * mDNS/Bonjour Adapter
 *
 * Provides a unified interface for mDNS operations.
 * Uses different implementations based on platform availability.
 *
 * Supported backends:
 * - bonjour-service (Node.js, cross-platform)
 * - dns-sd (macOS native, fallback)
 */

export interface MdnsAdvertiseOptions {
  name: string;
  type: string;  // e.g., '_audiio._tcp'
  port: number;
  txt?: Record<string, string>;
}

export interface MdnsBrowseOptions {
  type: string;
  onServiceFound: (service: MdnsServiceInfo) => void;
  onServiceLost?: (name: string) => void;
}

export interface MdnsServiceInfo {
  name: string;
  type: string;
  host: string;
  port: number;
  addresses: string[];
  txt?: Record<string, string>;
}

export interface MdnsService {
  advertise(options: MdnsAdvertiseOptions): Promise<void>;
  stopAdvertising(): Promise<void>;
  browse(options: MdnsBrowseOptions): Promise<void>;
  stopBrowsing(): Promise<void>;
}

/**
 * Create an mDNS service using available backends
 */
export async function createMdnsService(): Promise<MdnsService | null> {
  // Try bonjour-service first (most compatible)
  try {
    const bonjourService = await tryBonjourService();
    if (bonjourService) {
      console.log('[mDNS] Using bonjour-service backend');
      return bonjourService;
    }
  } catch (err) {
    console.log('[mDNS] bonjour-service not available');
  }

  // Fallback: stub implementation (for development)
  console.log('[mDNS] No mDNS backend available, using stub');
  return createStubService();
}

/**
 * Try to use bonjour-service package
 */
async function tryBonjourService(): Promise<MdnsService | null> {
  try {
    // Dynamic import to avoid requiring the dependency if not installed
    const { Bonjour } = await import('bonjour-service');
    const bonjour = new Bonjour();

    let publishedService: any = null;
    let browser: any = null;

    return {
      async advertise(options) {
        publishedService = bonjour.publish({
          name: options.name,
          type: options.type.replace('_', '').replace('._tcp', ''),
          port: options.port,
          txt: options.txt
        });
      },

      async stopAdvertising() {
        if (publishedService) {
          publishedService.stop();
          publishedService = null;
        }
      },

      async browse(options) {
        const serviceType = options.type.replace('_', '').replace('._tcp', '');
        browser = bonjour.find({ type: serviceType }, (service: any) => {
          options.onServiceFound({
            name: service.name,
            type: service.type,
            host: service.host,
            port: service.port,
            addresses: service.addresses || [],
            txt: service.txt
          });
        });

        // Handle service removal
        if (options.onServiceLost) {
          browser.on('down', (service: any) => {
            options.onServiceLost!(service.name);
          });
        }
      },

      async stopBrowsing() {
        if (browser) {
          browser.stop();
          browser = null;
        }
      }
    };
  } catch (err) {
    return null;
  }
}

/**
 * Stub implementation for platforms without mDNS
 */
function createStubService(): MdnsService {
  return {
    async advertise(options) {
      console.log(`[mDNS Stub] Would advertise: ${options.name} on port ${options.port}`);
    },
    async stopAdvertising() {
      console.log('[mDNS Stub] Stopped advertising');
    },
    async browse(options) {
      console.log(`[mDNS Stub] Would browse for: ${options.type}`);
    },
    async stopBrowsing() {
      console.log('[mDNS Stub] Stopped browsing');
    }
  };
}
