/**
 * Plugin Detail Page - View and configure individual plugin
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePluginStore, CATEGORY_COLORS, type PluginSettingDefinition } from '../stores/plugin-store';
import { ChevronLeftIcon, PlugIcon, ShieldIcon } from '@audiio/icons';
import styles from './PluginDetailPage.module.css';

export function PluginDetailPage() {
  const { pluginId } = useParams<{ pluginId: string }>();
  const navigate = useNavigate();
  const { plugins, fetchPlugins, togglePlugin, updatePluginSettings } = usePluginStore();
  const [localSettings, setLocalSettings] = useState<Record<string, unknown>>({});
  const [isSaving, setIsSaving] = useState(false);

  const plugin = plugins.find(p => p.id === pluginId);

  useEffect(() => {
    if (plugins.length === 0) {
      fetchPlugins();
    }
  }, [plugins.length, fetchPlugins]);

  useEffect(() => {
    if (plugin?.settings) {
      setLocalSettings(plugin.settings);
    }
  }, [plugin?.settings]);

  if (!plugin) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <button className={styles.backButton} onClick={() => navigate(-1)}>
            <ChevronLeftIcon />
          </button>
          <h1 className={styles.title}>Plugin</h1>
        </header>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  const getCategoryColor = () => {
    return CATEGORY_COLORS[plugin.category || 'other'] || CATEGORY_COLORS.other;
  };

  const handleToggle = async () => {
    await togglePlugin(plugin.id);
  };

  const handleSettingChange = async (key: string, value: unknown) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);

    setIsSaving(true);
    await updatePluginSettings(plugin.id, newSettings);
    setIsSaving(false);
  };

  const renderSettingControl = (setting: PluginSettingDefinition) => {
    const value = localSettings[setting.key] ?? setting.default;

    switch (setting.type) {
      case 'boolean':
        return (
          <button
            className={`${styles.toggle} ${value ? styles.enabled : ''}`}
            onClick={() => handleSettingChange(setting.key, !value)}
            disabled={isSaving}
          >
            <span className={styles.toggleKnob} />
          </button>
        );

      case 'select':
        return (
          <select
            className={styles.select}
            value={String(value)}
            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
            disabled={isSaving}
          >
            {setting.options?.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'number':
        return (
          <input
            type="number"
            className={styles.numberInput}
            value={Number(value)}
            min={setting.min}
            max={setting.max}
            onChange={(e) => handleSettingChange(setting.key, Number(e.target.value))}
            disabled={isSaving}
          />
        );

      default:
        return (
          <input
            type="text"
            className={styles.textInput}
            value={String(value)}
            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
            disabled={isSaving}
          />
        );
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          <ChevronLeftIcon />
        </button>
        <h1 className={styles.title}>Plugin Details</h1>
      </header>

      <div className={styles.content}>
        {/* Hero Section */}
        <div className={styles.hero}>
          <div
            className={styles.heroIcon}
            style={{ backgroundColor: getCategoryColor() }}
          >
            <PlugIcon />
          </div>
          <h2 className={styles.pluginName}>{plugin.name}</h2>
          <div className={styles.pluginMeta}>
            <span
              className={styles.category}
              style={{ color: getCategoryColor() }}
            >
              {plugin.category || 'other'}
            </span>
            {plugin.version && <span className={styles.version}>v{plugin.version}</span>}
            {plugin.author && <span className={styles.author}>by {plugin.author}</span>}
          </div>
        </div>

        {/* Enable/Disable */}
        <section className={styles.section}>
          <div className={styles.card}>
            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>Enable Plugin</span>
                <span className={styles.settingDesc}>
                  {plugin.enabled ? 'Plugin is active and running' : 'Plugin is disabled'}
                </span>
              </div>
              <button
                className={`${styles.toggle} ${styles.large} ${plugin.enabled ? styles.enabled : ''}`}
                onClick={handleToggle}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>
        </section>

        {/* Description */}
        {plugin.description && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>About</h3>
            <div className={styles.card}>
              <p className={styles.description}>{plugin.description}</p>
            </div>
          </section>
        )}

        {/* Capabilities */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Capabilities</h3>
          <div className={styles.card}>
            <div className={styles.capabilities}>
              {plugin.roles.map(role => (
                <span key={role} className={styles.capability}>
                  {role.replace('-', ' ')}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Settings */}
        {plugin.settingsDefinitions && plugin.settingsDefinitions.length > 0 && plugin.enabled && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              Configuration
              {isSaving && <span className={styles.savingIndicator}>Saving...</span>}
            </h3>
            <div className={styles.card}>
              {plugin.settingsDefinitions.map((setting, index) => (
                <div
                  key={setting.key}
                  className={`${styles.settingRow} ${index < plugin.settingsDefinitions!.length - 1 ? styles.bordered : ''}`}
                >
                  <div className={styles.settingInfo}>
                    <span className={styles.settingLabel}>{setting.label}</span>
                    <span className={styles.settingDesc}>{setting.description}</span>
                  </div>
                  {renderSettingControl(setting)}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Privacy */}
        <section className={styles.section}>
          <div className={styles.privacyCard}>
            <div className={styles.privacyHeader}>
              <ShieldIcon />
              <span>Privacy</span>
            </div>
            <div className={styles.privacyContent}>
              <p>This plugin may access:</p>
              <ul>
                {plugin.roles.includes('metadata-provider') && (
                  <li>Network access for fetching metadata</li>
                )}
                {plugin.roles.includes('stream-provider') && (
                  <li>Network access for streaming audio</li>
                )}
                {plugin.roles.includes('lyrics-provider') && (
                  <li>Network access for fetching lyrics</li>
                )}
                {plugin.roles.includes('scrobbler') && (
                  <li>Your listening history</li>
                )}
                <li>Basic playback information</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
