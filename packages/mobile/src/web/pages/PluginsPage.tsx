/**
 * Plugins Page - Manage host plugins from mobile
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePluginStore, CATEGORY_COLORS, type Plugin } from '../stores/plugin-store';
import { ChevronLeftIcon, ChevronRightIcon, PlugIcon } from '@audiio/icons';
import styles from './PluginsPage.module.css';

export function PluginsPage() {
  const navigate = useNavigate();
  const { plugins, isLoading, error, fetchPlugins, togglePlugin, selectPlugin } = usePluginStore();

  useEffect(() => {
    fetchPlugins();
  }, [fetchPlugins]);

  const handlePluginClick = (plugin: Plugin) => {
    selectPlugin(plugin.id);
    navigate(`/plugins/${plugin.id}`);
  };

  const handleToggle = async (e: React.MouseEvent, pluginId: string) => {
    e.stopPropagation();
    await togglePlugin(pluginId);
  };

  const getCategoryColor = (category?: string) => {
    return CATEGORY_COLORS[category || 'other'] || CATEGORY_COLORS.other;
  };

  const enabledCount = plugins.filter(p => p.enabled).length;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          <ChevronLeftIcon />
        </button>
        <h1 className={styles.title}>Plugins</h1>
      </header>

      <div className={styles.content}>
        {/* Stats */}
        <div className={styles.stats}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{enabledCount}</span>
            <span className={styles.statLabel}>Active</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{plugins.length}</span>
            <span className={styles.statLabel}>Total</span>
          </div>
        </div>

        {/* Info Banner */}
        <div className={styles.infoBanner}>
          <p>
            Plugins extend Audiio's capabilities. Changes sync with your desktop app in real-time.
          </p>
        </div>

        {/* Plugin List */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Installed Plugins</h2>

          {isLoading ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <span>Loading plugins...</span>
            </div>
          ) : error ? (
            <div className={styles.error}>
              <p>Failed to load plugins</p>
              <button onClick={fetchPlugins}>Retry</button>
            </div>
          ) : plugins.length > 0 ? (
            <div className={styles.pluginList}>
              {plugins.map((plugin, index) => (
                <div
                  key={plugin.id}
                  className={styles.pluginCard}
                  onClick={() => handlePluginClick(plugin)}
                >
                  <div className={styles.pluginLeft}>
                    <div
                      className={styles.pluginIcon}
                      style={{ backgroundColor: getCategoryColor(plugin.category) }}
                    >
                      <PlugIcon />
                    </div>
                    <div className={styles.pluginInfo}>
                      <div className={styles.pluginHeader}>
                        <span className={styles.pluginName}>{plugin.name}</span>
                        <span className={styles.pluginPriority}>#{index + 1}</span>
                      </div>
                      {plugin.description && (
                        <span className={styles.pluginDesc}>{plugin.description}</span>
                      )}
                      <div className={styles.pluginMeta}>
                        <span
                          className={styles.pluginCategory}
                          style={{ color: getCategoryColor(plugin.category) }}
                        >
                          {plugin.category || 'other'}
                        </span>
                        {plugin.version && (
                          <span className={styles.pluginVersion}>v{plugin.version}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={styles.pluginRight}>
                    <button
                      className={`${styles.toggle} ${plugin.enabled ? styles.enabled : ''}`}
                      onClick={(e) => handleToggle(e, plugin.id)}
                      aria-label={plugin.enabled ? 'Disable plugin' : 'Enable plugin'}
                    >
                      <span className={styles.toggleKnob} />
                    </button>
                    <ChevronRightIcon className={styles.chevron} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <PlugIcon className={styles.emptyIcon} />
              <p>No plugins installed</p>
              <span>Plugins are managed from the desktop app</span>
            </div>
          )}
        </section>

        {/* Hint */}
        <p className={styles.hint}>
          Tap a plugin to view details and configure settings
        </p>
      </div>
    </div>
  );
}
