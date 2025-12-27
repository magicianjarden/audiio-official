/**
 * MobileAccessSettings - Configure mobile portal access
 *
 * Apple-style privacy-first design with clear user communication
 */

import React, { useState, useEffect } from 'react';

// Types
interface AccessConfig {
  token: string;
  localUrl: string;
  tunnelUrl?: string;
  tunnelPassword?: string;
  qrCode?: string;
  createdAt: number;
  relayCode?: string;
  relayPublicKey?: string;
  relayActive?: boolean;
}

interface MobileSession {
  id: string;
  deviceName?: string;
  connectedAt: number;
  lastActivity: number;
  isActive: boolean;
}

interface AuthorizedDevice {
  id: string;
  name: string;
  createdAt: string;
  lastAccessAt: string;
  expiresAt: string | null;
}

interface AuthSettings {
  useCustomPassword: boolean;
  defaultExpirationDays: number | null;
  requirePasswordEveryTime: boolean;
}

interface DeviceApprovalRequest {
  id: string;
  deviceName: string;
  userAgent: string;
}

interface MobileAccessState {
  isEnabled: boolean;
  isLoading: boolean;
  accessConfig: AccessConfig | null;
  sessions: MobileSession[];
  enableRemoteAccess: boolean;
  hasAcceptedPrivacy: boolean;
  passphrase: string | null;
  authorizedDevices: AuthorizedDevice[];
  authSettings: AuthSettings;
  showCustomPasswordForm: boolean;
  customPassword: string;
  customPasswordError: string | null;
  pendingApproval: DeviceApprovalRequest | null;
}

// ========================================
// Privacy Notice Modal
// ========================================

interface PrivacyNoticeProps {
  onAccept: () => void;
  onDecline: () => void;
}

const PrivacyNotice: React.FC<PrivacyNoticeProps> = ({ onAccept, onDecline }) => {
  return (
    <div className="mobile-privacy-overlay">
      <div className="mobile-privacy-modal">
        <div className="mobile-privacy-icon">
          <MobileIcon size={48} />
        </div>

        <h2 className="mobile-privacy-title">Mobile Access</h2>
        <p className="mobile-privacy-subtitle">
          Stream your music anywhere
        </p>

        <div className="mobile-privacy-content">
          <div className="mobile-privacy-section">
            <div className="mobile-privacy-feature">
              <div className="mobile-privacy-feature-icon secure">
                <LockIcon size={20} />
              </div>
              <div className="mobile-privacy-feature-info">
                <h4>Secure Connection</h4>
                <p>Each session uses a unique, randomly generated access token. Only devices with your token can connect.</p>
              </div>
            </div>

            <div className="mobile-privacy-feature">
              <div className="mobile-privacy-feature-icon private">
                <ShieldIcon size={20} />
              </div>
              <div className="mobile-privacy-feature-info">
                <h4>Your Data Stays Yours</h4>
                <p>Music streams directly from your computer. No data is sent to external servers or stored in the cloud.</p>
              </div>
            </div>

            <div className="mobile-privacy-feature">
              <div className="mobile-privacy-feature-icon control">
                <ControlIcon size={20} />
              </div>
              <div className="mobile-privacy-feature-info">
                <h4>You're in Control</h4>
                <p>See all connected devices, disconnect any session instantly, or regenerate your access token at any time.</p>
              </div>
            </div>
          </div>

          <div className="mobile-privacy-note">
            <InfoIcon size={16} />
            <p>
              <strong>How it works:</strong> Audiio creates a personal server on your computer.
              Scan the QR code with your phone to access your music library through a secure web portal.
            </p>
          </div>
        </div>

        <div className="mobile-privacy-actions">
          <button className="mobile-privacy-btn secondary" onClick={onDecline}>
            Not Now
          </button>
          <button className="mobile-privacy-btn primary" onClick={onAccept}>
            Enable Mobile Access
          </button>
        </div>
      </div>
    </div>
  );
};

// ========================================
// Device Approval Dialog
// ========================================

interface DeviceApprovalDialogProps {
  request: DeviceApprovalRequest;
  onApprove: () => void;
  onDeny: () => void;
}

