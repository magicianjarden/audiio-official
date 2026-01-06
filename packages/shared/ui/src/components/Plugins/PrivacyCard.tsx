/**
 * Privacy Card Component
 * Apple-style privacy transparency with Simple and Detailed views
 */

import React, { useState } from 'react';
import type {
  PrivacyManifest,
  PrivacyDataAccess,
  PrivacyNetworkAccess,
  PrivacyDataCategory
} from '@audiio/core';
import {
  ShieldIcon,
  ShieldCheckIcon,
  NetworkIcon,
  StorageIcon,
  ShareIcon,
  ClockIcon,
  GlobeIcon,
  MusicNoteIcon,
  LibraryAccessIcon,
  KeyIcon,
  DeviceIcon,
  StatsIcon,
  ChevronDownIcon,
  CheckIcon
} from '@audiio/icons';

// ========================================
// Types
// ========================================

interface PrivacyCardProps {
  privacy?: PrivacyManifest;
  pluginName?: string;
}

type ViewMode = 'simple' | 'detailed';

// ========================================
// Icon mapping for data categories
// ========================================

const categoryIcons: Record<PrivacyDataCategory, React.FC<{ size?: number }>> = {
  'listening-history': MusicNoteIcon,
  'library-data': LibraryAccessIcon,
  'user-credentials': KeyIcon,
  'device-info': DeviceIcon,
  'usage-analytics': StatsIcon,
  'audio-content': MusicNoteIcon
};

const categoryColors: Record<PrivacyDataCategory, string> = {
  'listening-history': 'var(--color-access-playback, #8b5cf6)',
  'library-data': 'var(--color-access-library, #3b82f6)',
  'user-credentials': 'var(--color-access-system, #f59e0b)',
  'device-info': 'var(--color-access-system, #6b7280)',
  'usage-analytics': 'var(--color-access-network, #10b981)',
  'audio-content': 'var(--color-access-playback, #ec4899)'
};

const usageLabels: Record<string, string> = {
  'service-functionality': 'Functionality',
  'personalization': 'Personalization',
  'analytics': 'Analytics',
  'third-party-sharing': 'Third-party'
};

// ========================================
// Segmented Control Component
// ========================================

interface SegmentedControlProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({ value, onChange }) => (
  <div className="privacy-view-toggle">
    <button
      className={`privacy-view-toggle-btn ${value === 'simple' ? 'active' : ''}`}
      onClick={() => onChange('simple')}
    >
      Simple
    </button>
    <button
      className={`privacy-view-toggle-btn ${value === 'detailed' ? 'active' : ''}`}
      onClick={() => onChange('detailed')}
    >
      Detailed
    </button>
  </div>
);

// ========================================
// Simple View Component
// ========================================

interface SimpleViewProps {
  privacy: PrivacyManifest;
  pluginName?: string;
}

