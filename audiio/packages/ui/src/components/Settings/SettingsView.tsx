/**
 * SettingsView - Main settings page with theme customization
 */

import React, { useState } from 'react';
import { useThemeStore, type SystemMode, type ThemeConfig } from '../../stores/theme-store';
import { ThemeEditorModal } from './ThemeEditorModal';
import { MobileAccessSettings } from './MobileAccessSettings';
import { StorageSettings } from './StorageSettings';
import { AudioSettings } from './AudioSettings';
import { fetchThemeFromGitHub } from '../../utils/theme-utils';
import {
  SettingsIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  CheckIcon,
  PaletteIcon,
  PlusIcon,
  TrashIcon,
  DownloadIcon,
  UploadIcon,
  EditIcon,
  GitHubIcon,
  LoadingIcon,
  FolderIcon,
  MusicNoteIcon,
} from '@audiio/icons';

// ========================================
// Theme Preview Card
// ========================================

interface ThemePreviewCardProps {
  theme: ThemeConfig;
  isActive: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}

const ThemePreviewCard: React.FC<ThemePreviewCardProps> = ({
  theme,
  isActive,
  onSelect,
  onDelete,
  onEdit,
}) => {
  return (
    <button
      className={`theme-preview-card ${isActive ? 'active' : ''}`}
      onClick={onSelect}
      title={theme.description}
    >
      {/* Theme Preview */}
      <div
        className="theme-preview"
        style={{
          background: theme.colors.bgPrimary,
          borderColor: theme.colors.borderColor,
        }}
      >
        {/* Mini sidebar */}
        <div
          className="theme-preview-sidebar"
          style={{ background: theme.colors.bgSecondary }}
        >
          <div
            className="theme-preview-sidebar-item"
            style={{ background: theme.colors.accent }}
          />
          <div
            className="theme-preview-sidebar-item"
            style={{ background: theme.colors.bgTertiary }}
          />
        </div>
        {/* Mini content */}
        <div className="theme-preview-content">
          <div
            className="theme-preview-header"
            style={{ background: theme.colors.textPrimary }}
          />
          <div className="theme-preview-cards">
            <div
              className="theme-preview-card-item"
              style={{ background: theme.colors.bgSecondary }}
            />
            <div
              className="theme-preview-card-item"
              style={{ background: theme.colors.bgSecondary }}
            />
          </div>
        </div>
        {/* Mini player */}
        <div
          className="theme-preview-player"
          style={{ background: theme.colors.bgSecondary }}
        >
          <div
            className="theme-preview-player-accent"
            style={{ background: theme.colors.accent }}
          />
        </div>
      </div>

      {/* Theme Info */}
      <div className="theme-preview-info">
        <span className="theme-preview-name">{theme.name}</span>
        <span className="theme-preview-mode">{theme.mode}</span>
      </div>

      {/* Active Indicator */}
      {isActive && (
        <div className="theme-preview-check">
          <CheckIcon size={14} />
        </div>
      )}

      {/* Action Buttons (for community themes) */}
      {(onEdit || onDelete) && (
        <div className="theme-preview-actions">
          {onEdit && (
            <button
              className="theme-preview-action edit"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              title="Edit theme"
            >
              <EditIcon size={14} />
            </button>
          )}
          {onDelete && (
            <button
              className="theme-preview-action delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Remove theme"
            >
              <TrashIcon size={14} />
            </button>
          )}
        </div>
      )}
    </button>
  );
};

// ========================================
// Mode Toggle
// ========================================

interface ModeToggleProps {
  currentMode: SystemMode;
  onChange: (mode: SystemMode) => void;
}

const ModeToggle: React.FC<ModeToggleProps> = ({ currentMode, onChange }) => {
  const modes: { id: SystemMode; label: string; icon: React.ReactNode }[] = [
    { id: 'auto', label: 'Auto', icon: <MonitorIcon size={16} /> },
    { id: 'light', label: 'Light', icon: <SunIcon size={16} /> },
    { id: 'dark', label: 'Dark', icon: <MoonIcon size={16} /> },
  ];

  return (
    <div className="mode-toggle">
      {modes.map((mode) => (
        <button
          key={mode.id}
          className={`mode-toggle-btn ${currentMode === mode.id ? 'active' : ''}`}
          onClick={() => onChange(mode.id)}
        >
          {mode.icon}
          <span>{mode.label}</span>
        </button>
      ))}
    </div>
  );
};

// ========================================
// Settings Tabs
// ========================================

type SettingsTab = 'appearance' | 'audio' | 'storage' | 'mobile';

// ========================================
// Settings View
// ========================================

