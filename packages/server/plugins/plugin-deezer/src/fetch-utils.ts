/**
 * Protected Fetch Utilities for Deezer Plugin
 *
 * Implements rate limiting, circuit breaker, request deduplication,
 * exponential backoff, and User-Agent rotation to prevent API blocks.
 */

// Circuit breaker states
type CircuitState = 'closed' | 'open' | 'half-open';

// Realistic browser User-Agent strings
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
];

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests: number;
}

interface RateLimiterConfig {
  requestsPerSecond: number;
}

class DeezerFetchClient {
  // Circuit breaker state
  private circuitState: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private halfOpenSuccesses = 0;
  private readonly circuitConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    halfOpenRequests: 2,
  };

  // Rate limiter state
  private readonly rateLimitConfig: RateLimiterConfig = {
    requestsPerSecond: 25,
  };
  private requestQueue: Array<() => void> = [];
  private activeRequests = 0;
  private lastRequestTime = 0;
  private requestInterval: ReturnType<typeof setInterval> | null = null;

  // Request deduplication
  private inFlightRequests = new Map<string, Promise<Response>>();

  // Current User-Agent
  private userAgent: string;

  // Proxy URL for bypassing IP blocks
  private proxyUrl: string | null = null;

  constructor() {
    this.userAgent = this.getRandomUserAgent();
    this.startRateLimiter();
  }

  private getRandomUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  private rotateUserAgent(): void {
    this.userAgent = this.getRandomUserAgent();
  }

  private startRateLimiter(): void {
    if (this.requestInterval) return;

    const intervalMs = 1000 / this.rateLimitConfig.requestsPerSecond;
    this.requestInterval = setInterval(() => {
      if (this.requestQueue.length > 0 && this.activeRequests < this.rateLimitConfig.requestsPerSecond) {
        const next = this.requestQueue.shift();
        if (next) next();
      }
    }, intervalMs);
  }

  private isCircuitOpen(): boolean {
    if (this.circuitState === 'closed') return false;

    if (this.circuitState === 'open') {
      if (Date.now() - this.lastFailureTime >= this.circuitConfig.resetTimeout) {
        this.circuitState = 'half-open';
        this.halfOpenSuccesses = 0;
        console.log('[Deezer] Circuit breaker transitioning to half-open');
        return false;
      }
      return true;
    }

    return false;
  }

  private recordSuccess(): void {
    if (this.circuitState === 'half-open') {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.circuitConfig.halfOpenRequests) {
        this.circuitState = 'closed';
        this.failureCount = 0;
        console.log('[Deezer] Circuit breaker closed - recovered');
      }
    } else if (this.circuitState === 'closed') {
      this.failureCount = 0;
    }
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.rotateUserAgent();

    if (this.circuitState === 'half-open') {
      this.circuitState = 'open';
      console.warn('[Deezer] Circuit breaker reopened');
    } else if (this.failureCount >= this.circuitConfig.failureThreshold) {
      this.circuitState = 'open';
      console.warn(`[Deezer] Circuit breaker opened after ${this.failureCount} failures`);
    }
  }

  private calculateBackoff(attempt: number): number {
    const baseMs = 1000;
    const exponentialDelay = baseMs * Math.pow(2, attempt - 1);
    const jitter = exponentialDelay * Math.random() * 0.5;
    return Math.min(exponentialDelay + jitter, 30000);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Build the request URL, applying proxy if configured
   */
  private buildRequestUrl(url: string): string {
    if (this.proxyUrl) {
      // corsproxy.io format: https://corsproxy.io/?url
      return `${this.proxyUrl}${encodeURIComponent(url)}`;
    }
    return url;
  }

  /**
   * Get circuit breaker status for monitoring
   */
  getCircuitStatus(): { state: CircuitState; failures: number; canRetryAt: number | null } {
    return {
      state: this.circuitState,
      failures: this.failureCount,
      canRetryAt: this.circuitState === 'open'
        ? this.lastFailureTime + this.circuitConfig.resetTimeout
        : null,
    };
  }

  /**
   * Protected fetch with all safeguards
   */
  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    // Check circuit breaker
    if (this.isCircuitOpen()) {
      const status = this.getCircuitStatus();
      const retryIn = status.canRetryAt ? Math.ceil((status.canRetryAt - Date.now()) / 1000) : 0;
      throw new Error(`Circuit breaker open. Too many failures. Retry in ${retryIn}s`);
    }

    // Request deduplication
    const cacheKey = `${url}:${JSON.stringify(options)}`;
    const existingRequest = this.inFlightRequests.get(cacheKey);
    if (existingRequest) {
      return existingRequest.then(r => r.clone());
    }

    // Create rate-limited request
    const requestPromise = new Promise<Response>((resolve, reject) => {
      const executeRequest = async () => {
        this.activeRequests++;
        let lastError: Error | null = null;

        try {
          // Retry with exponential backoff
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              const requestUrl = this.buildRequestUrl(url);
              const response = await fetch(requestUrl, {
                ...options,
                headers: {
                  'User-Agent': this.userAgent,
                  'Accept': 'application/json',
                  'Accept-Language': 'en-US,en;q=0.9',
                  ...options.headers,
                },
              });

              if (!response.ok) {
                if (response.status === 429) {
                  this.recordFailure();
                  lastError = new Error(`Rate limited by Deezer`);
                  if (attempt < 3) {
                    await this.sleep(this.calculateBackoff(attempt));
                    continue;
                  }
                } else if (response.status === 403) {
                  this.recordFailure();
                  throw new Error(`Access denied by Deezer: likely IP blocked`);
                } else if (response.status === 503) {
                  this.recordFailure();
                  lastError = new Error(`Service unavailable: ${response.status}`);
                  if (attempt < 3) {
                    await this.sleep(this.calculateBackoff(attempt));
                    continue;
                  }
                } else if (response.status >= 500) {
                  lastError = new Error(`Server error: ${response.status}`);
                  if (attempt < 3) {
                    await this.sleep(this.calculateBackoff(attempt));
                    continue;
                  }
                }
                throw lastError || new Error(`HTTP ${response.status}`);
              }

              this.recordSuccess();
              return response;
            } catch (err) {
              lastError = err instanceof Error ? err : new Error(String(err));
              if (attempt < 3 && !lastError.message.includes('Access denied')) {
                await this.sleep(this.calculateBackoff(attempt));
              }
            }
          }

          throw lastError || new Error('Request failed after retries');
        } finally {
          this.activeRequests--;
        }
      };

      // Queue the request for rate limiting
      this.requestQueue.push(() => {
        executeRequest().then(resolve).catch(reject);
      });

      // Process queue immediately if under limit
      if (this.activeRequests < this.rateLimitConfig.requestsPerSecond) {
        const next = this.requestQueue.shift();
        if (next) next();
      }
    });

    // Store for deduplication
    this.inFlightRequests.set(cacheKey, requestPromise);
    requestPromise.finally(() => {
      this.inFlightRequests.delete(cacheKey);
    });

    return requestPromise;
  }

  /**
   * Fetch and parse JSON with all safeguards
   */
  async fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await this.fetch(url, options);
    return response.json() as Promise<T>;
  }

  /**
   * Set proxy URL for requests
   */
  setProxyUrl(url: string | null): void {
    this.proxyUrl = url;
    console.log(`[Deezer] Proxy ${url ? 'enabled: ' + url : 'disabled'}`);
  }

  /**
   * Reset circuit breaker (for testing/recovery)
   */
  resetCircuitBreaker(): void {
    this.circuitState = 'closed';
    this.failureCount = 0;
    this.halfOpenSuccesses = 0;
    console.log('[Deezer] Circuit breaker manually reset');
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.requestInterval) {
      clearInterval(this.requestInterval);
      this.requestInterval = null;
    }
    this.requestQueue = [];
    this.inFlightRequests.clear();
  }
}

// Singleton instance
export const deezerFetch = new DeezerFetchClient();

// Enable proxy by default to avoid IP blocks
// Using corsproxy.io as a public CORS proxy
deezerFetch.setProxyUrl('https://corsproxy.io/?');

// Convenience exports
export const protectedFetch = (url: string, options?: RequestInit) => deezerFetch.fetch(url, options);
export const protectedFetchJson = <T>(url: string, options?: RequestInit) => deezerFetch.fetchJson<T>(url, options);
export const getCircuitStatus = () => deezerFetch.getCircuitStatus();
export const resetCircuitBreaker = () => deezerFetch.resetCircuitBreaker();
export const setProxyUrl = (url: string | null) => deezerFetch.setProxyUrl(url);
