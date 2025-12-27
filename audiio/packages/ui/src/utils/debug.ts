/**
 * Debug Logging Utility
 * Only logs in development mode to keep production console clean
 */

const isDev = process.env.NODE_ENV === 'development';

/**
 * Logs debug messages only in development mode
 * @param prefix - Section/component identifier (e.g., '[MoodPlaylist]')
 * @param message - Main message to log
 * @param data - Optional additional data to log
 */
export function debugLog(prefix: string, message: string, data?: unknown): void {
  if (isDev) {
    if (data !== undefined) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}

/**
 * Logs warning messages only in development mode
 */
export function debugWarn(prefix: string, message: string, data?: unknown): void {
  if (isDev) {
    if (data !== undefined) {
      console.warn(`${prefix} ${message}`, data);
    } else {
      console.warn(`${prefix} ${message}`);
    }
  }
}

/**
 * Logs error messages (always logs - errors should be visible in production)
 */
export function debugError(prefix: string, message: string, error?: unknown): void {
  if (error !== undefined) {
    console.error(`${prefix} ${message}`, error);
  } else {
    console.error(`${prefix} ${message}`);
  }
}

export default { debugLog, debugWarn, debugError };