export const SettingsView: React.FC = () => {
  const {
    activeThemeId,
    systemMode,
    themes,
    communityThemes,
    setTheme,
    setSystemMode,
    installTheme,
    uninstallTheme,
    importTheme,
    exportTheme,
    getActiveTheme,
  } = useThemeStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importJSON, setImportJSON] = useState('');
  const [importError, setImportError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<ThemeConfig | undefined>(undefined);
  const [githubModalOpen, setGithubModalOpen] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
  const [githubError, setGithubError] = useState('');
  const [githubLoading, setGithubLoading] = useState(false);

  const activeTheme = getActiveTheme();
  const builtinThemes = themes.filter((t) => t.source === 'builtin');
  const darkThemes = builtinThemes.filter((t) => t.mode === 'dark');
  const lightThemes = builtinThemes.filter((t) => t.mode === 'light');

  const handleImport = () => {
    if (!importJSON.trim()) {
      setImportError('Please paste theme JSON');
      return;
    }

    const result = importTheme(importJSON);
    if (result) {
      setImportModalOpen(false);
      setImportJSON('');
      setImportError('');
      setTheme(result.id);
    } else {
      setImportError('Invalid theme format. Please check the JSON.');
    }
  };

  const handleExport = () => {
    const json = exportTheme(activeThemeId);
    if (json) {
      navigator.clipboard.writeText(json);
      // Could add a toast notification here
    }
  };

  const handleCreateTheme = () => {
    setEditingTheme(undefined);
    setEditorOpen(true);
  };

  const handleEditTheme = (theme: ThemeConfig) => {
    setEditingTheme(theme);
    setEditorOpen(true);
  };

  const handleGitHubImport = async () => {
    if (!githubUrl.trim()) {
      setGithubError('Please enter a GitHub repository URL');
      return;
    }

    setGithubLoading(true);
    setGithubError('');

    try {
      const theme = await fetchThemeFromGitHub(githubUrl);
      if (theme) {
        // Generate a unique ID for the theme
        const themeWithId = {
          ...theme,
          id: `community-${Date.now()}`,
          source: 'community' as const,
        };
        installTheme(themeWithId);
        setTheme(themeWithId.id);
        setGithubModalOpen(false);
        setGithubUrl('');
      }
    } catch (error) {
      setGithubError(error instanceof Error ? error.message : 'Failed to import theme');
    } finally {
      setGithubLoading(false);
    }
  };

  return (
    <div className="settings-view">
      {/* Header */}
      <header className="settings-header">
        <div className="settings-header-icon">
          <SettingsIcon size={64} />
        </div>
        <div className="settings-header-info">
          <span className="settings-header-type">Preferences</span>
          <h1 className="settings-header-title">Settings</h1>
          <span className="settings-header-subtitle">Customize your Audiio experience</span>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === 'appearance' ? 'active' : ''}`}
          onClick={() => setActiveTab('appearance')}
        >
          <PaletteIcon size={18} />
          <span>Appearance</span>
        </button>
        <button
          className={`settings-tab ${activeTab === 'audio' ? 'active' : ''}`}
          onClick={() => setActiveTab('audio')}
        >
          <MusicNoteIcon size={18} />
          <span>Audio</span>
        </button>
        <button
          className={`settings-tab ${activeTab === 'storage' ? 'active' : ''}`}
          onClick={() => setActiveTab('storage')}
        >
          <FolderIcon size={18} />
          <span>Storage</span>
        </button>
        <button
          className={`settings-tab ${activeTab === 'mobile' ? 'active' : ''}`}
          onClick={() => setActiveTab('mobile')}
        >
          <MobileAccessIcon size={18} />
          <span>Mobile</span>
        </button>
      </div>

      <div className="settings-content">
        {/* Appearance Tab */}
        {activeTab === 'appearance' && (
        <section className="settings-section">
          <div className="settings-section-header">
            <PaletteIcon size={20} />
            <h2>Appearance</h2>
          </div>

          {/* Mode Toggle */}
          <div className="settings-option">
            <div className="settings-option-info">
              <h3>Mode</h3>
              <p>Choose between light, dark, or auto (follows system)</p>
            </div>
            <ModeToggle currentMode={systemMode} onChange={setSystemMode} />
          </div>

          {/* Current Theme Preview */}
          <div className="settings-current-theme">
            <div className="settings-current-theme-label">Current Theme</div>
            <div
              className="settings-current-theme-preview"
              style={{
                background: activeTheme.colors.bgSecondary,
                borderColor: activeTheme.colors.borderLight,
              }}
            >
              <div
                className="settings-current-accent"
                style={{ background: activeTheme.colors.accent }}
              />
              <div className="settings-current-info">
                <span className="settings-current-name">{activeTheme.name}</span>
                <span className="settings-current-author">by {activeTheme.author}</span>
              </div>
            </div>
          </div>

          {/* Dark Themes */}
          <div className="settings-theme-group">
            <h3>Dark Themes</h3>
            <div className="settings-theme-grid">
              {darkThemes.map((theme) => (
                <ThemePreviewCard
                  key={theme.id}
                  theme={theme}
                  isActive={activeThemeId === theme.id}
                  onSelect={() => setTheme(theme.id)}
                />
              ))}
            </div>
          </div>

          {/* Light Themes */}
          <div className="settings-theme-group">
            <h3>Light Themes</h3>
            <div className="settings-theme-grid">
              {lightThemes.map((theme) => (
                <ThemePreviewCard
                  key={theme.id}
                  theme={theme}
                  isActive={activeThemeId === theme.id}
                  onSelect={() => setTheme(theme.id)}
                />
              ))}
            </div>
          </div>

          {/* Community Themes */}
          {communityThemes.length > 0 && (
            <div className="settings-theme-group">
              <h3>Community Themes</h3>
              <div className="settings-theme-grid">
                {communityThemes.map((theme) => (
                  <ThemePreviewCard
                    key={theme.id}
                    theme={theme}
                    isActive={activeThemeId === theme.id}
                    onSelect={() => setTheme(theme.id)}
                    onEdit={() => handleEditTheme(theme)}
                    onDelete={() => uninstallTheme(theme.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Theme Actions */}
          <div className="settings-theme-actions">
            <button
              className="settings-action-btn primary"
              onClick={handleCreateTheme}
            >
              <PlusIcon size={16} />
              <span>Create Theme</span>
            </button>
            <button
              className="settings-action-btn"
              onClick={() => setGithubModalOpen(true)}
            >
              <GitHubIcon size={16} />
              <span>From GitHub</span>
            </button>
            <button
              className="settings-action-btn"
              onClick={() => setImportModalOpen(true)}
            >
              <UploadIcon size={16} />
              <span>Import JSON</span>
            </button>
            <button className="settings-action-btn" onClick={handleExport}>
              <DownloadIcon size={16} />
              <span>Export Current</span>
            </button>
          </div>
        </section>
        )}

        {/* Audio Tab */}
        {activeTab === 'audio' && (
          <section className="settings-section">
            <div className="settings-section-header">
              <MusicNoteIcon size={20} />
              <h2>Audio & Playback</h2>
            </div>
            <p className="settings-section-description">
              Configure audio processing, vocal removal, crossfade, and other playback settings.
            </p>
            <AudioSettings />
          </section>
        )}

        {/* Storage Tab */}
        {activeTab === 'storage' && (
          <section className="settings-section">
            <div className="settings-section-header">
              <FolderIcon size={20} />
              <h2>Storage & Local Music</h2>
            </div>
            <p className="settings-section-description">
              Configure where downloads are saved, add local music folders, and manage plugin installation.
            </p>
            <StorageSettings />
          </section>
        )}

        {/* Mobile Tab */}
        {activeTab === 'mobile' && (
          <section className="settings-section">
            <div className="settings-section-header">
              <MobileAccessIcon size={20} />
              <h2>Mobile Access</h2>
            </div>
            <p className="settings-section-description">
              Access your music library from your phone or tablet. Stream anywhere on your local network or use remote access to listen from outside your home.
            </p>
            <MobileAccessSettings />
          </section>
        )}
      </div>

      {/* Import Modal */}
      {importModalOpen && (
        <div className="modal-overlay" onClick={() => setImportModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Import Theme</h2>
              <button
                className="modal-close"
                onClick={() => setImportModalOpen(false)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p className="settings-import-hint">
                Paste the theme JSON below to import a custom theme.
              </p>
              <textarea
                className="settings-import-textarea"
                placeholder='{"name": "My Theme", "colors": {...}}'
                value={importJSON}
                onChange={(e) => {
                  setImportJSON(e.target.value);
                  setImportError('');
                }}
                rows={10}
              />
              {importError && (
                <div className="settings-import-error">{importError}</div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="modal-btn secondary"
                onClick={() => setImportModalOpen(false)}
              >
                Cancel
              </button>
              <button className="modal-btn primary" onClick={handleImport}>
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GitHub Import Modal */}
      {githubModalOpen && (
        <div className="modal-overlay" onClick={() => setGithubModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <GitHubIcon size={20} />
                Import from GitHub
              </h2>
              <button
                className="modal-close"
                onClick={() => setGithubModalOpen(false)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p className="settings-import-hint">
                Enter a GitHub repository URL to import a theme. The repository should contain an{' '}
                <code>audiio-theme.json</code> file in its root.
              </p>
              <div className="settings-github-input-wrapper">
                <GitHubIcon size={18} />
                <input
                  type="text"
                  className="settings-github-input"
                  placeholder="github.com/user/my-theme or user/my-theme"
                  value={githubUrl}
                  onChange={(e) => {
                    setGithubUrl(e.target.value);
                    setGithubError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !githubLoading) {
                      handleGitHubImport();
                    }
                  }}
                />
              </div>
              {githubError && (
                <div className="settings-import-error">{githubError}</div>
              )}
              <div className="settings-github-examples">
                <span className="settings-github-examples-label">Examples:</span>
                <code>github.com/username/theme-repo</code>
                <code>username/audiio-dark-theme</code>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="modal-btn secondary"
                onClick={() => setGithubModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="modal-btn primary"
                onClick={handleGitHubImport}
                disabled={githubLoading}
              >
                {githubLoading ? (
                  <>
                    <LoadingIcon size={16} />
                    Importing...
                  </>
                ) : (
                  'Import'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Theme Editor Modal */}
      <ThemeEditorModal
        isOpen={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditingTheme(undefined);
        }}
        editingTheme={editingTheme}
      />
    </div>
  );
};

// Mobile Access Icon
const MobileAccessIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/>
  </svg>
);
