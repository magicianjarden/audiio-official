/**
 * MerchandiseSection - Displays merchandise link from Bandcamp or external URL
 */

import React from 'react';

interface MerchandiseSectionProps {
  merchandiseUrl: string;
  artistName: string;
}

export const MerchandiseSection: React.FC<MerchandiseSectionProps> = ({
  merchandiseUrl,
  artistName,
}) => {
  if (!merchandiseUrl) return null;

  // Determine the source based on URL
  const getSource = (url: string): { name: string; icon: string } => {
    if (url.includes('bandcamp.com')) {
      return { name: 'Bandcamp', icon: 'bandcamp' };
    }
    if (url.includes('shopify')) {
      return { name: 'Shop', icon: 'shop' };
    }
    if (url.includes('merch')) {
      return { name: 'Merch Store', icon: 'shop' };
    }
    return { name: 'Official Store', icon: 'shop' };
  };

  const source = getSource(merchandiseUrl);

  return (
    <div className="enrichment-merchandise">
      <a
        href={merchandiseUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="merchandise-link-card"
      >
        <div className="merchandise-icon">
          {source.icon === 'bandcamp' ? (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path d="M0 18.75l7.437-13.5H24l-7.438 13.5H0z"/>
            </svg>
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
          )}
        </div>
        <div className="merchandise-info">
          <span className="merchandise-title">Official Merchandise</span>
          <span className="merchandise-subtitle">
            Shop {artistName} on {source.name}
          </span>
        </div>
        <div className="merchandise-arrow">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
          </svg>
        </div>
      </a>
    </div>
  );
};

export default MerchandiseSection;
