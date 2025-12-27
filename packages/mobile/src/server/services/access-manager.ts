/**
 * Access Manager - Handles token generation and validation
 *
 * Generates secure random tokens for accessing the mobile portal.
 * Tokens are URL-safe and can be embedded in QR codes.
 * Supports one-time pairing codes for frictionless device registration.
 */

import { nanoid } from 'nanoid';
import * as QRCode from 'qrcode';
import type { AccessConfig } from '../../shared/types';

export interface PairingResult {
  success: boolean;
  deviceId?: string;
  deviceToken?: string;
  error?: string;
  requiresApproval?: boolean;
}

export interface PairingRequest {
  id: string;
  pairingCode: string;
  userAgent: string;
  deviceName: string;
  timestamp: number;
  resolve: (result: PairingResult) => void;
}

export class AccessManager {
  private currentAccess: AccessConfig | null = null;
  private validTokens = new Set<string>();
  private validPairingCodes = new Set<string>();
  private pendingPairingRequests = new Map<string, PairingRequest>();
  private onPairDevice: ((userAgent: string) => PairingResult) | null = null;
  private onApprovalRequest: ((request: { id: string; deviceName: string; userAgent: string }) => void) | null = null;
  private requireApproval = true; // Default to requiring desktop approval

  /**
   * Set callback for pairing devices (called by AuthManager)
   */
  setPairingCallback(callback: (userAgent: string) => PairingResult): void {
    this.onPairDevice = callback;
  }

  /**
   * Set callback for approval requests (called when device needs desktop approval)
   */
  setApprovalCallback(callback: (request: { id: string; deviceName: string; userAgent: string }) => void): void {
    this.onApprovalRequest = callback;
  }

  /**
   * Enable or disable desktop approval requirement
   */
  setRequireApproval(require: boolean): void {
    this.requireApproval = require;
  }

  /**
   * Generate a new access configuration with secure token, pairing code, and QR code
   */
  async generateAccess(localUrl: string): Promise<AccessConfig> {
    // Generate URL-safe token (32 chars)
    const token = nanoid(32);
    // Generate one-time pairing code (shorter, 16 chars for URL)
    const pairingCode = nanoid(16);

    // Store as valid
    this.validTokens.add(token);
    this.validPairingCodes.add(pairingCode);

    // Build access URL with token and pairing code
    const accessUrl = `${localUrl}?token=${token}&pair=${pairingCode}`;

    // Generate QR code for the access URL
    const qrCode = await this.generateQRCode(accessUrl);

    this.currentAccess = {
      token,
      localUrl: accessUrl,
      pairingCode,
      qrCode,
      createdAt: Date.now()
    };

    return this.currentAccess;
  }

  /**
   * Validate and consume a pairing code (one-time use)
   * Returns device token if successful, or initiates approval flow
   */
  consumePairingCode(pairingCode: string, userAgent: string): PairingResult | Promise<PairingResult> {
    if (!pairingCode || !this.validPairingCodes.has(pairingCode)) {
      return { success: false, error: 'Invalid or expired pairing code' };
    }

    // If approval is required and callback is set, initiate approval flow
    if (this.requireApproval && this.onApprovalRequest) {
      const requestId = nanoid(12);
      const deviceName = this.getDeviceNameFromUA(userAgent);

      // Return a promise that will be resolved when desktop approves/denies
      return new Promise<PairingResult>((resolve) => {
        // Store the pending request
        const request: PairingRequest = {
          id: requestId,
          pairingCode,
          userAgent,
          deviceName,
          timestamp: Date.now(),
          resolve
        };
        this.pendingPairingRequests.set(requestId, request);

        // Notify desktop about the approval request
        this.onApprovalRequest!({
          id: requestId,
          deviceName,
          userAgent
        });

        // Timeout after 60 seconds
        setTimeout(() => {
          if (this.pendingPairingRequests.has(requestId)) {
            this.pendingPairingRequests.delete(requestId);
            resolve({ success: false, error: 'Approval request timed out' });
          }
        }, 60000);
      });
    }

    // No approval required - pair immediately
    return this.completePairing(pairingCode, userAgent);
  }