const DeviceApprovalDialog: React.FC<DeviceApprovalDialogProps> = ({ request, onApprove, onDeny }) => {
  return (
    <div className="mobile-approval-overlay">
      <div className="mobile-approval-modal">
        <div className="mobile-approval-icon">
          <MobileIcon size={48} />
        </div>

        <h2 className="mobile-approval-title">New Device</h2>
        <p className="mobile-approval-subtitle">
          A device wants to connect
        </p>

        <div className="mobile-approval-device">
          <div className="mobile-approval-device-name">{request.deviceName}</div>
          <div className="mobile-approval-device-hint">
            This device scanned your QR code
          </div>
        </div>

        <div className="mobile-approval-actions">
          <button
            className="mobile-approval-btn mobile-approval-btn-approve"
            onClick={onApprove}
          >
            <CheckIcon size={18} />
            Allow Connection
          </button>
          <button
            className="mobile-approval-btn mobile-approval-btn-deny"
            onClick={onDeny}
          >
            Deny
          </button>
        </div>

        <p className="mobile-approval-note">
          Approved devices can stream your music library.
          You can revoke access anytime from Device Management.
        </p>
      </div>
    </div>
  );
};

// ========================================
// QR Code Display
// ========================================

interface QRCodeDisplayProps {
  qrCode: string;
  url: string;
  isRemote: boolean;
  tunnelPassword?: string;
}

