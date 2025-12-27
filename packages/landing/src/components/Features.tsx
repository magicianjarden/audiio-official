import {
  DiscoverIcon,
  LyricsIcon,
  DesktopIcon,
  PhoneIcon,
  ShieldIcon,
  PluginIcon,
} from '@audiio/icons';
import { useDevMode } from '../hooks/useDevMode';
import './Features.css';

const features = [
  {
    icon: DiscoverIcon,
    title: 'Smart Discovery',
    description: 'ML-powered recommendations that learn your taste. Discover new music through mood, genre, and audio similarity.',
    gradient: 'var(--gradient-purple)',
    devInfo: 'Uses TensorFlow.js for audio embeddings and cosine similarity matching.',
  },
  {
    icon: LyricsIcon,
    title: 'Synced Lyrics & Karaoke',
    description: 'Real-time synchronized lyrics with translation support. Enable karaoke mode to sing along with instrumental backing.',
    gradient: 'var(--gradient-pink)',
    devInfo: 'LRC parsing with millisecond precision. Vocal removal via source separation.',
  },
  {
    icon: DesktopIcon,
    title: 'Cross-Platform',
    description: 'Native desktop app for macOS and Windows. Access your library from any device through the mobile web portal.',
    gradient: 'var(--gradient-blue)',
    devInfo: 'Electron for desktop, React PWA for mobile. P2P sync via WebRTC.',
  },
  {
    icon: ShieldIcon,
    title: 'Privacy-First',
    description: 'Your music, your data. Local library with optional P2P sync. No tracking, no ads, ever.',
    gradient: 'var(--gradient-teal)',
    devInfo: 'All data stored locally. Optional Nostr relay for decentralized sync.',
  },
  {
    icon: PluginIcon,
    title: 'Plugin Ecosystem',
    description: 'Extend functionality with plugins. Metadata providers, lyrics sources, scrobbling, audio analysis, and more.',
    gradient: 'var(--gradient-orange)',
    devInfo: 'TypeScript SDK with hot-reload. Sandboxed plugin execution.',
  },
  {
    icon: PhoneIcon,
    title: 'Keyboard-First',
    description: 'Full keyboard navigation and customizable shortcuts. Power users rejoice — everything is accessible without a mouse.',
    gradient: 'var(--gradient-accent)',
    devInfo: 'Vim-style navigation available. All actions have configurable bindings.',
  },
];

export function Features() {
  const { isDevMode } = useDevMode();

  return (
    <section id="features" className="features">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">Everything You Need</h2>
          <p className="section-subtitle">
            Built for music lovers who want control over their listening experience.
          </p>
        </div>

        <div className="features-grid">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="feature-card card"
                style={{ '--feature-gradient': feature.gradient, '--delay': `${index * 0.1}s` } as React.CSSProperties}
              >
                <div className="feature-icon">
                  <Icon size={24} />
                </div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
                {isDevMode && (
                  <div className="feature-dev-info">
                    <code>{feature.devInfo}</code>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
