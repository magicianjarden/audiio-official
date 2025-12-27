/**
 * ExternalLinks - Display social media and website links for artists
 */

import React from 'react';
import {
  SpotifyIcon,
  InstagramIcon,
  TwitterIcon,
  FacebookIcon,
  GitHubIcon,
  WebsiteIcon,
  LinkIcon
} from '@audiio/icons';

interface ExternalLinksProps {
  urls: Record<string, string | undefined>;
  className?: string;
}

// Map URL keys to icons and labels
const linkConfig: Record<string, { icon: React.FC<{ size?: number; className?: string }>; label: string }> = {
  spotify: { icon: SpotifyIcon, label: 'Spotify' },
  instagram: { icon: InstagramIcon, label: 'Instagram' },
  twitter: { icon: TwitterIcon, label: 'Twitter' },
  facebook: { icon: FacebookIcon, label: 'Facebook' },
  github: { icon: GitHubIcon, label: 'GitHub' },
  website: { icon: WebsiteIcon, label: 'Website' }
};

export const ExternalLinks: React.FC<ExternalLinksProps> = ({ urls, className }) => {
  // Filter out undefined/empty values
  const validLinks = Object.entries(urls).filter(
    ([_, url]) => url && url.trim() !== ''
  );

  if (validLinks.length === 0) {
    return null;
  }

  return (
    <div className={`external-links ${className || ''}`}>
      {validLinks.map(([key, url]) => {
        const config = linkConfig[key.toLowerCase()];
        const Icon = config?.icon || LinkIcon;
        const label = config?.label || key.charAt(0).toUpperCase() + key.slice(1);

        return (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="external-link"
            title={label}
          >
            <Icon size={20} />
            <span className="external-link-label">{label}</span>
          </a>
        );
      })}
    </div>
  );
};

export default ExternalLinks;
