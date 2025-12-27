import { useEffect, useState } from 'react';
import { DownloadIcon, DesktopIcon, PhoneIcon, ExternalLinkIcon } from '@audiio/icons';
import { useDevMode } from '../hooks/useDevMode';
import './Download.css';

type Platform = 'mac' | 'mac-intel' | 'windows' | 'linux' | 'unknown';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';

  const userAgent = navigator.userAgent.toLowerCase();
  const platform = (navigator as any).userAgentData?.platform?.toLowerCase() || navigator.platform.toLowerCase();

  if (platform.includes('mac') || userAgent.includes('mac')) {
    // Check for Apple Silicon vs Intel
    // This is a heuristic - not 100% accurate
    if (userAgent.includes('arm') || (platform.includes('mac') && !userAgent.includes('intel'))) {
      return 'mac';
    }
    return 'mac-intel';
  }
  if (platform.includes('win') || userAgent.includes('win')) return 'windows';
  if (platform.includes('linux') || userAgent.includes('linux')) return 'linux';

  return 'unknown';
}

const platformInfo = {
  mac: {
    name: 'macOS (Apple Silicon)',
    file: 'Audiio-arm64.dmg',
    icon: DesktopIcon,
  },
  'mac-intel': {
    name: 'macOS (Intel)',
    file: 'Audiio-x64.dmg',
    icon: DesktopIcon,
  },
  windows: {
    name: 'Windows',
    file: 'Audiio-Setup.exe',
    icon: DesktopIcon,
  },
  linux: {
    name: 'Linux',
    file: 'Audiio.AppImage',
    icon: DesktopIcon,
  },
  unknown: {
    name: 'Desktop',
    file: '',
    icon: DesktopIcon,
  },
};

const GITHUB_RELEASES_URL = 'https://github.com/audiio/audiio/releases/latest';

export function Download() {
  const [platform, setPlatform] = useState<Platform>('unknown');
  const { isDevMode } = useDevMode();

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const currentPlatform = platformInfo[platform];
  const Icon = currentPlatform.icon;

  const otherPlatforms = Object.entries(platformInfo)
    .filter(([key]) => key !== platform && key !== 'unknown')
    .map(([key, info]) => ({ key, ...info }));

  return (
    <section id="download" className="download">
      <div className="download-bg">
        <div className="download-glow" />
      </div>

      <div className="container">
        <div className="download-content">
          <h2 className="download-title">
            Ready to{' '}
            <span className="text-gradient">Get Started?</span>
          </h2>
          <p className="download-subtitle">
            Download Audiio for free. No account required.
          </p>

          <div className="download-main">
            <a
              href={GITHUB_RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="download-primary btn btn-primary"
            >
              <Icon size={24} />
              <div className="download-info">
                <span className="download-label">Download for {currentPlatform.name}</span>
                {currentPlatform.file && (
                  <span className="download-file">{currentPlatform.file}</span>
                )}
              </div>
              <DownloadIcon size={20} />
            </a>
          </div>

          <div className="download-other">
            <span className="download-other-label">Also available for:</span>
            <div className="download-other-links">
              {otherPlatforms.map((p) => (
                <a
                  key={p.key}
                  href={GITHUB_RELEASES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="download-other-link"
                >
                  <p.icon size={16} />
                  {p.name}
                </a>
              ))}
            </div>
          </div>

          <div className="download-mobile">
            <div className="mobile-card">
              <PhoneIcon size={24} />
              <div className="mobile-info">
                <h3>Mobile Access</h3>
                <p>Control your desktop library from any device via the built-in web portal.</p>
              </div>
            </div>
          </div>

          {isDevMode && (
            <div className="download-dev">
              <code>
                # Clone and build from source
                <br />
                git clone https://github.com/audiio/audiio.git
                <br />
                cd audiio && npm install && npm run build
              </code>
            </div>
          )}

          <a
            href={GITHUB_RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="download-releases-link"
          >
            View all releases on GitHub <ExternalLinkIcon size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}
