/**
 * Auth Page - Enhanced authentication for mobile portal
 *
 * Supports:
 * - Passphrase/password login
 * - Device token authentication (remember device)
 * - QR code scanning option
 * - Device naming
 */

import React, { useState, useEffect } from 'react';
import { useAuthStore, tunnelFetch } from '../stores/auth-store';
import { KeyIcon, QrCodeIcon, DeviceIcon, SpinnerIcon, CopyIcon, CheckIcon } from '../components/Icons';
import styles from './AuthPage.module.css';

type AuthMode = 'passphrase' | 'device-token';

export function AuthPage() {
  const [authMode, setAuthMode] = useState<AuthMode>('passphrase');
  const [passphrase, setPassphrase] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [deviceToken, setDeviceToken] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tunnelPassword, setTunnelPassword] = useState<string | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const { setToken, validateToken, error: storeError, isValidating } = useAuthStore();

  // Check for tunnel password in URL (for bypass helper)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tp = urlParams.get('tp');
    if (tp) {
      setTunnelPassword(tp);
      // Store for future reference
      localStorage.setItem('audiio-tunnel-password', tp);
    }
  }, []);

  // Check for saved device token on mount
  useEffect(() => {
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
  }, []);

  const copyTunnelPassword = async () => {
    if (tunnelPassword) {
      await navigator.clipboard.writeText(tunnelPassword);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

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

  const error = localError || storeError;
  const loading = isLoading || isValidating;

  return (
    <div className={styles.container}>
      {/* Tunnel Password Helper Banner */}
      {tunnelPassword && (
        <div className={styles.tunnelBanner}>
          <div className={styles.tunnelBannerContent}>
            <div className={styles.tunnelBannerIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
              </svg>
            </div>
            <div className={styles.tunnelBannerText}>
              <span className={styles.tunnelBannerLabel}>Tunnel Security Code</span>
              <span className={styles.tunnelBannerHint}>Enter this if prompted by loca.lt</span>
            </div>
            <div className={styles.tunnelPasswordBox}>
              <code className={styles.tunnelPasswordValue}>{tunnelPassword}</code>
              <button
                className={`${styles.tunnelCopyBtn} ${copiedPassword ? styles.copied : ''}`}
                onClick={copyTunnelPassword}
              >
                {copiedPassword ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
              </button>
            </div>
          </div>
        </div>
      )}

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
        {!deviceToken && (
          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tab} ${authMode === 'passphrase' ? styles.activeTab : ''}`}
              onClick={() => setAuthMode('passphrase')}
            >
              <KeyIcon size={16} />
              Passphrase
            </button>
            <button
              type="button"
              className={`${styles.tab} ${authMode === 'device-token' ? styles.activeTab : ''}`}
              onClick={() => setAuthMode('device-token')}
            >
              <DeviceIcon size={16} />
              Device Token
            </button>
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

        {/* Auto-login with saved device token */}
        {deviceToken && (
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
        {!deviceToken && (
          <div className={styles.help}>
            <div className={styles.helpHeader}>
              <QrCodeIcon size={18} />
              <span>Getting Started</span>
            </div>
            <ol className={styles.helpList}>
              <li>Open Audiio on your desktop</li>
              <li>Go to <strong>Settings → Mobile Access</strong></li>
              <li>Click <strong>Enable Mobile Portal</strong></li>
              <li>Enter the passphrase shown, or scan the QR code</li>
            </ol>
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
