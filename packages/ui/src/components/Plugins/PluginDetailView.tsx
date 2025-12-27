import React from 'react';
import { usePluginStore, type PluginCategory, type PluginPrivacyAccess, type PluginSettingDefinition } from '../../stores/plugin-store';
import { useNavigationStore } from '../../stores/navigation-store';
import {
  PluginIcon,
  BackIcon,
  DeleteIcon,
  NetworkIcon,
  StorageIcon,
  PlaybackIcon,
  LibraryAccessIcon,
  SystemIcon,
  ShieldIcon,
  CheckIcon,
  SettingsIcon,
} from '@audiio/icons';

const categoryLabels: Record<PluginCategory, string> = {
  metadata: 'Metadata Provider',
  streaming: 'Streaming Provider',
  lyrics: 'Lyrics Provider',
  translation: 'Translation Service',
  scrobbling: 'Scrobbling Service',
  analysis: 'Audio Analysis',
  other: 'Other',
};

const categoryColors: Record<PluginCategory, string> = {
  metadata: 'var(--color-access-metadata)',
  streaming: 'var(--color-access-streaming)',
  lyrics: 'var(--color-access-lyrics)',
  translation: 'var(--color-access-translation, var(--color-access-lyrics))',
  scrobbling: 'var(--color-access-scrobbling)',
  analysis: 'var(--color-access-analysis, var(--color-access-metadata))',
  other: 'var(--color-access-other)',
};

const accessTypeIcons: Record<string, React.FC<{ size?: number }>> = {
  network: NetworkIcon,
  storage: StorageIcon,
  playback: PlaybackIcon,
  library: LibraryAccessIcon,
  system: SystemIcon,
};

const accessTypeColors: Record<string, string> = {
  network: 'var(--color-access-network)',
  storage: 'var(--color-access-storage)',
  playback: 'var(--color-access-playback)',
  library: 'var(--color-access-library)',
  system: 'var(--color-access-system)',
};

// ========================================
// Plugin Setting Item Component
// ========================================

interface PluginSettingItemProps {
  setting: PluginSettingDefinition;
  value: boolean | string | number;
  onChange: (value: boolean | string | number) => void;
  disabled?: boolean;
}