  /**
   * Complete the pairing process (called directly or after approval)
   */
  private completePairing(pairingCode: string, userAgent: string): PairingResult {
    // Consume the pairing code (one-time use)
    this.validPairingCodes.delete(pairingCode);

    // Create device via callback if available
    if (this.onPairDevice) {
      const result = this.onPairDevice(userAgent);
      if (result.success) {
        console.log(`[AccessManager] Device paired successfully via QR code`);
      }
      return result;
    }

    // Fallback: no device manager, just grant access
    return { success: true };
  }

  /**
   * Approve a pending pairing request (called from desktop)
   */
  approvePairingRequest(requestId: string): boolean {
    const request = this.pendingPairingRequests.get(requestId);
    if (!request) {
      console.log(`[AccessManager] Pairing request ${requestId} not found`);
      return false;
    }

    this.pendingPairingRequests.delete(requestId);
    const result = this.completePairing(request.pairingCode, request.userAgent);
    request.resolve(result);
    console.log(`[AccessManager] Pairing request ${requestId} approved`);
    return true;
  }

  /**
   * Deny a pending pairing request (called from desktop)
   */
  denyPairingRequest(requestId: string): boolean {
    const request = this.pendingPairingRequests.get(requestId);
    if (!request) {
      console.log(`[AccessManager] Pairing request ${requestId} not found`);
      return false;
    }

    this.pendingPairingRequests.delete(requestId);
    // Don't consume the pairing code so user can try again
    request.resolve({ success: false, error: 'Connection denied by desktop' });
    console.log(`[AccessManager] Pairing request ${requestId} denied`);
    return true;
  }

  /**
   * Get pending pairing requests (for UI display)
   */
  getPendingRequests(): Array<{ id: string; deviceName: string; timestamp: number }> {
    return Array.from(this.pendingPairingRequests.values()).map(r => ({
      id: r.id,
      deviceName: r.deviceName,
      timestamp: r.timestamp
    }));
  }

  /**
   * Extract device name from user agent
   */
  private getDeviceNameFromUA(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    if (ua.includes('iphone')) return 'iPhone';
    if (ua.includes('ipad')) return 'iPad';
    if (ua.includes('android')) {
      if (ua.includes('mobile')) return 'Android Phone';
      return 'Android Tablet';
    }
    if (ua.includes('mac')) return 'Mac';
    if (ua.includes('windows')) return 'Windows PC';
    if (ua.includes('linux')) return 'Linux Device';
    return 'Unknown Device';
  }

  /**
   * Check if a pairing code is valid (without consuming it)
   */
  isPairingCodeValid(pairingCode: string): boolean {
    return this.validPairingCodes.has(pairingCode);
  }

  /**
   * Regenerate pairing code for current access (allows new devices)
   */
  async regeneratePairingCode(): Promise<string | null> {
    if (!this.currentAccess) return null;

    // Generate new pairing code
    const pairingCode = nanoid(16);
    this.validPairingCodes.add(pairingCode);
    this.currentAccess.pairingCode = pairingCode;

    // Update URL with new pairing code
    const baseLocalUrl = this.currentAccess.localUrl.split('?')[0] || '';
    this.currentAccess.localUrl = `${baseLocalUrl}?token=${this.currentAccess.token}&pair=${pairingCode}`;

    // Regenerate QR code
    await this.updateQRCode();

    console.log('[AccessManager] Pairing code regenerated');
    return pairingCode;
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
   * Regenerate QR code for current access
   */
  async updateQRCode(): Promise<void> {
    if (!this.currentAccess) return;
    this.currentAccess.qrCode = await this.generateQRCode(this.currentAccess.localUrl);
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
  async rotateAccess(localUrl: string): Promise<AccessConfig> {
    this.validTokens.clear();
    this.validPairingCodes.clear();
    return this.generateAccess(localUrl);
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
