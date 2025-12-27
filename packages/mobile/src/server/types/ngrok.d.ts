/**
 * Type declarations for ngrok
 */

declare module 'ngrok' {
  interface NgrokOptions {
    addr?: number | string;
    subdomain?: string;
    authtoken?: string;
    region?: string;
    proto?: 'http' | 'tcp' | 'tls';
    binPath?: (defaultPath: string) => string;
  }

  interface Ngrok {
    connect(options?: NgrokOptions | number | string): Promise<string>;
    disconnect(url?: string): Promise<void>;
    kill(): Promise<void>;
    getUrl(): string | null;
    authtoken(token: string): Promise<void>;
  }

  const ngrok: Ngrok;
  export default ngrok;
}