const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ qrCode, url, isRemote, tunnelPassword }) => {
  const [copied, setCopied] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
    }
  };

  const handleCopyPassword = async () => {
    if (!tunnelPassword) return;
    try {
      await navigator.clipboard.writeText(tunnelPassword);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 2000);
    } catch {
      // Fallback for older browsers
    }
  };

  return (
    <div className="mobile-qr-container">
      <div className="mobile-qr-card">
        {qrCode ? (
          <img src={qrCode} alt="Scan to connect" className="mobile-qr-image" />
        ) : (
          <div className="mobile-qr-placeholder">
            <QRIcon size={64} />
          </div>
        )}
      </div>

      <div className="mobile-qr-info">
        <p className="mobile-qr-instruction">
          Scan with your phone's camera to connect instantly
        </p>
        <p className="mobile-qr-hint">
          One-time setup - your device will be remembered
        </p>
        <div className="mobile-qr-url-row">
          <span className="mobile-qr-badge">
            {isRemote ? 'Remote' : 'Local Network'}
          </span>
          <button className="mobile-qr-copy" onClick={handleCopy}>
            {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>

        {/* Tunnel bypass password notice */}
        {isRemote && tunnelPassword && (
          <div className="mobile-tunnel-password">
            <div className="mobile-tunnel-password-header">
              <ShieldIcon size={16} />
              <span>Security Code Required</span>
            </div>
            <p className="mobile-tunnel-password-hint">
              When opening the link, you'll see a security page from <strong>loca.lt</strong>.
              Enter this code in the "Endpoint IP" field:
            </p>
            <div className="mobile-tunnel-password-value">
              <code>{tunnelPassword}</code>
              <button
                className="mobile-qr-copy"
                onClick={handleCopyPassword}
                title="Copy code"
              >
                {passwordCopied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                {passwordCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="mobile-tunnel-password-note">
              This is a one-time security check. After entering, you'll be connected to Audiio.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ========================================
// Relay Code Display
// ========================================

interface RelayCodeDisplayProps {
  code: string;
  isActive: boolean;
}

const RelayCodeDisplay: React.FC<RelayCodeDisplayProps> = ({ code, isActive }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
    }
  };

  if (!code) return null;

  return (
    <div className="mobile-relay-container">
      <div className="mobile-relay-header">
        <div className="mobile-relay-status">
          <span className={`mobile-relay-indicator ${isActive ? 'active' : ''}`} />
          <span>Relay {isActive ? 'Active' : 'Connecting...'}</span>
        </div>
        <LinkIcon size={16} />
      </div>

      <div className="mobile-relay-code-card">
        <div className="mobile-relay-code">
          {code.split('-').map((part, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="mobile-relay-separator">-</span>}
              <span className="mobile-relay-code-part">{part}</span>
            </React.Fragment>
          ))}
        </div>
        <button className="mobile-relay-copy" onClick={handleCopy}>
          {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <p className="mobile-relay-hint">
        Enter this code on your mobile device to connect from anywhere.
        Works across different networks - no need to be on the same WiFi.
      </p>
    </div>
  );
};

// ========================================
// Connected Devices
// ========================================

interface ConnectedDevicesProps {
  sessions: MobileSession[];
  onDisconnect: (sessionId: string) => void;
}

const ConnectedDevices: React.FC<ConnectedDevicesProps> = ({ sessions, onDisconnect }) => {
  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  if (sessions.length === 0) {
    return (
      <div className="mobile-devices-empty">
        <DevicesIcon size={32} />
        <p>No devices connected</p>
        <span>Scan the QR code with your phone to get started</span>
      </div>
    );
  }

  return (
    <div className="mobile-devices-list">
      {sessions.map(session => (
        <div key={session.id} className="mobile-device-item">
          <div className="mobile-device-icon">
            <PhoneIcon size={20} />
            <span className={`mobile-device-status ${session.isActive ? 'active' : ''}`} />
          </div>
          <div className="mobile-device-info">
            <span className="mobile-device-name">{session.deviceName || 'Unknown Device'}</span>
            <span className="mobile-device-time">
              {session.isActive ? 'Active now' : `Last seen ${formatTime(session.lastActivity)}`}
            </span>
          </div>
          <button
            className="mobile-device-disconnect"
            onClick={() => onDisconnect(session.id)}
            title="Disconnect this device"
          >
            <CloseIcon size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};

// ========================================
// Main Component
// ========================================

// ========================================
// Passphrase Display
// ========================================

interface PassphraseDisplayProps {
  passphrase: string | null;
  useCustomPassword: boolean;
  onRegenerate: () => void;
  onShowCustomPasswordForm: () => void;
  onRemoveCustomPassword: () => void;
  isLoading: boolean;
}

const PassphraseDisplay: React.FC<PassphraseDisplayProps> = ({
  passphrase,
  useCustomPassword,
  onRegenerate,
  onShowCustomPasswordForm,
  onRemoveCustomPassword,
  isLoading
}) => {
  const [copied, setCopied] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);

  const handleCopy = async () => {
    if (!passphrase) return;
    try {
      await navigator.clipboard.writeText(passphrase);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
    }
  };

  return (
    <div className="mobile-passphrase-section">
      <div className="mobile-access-section-header">
        <KeyIcon size={16} />
        <h4>Access Credentials</h4>
      </div>

      {useCustomPassword ? (
        <div className="mobile-passphrase-card custom">
          <div className="mobile-passphrase-info">
            <span className="mobile-passphrase-label">Custom Password</span>
            <span className="mobile-passphrase-value masked">••••••••</span>
          </div>
          <div className="mobile-passphrase-actions">
            <button
              className="mobile-passphrase-btn"
              onClick={onRemoveCustomPassword}
              disabled={isLoading}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="mobile-passphrase-card">
          <div className="mobile-passphrase-info">
            <span className="mobile-passphrase-label">Passphrase</span>
            <span className="mobile-passphrase-value">
              {showPassphrase ? passphrase : '•••-•••-•••-••'}
            </span>
          </div>
          <div className="mobile-passphrase-actions">
            <button
              className="mobile-passphrase-btn"
              onClick={() => setShowPassphrase(!showPassphrase)}
              title={showPassphrase ? 'Hide' : 'Show'}
            >
              {showPassphrase ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
            </button>
            <button
              className="mobile-passphrase-btn"
              onClick={handleCopy}
              title="Copy"
            >
              {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
            </button>
            <button
              className="mobile-passphrase-btn"
              onClick={onRegenerate}
              disabled={isLoading}
              title="Generate new passphrase"
            >
              <RefreshIcon size={16} />
            </button>
          </div>
        </div>
      )}

      <button
        className="mobile-custom-password-link"
        onClick={useCustomPassword ? onRemoveCustomPassword : onShowCustomPasswordForm}
      >
        {useCustomPassword ? 'Use generated passphrase instead' : 'Set custom password instead'}
      </button>
    </div>
  );
};

// ========================================
// Authorized Devices List
// ========================================

interface AuthorizedDevicesProps {
  devices: AuthorizedDevice[];
  onRevoke: (deviceId: string) => void;
  onRevokeAll: () => void;
  onRename: (deviceId: string, name: string) => void;
}

const AuthorizedDevices: React.FC<AuthorizedDevicesProps> = ({
  devices,
  onRevoke,
  onRevokeAll
}) => {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return 'Never';
    const date = new Date(expiresAt);
    const diff = date.getTime() - Date.now();
    if (diff < 0) return 'Expired';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days < 7) return `${days} days`;
    return date.toLocaleDateString();
  };

  if (devices.length === 0) {
    return (
      <div className="mobile-devices-empty">
        <DevicesIcon size={32} />
        <p>No remembered devices</p>
        <span>Devices that chose "Remember me" will appear here</span>
      </div>
    );
  }

  return (
    <div className="mobile-authorized-devices">
      <div className="mobile-devices-list">
        {devices.map(device => (
          <div key={device.id} className="mobile-device-item">
            <div className="mobile-device-icon">
              <PhoneIcon size={20} />
            </div>
            <div className="mobile-device-info">
              <span className="mobile-device-name">{device.name}</span>
              <span className="mobile-device-time">
                Last seen {formatTime(device.lastAccessAt)} • Expires {formatExpiry(device.expiresAt)}
              </span>
            </div>
            <button
              className="mobile-device-disconnect"
              onClick={() => onRevoke(device.id)}
              title="Revoke access"
            >
              <CloseIcon size={16} />
            </button>
          </div>
        ))}
      </div>
      {devices.length > 1 && (
        <button className="mobile-revoke-all-btn" onClick={onRevokeAll}>
          Revoke all devices
        </button>
      )}
    </div>
  );
};

// ========================================
// Security Settings
// ========================================

interface SecuritySettingsProps {
  settings: AuthSettings;
  onUpdateSettings: (settings: Partial<AuthSettings>) => void;
}

const SecuritySettings: React.FC<SecuritySettingsProps> = ({ settings, onUpdateSettings }) => {
  const expirationOptions = [
    { value: 7, label: '7 days' },
    { value: 30, label: '30 days' },
    { value: 90, label: '90 days' },
    { value: null, label: 'Never' }
  ];

  return (
    <div className="mobile-security-settings">
      <div className="mobile-access-section-header">
        <ShieldIcon size={16} />
        <h4>Security Settings</h4>
      </div>

      <div className="mobile-security-option">
        <div className="mobile-security-option-info">
          <span className="mobile-security-option-label">Device token expiration</span>
          <span className="mobile-security-option-desc">
            How long remembered devices stay authorized
          </span>
        </div>
        <select
          className="mobile-security-select"
          value={settings.defaultExpirationDays ?? 'null'}
          onChange={(e) => {
            const value = e.target.value === 'null' ? null : parseInt(e.target.value, 10);
            onUpdateSettings({ defaultExpirationDays: value });
          }}
        >
          {expirationOptions.map(opt => (
            <option key={opt.value ?? 'null'} value={opt.value ?? 'null'}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mobile-security-option">
        <div className="mobile-security-option-info">
          <span className="mobile-security-option-label">Require password every time</span>
          <span className="mobile-security-option-desc">
            Always ask for password, even on remembered devices
          </span>
        </div>
        <label className="mobile-access-toggle small">
          <input
            type="checkbox"
            checked={settings.requirePasswordEveryTime}
            onChange={(e) => onUpdateSettings({ requirePasswordEveryTime: e.target.checked })}
          />
          <span className="mobile-access-toggle-slider" />
        </label>
      </div>
    </div>
  );
};

// ========================================
// Custom Password Form
// ========================================

interface CustomPasswordFormProps {
  password: string;
  error: string | null;
  onPasswordChange: (password: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

const CustomPasswordForm: React.FC<CustomPasswordFormProps> = ({
  password,
  error,
  onPasswordChange,
  onSubmit,
  onCancel,
  isLoading
}) => {
  return (
    <div className="mobile-custom-password-form">
      <div className="mobile-custom-password-header">
        <h4>Set Custom Password</h4>
        <button className="mobile-custom-password-close" onClick={onCancel}>
          <CloseIcon size={16} />
        </button>
      </div>
      <p className="mobile-custom-password-hint">
        Enter a password that's at least 8 characters long. This will be used instead of the generated passphrase.
      </p>
      <input
        type="password"
        className="mobile-custom-password-input"
        placeholder="Enter password"
        value={password}
        onChange={(e) => onPasswordChange(e.target.value)}
        autoFocus
      />
      {error && <p className="mobile-custom-password-error">{error}</p>}
      <div className="mobile-custom-password-actions">
        <button
          className="mobile-custom-password-btn secondary"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          className="mobile-custom-password-btn primary"
          onClick={onSubmit}
          disabled={isLoading || password.length < 8}
        >
          Set Password
        </button>
      </div>
    </div>
  );
};

// ========================================
// Main Component
// ========================================

export const MobileAccessSettings: React.FC = () => {
  const [state, setState] = useState<MobileAccessState>({
    isEnabled: false,
    isLoading: true,
    accessConfig: null,
    sessions: [],
    enableRemoteAccess: false,
    hasAcceptedPrivacy: localStorage.getItem('audiio-mobile-privacy-accepted') === 'true',
    passphrase: null,
    authorizedDevices: [],
    authSettings: {
      useCustomPassword: false,
      defaultExpirationDays: null, // Never expires by default
      requirePasswordEveryTime: false
    },
    showCustomPasswordForm: false,
    customPassword: '',
    customPasswordError: null,
    pendingApproval: null
  });

  const [showPrivacy, setShowPrivacy] = useState(false);

  // Load initial state
  useEffect(() => {
    loadMobileStatus();
  }, []);

  // Load auth data when mobile is enabled
  useEffect(() => {
    if (state.isEnabled) {
      loadAuthData();
    }
  }, [state.isEnabled]);

  // Listen for device approval requests
  useEffect(() => {
    // @ts-ignore - API exposed via preload
    const unsubscribe = window.api?.onMobileDeviceApprovalRequest?.((request: DeviceApprovalRequest) => {
      console.log('[MobileAccess] Device approval request:', request);
      setState(prev => ({ ...prev, pendingApproval: request }));
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleApproveDevice = async () => {
    if (!state.pendingApproval) return;

    try {
      // @ts-ignore - API exposed via preload
      await window.api?.approveMobileDevice?.(state.pendingApproval.id);
      setState(prev => ({ ...prev, pendingApproval: null }));
      // Reload devices to show the new one
      loadAuthData();
    } catch (err) {
      console.error('[MobileAccess] Error approving device:', err);
    }
  };

  const handleDenyDevice = async () => {
    if (!state.pendingApproval) return;

    try {
      // @ts-ignore - API exposed via preload
      await window.api?.denyMobileDevice?.(state.pendingApproval.id);
      setState(prev => ({ ...prev, pendingApproval: null }));
    } catch (err) {
      console.error('[MobileAccess] Error denying device:', err);
    }
  };

  const loadMobileStatus = async () => {
    console.log('[MobileAccess] Loading status...');
    try {
      // @ts-ignore - API exposed via preload
      const status = await window.api?.getMobileStatus?.();
      console.log('[MobileAccess] Status:', status);

      if (status) {
        setState(prev => ({
          ...prev,
          isEnabled: status.isEnabled,
          accessConfig: status.accessConfig,
          sessions: status.sessions || [],
          enableRemoteAccess: status.enableRemoteAccess || false,
          isLoading: false
        }));
      } else {
        console.log('[MobileAccess] No status returned (API may not be available)');
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (err) {
      console.error('[MobileAccess] Error loading status:', err);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const loadAuthData = async () => {
    try {
      // @ts-ignore - API exposed via preload
      const [passphraseResult, devicesResult, settingsResult] = await Promise.all([
        window.api?.getMobilePassphrase?.(),
        window.api?.getMobileDevices?.(),
        window.api?.getMobileAuthSettings?.()
      ]);

      setState(prev => ({
        ...prev,
        passphrase: passphraseResult?.passphrase || null,
        authorizedDevices: devicesResult?.devices || [],
        authSettings: settingsResult || prev.authSettings
      }));
    } catch (err) {
      console.error('[MobileAccess] Error loading auth data:', err);
    }
  };

  const handleRegeneratePassphrase = async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      // @ts-ignore - API exposed via preload
      const result = await window.api?.regenerateMobilePassphrase?.();
      if (result?.success) {
        setState(prev => ({
          ...prev,
          passphrase: result.passphrase,
          authorizedDevices: [], // All devices revoked
          isLoading: false
        }));
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('[MobileAccess] Failed to regenerate passphrase:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleSetCustomPassword = async () => {
    setState(prev => ({ ...prev, isLoading: true, customPasswordError: null }));
    try {
      // @ts-ignore - API exposed via preload
      const result = await window.api?.setMobileCustomPassword?.(state.customPassword);
      if (result?.success) {
        setState(prev => ({
          ...prev,
          authSettings: { ...prev.authSettings, useCustomPassword: true },
          authorizedDevices: [], // All devices revoked
          showCustomPasswordForm: false,
          customPassword: '',
          isLoading: false
        }));
      } else {
        setState(prev => ({
          ...prev,
          customPasswordError: result?.error || 'Failed to set password',
          isLoading: false
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        customPasswordError: 'Failed to set password',
        isLoading: false
      }));
    }
  };

  const handleRemoveCustomPassword = async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      // @ts-ignore - API exposed via preload
      await window.api?.removeMobileCustomPassword?.();
      setState(prev => ({
        ...prev,
        authSettings: { ...prev.authSettings, useCustomPassword: false },
        isLoading: false
      }));
      // Reload passphrase
      const result = await (window as any).api?.getMobilePassphrase?.();
      if (result?.passphrase) {
        setState(prev => ({ ...prev, passphrase: result.passphrase }));
      }
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    try {
      // @ts-ignore - API exposed via preload
      const result = await window.api?.revokeMobileDevice?.(deviceId);
      if (result?.success) {
        setState(prev => ({
          ...prev,
          authorizedDevices: prev.authorizedDevices.filter(d => d.id !== deviceId)
        }));
      }
    } catch (error) {
      console.error('[MobileAccess] Failed to revoke device:', error);
    }
  };

  const handleRevokeAllDevices = async () => {
    try {
      // @ts-ignore - API exposed via preload
      const result = await window.api?.revokeAllMobileDevices?.();
      if (result?.success) {
        setState(prev => ({ ...prev, authorizedDevices: [] }));
      }
    } catch (error) {
      console.error('[MobileAccess] Failed to revoke all devices:', error);
    }
  };

  const handleRenameDevice = async (deviceId: string, name: string) => {
    try {
      // @ts-ignore - API exposed via preload
      const result = await window.api?.renameMobileDevice?.(deviceId, name);
      if (result?.success) {
        setState(prev => ({
          ...prev,
          authorizedDevices: prev.authorizedDevices.map(d =>
            d.id === deviceId ? { ...d, name } : d
          )
        }));
      }
    } catch (error) {
      console.error('[MobileAccess] Failed to rename device:', error);
    }
  };

  const handleUpdateAuthSettings = async (settings: Partial<AuthSettings>) => {
    try {
      // @ts-ignore - API exposed via preload
      const result = await window.api?.updateMobileAuthSettings?.(settings);
      if (result?.success) {
        setState(prev => ({
          ...prev,
          authSettings: { ...prev.authSettings, ...settings }
        }));
      }
    } catch (error) {
      console.error('[MobileAccess] Failed to update settings:', error);
    }
  };

  const handleEnableClick = () => {
    if (!state.hasAcceptedPrivacy) {
      setShowPrivacy(true);
    } else {
      enableMobileAccess();
    }
  };

  const handlePrivacyAccept = () => {
    localStorage.setItem('audiio-mobile-privacy-accepted', 'true');
    setState(prev => ({ ...prev, hasAcceptedPrivacy: true }));
    setShowPrivacy(false);
    enableMobileAccess();
  };

  const handlePrivacyDecline = () => {
    setShowPrivacy(false);
  };

  const enableMobileAccess = async () => {
    console.log('[MobileAccess] Enabling mobile access...');
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      // @ts-ignore - API exposed via preload
      const result = await window.api?.enableMobileAccess?.();
      console.log('[MobileAccess] Result:', result);

      if (result?.success && result.accessConfig) {
        console.log('[MobileAccess] Successfully enabled, QR:', !!result.accessConfig.qrCode);
        setState(prev => ({
          ...prev,
          isEnabled: true,
          accessConfig: result.accessConfig,
          isLoading: false
        }));
      } else {
        console.error('[MobileAccess] Enable failed:', result?.error || 'Unknown error');
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('[MobileAccess] Failed to enable mobile access:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const disableMobileAccess = async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      // @ts-ignore - API exposed via preload
      await window.api?.disableMobileAccess?.();
      setState(prev => ({
        ...prev,
        isEnabled: false,
        accessConfig: null,
        sessions: [],
        isLoading: false
      }));
    } catch (error) {
      console.error('Failed to disable mobile access:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleRemoteToggle = async () => {
    const newValue = !state.enableRemoteAccess;
    setState(prev => ({ ...prev, enableRemoteAccess: newValue, isLoading: true }));

    try {
      // @ts-ignore - API exposed via preload
      const result = await window.api?.setMobileRemoteAccess?.(newValue);
      if (result?.accessConfig) {
        setState(prev => ({
          ...prev,
          accessConfig: result.accessConfig,
          isLoading: false
        }));
      }
    } catch {
      setState(prev => ({ ...prev, enableRemoteAccess: !newValue, isLoading: false }));
    }
  };

  const handleRegenerateToken = async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      // @ts-ignore - API exposed via preload
      const result = await window.api?.regenerateMobileToken?.();
      if (result?.accessConfig) {
        setState(prev => ({
          ...prev,
          accessConfig: result.accessConfig,
          sessions: [],
          isLoading: false
        }));
      }
    } catch {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleDisconnectDevice = async (sessionId: string) => {
    try {
      // @ts-ignore - API exposed via preload
      await window.api?.disconnectMobileSession?.(sessionId);
      setState(prev => ({
        ...prev,
        sessions: prev.sessions.filter(s => s.id !== sessionId)
      }));
    } catch (error) {
      console.error('Failed to disconnect device:', error);
    }
  };

  // Loading state
  if (state.isLoading && !state.isEnabled) {
    return (
      <div className="mobile-access-loading">
        <div className="mobile-access-spinner" />
      </div>
    );
  }

  const primaryUrl = state.accessConfig?.tunnelUrl || state.accessConfig?.localUrl || '';
  const isRemote = !!state.accessConfig?.tunnelUrl;

  return (
    <div className="mobile-access-settings">
      {/* Privacy Notice Modal */}
      {showPrivacy && (
        <PrivacyNotice onAccept={handlePrivacyAccept} onDecline={handlePrivacyDecline} />
      )}

      {/* Device Approval Dialog */}
      {state.pendingApproval && (
        <DeviceApprovalDialog
          request={state.pendingApproval}
          onApprove={handleApproveDevice}
          onDeny={handleDenyDevice}
        />
      )}

      {/* Header */}
      <div className="mobile-access-header">
        <div className="mobile-access-header-icon">
          <MobileIcon size={24} />
        </div>
        <div className="mobile-access-header-info">
          <h3>Mobile Access</h3>
          <p>Access your music from your phone or tablet</p>
        </div>
        <label className="mobile-access-toggle">
          <input
            type="checkbox"
            checked={state.isEnabled}
            onChange={state.isEnabled ? disableMobileAccess : handleEnableClick}
            disabled={state.isLoading}
          />
          <span className="mobile-access-toggle-slider" />
        </label>
      </div>

      {/* Content - only show when enabled */}
      {state.isEnabled && state.accessConfig && (
        <div className="mobile-access-content">
          {/* Relay Code Section - Primary connection method */}
          {state.accessConfig.relayCode && (
            <RelayCodeDisplay
              code={state.accessConfig.relayCode}
              isActive={state.accessConfig.relayActive || false}
            />
          )}

          {/* QR Code Section */}
          <QRCodeDisplay
            qrCode={state.accessConfig.qrCode || ''}
            url={primaryUrl}
            isRemote={isRemote}
            tunnelPassword={state.accessConfig.tunnelPassword}
          />

          {/* Remote Access Option - Only show if relay not active */}
          {!state.accessConfig.relayActive && (
          <div className="mobile-access-option">
            <div className="mobile-access-option-info">
              <div className="mobile-access-option-row">
                <GlobeIcon size={18} />
                <h4>Access from Anywhere</h4>
              </div>
              <p>
                Enable to access your music outside your home network.
                Uses a secure tunnel connection.
              </p>
            </div>
            <label className="mobile-access-toggle small">
              <input
                type="checkbox"
                checked={state.enableRemoteAccess}
                onChange={handleRemoteToggle}
                disabled={state.isLoading}
              />
              <span className="mobile-access-toggle-slider" />
            </label>
          </div>
          )}

          {/* Passphrase Section */}
          {state.showCustomPasswordForm ? (
            <CustomPasswordForm
              password={state.customPassword}
              error={state.customPasswordError}
              onPasswordChange={(password) => setState(prev => ({ ...prev, customPassword: password }))}
              onSubmit={handleSetCustomPassword}
              onCancel={() => setState(prev => ({ ...prev, showCustomPasswordForm: false, customPassword: '', customPasswordError: null }))}
              isLoading={state.isLoading}
            />
          ) : (
            <PassphraseDisplay
              passphrase={state.passphrase}
              useCustomPassword={state.authSettings.useCustomPassword}
              onRegenerate={handleRegeneratePassphrase}
              onShowCustomPasswordForm={() => setState(prev => ({ ...prev, showCustomPasswordForm: true }))}
              onRemoveCustomPassword={handleRemoveCustomPassword}
              isLoading={state.isLoading}
            />
          )}

          {/* Authorized Devices */}
          <div className="mobile-access-section">
            <div className="mobile-access-section-header">
              <h4>Remembered Devices</h4>
              <span className="mobile-access-count">{state.authorizedDevices.length}</span>
            </div>
            <AuthorizedDevices
              devices={state.authorizedDevices}
              onRevoke={handleRevokeDevice}
              onRevokeAll={handleRevokeAllDevices}
              onRename={handleRenameDevice}
            />
          </div>

          {/* Active Sessions */}
          <div className="mobile-access-section">
            <div className="mobile-access-section-header">
              <h4>Active Sessions</h4>
              <span className="mobile-access-count">{state.sessions.length}</span>
            </div>
            <ConnectedDevices
              sessions={state.sessions}
              onDisconnect={handleDisconnectDevice}
            />
          </div>

          {/* Security Settings */}
          <SecuritySettings
            settings={state.authSettings}
            onUpdateSettings={handleUpdateAuthSettings}
          />
        </div>
      )}

      {/* Disabled state hint */}
      {!state.isEnabled && (
        <div className="mobile-access-disabled-hint">
          <p>
            Turn on to create a personal streaming portal.
            Scan the QR code with your phone to listen anywhere.
          </p>
        </div>
      )}
    </div>
  );
};

// ========================================
// Icons
// ========================================

const MobileIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/>
  </svg>
);

const LockIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
  </svg>
);

const ShieldIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
  </svg>
);

const ControlIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/>
  </svg>
);

const InfoIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
  </svg>
);

const QRIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zM3 21h8v-8H3v8zm2-6h4v4H5v-4zM13 3v8h8V3h-8zm6 6h-4V5h4v4zM13 13h2v2h-2zM15 15h2v2h-2zM13 17h2v2h-2zM17 13h2v2h-2zM19 15h2v2h-2zM17 17h2v2h-2zM15 19h2v2h-2zM19 19h2v2h-2z"/>
  </svg>
);

const CopyIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
  </svg>
);

const CheckIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
  </svg>
);

const DevicesIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z"/>
  </svg>
);

const PhoneIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 1H8C6.34 1 5 2.34 5 4v16c0 1.66 1.34 3 3 3h8c1.66 0 3-1.34 3-3V4c0-1.66-1.34-3-3-3zm-2 20h-4v-1h4v1zm3.25-3H6.75V4h10.5v14z"/>
  </svg>
);

const CloseIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
  </svg>
);

const GlobeIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
  </svg>
);

const RefreshIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
  </svg>
);

const KeyIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
  </svg>
);

const EyeIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
  </svg>
);

const EyeOffIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
  </svg>
);

const LinkIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
  </svg>
);

export default MobileAccessSettings;
