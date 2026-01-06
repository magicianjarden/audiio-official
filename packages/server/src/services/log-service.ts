/**
 * Structured Logging Service
 * Provides centralized logging with memory buffer for admin UI streaming
 */

import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  service: string;
  message: string;
  data?: Record<string, unknown>;
}

class LogService extends EventEmitter {
  private buffer: LogEntry[] = [];
  private maxBufferSize = 1000;

  /**
   * Log a message with structured data
   */
  log(level: LogLevel, service: string, message: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      id: nanoid(12),
      timestamp: Date.now(),
      level,
      service,
      message,
      data
    };

    // Add to circular buffer
    this.buffer.push(entry);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    // Emit for WebSocket subscribers
    this.emit('log', entry);

    // Also output to console for file/stdout logging
    const prefix = `[${service}]`;
    const logFn = level === 'error' ? console.error :
                  level === 'warn' ? console.warn : console.log;

    if (data && Object.keys(data).length > 0) {
      logFn(prefix, message, data);
    } else {
      logFn(prefix, message);
    }
  }

  /**
   * Get recent log entries with optional filtering
   */
  getRecent(count: number = 100, filter?: { level?: LogLevel; service?: string }): LogEntry[] {
    let entries = this.buffer.slice(-Math.min(count, this.maxBufferSize));

    if (filter?.level) {
      entries = entries.filter(e => e.level === filter.level);
    }
    if (filter?.service) {
      const serviceLower = filter.service.toLowerCase();
      entries = entries.filter(e => e.service.toLowerCase().includes(serviceLower));
    }

    return entries;
  }

  /**
   * Clear all buffered logs
   */
  clear(): void {
    this.buffer = [];
    this.emit('clear');
  }

  /**
   * Get buffer statistics
   */
  getStats(): { count: number; maxSize: number; oldestTimestamp?: number } {
    return {
      count: this.buffer.length,
      maxSize: this.maxBufferSize,
      oldestTimestamp: this.buffer[0]?.timestamp
    };
  }
}

// Singleton instance
export const logService = new LogService();

// Convenience helper functions for services to use
export const log = {
  debug: (service: string, message: string, data?: Record<string, unknown>) =>
    logService.log('debug', service, message, data),

  info: (service: string, message: string, data?: Record<string, unknown>) =>
    logService.log('info', service, message, data),

  warn: (service: string, message: string, data?: Record<string, unknown>) =>
    logService.log('warn', service, message, data),

  error: (service: string, message: string, data?: Record<string, unknown>) =>
    logService.log('error', service, message, data),
};