const PluginSettingItem: React.FC<PluginSettingItemProps> = ({
  setting,
  value,
  onChange,
  disabled = false,
}) => {
  const renderControl = () => {
    switch (setting.type) {
      case 'boolean':
        return (
          <label className="plugin-toggle">
            <input
              type="checkbox"
              checked={value as boolean}
              onChange={(e) => onChange(e.target.checked)}
              disabled={disabled}
            />
            <span className="plugin-toggle-slider"></span>
          </label>
        );

      case 'select':
        return (
          <select
            className="plugin-select"
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          >
            {setting.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'number':
        return (
          <input
            type="number"
            className="plugin-number-input"
            value={value as number}
            min={setting.min}
            max={setting.max}
            onChange={(e) => onChange(parseInt(e.target.value, 10) || setting.default as number)}
            disabled={disabled}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="plugin-setting-item">
      <div className="plugin-setting-info">
        <span className="plugin-setting-label">{setting.label}</span>
        <span className="plugin-setting-description">{setting.description}</span>
      </div>
      {renderControl()}
    </div>
  );
};

interface PrivacyCardProps {
  privacyAccess: PluginPrivacyAccess[];
}

const PrivacyCard: React.FC<PrivacyCardProps> = ({ privacyAccess }) => {
  if (privacyAccess.length === 0) {
    return (
      <div className="privacy-card">
        <div className="privacy-card-header">
          <ShieldIcon size={24} />
          <h3>App Privacy</h3>
        </div>
        <div className="privacy-card-empty">
          <CheckIcon size={32} />
          <p>This plugin does not access any sensitive data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="privacy-card">
      <div className="privacy-card-header">
        <ShieldIcon size={24} />
        <h3>App Privacy</h3>
      </div>
      <p className="privacy-card-subtitle">
        The developer indicated that this plugin may access the following data:
      </p>
      <div className="privacy-access-list">
        {privacyAccess.map((access, index) => {
          const Icon = accessTypeIcons[access.type] || SystemIcon;
          const color = accessTypeColors[access.type] || '#6b7280';
          return (
            <div key={index} className="privacy-access-item">
              <div className="privacy-access-icon" style={{ backgroundColor: `${color}20`, color }}>
                <Icon size={20} />
              </div>
              <div className="privacy-access-info">
                <div className="privacy-access-header">
                  <span className="privacy-access-label">{access.label}</span>
                  {access.required && (
                    <span className="privacy-access-required">Required</span>
                  )}
                </div>
                <p className="privacy-access-description">{access.description}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="privacy-card-footer">
        <p>
          Privacy practices may vary based on the features you use or your configuration.
          <a href="#" className="privacy-learn-more">Learn More</a>
        </p>
      </div>
    </div>
  );
};

export const PluginDetailView: React.FC = () => {
  const { selectedPluginId, goBack } = useNavigationStore();
  const { plugins, togglePlugin, removePlugin, updatePluginSetting } = usePluginStore();

  const plugin = plugins.find(p => p.id === selectedPluginId);

  if (!plugin) {
    return (
      <div className="plugin-detail-view">
        <div className="plugin-detail-empty">
          <h3>Plugin not found</h3>
          <button onClick={goBack}>Go back</button>
        </div>
      </div>
    );
  }

  const handleToggle = () => {
    togglePlugin(plugin.id);
  };

  const handleUninstall = () => {
    if (confirm(`Are you sure you want to uninstall "${plugin.name}"?`)) {
      removePlugin(plugin.id);
      goBack();
    }
  };

  return (
    <div className="plugin-detail-view">
      <header className="plugin-detail-header">
        <button className="back-btn-round plugin-back-btn-pos" onClick={goBack} aria-label="Go back">
          <BackIcon size={20} />
        </button>
      </header>

      <div className="plugin-detail-hero">
        <div
          className="plugin-detail-icon"
          style={{ background: categoryColors[plugin.category] }}
        >
          {plugin.icon ? (
            <img src={plugin.icon} alt={plugin.name} />
          ) : (
            <PluginIcon size={56} />
          )}
        </div>
        <div className="plugin-detail-info">
          <h1 className="plugin-detail-name">{plugin.name}</h1>
          <span className="plugin-detail-category" style={{ color: categoryColors[plugin.category] }}>
            {categoryLabels[plugin.category]}
          </span>
          <div className="plugin-detail-meta">
            <span className="plugin-detail-version">Version {plugin.version}</span>
            <span className="plugin-detail-author">by {plugin.author}</span>
          </div>
        </div>
        <div className="plugin-detail-actions">
          {plugin.installed ? (
            <button
              className="plugin-action-button danger"
              onClick={handleUninstall}
            >
              <DeleteIcon size={18} />
              Uninstall
            </button>
          ) : (
            <button className="plugin-action-button primary">
              Install
            </button>
          )}
        </div>
      </div>

      <div className="plugin-detail-content">
        <section className="plugin-detail-section">
          <h2>About</h2>
          <p className="plugin-detail-description">{plugin.description}</p>
          {(plugin.homepage || plugin.repository) && (
            <div className="plugin-detail-links">
              {plugin.homepage && (
                <a href={plugin.homepage} target="_blank" rel="noopener noreferrer">
                  Homepage
                </a>
              )}
              {plugin.repository && (
                <a href={plugin.repository} target="_blank" rel="noopener noreferrer">
                  Source Code
                </a>
              )}
            </div>
          )}
        </section>

        <section className="plugin-detail-section">
          <PrivacyCard privacyAccess={plugin.privacyAccess} />
        </section>

        <section className="plugin-detail-section">
          <h2>Settings</h2>
          <div className="plugin-settings-list">
            {/* Enable/Disable toggle */}
            <div className="plugin-setting-item">
              <div className="plugin-setting-info">
                <span className="plugin-setting-label">Enabled</span>
                <span className="plugin-setting-description">
                  Allow this plugin to run and access data
                </span>
              </div>
              <label className="plugin-toggle">
                <input
                  type="checkbox"
                  checked={plugin.enabled}
                  onChange={handleToggle}
                  disabled={!plugin.installed}
                />
                <span className="plugin-toggle-slider"></span>
              </label>
            </div>

            {/* Plugin-specific settings */}
            {plugin.settingsDefinitions && plugin.settingsDefinitions.length > 0 && (
              <>
                <div className="plugin-settings-divider" />
                <div className="plugin-settings-header">
                  <SettingsIcon size={16} />
                  <span>Plugin Configuration</span>
                </div>
                {plugin.settingsDefinitions.map((setting) => (
                  <PluginSettingItem
                    key={setting.key}
                    setting={setting}
                    value={plugin.settings?.[setting.key] ?? setting.default}
                    onChange={(value) => updatePluginSetting(plugin.id, setting.key, value)}
                    disabled={!plugin.enabled || !plugin.installed}
                  />
                ))}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
