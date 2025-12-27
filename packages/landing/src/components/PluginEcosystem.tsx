import {
  PluginIcon,
  LyricsIcon,
  MusicNoteIcon,
  StatsIcon,
  MicIcon,
  GlobeIcon,
  ExternalLinkIcon,
} from '@audiio/icons';
import { useDevMode } from '../hooks/useDevMode';
import './PluginEcosystem.css';

const plugins = [
  {
    icon: GlobeIcon,
    name: 'Metadata Providers',
    description: 'Deezer, YouTube Music, and more',
    color: '#3b82f6',
    devInfo: 'Interface: MetadataProvider. Returns artist bio, credits, related artists.',
  },
  {
    icon: LyricsIcon,
    name: 'Lyrics Sources',
    description: 'LRCLib, Genius, custom sources',
    color: '#ec4899',
    devInfo: 'Interface: LyricsProvider. Supports synced (LRC) and unsynced lyrics.',
  },
  {
    icon: StatsIcon,
    name: 'Scrobbling',
    description: 'Last.fm, ListenBrainz, custom',
    color: '#f59e0b',
    devInfo: 'Interface: ScrobblingProvider. Hook into playback events.',
  },
  {
    icon: MusicNoteIcon,
    name: 'Audio Analysis',
    description: 'BPM, key detection, chroma',
    color: '#14b8a6',
    devInfo: 'Interface: AudioAnalyzer. Access to Web Audio API and TensorFlow.js.',
  },
  {
    icon: MicIcon,
    name: 'Karaoke Mode',
    description: 'Vocal removal and isolation',
    color: '#8b5cf6',
    devInfo: 'Uses Demucs for source separation. Real-time mixing support.',
  },
  {
    icon: PluginIcon,
    name: 'Build Your Own',
    description: 'TypeScript SDK with full docs',
    color: '#1db954',
    devInfo: 'npm install @audiio/sdk — Full TypeScript support with hot-reload.',
  },
];

export function PluginEcosystem() {
  const { isDevMode } = useDevMode();

  return (
    <section id="plugins" className="plugin-ecosystem">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">Extend Everything</h2>
          <p className="section-subtitle">
            A modular plugin system that lets you customize every aspect of your music experience.
          </p>
        </div>

        <div className="plugins-grid">
          {plugins.map((plugin) => {
            const Icon = plugin.icon;
            return (
              <div
                key={plugin.name}
                className="plugin-card"
                style={{ '--plugin-color': plugin.color } as React.CSSProperties}
              >
                <div className="plugin-icon">
                  <Icon size={24} />
                </div>
                <div className="plugin-content">
                  <h3 className="plugin-name">{plugin.name}</h3>
                  <p className="plugin-description">{plugin.description}</p>
                  {isDevMode && (
                    <code className="plugin-dev-info">{plugin.devInfo}</code>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {isDevMode && (
          <div className="plugin-sdk-info">
            <div className="sdk-header">
              <h3>Plugin SDK</h3>
              <a
                href="https://github.com/magicianjarden/audiio-official/tree/main/packages/sdk"
                target="_blank"
                rel="noopener noreferrer"
                className="sdk-link"
              >
                View on GitHub <ExternalLinkIcon size={16} />
              </a>
            </div>
            <pre className="sdk-code">
{`import { definePlugin } from '@audiio/sdk';

export default definePlugin({
  name: 'my-plugin',
  version: '1.0.0',

  async onTrackPlay(track) {
    // Your custom logic here
    console.log('Now playing:', track.title);
  }
});`}
            </pre>
          </div>
        )}

        <div className="plugin-cta">
          <p>
            Can't find what you need? Build your own plugin with our
            <a href="https://github.com/magicianjarden/audiio-official" target="_blank" rel="noopener noreferrer">
              {' '}TypeScript SDK
            </a>.
          </p>
        </div>
      </div>
    </section>
  );
}