const SimpleView: React.FC<SimpleViewProps> = ({ privacy, pluginName }) => {
  const thirdPartyHost = privacy.networkAccess[0]?.host;

  return (
    <div className="privacy-simple-view">
      {/* Summary Badges */}
      <div className="privacy-summary-badges">
        {privacy.sharesWithThirdParties ? (
          <div className="privacy-badge privacy-badge-shares">
            <ShareIcon size={16} />
            <span>Shares Data</span>
          </div>
        ) : (
          <div className="privacy-badge privacy-badge-no-sharing">
            <ShieldCheckIcon size={16} />
            <span>No Sharing</span>
          </div>
        )}

        {privacy.collects ? (
          <div className="privacy-badge privacy-badge-collects">
            <StorageIcon size={16} />
            <span>Collects Data</span>
          </div>
        ) : (
          <div className="privacy-badge privacy-badge-no-collection">
            <ShieldCheckIcon size={16} />
            <span>No Collection</span>
          </div>
        )}

        {!privacy.tracksAcrossApps && (
          <div className="privacy-badge privacy-badge-no-tracking">
            <CheckIcon size={16} />
            <span>No Tracking</span>
          </div>
        )}
      </div>

      {/* Quick List */}
      {privacy.dataAccess.length > 0 && (
        <div className="privacy-quick-list">
          {privacy.dataAccess.map((access, index) => {
            const Icon = categoryIcons[access.category] || StorageIcon;
            return (
              <div key={index} className="privacy-quick-item">
                <Icon size={16} />
                <span>{access.userFriendlyLabel}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {thirdPartyHost && (
        <div className="privacy-simple-footer">
          Data shared with {pluginName || thirdPartyHost.split('.')[0]}
        </div>
      )}
    </div>
  );
};

// ========================================
// Detailed View Component
// ========================================

interface DetailedViewProps {
  privacy: PrivacyManifest;
}

const DataAccessItem: React.FC<{ access: PrivacyDataAccess }> = ({ access }) => {
  const [expanded, setExpanded] = useState(false);
  const Icon = categoryIcons[access.category] || StorageIcon;
  const color = categoryColors[access.category];

  return (
    <div className="privacy-data-item">
      <div className="privacy-data-item-header">
        <div
          className="privacy-data-item-icon"
          style={{ backgroundColor: `${color}20`, color }}
        >
          <Icon size={20} />
        </div>
        <div className="privacy-data-item-info">
          <div className="privacy-data-item-title">
            <span>{access.userFriendlyLabel}</span>
            {access.required && (
              <span className="privacy-required-badge">Required</span>
            )}
          </div>
          <p className="privacy-data-item-desc">{access.userFriendlyDesc}</p>
        </div>
      </div>

      {/* Usage badges */}
      <div className="privacy-usage-badges">
        <span className="privacy-usage-label">Used for:</span>
        {access.usage.map((use, idx) => (
          <span key={idx} className="privacy-usage-badge">
            {usageLabels[use] || use}
          </span>
        ))}
      </div>

      {/* Technical details (expandable) */}
      {access.technicalDesc && (
        <div className="privacy-technical-section">
          <button
            className="privacy-technical-toggle"
            onClick={() => setExpanded(!expanded)}
          >
            <ChevronDownIcon
              size={14}
              style={{
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }}
            />
            <span>Technical Details</span>
          </button>
          {expanded && (
            <div className="privacy-technical-content">
              <code>{access.technicalDesc}</code>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const NetworkAccessItem: React.FC<{ network: PrivacyNetworkAccess }> = ({ network }) => (
  <div className="privacy-network-item">
    <div className="privacy-network-header">
      <GlobeIcon size={18} />
      <span className="privacy-network-host">{network.host}</span>
    </div>
    <p className="privacy-network-purpose">{network.purpose}</p>
    <div className="privacy-network-data">
      <span>Sends:</span>
      {network.dataTypes.map((type, idx) => (
        <span key={idx} className="privacy-network-data-type">
          {type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
        </span>
      ))}
    </div>
  </div>
);

const DetailedView: React.FC<DetailedViewProps> = ({ privacy }) => {
  const retentionLabels: Record<string, string> = {
    'session': 'Cleared when app closes',
    'persistent': 'Stored permanently',
    'third-party-controlled': 'Controlled by third party'
  };

  return (
    <div className="privacy-detailed-view">
      {/* Data Collected Section */}
      {privacy.dataAccess.length > 0 && (
        <div className="privacy-section">
          <h4 className="privacy-section-title">DATA COLLECTED</h4>
          <div className="privacy-section-content">
            {privacy.dataAccess.map((access, index) => (
              <DataAccessItem key={index} access={access} />
            ))}
          </div>
        </div>
      )}

      {/* Network Access Section */}
      {privacy.networkAccess.length > 0 && (
        <div className="privacy-section">
          <h4 className="privacy-section-title">NETWORK ACCESS</h4>
          <div className="privacy-section-content">
            {privacy.networkAccess.map((network, index) => (
              <NetworkAccessItem key={index} network={network} />
            ))}
          </div>
        </div>
      )}

      {/* Storage Section */}
      {(privacy.localStorageUsed || privacy.dataRetention) && (
        <div className="privacy-section">
          <h4 className="privacy-section-title">STORAGE</h4>
          <div className="privacy-storage-list">
            {privacy.localStorageUsed && privacy.localStorageDesc && (
              <div className="privacy-storage-item">
                <StorageIcon size={16} />
                <span>Local: {privacy.localStorageDesc}</span>
              </div>
            )}
            {privacy.dataRetention && (
              <div className="privacy-storage-item">
                <ClockIcon size={16} />
                <span>Retention: {retentionLabels[privacy.dataRetention]}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Last Updated */}
      {privacy.lastUpdated && (
        <div className="privacy-last-updated">
          Last updated: {new Date(privacy.lastUpdated).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </div>
      )}
    </div>
  );
};

// ========================================
// Empty State Component
// ========================================

const EmptyState: React.FC = () => (
  <div className="privacy-card-empty">
    <ShieldCheckIcon size={32} />
    <p>This plugin does not access any sensitive data</p>
  </div>
);

// ========================================
// Main PrivacyCard Component
// ========================================

export const PrivacyCard: React.FC<PrivacyCardProps> = ({ privacy, pluginName }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('simple');

  // No privacy manifest or empty manifest
  const hasPrivacyData = privacy &&
    (privacy.dataAccess.length > 0 || privacy.networkAccess.length > 0);

  return (
    <div className="privacy-card">
      <div className="privacy-card-header">
        <div className="privacy-card-title">
          <ShieldIcon size={24} />
          <h3>App Privacy</h3>
        </div>
        {hasPrivacyData && (
          <SegmentedControl value={viewMode} onChange={setViewMode} />
        )}
      </div>

      {!hasPrivacyData ? (
        <EmptyState />
      ) : viewMode === 'simple' ? (
        <SimpleView privacy={privacy!} pluginName={pluginName} />
      ) : (
        <DetailedView privacy={privacy!} />
      )}

      {hasPrivacyData && (
        <div className="privacy-card-footer">
          <p>
            Privacy practices may vary based on features you use or your configuration.
          </p>
        </div>
      )}
    </div>
  );
};

export default PrivacyCard;
