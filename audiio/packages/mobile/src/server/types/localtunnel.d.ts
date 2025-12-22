/**
 * Type declarations for localtunnel
 */

declare module 'localtunnel' {
  interface TunnelOptions {
    port: number;
    subdomain?: string;
    host?: string;
    allow_invalid_cert?: boolean;
    local_host?: string;
    local_https?: boolean;
    local_cert?: string;
    local_key?: string;
    local_ca?: string;
  }

  interface Tunnel {
    url: string;
    on(event: 'error', callback: (err: Error) => void): void;
    on(event: 'close', callback: () => void): void;
    close(): void;
  }

  function localtunnel(options: TunnelOptions | number): Promise<Tunnel>;

  export default localtunnel;
}
