import { GitHubIcon, HeartIcon, ExternalLinkIcon } from '@audiio/icons';
import { useDevMode } from '../hooks/useDevMode';
import './Community.css';

export function Community() {
  const { isDevMode } = useDevMode();

  return (
    <section id="community" className="community">
      <div className="container">
        <div className="community-content">
          <div className="community-text">
            <h2 className="community-title">
              Open Source,{' '}
              <span className="text-gradient">Community Driven</span>
            </h2>
            <p className="community-subtitle">
              Audiio is built in the open. Contribute code, report issues, suggest features,
              or just star the repo to show your support.
            </p>

            <div className="community-actions">
              <a
                href="https://github.com/magicianjarden/audiio-official"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                <GitHubIcon size={20} />
                View on GitHub
              </a>
              <a
                href="https://github.com/magicianjarden/audiio-official/stargazers"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                <HeartIcon size={20} />
                Star the Repo
              </a>
            </div>

            {isDevMode && (
              <div className="community-dev-links">
                <a href="https://github.com/magicianjarden/audiio-official/issues" target="_blank" rel="noopener noreferrer">
                  <ExternalLinkIcon size={14} />
                  Issues
                </a>
                <a href="https://github.com/magicianjarden/audiio-official/pulls" target="_blank" rel="noopener noreferrer">
                  <ExternalLinkIcon size={14} />
                  Pull Requests
                </a>
                <a href="https://github.com/magicianjarden/audiio-official/discussions" target="_blank" rel="noopener noreferrer">
                  <ExternalLinkIcon size={14} />
                  Discussions
                </a>
                <a href="https://github.com/magicianjarden/audiio-official/wiki" target="_blank" rel="noopener noreferrer">
                  <ExternalLinkIcon size={14} />
                  Wiki
                </a>
              </div>
            )}
          </div>

          <div className="community-stats">
            <div className="stat-card">
              <div className="stat-icon">
                <GitHubIcon size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-number">MIT</span>
                <span className="stat-label">License</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon purple">
                <HeartIcon size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-number">100%</span>
                <span className="stat-label">Free Forever</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
