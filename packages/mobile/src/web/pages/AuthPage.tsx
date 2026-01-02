/**
 * Auth Page - Simplified mobile authentication
 *
 * Single unified flow:
 * 1. Enter WORD-WORD-NUMBER code (or scan QR)
 * 2. Optionally set device name
 * 3. Auto-paired, done
 *
 * No tabs, no mode selection, no passphrase.
 */

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/auth-store';
import { useP2PStore, isP2PSupported } from '../stores/p2p-store';
import { SpinnerIcon, CheckIcon } from '@audiio/icons';
import styles from './AuthPage.module.css';

export function AuthPage() {
  const [code, setCode] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [isAutoConnecting, setIsAutoConnecting] = useState(false);

  const {
    pair,
    validateToken,
    deviceToken,
    relayCode: savedRelayCode,
    serverName,
    isAuthenticated,
    isPairing,
    isConnecting,
    error: authError
  } = useAuthStore();

  const {
    status: p2pStatus,
    error: p2pError,
    connect: p2pConnect,
    authToken: p2pAuthToken
  } = useP2PStore();

  // Generate default device name on mount
  useEffect(() => {
    setDeviceName(getDefaultDeviceName());
  }, []);

  // Check for code in URL (from QR scan)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pairingCode = urlParams.get('pair');

    if (pairingCode) {
      // Auto-pair with code from QR
      setCode(pairingCode);
      setIsAutoConnecting(true);
      handlePair(pairingCode);

      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('pair');
      window.history.replaceState({}, '', url.toString());
    }

    // Also check for code in hash (for P2P)
    const hash = window.location.hash;
    if (hash.startsWith('#p2p=')) {
      const codeFromHash = hash.substring(5);
      if (codeFromHash) {
        setCode(codeFromHash);
        handleP2PConnect(codeFromHash);
        window.history.replaceState({}, '', window.location.pathname + window.location.search);
      }
    }
  }, []);

  // Try to reconnect with saved credentials on mount
  // Plex-like "pair once, connect forever" using saved relayCode
  useEffect(() => {
    const attemptReconnect = async () => {
      if (!deviceToken) return;

      // Check if we're in remote mode (GitHub Pages, etc.)
      const host = window.location.hostname;
      const isRemoteMode = host.includes('github.io') ||
                           host.includes('netlify') ||
                           host.includes('vercel') ||
                           host.includes('pages.dev');

      setIsAutoConnecting(true);

      // In remote mode, skip local validation and go straight to P2P
      if (isRemoteMode) {
        if (savedRelayCode && isP2PSupported()) {
          console.log('[Auth] Remote mode - connecting via P2P with saved code:', savedRelayCode);
          setCode(savedRelayCode);
          const p2pSuccess = await p2pConnect(savedRelayCode, deviceName || getDefaultDeviceName());
          if (!p2pSuccess) {
            setIsAutoConnecting(false);
          }
        } else {
          console.log('[Auth] Remote mode - no saved relay code, need to pair');
          setIsAutoConnecting(false);
        }
        return;
      }

      // Local mode - try local validation first (same network)
      const localSuccess = await validateToken();
      if (localSuccess) {
        setIsAutoConnecting(false);
        return;
      }

      // Local failed - try P2P reconnection with saved relay code
      if (savedRelayCode && isP2PSupported()) {
        console.log('[Auth] Local validation failed, trying P2P with saved code:', savedRelayCode);
        // Set the code for display
        setCode(savedRelayCode);
        // Connect via P2P relay
        const p2pSuccess = await p2pConnect(savedRelayCode, deviceName || getDefaultDeviceName());
        if (!p2pSuccess) {
          setIsAutoConnecting(false);
        }
        // If P2P succeeds, the other useEffect will handle device registration
      } else {
        setIsAutoConnecting(false);
      }
    };

    attemptReconnect();
  }, []);

  // When P2P connects, validate existing token or register new device
  useEffect(() => {
    if (p2pStatus === 'connected') {
      const handleP2PConnected = async () => {
        if (deviceToken) {
          // Already have device token - validate it via P2P
          console.log('[Auth] P2P connected, validating existing device token...');
          const valid = await validateToken();
          if (valid) {
            console.log('[Auth] Device token validated via P2P');
          } else {
            console.log('[Auth] Device token invalid, will need to re-pair');
          }
        } else {
          // No device token - register new device
          const codeToUse = code.trim();
          if (codeToUse) {
            console.log('[Auth] P2P connected, registering new device...');
            await pair(codeToUse, deviceName.trim() || getDefaultDeviceName());
          }
        }
        setIsAutoConnecting(false);
      };
      handleP2PConnected();
    }
  }, [p2pStatus, deviceToken, code, deviceName, pair, validateToken]);

  const handlePair = async (pairingCode?: string) => {
    const codeToUse = pairingCode || code.trim();
    if (!codeToUse) return;

    const success = await pair(codeToUse, deviceName.trim() || undefined);
    if (!success) {
      setIsAutoConnecting(false);
    }
  };

  const handleP2PConnect = async (pairingCode?: string) => {
    const codeToUse = pairingCode || code.trim();
    if (!codeToUse || !isP2PSupported()) return;

    setIsAutoConnecting(true);
    await p2pConnect(codeToUse, deviceName.trim() || getDefaultDeviceName());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check if we're in remote mode (GitHub Pages, etc.)
    // In remote mode, we MUST use P2P - direct HTTP won't work
    const host = window.location.hostname;
    const isRemoteMode = host.includes('github.io') ||
                         host.includes('netlify') ||
                         host.includes('vercel') ||
                         host.includes('pages.dev');

    if (isRemoteMode) {
      // In remote mode, always use P2P
      handleP2PConnect();
    } else {
      // Local mode - can try direct HTTP first
      handlePair();
    }
  };

  const error = authError || p2pError;
  const loading = isPairing || isConnecting || p2pStatus === 'connecting';

  // Auto-connecting state (either reconnecting or from QR)
  if (isAutoConnecting && !error) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.logo}>
            <AudiioLogo />
          </div>
          <h1 className={styles.title}>Audiio</h1>

          <div className={styles.autoLogin}>
            <SpinnerIcon size={32} className={styles.spinner} />
            <p className={styles.autoLoginText}>
              {deviceToken ? 'Reconnecting...' : 'Connecting...'}
            </p>
            <p className={styles.autoLoginHint}>
              {deviceToken && serverName
                ? `Connecting to ${serverName}`
                : deviceToken
                ? 'Using saved device credentials'
                : 'Setting up your device'}
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // P2P connected state
  if (p2pStatus === 'connected') {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.logo}>
            <AudiioLogo />
          </div>
          <h1 className={styles.title}>Audiio</h1>

          <div className={styles.autoLogin}>
            <div className={styles.autoLoginIcon} style={{ color: 'var(--color-success, #22c55e)' }}>
              <CheckIcon size={32} />
            </div>
            <p className={styles.autoLoginText}>Connected!</p>
            <p className={styles.autoLoginHint}>
              Streaming directly from your desktop
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Main pairing form
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Logo */}
        <div className={styles.logo}>
          <AudiioLogo />
        </div>

        <h1 className={styles.title}>Audiio</h1>
        <p className={styles.subtitle}>
          Enter the code shown on your desktop
        </p>

        {/* Single code input form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="code" className={styles.label}>
              Connection code
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SWIFT-EAGLE-42"
              className={styles.input}
              disabled={loading}
              autoComplete="off"
              autoFocus
              style={{ textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center' }}
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
              placeholder="My Phone"
              className={styles.input}
              disabled={loading}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="submit"
            className={styles.button}
            disabled={!code.trim() || loading}
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

        {/* Instructions */}
        <div className={styles.help}>
          <p className={styles.helpNote}>
            Find this code in <strong>Audiio Desktop → Settings → Mobile Access</strong>
          </p>
          <p className={styles.p2pInfo}>
            Works from any network — WiFi, cellular, anywhere
          </p>
        </div>

        {/* QR scan hint */}
        <p className={styles.qrHint}>
          Or scan the QR code on desktop
        </p>
      </div>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className={styles.footer}>
      <span>Audiio Mobile</span>
      <span className={styles.footerDot}>•</span>
      <span>Secure connection</span>
    </footer>
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
