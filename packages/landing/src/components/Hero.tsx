import { DownloadIcon, ChevronDownIcon } from '@audiio/icons';
import { AppPreview } from './AppPreview';
import { useDevMode } from '../hooks/useDevMode';
import './Hero.css';

export function Hero() {
  const { isDevMode } = useDevMode();

  return (
    <section className="hero">
      <div className="hero-bg">
        <div className="hero-glow" />
        <div className="hero-grid" />
      </div>

      <div className="container hero-container">
        <div className="hero-content">
          <h1 className="hero-title">
            Music,{' '}
            <span className="text-gradient">Your Way</span>
          </h1>
          <p className="hero-subtitle">
            A unified, modular music platform. Customize everything — themes, plugins,
            and how you discover music. Open source and privacy-first.
          </p>

          {isDevMode && (
            <div className="hero-dev-info">
              <code>$ npm install -g @audiio/cli</code>
            </div>
          )}

          <div className="hero-actions">
            <a href="#download" className="btn btn-primary">
              <DownloadIcon size={20} />
              Download Now
            </a>
            <a href="#features" className="btn btn-secondary">
              Learn More
            </a>
          </div>

          <div className="hero-stats">
            <div className="stat">
              <span className="stat-value">10+</span>
              <span className="stat-label">Plugins</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-value">8</span>
              <span className="stat-label">Themes</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-value">100%</span>
              <span className="stat-label">Open Source</span>
            </div>
          </div>
        </div>

        <div className="hero-preview">
          <AppPreview />
        </div>
      </div>

      <a href="#features" className="scroll-indicator">
        <span>Scroll to explore</span>
        <ChevronDownIcon size={20} />
      </a>
    </section>
  );
}
