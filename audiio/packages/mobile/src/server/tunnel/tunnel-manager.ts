/**
 * Tunnel Manager - Handles secure remote access
 *
 * Provides tunneling options for accessing the mobile portal
 * from outside the local network. Supports multiple providers.
 */

type TunnelProvider = 'localtunnel' | 'cloudflare' | 'ngrok';

interface TunnelInstance {
  url: string;
  password?: string;
  close: () => Promise<void>;
}

interface TunnelInfo {
  url: string;
  password?: string;
}

export class TunnelManager {
  private tunnel: TunnelInstance | null = null;
  private provider: TunnelProvider;

  constructor(provider: TunnelProvider = 'localtunnel') {
    this.provider = provider;
  }

  /**
   * Start a tunnel to expose the local server
   */
  async start(port: number, subdomain?: string): Promise<TunnelInfo> {
    if (this.tunnel) {
      throw new Error('Tunnel already running');
    }

    switch (this.provider) {
      case 'localtunnel':
        return this.startLocalTunnel(port, subdomain);
      case 'cloudflare':
        return this.startCloudflareTunnel(port);
      case 'ngrok':
        return this.startNgrokTunnel(port, subdomain);
      default:
        throw new Error(`Unknown tunnel provider: ${this.provider}`);
    }
  }

  /**
   * Stop the active tunnel
   */
  async stop(): Promise<void> {
    if (this.tunnel) {
      await this.tunnel.close();
      this.tunnel = null;
    }
  }

  /**
   * Get current tunnel URL
   */
  getUrl(): string | null {
    return this.tunnel?.url || null;
  }

  /**
   * Get tunnel password (for localtunnel bypass)
   */
  getPassword(): string | null {
    return this.tunnel?.password || null;
  }

  /**
   * Check if tunnel is active
   */
  isActive(): boolean {
    return this.tunnel !== null;
  }

  /**
   * Start localtunnel (free, no account required)
   */
  private async startLocalTunnel(port: number, subdomain?: string): Promise<TunnelInfo> {
    try {
      const localtunnel = await import('localtunnel');
      const tunnel = await localtunnel.default({
        port,
        subdomain,
        allow_invalid_cert: true
      });

      // Fetch the tunnel bypass password (user's IP address)
      let password: string | undefined;
      try {
        console.log('[Tunnel] Fetching bypass password from loca.lt...');
        const response = await fetch('https://loca.lt/mytunnelpassword');
        console.log('[Tunnel] Password fetch response status:', response.status);
        if (response.ok) {
          password = (await response.text()).trim();
          console.log(`[Tunnel] Bypass password retrieved: "${password}"`);
        } else {
          console.log('[Tunnel] Password fetch failed with status:', response.status);
        }
      } catch (fetchError) {
        console.log('[Tunnel] Could not fetch bypass password:', fetchError);
      }

      this.tunnel = {
        url: tunnel.url,
        password,
        close: async () => tunnel.close()
      };

      // Handle tunnel errors
      tunnel.on('error', (err: Error) => {
        console.error('Tunnel error:', err);
      });

      tunnel.on('close', () => {
        this.tunnel = null;
      });

      return { url: tunnel.url, password };
    } catch (error) {
      throw new Error(`Failed to start localtunnel: ${error}`);
    }
  }

  /**
   * Start Cloudflare Tunnel (requires cloudflared CLI)
   * More stable than localtunnel, but requires setup
   */
  private async startCloudflareTunnel(port: number): Promise<TunnelInfo> {
    // Cloudflare Tunnel requires the cloudflared CLI to be installed
    const { spawn } = await import('child_process');

    return new Promise((resolve, reject) => {
      const cloudflared = spawn('cloudflared', [
        'tunnel',
        '--url',
        `http://localhost:${port}`
      ]);

      let url = '';

      cloudflared.stderr.on('data', (data: Buffer) => {
        const output = data.toString();
        // Cloudflare outputs the URL to stderr
        const match = output.match(/https:\/\/[^\s]+\.trycloudflare\.com/);
        if (match && !url) {
          url = match[0];
          this.tunnel = {
            url,
            close: async () => {
              cloudflared.kill();
            }
          };
          resolve({ url });
        }
      });

      cloudflared.on('error', (err) => {
        reject(new Error(`Cloudflare tunnel failed: ${err.message}. Make sure cloudflared is installed.`));
      });

      cloudflared.on('exit', (code) => {
        if (!url) {
          reject(new Error(`Cloudflare tunnel exited with code ${code}`));
        }
        this.tunnel = null;
      });

      // Timeout if URL not received
      setTimeout(() => {
        if (!url) {
          cloudflared.kill();
          reject(new Error('Cloudflare tunnel timeout - URL not received'));
        }
      }, 30000);
    });
  }

  /**
   * Start ngrok tunnel (requires ngrok account/authtoken)
   */
  private async startNgrokTunnel(port: number, subdomain?: string): Promise<TunnelInfo> {
    // ngrok requires an authtoken for custom subdomains
    // Free tier has limitations

    try {
      const ngrok = await import('ngrok');

      const url = await ngrok.default.connect({
        addr: port,
        subdomain,
        // authtoken should be set via NGROK_AUTHTOKEN env or ngrok config
      });

      this.tunnel = {
        url,
        close: async () => {
          await ngrok.default.disconnect(url);
          await ngrok.default.kill();
        }
      };

      return { url };
    } catch (error) {
      throw new Error(`Failed to start ngrok: ${error}. Make sure ngrok is installed and configured.`);
    }
  }
}
