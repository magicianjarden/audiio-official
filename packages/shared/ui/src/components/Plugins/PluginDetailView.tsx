import React, { useCallback, useMemo } from 'react';
import { usePluginStore, type PluginCategory, type PluginSettingDefinition } from '../../stores/plugin-store';
import { useNavigationStore } from '../../stores/navigation-store';
import { useSearchStore } from '../../stores/search-store';
import { FloatingSearch, type SearchAction } from '../Search/FloatingSearch';
import { PrivacyCard } from './PrivacyCard';
import {
  PluginIcon,
  BackIcon,
  DeleteIcon,
  CheckIcon,
  SettingsIcon,
  DownloadIcon,
} from '@audiio/icons';

const categoryLabels: Record<PluginCategory, string> = {
  metadata: 'Metadata Provider',
  streaming: 'Streaming Provider',
  lyrics: 'Lyrics Provider',
  translation: 'Translation Service',
  scrobbling: 'Scrobbling Service',
  analysis: 'Audio Analysis',
  audio: 'Audio Processor',
  tool: 'Tool',
  other: 'Other',
};

const categoryColors: Record<PluginCategory, string> = {
  metadata: 'var(--color-access-metadata)',
  streaming: 'var(--color-access-streaming)',
  lyrics: 'var(--color-access-lyrics)',
  translation: 'var(--color-access-translation, var(--color-access-lyrics))',
  scrobbling: 'var(--color-access-scrobbling)',
  analysis: 'var(--color-access-analysis, var(--color-access-metadata))',
  audio: 'var(--color-access-audio, var(--color-access-playback))',
  tool: 'var(--color-access-tool, var(--color-access-system))',
  other: 'var(--color-access-other)',
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
            step={setting.step}
            onChange={(e) => onChange(parseInt(e.target.value, 10) || setting.default as number)}
            disabled={disabled}
          />
        );

      case 'string':
        return (
          <input
            type={setting.secret ? 'password' : 'text'}
            className="plugin-text-input"
            value={(value as string) || ''}
            placeholder={setting.placeholder}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        );

      case 'color':
        return (
          <input
            type="color"
            className="plugin-color-input"
            value={(value as string) || '#6366f1'}
            onChange={(e) => onChange(e.target.value)}
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
        <span className="plugin-setting-label">
          {setting.label}
          {setting.required && <span className="plugin-setting-required">*</span>}
        </span>
        {setting.description && (
          <span className="plugin-setting-description">{setting.description}</span>
        )}
      </div>
      {renderControl()}
    </div>
  );
};

export const PluginDetailView: React.FC = () => {
  const { selectedPluginId, goBack } = useNavigationStore();
  const { plugins, togglePlugin, removePlugin, updatePluginSetting } = usePluginStore();

  // Global search redirect
  const { setQuery, setIsOpen } = useSearchStore();
  const handleSearch = useCallback((query: string) => {
    if (query.trim()) {
      setQuery(query);
      setIsOpen(true);
    }
  }, [setQuery, setIsOpen]);

  const plugin = plugins.find(p => p.id === selectedPluginId);

  const handleToggle = useCallback(() => {
    if (plugin) togglePlugin(plugin.id);
  }, [plugin, togglePlugin]);

  const handleUninstall = useCallback(async () => {
    if (!plugin) return;
    if (confirm(`Are you sure you want to uninstall "${plugin.name}"?`)) {
      try {
        await removePlugin(plugin.id);
        goBack();
      } catch (error) {
        console.error('Failed to uninstall plugin:', error);
      }
    }
  }, [plugin, removePlugin, goBack]);

  // Actions for FloatingSearch CTA
  const actions: SearchAction[] = useMemo(() => {
    if (!plugin) return [];
    const result: SearchAction[] = [];

    if (plugin.installed) {
      result.push({
        id: 'toggle',
        label: plugin.enabled ? 'Disable' : 'Enable',
        icon: plugin.enabled ? <CheckIcon size={14} /> : <PluginIcon size={14} />,
        primary: true,
        active: plugin.enabled,
        onClick: handleToggle,
      });
      result.push({
        id: 'uninstall',
        label: 'Uninstall',
        icon: <DeleteIcon size={14} />,
        onClick: handleUninstall,
      });
    } else {
      result.push({
        id: 'install',
        label: 'Install',
        icon: <DownloadIcon size={14} />,
        primary: true,
        onClick: () => {}, // TODO: implement install
      });
    }

    return result;
  }, [plugin, handleToggle, handleUninstall]);

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

  return (
    <div className="plugin-detail-view">
      <FloatingSearch
        onSearch={handleSearch}
        onClose={() => {}}
        isSearchActive={false}
        actions={actions}
        pageContext={{ type: 'other', icon: <PluginIcon size={14} /> }}
        detailInfo={{
          title: plugin.name,
          subtitle: `${categoryLabels[plugin.category]} v${plugin.version}`,
          icon: plugin.icon ? (
            <img src={plugin.icon} alt={plugin.name} style={{ width: 16, height: 16, borderRadius: 4 }} />
          ) : (
            <PluginIcon size={16} />
          ),
          color: categoryColors[plugin.category],
          onBack: goBack,
        }}
      />

      {/* Ambient Background */}
      <div
        className="detail-ambient-bg plugin-ambient"
        style={{ background: categoryColors[plugin.category] }}
      />

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
          <PrivacyCard privacy={plugin.privacy} pluginName={plugin.name} />
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
