/**
 * BannerSection - Full-width promotional banner for releases/events
 * Used for featured content, announcements, and calls-to-action
 */

import React from 'react';
import { useNavigationStore } from '../../../stores/navigation-store';
import { useSearchStore } from '../../../stores/search-store';
import { useTrendingStore, type PromoBanner } from '../../../stores/trending-store';
import type { BaseSectionProps } from '../section-registry';
import { PlayIcon, ChevronRightIcon } from '@audiio/icons';
import { debugLog } from '../../../utils/debug';

export interface BannerSectionProps extends BaseSectionProps {
  banner?: PromoBanner;
}

export const BannerSection: React.FC<BannerSectionProps> = ({
  id,
  context,
  banner: propBanner,
}) => {
  const { setSearchQuery } = useNavigationStore();
  const { search } = useSearchStore();
  const { getActiveBanners } = useTrendingStore();

  // Use provided banner or get first active banner
  const activeBanners = getActiveBanners();
  const banner = propBanner ?? activeBanners[0];

  if (!banner) {
    return null;
  }

  const handleClick = () => {
    if (!banner.ctaAction) return;

    // Handle different action types
    if (banner.ctaAction.startsWith('search:')) {
      const query = banner.ctaAction.replace('search:', '');
      setSearchQuery(query);
      search(query);
    } else if (banner.ctaAction.startsWith('artist:')) {
      // Could navigate to artist detail view
      const artistId = banner.ctaAction.replace('artist:', '');
      debugLog('[Banner]', `Navigate to artist: ${artistId}`);
    } else if (banner.ctaAction.startsWith('album:')) {
      // Could navigate to album detail view
      const albumId = banner.ctaAction.replace('album:', '');
      debugLog('[Banner]', `Navigate to album: ${albumId}`);
    }
  };

  // Build background style
  const backgroundStyle: React.CSSProperties = {};

  if (banner.backgroundImage) {
    backgroundStyle.backgroundImage = `url(${banner.backgroundImage})`;
    backgroundStyle.backgroundSize = 'cover';
    backgroundStyle.backgroundPosition = 'center';
  } else if (banner.gradientColors) {
    backgroundStyle.background = `linear-gradient(135deg, ${banner.gradientColors[0]} 0%, ${banner.gradientColors[1]} 100%)`;
  } else if (banner.backgroundColor) {
    backgroundStyle.backgroundColor = banner.backgroundColor;
  } else {
    // Default gradient - using CSS variables for theme support
    backgroundStyle.background = 'linear-gradient(135deg, var(--accent) 0%, var(--bg-primary) 100%)';
  }

  return (
    <section id={id} className="banner-section" style={backgroundStyle}>
      {/* Overlay for text readability */}
      <div className="banner-overlay" />

      <div className="banner-content">
        <div className="banner-text">
          {banner.type !== 'custom' && (
            <span className="banner-badge">{getBadgeText(banner.type)}</span>
          )}
          <h2 className="banner-title">{banner.title}</h2>
          {banner.subtitle && (
            <p className="banner-subtitle">{banner.subtitle}</p>
          )}
        </div>

        {banner.ctaText && (
          <button className="banner-cta" onClick={handleClick}>
            <span>{banner.ctaText}</span>
            <ChevronRightIcon size={20} />
          </button>
        )}
      </div>

      {/* Decorative elements */}
      <div className="banner-decoration">
        <div className="banner-circle banner-circle--1" />
        <div className="banner-circle banner-circle--2" />
      </div>
    </section>
  );
};

function getBadgeText(type: PromoBanner['type']): string {
  switch (type) {
    case 'new-release':
      return 'New Release';
    case 'featured-artist':
      return 'Featured Artist';
    case 'playlist':
      return 'Playlist';
    case 'event':
      return 'Event';
    default:
      return '';
  }
}

export default BannerSection;
