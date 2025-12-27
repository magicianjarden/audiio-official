import { PlayIcon, HeartIcon, ShuffleIcon, RepeatIcon } from '@audiio/icons';
import './AppPreview.css';

interface AppPreviewProps {
  theme?: 'dark' | 'midnight' | 'sunset' | 'ocean' | 'monochrome';
}

const themes = {
  dark: {
    bg: '#0a0a0a',
    bgSecondary: '#141414',
    bgTertiary: '#1c1c1c',
    accent: '#1db954',
    text: '#ffffff',
    textSecondary: '#a3a3a3',
  },
  midnight: {
    bg: '#0f0f1a',
    bgSecondary: '#1a1a2e',
    bgTertiary: '#25253d',
    accent: '#6366f1',
    text: '#e0e0ff',
    textSecondary: '#8888bb',
  },
  sunset: {
    bg: '#1a0f0f',
    bgSecondary: '#2e1a1a',
    bgTertiary: '#3d2525',
    accent: '#f97316',
    text: '#fff0e0',
    textSecondary: '#bb9988',
  },
  ocean: {
    bg: '#0a1a1a',
    bgSecondary: '#0f2e2e',
    bgTertiary: '#143d3d',
    accent: '#14b8a6',
    text: '#e0ffff',
    textSecondary: '#88bbbb',
  },
  monochrome: {
    bg: '#0a0a0a',
    bgSecondary: '#1a1a1a',
    bgTertiary: '#2a2a2a',
    accent: '#ffffff',
    text: '#ffffff',
    textSecondary: '#888888',
  },
};

// Fake album art gradients
const albumGradients = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
];

export function AppPreview({ theme = 'dark' }: AppPreviewProps) {
  const t = themes[theme];

  return (
    <div
      className="app-preview"
      style={{
        '--preview-bg': t.bg,
        '--preview-bg-secondary': t.bgSecondary,
        '--preview-bg-tertiary': t.bgTertiary,
        '--preview-accent': t.accent,
        '--preview-text': t.text,
        '--preview-text-secondary': t.textSecondary,
      } as React.CSSProperties}
    >
      {/* Sidebar */}
      <div className="preview-sidebar">
        <div className="preview-logo">
          <div className="preview-logo-box" />
          <span>audiio</span>
        </div>
        <div className="preview-nav">
          <div className="preview-nav-item active">
            <div className="nav-dot" />
            <span>Discover</span>
          </div>
          <div className="preview-nav-item">
            <div className="nav-dot" />
            <span>Likes</span>
          </div>
          <div className="preview-nav-item">
            <div className="nav-dot" />
            <span>Playlists</span>
          </div>
          <div className="preview-nav-item">
            <div className="nav-dot" />
            <span>Downloads</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="preview-main">
        <div className="preview-header">
          <span>Good evening</span>
          <div className="preview-search" />
        </div>

        {/* Album Grid */}
        <div className="preview-grid">
          {albumGradients.slice(0, 6).map((gradient, i) => (
            <div key={i} className="preview-card">
              <div
                className="preview-album-art"
                style={{ background: gradient }}
              >
                <div className="preview-play-btn">
                  <PlayIcon size={12} />
                </div>
              </div>
              <div className="preview-card-info">
                <div className="preview-title" />
                <div className="preview-artist" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mini Player */}
      <div className="preview-player">
        <div className="preview-now-playing">
          <div
            className="preview-player-art"
            style={{ background: albumGradients[0] }}
          />
          <div className="preview-player-info">
            <div className="preview-player-title" />
            <div className="preview-player-artist" />
          </div>
          <HeartIcon size={14} className="preview-heart" />
        </div>

        <div className="preview-controls">
          <ShuffleIcon size={12} />
          <div className="preview-prev" />
          <div className="preview-play-main">
            <PlayIcon size={14} />
          </div>
          <div className="preview-next" />
          <RepeatIcon size={12} />
        </div>

        <div className="preview-progress">
          <div className="preview-progress-bar">
            <div className="preview-progress-fill" />
          </div>
        </div>
      </div>
    </div>
  );
}
