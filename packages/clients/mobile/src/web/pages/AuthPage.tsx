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
    connectWithPassword: p2pConnectWithPassword,
    requiresPassword,
    pendingServerName,
    authToken: p2pAuthToken
  } = useP2PStore();

  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Generate default device name on mount
  useEffect(() => {
    setDeviceName(getDefaultDeviceName());
  }, []);

  // Check for code in URL (from QR scan or direct link)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);

    // Check for new Device Trust QR data (v2 format)
    const qrData = urlParams.get('qr');
    if (qrData) {
      try {
        const parsed = JSON.parse(decodeURIComponent(qrData));
        if (parsed.serverId && parsed.pairingToken) {
          console.log('[Auth] Found Device Trust QR data:', parsed.serverId);
          handleDeviceTrustPairing(parsed);

          // Clean up URL
          const url = new URL(window.location.href);
          url.searchParams.delete('qr');
          window.history.replaceState({}, '', url.toString());
          return;
        }
      } catch (e) {
        console.error('[Auth] Failed to parse QR data:', e);
      }
    }

    // Check for room ID (new static room model) - primary format
    const roomId = urlParams.get('room');
    if (roomId) {
      console.log('[Auth] Found room ID in URL:', roomId);
      setCode(roomId);
      setIsAutoConnecting(true);
      handleP2PConnect(roomId);

      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url.toString());
      return;
    }

    // Check for legacy pairing code
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
      return;
    }

    // Also check for code in hash (for P2P) - legacy format
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

  // Handle Device Trust pairing (new v2 flow)
  const handleDeviceTrustPairing = async (qrData: {
    serverId: string;
    serverPublicKey: string;
    serverName?: string;
    pairingToken: string;
    localUrl?: string;
    relayUrl?: string;
  }) => {
    setIsAutoConnecting(true);

    try {
      // Generate device key pair if not exists
      const deviceKeyPair = await getOrCreateDeviceKeyPair();
      const deviceId = await getDeviceId(deviceKeyPair.publicKey);

      // Try local URL first
      const baseUrl = qrData.localUrl || window.location.origin;

      const response = await fetch(`${baseUrl}/api/auth/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairingToken: qrData.pairingToken,
          deviceId,
          devicePublicKey: deviceKeyPair.publicKey,
          deviceName: deviceName || getDefaultDeviceName(),
          deviceType: 'mobile'
        })
      });

      const result = await response.json();

      if (result.success) {
        // Store the session and server info
        localStorage.setItem('audiio_session_token', result.sessionToken);
        localStorage.setItem('audiio_server_id', qrData.serverId);
        localStorage.setItem('audiio_server_url', baseUrl);
        localStorage.setItem('audiio_server_name', qrData.serverName || 'Audiio Server');

        console.log('[Auth] Device Trust pairing successful');
        window.location.reload();
      } else {
        console.error('[Auth] Pairing failed:', result.error);
        setIsAutoConnecting(false);
      }
    } catch (error) {
      console.error('[Auth] Device Trust pairing error:', error);
      setIsAutoConnecting(false);
    }
  };

  // Get or create device key pair
  const getOrCreateDeviceKeyPair = async (): Promise<{ publicKey: string; secretKey: string }> => {
    const stored = localStorage.getItem('audiio_device_keypair');
    if (stored) {
      return JSON.parse(stored);
    }

    // Generate new key pair using Web Crypto
    const keyPair = await window.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey']
    );

    const publicKeyRaw = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
    const privateKeyRaw = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    const result = {
      publicKey: btoa(String.fromCharCode(...new Uint8Array(publicKeyRaw))),
      secretKey: btoa(String.fromCharCode(...new Uint8Array(privateKeyRaw)))
    };

    localStorage.setItem('audiio_device_keypair', JSON.stringify(result));
    return result;
  };

  // Generate device ID from public key
  const getDeviceId = async (publicKey: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(publicKey);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray.slice(0, 4))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  };

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

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setPasswordError('Please enter a password');
      return;
    }
    setPasswordError('');
    setIsAutoConnecting(true);
    const success = await p2pConnectWithPassword(password);
    if (!success) {
      setPasswordError('Incorrect password');
      setIsAutoConnecting(false);
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

  // Password required state
  if (requiresPassword) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.logo}>
            <AudiioLogo />
          </div>
          <h1 className={styles.title}>Audiio</h1>
          <p className={styles.subtitle}>
            {pendingServerName
              ? `Enter password for ${pendingServerName}`
              : 'This server requires a password'}
          </p>

          <form onSubmit={handlePasswordSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="password" className={styles.label}>
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className={styles.input}
                disabled={loading}
                autoComplete="off"
                autoFocus
              />
            </div>

            {passwordError && <p className={styles.error}>{passwordError}</p>}

            <button
              type="submit"
              className={styles.button}
              disabled={!password.trim() || loading}
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

          <button
            className={styles.backLink}
            onClick={() => {
              setPassword('');
              setPasswordError('');
              // Reset the P2P state to go back to code entry
              useP2PStore.setState({
                requiresPassword: false,
                pendingRoomId: null,
                pendingServerName: null
              });
            }}
          >
            ← Enter a different code
          </button>
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
