/**
 * Access Manager - Handles token generation and validation
 *
 * Generates secure random tokens for accessing the mobile portal.
 * Tokens are URL-safe and can be embedded in QR codes.
 */

import { nanoid } from 'nanoid';
import * as QRCode from 'qrcode';
import type { AccessConfig } from '../../shared/types';

export class AccessManager {
  private currentAccess: AccessConfig | null = null;
  private validTokens = new Set<string>();

  /**
   * Generate a new access configuration with secure token and QR code
   */
  async generateAccess(localUrl: string, tunnelUrl?: string, tunnelPassword?: string): Promise<AccessConfig> {
    // Generate URL-safe token (32 chars)
    const token = nanoid(32);

    // Store as valid token
    this.validTokens.add(token);

    // Build access URLs with token
    const localAccessUrl = `${localUrl}?token=${token}`;
    // Include tunnel password in URL for easy bypass (tp = tunnel password)
    const tunnelAccessUrl = tunnelUrl
      ? `${tunnelUrl}?token=${token}${tunnelPassword ? `&tp=${encodeURIComponent(tunnelPassword)}` : ''}`
      : undefined;

    // Generate QR code for the primary access URL (prefer tunnel if available)
    const primaryUrl = tunnelAccessUrl || localAccessUrl;
    const qrCode = await this.generateQRCode(primaryUrl);

    this.currentAccess = {
      token,
      localUrl: localAccessUrl,
      tunnelUrl: tunnelAccessUrl,
      tunnelPassword,
      qrCode,
      createdAt: Date.now()
    };

    return this.currentAccess;
  }

  /**
   * Generate QR code as data URL
   */
  private async generateQRCode(url: string): Promise<string> {
    try {
      return await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: {
          dark: '#ffffff',
          light: '#00000000' // Transparent background
        },
        errorCorrectionLevel: 'M'
      });
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      return '';
    }
  }

  /**
   * Regenerate QR code for current access (e.g., when switching to tunnel)
   */
  async updateQRCode(): Promise<void> {
    if (!this.currentAccess) return;

    const primaryUrl = this.currentAccess.tunnelUrl || this.currentAccess.localUrl;
    this.currentAccess.qrCode = await this.generateQRCode(primaryUrl);
  }

  /**
   * Validate an access token
   */
  validateToken(token: string): boolean {
    if (!token) return false;

    // Check if token is in valid set
    if (this.validTokens.has(token)) {
      // Check expiry if set
      if (this.currentAccess?.expiresAt) {
        if (Date.now() > this.currentAccess.expiresAt) {
          this.revokeToken(token);
          return false;
        }
      }
      return true;
    }

    return false;
  }

  /**
   * Revoke a specific token
   */
  revokeToken(token: string): void {
    this.validTokens.delete(token);
    if (this.currentAccess?.token === token) {
      this.currentAccess = null;
    }
  }

  /**
   * Revoke all tokens and generate new access
   */
  async rotateAccess(localUrl: string, tunnelUrl?: string, tunnelPassword?: string): Promise<AccessConfig> {
    this.validTokens.clear();
    return this.generateAccess(localUrl, tunnelUrl, tunnelPassword);
  }

  /**
   * Get current access config
   */
  getCurrentAccess(): AccessConfig | null {
    return this.currentAccess;
  }

  /**
   * Set expiry for current access
   */
  setExpiry(expiresInMs: number): void {
    if (this.currentAccess) {
      this.currentAccess.expiresAt = Date.now() + expiresInMs;
    }
  }

  /**
   * Check if any valid access exists
   */
  hasValidAccess(): boolean {
    return this.validTokens.size > 0;
  }
}
