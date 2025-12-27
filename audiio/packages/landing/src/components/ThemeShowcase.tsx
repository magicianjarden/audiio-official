import { useState } from 'react';
import { PaletteIcon, CheckIcon } from '@audiio/icons';
import { AppPreview } from './AppPreview';
import { useDevMode } from '../hooks/useDevMode';
import './ThemeShowcase.css';

type ThemeKey = 'dark' | 'midnight' | 'sunset' | 'ocean' | 'monochrome';

const themes: { key: ThemeKey; name: string; description: string; colors: string[] }[] = [
  {
    key: 'dark',
    name: 'Default Dark',
    description: 'Classic dark theme with vibrant green accents',
    colors: ['#0a0a0a', '#1db954', '#ffffff'],
  },
  {
    key: 'midnight',
    name: 'Midnight',
    description: 'Deep blues and purples for late night listening',
    colors: ['#0f0f1a', '#6366f1', '#e0e0ff'],
  },
  {
    key: 'sunset',
    name: 'Sunset',
    description: 'Warm oranges and reds for a cozy vibe',
    colors: ['#1a0f0f', '#f97316', '#fff0e0'],
  },
  {
    key: 'ocean',
    name: 'Ocean',
    description: 'Cool teals and cyans for a refreshing feel',
    colors: ['#0a1a1a', '#14b8a6', '#e0ffff'],
  },
  {
    key: 'monochrome',
    name: 'Monochrome',
    description: 'Elegant grayscale for minimal distraction',
    colors: ['#0a0a0a', '#ffffff', '#888888'],
  },
];

export function ThemeShowcase() {
  const [activeTheme, setActiveTheme] = useState<ThemeKey>('dark');
  const { isDevMode } = useDevMode();

  return (
    <section id="themes" className="theme-showcase">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">Make It Yours</h2>
          <p className="section-subtitle">
            Choose from 8 built-in themes or create your own.
            Every color, every detail — fully customizable.
          </p>
        </div>

        <div className="theme-content">
          <div className="theme-preview-wrapper">
            <AppPreview theme={activeTheme} />
          </div>

          <div className="theme-selector">
            <div className="theme-selector-header">
              <PaletteIcon size={20} />
              <span>Select Theme</span>
            </div>

            <div className="theme-options">
              {themes.map((theme) => (
                <button
                  key={theme.key}
                  className={`theme-option ${activeTheme === theme.key ? 'active' : ''}`}
                  onClick={() => setActiveTheme(theme.key)}
                >
                  <div className="theme-colors">
                    {theme.colors.map((color, i) => (
                      <div
                        key={i}
                        className="theme-color-dot"
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                  <div className="theme-info">
                    <span className="theme-name">{theme.name}</span>
                    <span className="theme-desc">{theme.description}</span>
                  </div>
                  {activeTheme === theme.key && (
                    <CheckIcon size={18} className="theme-check" />
                  )}
                </button>
              ))}
            </div>

            <div className="theme-custom">
              <span>Want more?</span>
              <p>Create custom themes with our built-in editor or import community themes.</p>
              {isDevMode && (
                <code className="theme-code">
                  {`// themes are just CSS variables
:root {
  --accent: #your-color;
  --bg-primary: #your-bg;
}`}
                </code>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
