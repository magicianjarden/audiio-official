import { GitHubIcon, HeartIcon } from '@audiio/icons';
import { useDevMode } from '../hooks/useDevMode';
import './Footer.css';

export function Footer() {
  const { isDevMode } = useDevMode();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-brand">
            <span className="footer-logo">audiio</span>
            <p className="footer-tagline">
              Music, your way.
            </p>
          </div>

          <div className="footer-links">
            <div className="footer-column">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#plugins">Plugins</a>
              <a href="#download">Download</a>
              <a href="https://magicianjarden.github.io/audiio-official/remote/" target="_blank" rel="noopener noreferrer">
                Mobile Remote
              </a>
            </div>

            <div className="footer-column">
              <h4>Plugins</h4>
              <a href="https://github.com/magicianjarden/audiio-official-plugins" target="_blank" rel="noopener noreferrer">
                Official Plugins
              </a>
              <a href="https://github.com/magicianjarden/audiio-official/tree/main/docs/sdk" target="_blank" rel="noopener noreferrer">
                Plugin SDK
              </a>
              <a href="https://github.com/magicianjarden/audiio-official/discussions" target="_blank" rel="noopener noreferrer">
                Community Plugins
              </a>
            </div>

            <div className="footer-column">
              <h4>Community</h4>
              <a href="https://github.com/magicianjarden/audiio-official" target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
              <a href="https://github.com/magicianjarden/audiio-official/discussions" target="_blank" rel="noopener noreferrer">
                Discussions
              </a>
              <a href="https://github.com/magicianjarden/audiio-official/issues" target="_blank" rel="noopener noreferrer">
                Issues
              </a>
            </div>

            <div className="footer-column">
              <h4>Resources</h4>
              <a href="https://github.com/magicianjarden/audiio-official/tree/main/docs" target="_blank" rel="noopener noreferrer">
                Documentation
              </a>
              <a href="https://github.com/magicianjarden/audiio-official/blob/main/CHANGELOG.md" target="_blank" rel="noopener noreferrer">
                Changelog
              </a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-copyright">
            <span>&copy; {currentYear} Audiio.</span>
            <span className="footer-made-with">
              Made with <HeartIcon size={14} className="heart-icon" /> and open source
            </span>
          </div>

          <div className="footer-social">
            <a
              href="https://github.com/magicianjarden/audiio-official"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
              aria-label="GitHub"
            >
              <GitHubIcon size={20} />
            </a>
          </div>

          {isDevMode && (
            <div className="footer-dev-info">
              <code>v0.1.0 • React 18 • Vite 6</code>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
