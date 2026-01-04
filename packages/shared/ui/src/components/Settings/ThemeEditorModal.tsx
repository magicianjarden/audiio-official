/**
 * ThemeEditorModal - Visual theme editor with live preview
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useThemeStore, type ThemeConfig, type ThemeColors, type ColorMode } from '../../stores/theme-store';
import { ColorPicker } from '../common/ColorPicker';
import {
  CloseIcon,
  CheckIcon,
  DownloadIcon,
  RefreshIcon,
  SunIcon,
  MoonIcon,
} from '@audiio/icons';

interface ThemeEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTheme?: ThemeConfig; // If provided, edit existing theme
}

// Default colors for new themes
const getDefaultColors = (mode: ColorMode): ThemeColors => {
  if (mode === 'light') {
    return {
      // Background colors
      bgPrimary: '#ffffff',
      bgSecondary: '#f5f5f5',
      bgTertiary: '#ebebeb',
      bgHover: '#e0e0e0',
      bgElevated: '#ffffff',
      bgSurface: '#fafafa',
      bgOverlay: 'rgba(0, 0, 0, 0.4)',
      // Text colors
      textHero: '#000000',
      textPrimary: '#1a1a1a',
      textSecondary: '#666666',
      textTertiary: '#888888',
      textMuted: '#999999',
      textInverse: '#ffffff',
      textOnAccent: '#ffffff',
      // Accent colors
      accent: '#1db954',
      accentHover: '#1ed760',
      accentGlow: 'rgba(29, 185, 84, 0.2)',
      accentSoft: 'rgba(29, 185, 84, 0.08)',
      accentMuted: 'rgba(29, 185, 84, 0.4)',
      // Lyrics accent
      lyricsAccent: '#FF2D55',
      lyricsAccentGlow: 'rgba(255, 45, 85, 0.35)',
      // Border colors
      borderColor: 'rgba(0, 0, 0, 0.08)',
      borderLight: 'rgba(0, 0, 0, 0.05)',
      borderStrong: 'rgba(0, 0, 0, 0.15)',
      // Scrollbar colors
      scrollbarThumb: 'rgba(0, 0, 0, 0.15)',
      scrollbarThumbHover: 'rgba(0, 0, 0, 0.25)',
      // Overlay colors
      overlayLight: 'rgba(0, 0, 0, 0.03)',
      overlayMedium: 'rgba(0, 0, 0, 0.06)',
      overlayStrong: 'rgba(0, 0, 0, 0.1)',
      // Semantic colors
      colorSuccess: '#16a34a',
      colorWarning: '#d97706',
      colorError: '#dc2626',
      colorInfo: '#2563eb',
    };
  }

  return {
    // Background colors
    bgPrimary: '#0a0a0a',
    bgSecondary: '#141414',
    bgTertiary: '#1c1c1c',
    bgHover: '#252525',
    bgElevated: '#1a1a1a',
    bgSurface: '#121212',
    bgOverlay: 'rgba(0, 0, 0, 0.6)',
    // Text colors
    textHero: '#ffffff',
    textPrimary: '#f5f5f7',
    textSecondary: '#a0a0a0',
    textTertiary: '#737373',
    textMuted: '#525252',
    textInverse: '#000000',
    textOnAccent: '#ffffff',
    // Accent colors
    accent: '#1db954',
    accentHover: '#1ed760',
    accentGlow: 'rgba(29, 185, 84, 0.25)',
    accentSoft: 'rgba(29, 185, 84, 0.1)',
    accentMuted: 'rgba(29, 185, 84, 0.5)',
    // Lyrics accent
    lyricsAccent: '#FF2D55',
    lyricsAccentGlow: 'rgba(255, 45, 85, 0.4)',
    // Border colors
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderLight: 'rgba(255, 255, 255, 0.12)',
    borderStrong: 'rgba(255, 255, 255, 0.18)',
    // Scrollbar colors
    scrollbarThumb: 'rgba(255, 255, 255, 0.1)',
    scrollbarThumbHover: 'rgba(255, 255, 255, 0.2)',
    // Overlay colors
    overlayLight: 'rgba(255, 255, 255, 0.05)',
    overlayMedium: 'rgba(255, 255, 255, 0.1)',
    overlayStrong: 'rgba(255, 255, 255, 0.15)',
    // Semantic colors
    colorSuccess: '#1db954',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorInfo: '#3b82f6',
  };
};

// Helper to generate accent variants from a base color
const generateAccentVariants = (accent: string) => {
  // Simple lightening for hover
  const accentHover = adjustBrightness(accent, 15);
  // Semi-transparent variants
  const accentGlow = hexToRgba(accent, 0.25);
  const accentSoft = hexToRgba(accent, 0.1);
  const accentMuted = hexToRgba(accent, 0.5);

  return { accentHover, accentGlow, accentSoft, accentMuted };
};

// Hex to RGBA conversion
const hexToRgba = (hex: string, alpha: number): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(0, 0, 0, ${alpha})`;

  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Adjust brightness of a hex color
const adjustBrightness = (hex: string, percent: number): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;

  let r = parseInt(result[1], 16);
  let g = parseInt(result[2], 16);
  let b = parseInt(result[3], 16);

  r = Math.min(255, Math.max(0, r + (r * percent) / 100));
  g = Math.min(255, Math.max(0, g + (g * percent) / 100));
  b = Math.min(255, Math.max(0, b + (b * percent) / 100));

  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
};

export const ThemeEditorModal: React.FC<ThemeEditorModalProps> = ({
  isOpen,
  onClose,
  editingTheme,
}) => {
  const { createCustomTheme, updateTheme, exportTheme, setTheme } = useThemeStore();

  const [themeName, setThemeName] = useState('My Custom Theme');
  const [themeMode, setThemeMode] = useState<ColorMode>('dark');
  const [colors, setColors] = useState<ThemeColors>(getDefaultColors('dark'));
  const [customCSS, setCustomCSS] = useState('');
  const [activeTab, setActiveTab] = useState<'colors' | 'advanced'>('colors');

  // Initialize from editing theme
  useEffect(() => {
    if (editingTheme) {
      setThemeName(editingTheme.name);
      setThemeMode(editingTheme.mode);
      setColors(editingTheme.colors);
      setCustomCSS(editingTheme.customCSS || '');
    } else {
      // Reset to defaults for new theme
      setThemeName('My Custom Theme');
      setThemeMode('dark');
      setColors(getDefaultColors('dark'));
      setCustomCSS('');
    }
  }, [editingTheme, isOpen]);

  // Update colors when mode changes (for new themes only)
  useEffect(() => {
    if (!editingTheme) {
      setColors(getDefaultColors(themeMode));
    }
  }, [themeMode, editingTheme]);

  const handleColorChange = (key: keyof ThemeColors, value: string) => {
    setColors((prev) => {
      const newColors = { ...prev, [key]: value };

      // Auto-generate accent variants when accent changes
      if (key === 'accent') {
        const variants = generateAccentVariants(value);
        return { ...newColors, ...variants };
      }

      return newColors;
    });
  };

  const handleSave = () => {
    const themeConfig: Omit<ThemeConfig, 'id' | 'source'> = {
      name: themeName,
      author: 'You',
      version: '1.0.0',
      description: `Custom ${themeMode} theme`,
      mode: themeMode,
      colors,
      customCSS: customCSS || undefined,
    };

    if (editingTheme && editingTheme.source === 'community') {
      // Update existing theme
      updateTheme(editingTheme.id, themeConfig);
      setTheme(editingTheme.id);
    } else {
      // Create new theme
      const newTheme = createCustomTheme(themeConfig);
      setTheme(newTheme.id);
    }

    onClose();
  };

  const handleExport = () => {
    const themeConfig = {
      name: themeName,
      author: 'You',
      version: '1.0.0',
      description: `Custom ${themeMode} theme`,
      mode: themeMode,
      colors,
      customCSS: customCSS || undefined,
    };

    const json = JSON.stringify(themeConfig, null, 2);
    navigator.clipboard.writeText(json);
  };

  const handleReset = () => {
    setColors(getDefaultColors(themeMode));
    setCustomCSS('');
  };

  // Color categories for organized editing
  const colorCategories = useMemo(() => [
    {
      name: 'Background',
      description: 'Main surface and container colors',
      colors: [
        { key: 'bgPrimary', label: 'Primary' },
        { key: 'bgSecondary', label: 'Secondary' },
        { key: 'bgTertiary', label: 'Tertiary' },
        { key: 'bgHover', label: 'Hover' },
        { key: 'bgElevated', label: 'Elevated' },
        { key: 'bgSurface', label: 'Surface' },
      ],
    },
    {
      name: 'Text',
      description: 'Text color hierarchy',
      colors: [
        { key: 'textHero', label: 'Hero' },
        { key: 'textPrimary', label: 'Primary' },
        { key: 'textSecondary', label: 'Secondary' },
        { key: 'textTertiary', label: 'Tertiary' },
        { key: 'textMuted', label: 'Muted' },
        { key: 'textOnAccent', label: 'On Accent' },
      ],
    },
    {
      name: 'Accent',
      description: 'Primary brand/action color',
      colors: [
        { key: 'accent', label: 'Primary' },
        { key: 'accentHover', label: 'Hover' },
      ],
    },
    {
      name: 'Lyrics',
      description: 'Karaoke and sing-along colors',
      colors: [
        { key: 'lyricsAccent', label: 'Highlight' },
      ],
    },
    {
      name: 'Borders',
      description: 'Dividers and outlines',
      colors: [
        { key: 'borderColor', label: 'Default' },
        { key: 'borderLight', label: 'Light' },
        { key: 'borderStrong', label: 'Strong' },
      ],
    },
    {
      name: 'Semantic',
      description: 'Status and feedback colors',
      colors: [
        { key: 'colorSuccess', label: 'Success' },
        { key: 'colorWarning', label: 'Warning' },
        { key: 'colorError', label: 'Error' },
        { key: 'colorInfo', label: 'Info' },
      ],
    },
  ], []);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="theme-editor-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="theme-editor-header">
          <h2>{editingTheme ? 'Edit Theme' : 'Create Theme'}</h2>
          <button className="modal-close" onClick={onClose}>
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="theme-editor-content">
          {/* Left Panel - Controls */}
          <div className="theme-editor-controls">
            {/* Theme Name */}
            <div className="theme-editor-field">
              <label>Theme Name</label>
              <input
                type="text"
                className="theme-editor-input"
                value={themeName}
                onChange={(e) => setThemeName(e.target.value)}
                placeholder="My Custom Theme"
              />
            </div>

            {/* Mode Toggle */}
            <div className="theme-editor-field">
              <label>Mode</label>
              <div className="theme-editor-mode-toggle">
                <button
                  className={`theme-editor-mode-btn ${themeMode === 'dark' ? 'active' : ''}`}
                  onClick={() => setThemeMode('dark')}
                >
                  <MoonIcon size={16} />
                  Dark
                </button>
                <button
                  className={`theme-editor-mode-btn ${themeMode === 'light' ? 'active' : ''}`}
                  onClick={() => setThemeMode('light')}
                >
                  <SunIcon size={16} />
                  Light
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="theme-editor-tabs">
              <button
                className={`theme-editor-tab ${activeTab === 'colors' ? 'active' : ''}`}
                onClick={() => setActiveTab('colors')}
              >
                Colors
              </button>
              <button
                className={`theme-editor-tab ${activeTab === 'advanced' ? 'active' : ''}`}
                onClick={() => setActiveTab('advanced')}
              >
                Advanced
              </button>
            </div>

            {/* Colors Tab */}
            {activeTab === 'colors' && (
              <div className="theme-editor-colors">
                {colorCategories.map((category) => (
                  <div key={category.name} className="theme-editor-color-group">
                    <h4>{category.name}</h4>
                    <div className="theme-editor-color-grid">
                      {category.colors.map(({ key, label }) => (
                        <ColorPicker
                          key={key}
                          label={label}
                          color={colors[key as keyof ThemeColors]}
                          onChange={(value) => handleColorChange(key as keyof ThemeColors, value)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Advanced Tab */}
            {activeTab === 'advanced' && (
              <div className="theme-editor-advanced">
                <div className="theme-editor-field">
                  <label>Custom CSS</label>
                  <textarea
                    className="theme-editor-css"
                    value={customCSS}
                    onChange={(e) => setCustomCSS(e.target.value)}
                    placeholder={`.sidebar {\n  /* Custom styles */\n}`}
                    rows={12}
                  />
                  <span className="theme-editor-hint">
                    Add custom CSS to fine-tune your theme. Selectors are automatically scoped.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Preview */}
          <div className="theme-editor-preview-panel">
            <h4>Live Preview</h4>
            <div
              className="theme-editor-preview"
              style={{
                '--preview-bg-primary': colors.bgPrimary,
                '--preview-bg-secondary': colors.bgSecondary,
                '--preview-bg-tertiary': colors.bgTertiary,
                '--preview-text-primary': colors.textPrimary,
                '--preview-text-secondary': colors.textSecondary,
                '--preview-accent': colors.accent,
                '--preview-border': colors.borderColor,
              } as React.CSSProperties}
            >
              {/* Mini App Preview */}
              <div className="preview-app">
                {/* Sidebar */}
                <div className="preview-sidebar">
                  <div className="preview-logo" style={{ background: colors.accent }} />
                  <div className="preview-nav-item active" style={{ background: colors.accentSoft }}>
                    <div className="preview-nav-indicator" style={{ background: colors.accent }} />
                  </div>
                  <div className="preview-nav-item" />
                  <div className="preview-nav-item" />
                </div>

                {/* Content */}
                <div className="preview-content">
                  <div className="preview-header" style={{ background: colors.textPrimary }} />
                  <div className="preview-cards">
                    <div className="preview-card">
                      <div className="preview-card-art" style={{ background: colors.bgTertiary }} />
                      <div className="preview-card-text" style={{ background: colors.textSecondary }} />
                    </div>
                    <div className="preview-card">
                      <div className="preview-card-art" style={{ background: colors.bgTertiary }} />
                      <div className="preview-card-text" style={{ background: colors.textSecondary }} />
                    </div>
                    <div className="preview-card">
                      <div className="preview-card-art" style={{ background: colors.bgTertiary }} />
                      <div className="preview-card-text" style={{ background: colors.textSecondary }} />
                    </div>
                  </div>
                </div>

                {/* Player */}
                <div className="preview-player">
                  <div className="preview-player-art" style={{ background: colors.bgTertiary }} />
                  <div className="preview-player-info">
                    <div className="preview-player-title" style={{ background: colors.textPrimary }} />
                    <div className="preview-player-artist" style={{ background: colors.textSecondary }} />
                  </div>
                  <div className="preview-player-btn" style={{ background: colors.accent }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="theme-editor-footer">
          <div className="theme-editor-footer-left">
            <button className="theme-editor-btn secondary" onClick={handleReset}>
              <RefreshIcon size={16} />
              Reset
            </button>
            <button className="theme-editor-btn secondary" onClick={handleExport}>
              <DownloadIcon size={16} />
              Copy JSON
            </button>
          </div>
          <div className="theme-editor-footer-right">
            <button className="theme-editor-btn secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="theme-editor-btn primary" onClick={handleSave}>
              <CheckIcon size={16} />
              {editingTheme ? 'Save Changes' : 'Create Theme'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemeEditorModal;
