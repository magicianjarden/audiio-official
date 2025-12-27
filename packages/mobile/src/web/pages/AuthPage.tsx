/**
 * Auth Page - Enhanced authentication for mobile portal
 *
 * Supports:
 * - P2P Remote Access (enter code, works from anywhere!)
 * - One-time QR pairing (no password needed)
 * - Passphrase/password login (fallback)
 * - Device token authentication (remember device)
 * - Device naming
 */

import React, { useState, useEffect } from 'react';
import { useAuthStore, tunnelFetch } from '../stores/auth-store';
import { useP2PStore, isP2PSupported } from '../stores/p2p-store';
import { KeyIcon, QrCodeIcon, DeviceIcon, SpinnerIcon, CheckIcon, WifiIcon } from '@audiio/icons';
import styles from './AuthPage.module.css';

type AuthMode = 'p2p' | 'passphrase' | 'device-token' | 'pairing';

export function AuthPage() {
  const [authMode, setAuthMode] = useState<AuthMode>('p2p');
  const [passphrase, setPassphrase] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [deviceToken, setDeviceToken] = useState('');
  const [p2pCode, setP2PCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPairingMode, setIsPairingMode] = useState(false);

  const { setToken, validateToken, pairWithCode, error: storeError, isValidating, isPairing } = useAuthStore();
  const { status: p2pStatus, error: p2pError, connect: p2pConnect, disconnect: p2pDisconnect, authToken: p2pAuthToken } = useP2PStore();

  // When P2P connects and provides an auth token, authenticate automatically
  useEffect(() => {
    if (p2pStatus === 'connected' && p2pAuthToken) {
      console.log('[Auth] P2P connected with auth token, authenticating...');
      setToken(p2pAuthToken);
      validateToken();
    }
  }, [p2pStatus, p2pAuthToken, setToken, validateToken]);

  // Check for pairing code in URL (from QR scan on local network)
  // Also check for P2P code in hash (from remote QR scan)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pairingCode = urlParams.get('pair');

    // If we have a pairing code, try to auto-pair immediately
    if (pairingCode) {
      setIsPairingMode(true);
      setAuthMode('pairing');
      handleAutopairing(pairingCode);
      return;
    }

    // Check for P2P code in hash (e.g., #p2p=SWIFT-EAGLE-42)
    const hash = window.location.hash;
    if (hash.startsWith('#p2p=')) {
      const code = hash.substring(5); // Remove '#p2p='
      if (code) {
        console.log('[Auth] Found P2P code in URL hash:', code);
        setP2PCode(code);
        setAuthMode('p2p');
        // Auto-connect after a short delay to ensure component is mounted
        setTimeout(() => {
          const name = deviceName.trim() || getDefaultDeviceName();
          p2pConnect(code, name);
          // Clear the hash to prevent re-connect on refresh
          window.history.replaceState({}, '', window.location.pathname + window.location.search);
        }, 500);
      }
    }
  }, []);

  // Handle auto-pairing with QR code
  const handleAutopairing = async (pairingCode: string) => {
    console.log('[Auth] Auto-pairing with code...');
    const success = await pairWithCode(pairingCode);

    if (success) {
      console.log('[Auth] Pairing successful!');
      // Remove pairing code from URL to prevent re-use on refresh
      const url = new URL(window.location.href);
      url.searchParams.delete('pair');
      window.history.replaceState({}, '', url.toString());
    } else {
      // Pairing failed - fall back to password mode
      setIsPairingMode(false);
      setAuthMode('passphrase');
      setLocalError('QR code expired. Please enter the passphrase or scan a new QR code.');
    }
  };

  // Check for saved device token on mount (only if not pairing)
  useEffect(() => {
    if (isPairingMode) return;

    const savedToken = localStorage.getItem('audiio-device-token');
    if (savedToken) {
      setDeviceToken(savedToken);
      setAuthMode('device-token');
      // Try to auto-authenticate with saved token
      handleDeviceTokenAuth(savedToken);
    }

    // Generate default device name
    const defaultName = getDefaultDeviceName();
    setDeviceName(defaultName);
  }, [isPairingMode]);

  const handlePassphraseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) return;

    setLocalError(null);
    setIsLoading(true);

    try {
      const response = await tunnelFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: passphrase.trim(),
          deviceName: deviceName.trim() || 'Mobile Device',
          rememberDevice
        })
      });

      const data = await response.json();

      if (data.success) {
        // If we got a device token, save it
        if (data.deviceToken) {
          localStorage.setItem('audiio-device-token', data.deviceToken);
          localStorage.setItem('audiio-device-id', data.deviceId);
        }

        // Use the passphrase as the auth token for the session
        setToken(passphrase.trim());
        await validateToken();
      } else {
        setLocalError(data.error || 'Invalid passphrase');
      }
    } catch (err) {
      // Fallback to legacy token auth
      setToken(passphrase.trim());
      await validateToken();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeviceTokenAuth = async (token?: string) => {
    const tokenToUse = token || deviceToken;
    if (!tokenToUse.trim()) return;

    setLocalError(null);
    setIsLoading(true);

    try {
      const response = await tunnelFetch('/api/auth/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceToken: tokenToUse.trim() })
      });

      const data = await response.json();

      if (data.success) {
        // Extract just the token part for session auth
        const parts = tokenToUse.split(':');
        if (parts.length === 2) {
          setToken(parts[1]);
          await validateToken();
        }
      } else {
        // Device token invalid, clear it
        localStorage.removeItem('audiio-device-token');
        localStorage.removeItem('audiio-device-id');
        setLocalError('Device token expired. Please log in again.');
        setAuthMode('passphrase');
      }
    } catch (err) {
      setLocalError('Connection failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgetDevice = () => {
    localStorage.removeItem('audiio-device-token');
    localStorage.removeItem('audiio-device-id');
    setDeviceToken('');
    setAuthMode('passphrase');
  };

  const handleP2PConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!p2pCode.trim()) return;

    setLocalError(null);
    const name = deviceName.trim() || getDefaultDeviceName();
    await p2pConnect(p2pCode.trim(), name);
  };

  const error = localError || storeError || p2pError;
  const loading = isLoading || isValidating || p2pStatus === 'connecting';

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Logo */}
        <div className={styles.logo}>
          <AudiioLogo />
        </div>

        <h1 className={styles.title}>Audiio</h1>
        <p className={styles.subtitle}>
          Stream your music anywhere
        </p>

        {/* Auth Mode Tabs */}
        {!deviceToken && authMode !== 'pairing' && (
          <div className={styles.tabs}>
            {isP2PSupported() && (
              <button
                type="button"
                className={`${styles.tab} ${authMode === 'p2p' ? styles.activeTab : ''}`}
                onClick={() => { setAuthMode('p2p'); setLocalError(null); }}
              >
                <WifiIcon size={16} />
                Remote
              </button>
            )}
            <button
              type="button"
              className={`${styles.tab} ${authMode === 'passphrase' ? styles.activeTab : ''}`}
              onClick={() => { setAuthMode('passphrase'); setLocalError(null); }}
            >
              <KeyIcon size={16} />
              Local
            </button>
          </div>
        )}

        {/* P2P Remote Access */}
        {authMode === 'p2p' && !deviceToken && p2pStatus !== 'connected' && (
          <form onSubmit={handleP2PConnect} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="p2pCode" className={styles.label}>
                Enter connection code
              </label>
              <input
                id="p2pCode"
                type="text"
                value={p2pCode}
                onChange={(e) => setP2PCode(e.target.value.toUpperCase())}
                placeholder="SWIFT-EAGLE-42"
                className={styles.input}
                disabled={loading}
                autoComplete="off"
                autoFocus
                style={{ textTransform: 'uppercase', letterSpacing: '1px' }}
              />
              <p className={styles.inputHint}>
                Find this code in Audiio Desktop → Settings → Mobile
              </p>
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="p2pDeviceName" className={styles.label}>
                Device name (optional)
              </label>
              <input
                id="p2pDeviceName"
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="My iPhone"
                className={styles.input}
                disabled={loading}
              />
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button
              type="submit"
              className={styles.button}
              disabled={!p2pCode.trim() || loading}
            >
              {loading ? (
                <>
                  <SpinnerIcon size={18} />
                  Connecting...
                </>
              ) : (
                'Connect'
              )}
            </button>

            <p className={styles.p2pInfo}>
              Works from anywhere — cellular, WiFi, any network
            </p>
          </form>
        )}

        {/* P2P Connected State */}
        {authMode === 'p2p' && p2pStatus === 'connected' && (
          <div className={styles.autoLogin}>
            <div className={styles.autoLoginIcon} style={{ color: 'var(--color-success, #22c55e)' }}>
              <CheckIcon size={32} />
            </div>
            <p className={styles.autoLoginText}>Connected via P2P!</p>
            <p className={styles.autoLoginHint}>
              You're connected directly to your desktop
            </p>
          </div>
        )}

        {/* Passphrase Login */}
        {authMode === 'passphrase' && !deviceToken && (
          <form onSubmit={handlePassphraseSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="passphrase" className={styles.label}>
                Enter passphrase
              </label>
              <input
                id="passphrase"
                type="text"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="cosmic-river-mountain-42"
                className={styles.input}
                disabled={loading}
                autoComplete="off"
                autoFocus
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="deviceName" className={styles.label}>
                Device name (optional)
              </label>
              <input
                id="deviceName"
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="My iPhone"
                className={styles.input}
                disabled={loading}
              />
            </div>

            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                disabled={loading}
              />
              <span>Remember this device</span>
            </label>

            {error && <p className={styles.error}>{error}</p>}

            <button
              type="submit"
              className={styles.button}
              disabled={!passphrase.trim() || loading}
            >
              {loading ? (
                <>
                  <SpinnerIcon size={18} />
                  Connecting...
                </>
              ) : (
                'Connect'
              )}
            </button>
          </form>
        )}

        {/* Device Token Login */}
        {authMode === 'device-token' && !deviceToken && (
          <form onSubmit={(e) => { e.preventDefault(); handleDeviceTokenAuth(); }} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="deviceToken" className={styles.label}>
                Enter device token
              </label>
              <input
                id="deviceToken"
                type="text"
                value={deviceToken}
                onChange={(e) => setDeviceToken(e.target.value)}
                placeholder="device-id:token"
                className={styles.input}
                disabled={loading}
                autoComplete="off"
                autoFocus
              />
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button
              type="submit"
              className={styles.button}
              disabled={!deviceToken.trim() || loading}
            >
              {loading ? (
                <>
                  <SpinnerIcon size={18} />
                  Connecting...
                </>
              ) : (
                'Connect'
              )}
            </button>
          </form>
        )}

        {/* Auto-pairing via QR code */}
        {authMode === 'pairing' && (
          <div className={styles.autoLogin}>
            <div className={styles.autoLoginIcon}>
              <QrCodeIcon size={32} />
            </div>
            <p className={styles.autoLoginText}>
              {isPairing ? 'Waiting for approval on desktop...' : 'Setting up...'}
            </p>
            {isPairing && (
              <>
                <SpinnerIcon size={24} className={styles.spinner} />
                <p className={styles.autoLoginHint}>
                  Check your desktop to approve this connection
                </p>
              </>
            )}
            {error && (
              <>
                <p className={styles.error}>{error}</p>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => {
                    setIsPairingMode(false);
                    setAuthMode('passphrase');
                  }}
                >
                  Enter passphrase instead
                </button>
              </>
            )}
          </div>
        )}

        {/* Auto-login with saved device token */}
        {authMode === 'device-token' && deviceToken && (
          <div className={styles.autoLogin}>
            <div className={styles.autoLoginIcon}>
              <DeviceIcon size={32} />
            </div>
            <p className={styles.autoLoginText}>
              {loading ? 'Connecting to your desktop...' : 'Reconnecting...'}
            </p>
            {loading && <SpinnerIcon size={24} className={styles.spinner} />}
            {error && (
              <>
                <p className={styles.error}>{error}</p>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={handleForgetDevice}
                >
                  Use different device
                </button>
              </>
            )}
          </div>
        )}

        {/* Help Section */}
        {!deviceToken && authMode !== 'pairing' && authMode === 'p2p' && (
          <div className={styles.help}>
            <div className={styles.helpHeader}>
              <WifiIcon size={18} />
              <span>Remote Access</span>
            </div>
            <ol className={styles.helpList}>
              <li>Open Audiio on your desktop</li>
              <li>Go to <strong>Settings → Mobile Access</strong></li>
              <li>Enter the <strong>connection code</strong> shown above</li>
            </ol>
            <p className={styles.helpNote}>
              P2P connects you directly to your desktop from anywhere.
              No internet server needed — fully private and encrypted.
            </p>
          </div>
        )}

        {!deviceToken && authMode !== 'pairing' && authMode === 'passphrase' && (
          <div className={styles.help}>
            <div className={styles.helpHeader}>
              <QrCodeIcon size={18} />
              <span>Local Network</span>
            </div>
            <ol className={styles.helpList}>
              <li>Connect to the <strong>same WiFi</strong> as your desktop</li>
              <li>Open Audiio Desktop → <strong>Settings → Mobile</strong></li>
              <li>Scan the <strong>QR code</strong> or enter the passphrase</li>
            </ol>
            <p className={styles.helpNote}>
              Local mode works when you're on the same network.
              Use <strong>Remote</strong> tab for cellular/external access.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <span>Audiio Mobile</span>
        <span className={styles.footerDot}>•</span>
        <span>Secure connection</span>
      </footer>
    </div>
  );
}

function AudiioLogo() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      {/* Stylized audio waveform */}
      <rect x="4" y="20" width="4" height="8" rx="2" fill="currentColor" />
      <rect x="12" y="14" width="4" height="20" rx="2" fill="currentColor" />
      <rect x="20" y="8" width="4" height="32" rx="2" fill="currentColor" />
      <rect x="28" y="14" width="4" height="20" rx="2" fill="currentColor" />
      <rect x="36" y="18" width="4" height="12" rx="2" fill="currentColor" />
      <rect x="44" y="22" width="0" height="4" rx="0" fill="currentColor" />
    </svg>
  );
}

function getDefaultDeviceName(): string {
  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes('iphone')) return 'iPhone';
  if (ua.includes('ipad')) return 'iPad';
  if (ua.includes('android')) {
    if (ua.includes('mobile')) return 'Android Phone';
    return 'Android Tablet';
  }
  if (ua.includes('mac')) return 'Mac';
  if (ua.includes('windows')) return 'Windows PC';
  if (ua.includes('linux')) return 'Linux Device';

  return 'Mobile Device';
}
