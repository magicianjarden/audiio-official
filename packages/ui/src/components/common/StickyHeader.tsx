/**
 * StickyHeader - Reusable sticky/collapsing header for detail pages
 * Features parallax hero section with color-extracted gradients
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { BackIcon, PlayIcon, ShuffleIcon, MusicNoteIcon, VerifiedIcon } from '@audiio/icons';
import type { ExtractedColors } from '../../utils/color-extraction';

export interface StickyHeaderProps {
  /** Page title (artist name or album title) */
  title: string;
  /** Subtitle (e.g., artist name on album page) */
  subtitle?: string;
  /** Artwork URL */
  artworkUrl?: string;
  /** Extracted colors from artwork */
  colors: ExtractedColors;
  /** Type of page (affects artwork shape) */
  type: 'artist' | 'album';
  /** Whether artist is verified */
  verified?: boolean;
  /** Navigation back handler */
  onBack: () => void;
  /** Play all handler */
  onPlay: () => void;
  /** Shuffle play handler */
  onShuffle: () => void;
  /** Whether play is disabled */
  isPlayDisabled?: boolean;
  /** Render additional meta information */
  renderMeta?: () => React.ReactNode;
  /** Render badges/tags */
  renderBadges?: () => React.ReactNode;
  /** The scrollable container ref (if not using parent) */
  scrollContainerRef?: React.RefObject<HTMLElement>;
}

export const StickyHeader: React.FC<StickyHeaderProps> = ({
  title,
  subtitle,
  artworkUrl,
  colors,
  type,
  verified,
  onBack,
  onPlay,
  onShuffle,
  isPlayDisabled,
  renderMeta,
  renderBadges,
  scrollContainerRef
}) => {
  const heroRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Handle scroll events with throttling
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef?.current || heroRef.current?.parentElement;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const collapseThreshold = 200;
    const progress = Math.min(scrollTop / collapseThreshold, 1);

    setScrollProgress(progress);
    setIsCollapsed(progress >= 0.8);
  }, [scrollContainerRef]);

  useEffect(() => {
    const container = scrollContainerRef?.current || heroRef.current?.parentElement;
    if (!container) return;

    // Use requestAnimationFrame for smooth updates
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [handleScroll, scrollContainerRef]);

  const gradientStyle = {
    background: `linear-gradient(180deg,
      ${colors.dominant}dd 0%,
      ${colors.darkVibrant}99 40%,
      transparent 100%)`
  };

  return (
    <>
      {/* Fixed collapsed header bar */}
      <div
        className={`sticky-header-bar ${isCollapsed ? 'visible' : ''}`}
        style={{
          '--header-bg': colors.dominant,
          opacity: scrollProgress
        } as React.CSSProperties}
      >
        <button className="back-btn-round" onClick={onBack} aria-label="Go back">
          <BackIcon size={20} />
        </button>
        <div className="sticky-header-title">
          <span className="sticky-header-title-text">{title}</span>
          {verified && (
            <span className="sticky-header-verified">
              <VerifiedIcon size={16} />
            </span>
          )}
        </div>
        <button
          className="sticky-play-btn"
          onClick={onPlay}
          disabled={isPlayDisabled}
          aria-label="Play"
        >
          <PlayIcon size={18} />
        </button>
      </div>

      {/* Parallax hero section */}
      <div
        ref={heroRef}
        className={`detail-hero ${type}-hero`}
        style={{
          '--parallax-offset': `${scrollProgress * -50}px`
        } as React.CSSProperties}
      >
        <div className="hero-gradient-overlay" style={gradientStyle} />

        <div
          className="hero-content"
          style={{
            opacity: 1 - scrollProgress * 0.8,
            transform: `translateY(${scrollProgress * 30}px)`
          }}
        >
          {/* Artwork */}
          <div className={`hero-artwork ${type === 'artist' ? 'circular' : ''}`}>
            {artworkUrl ? (
              <img src={artworkUrl} alt={title} loading="eager" />
            ) : (
              <div className="hero-artwork-placeholder">
                <MusicNoteIcon size={64} />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="hero-info">
            {/* Verified badge for artists */}
            {type === 'artist' && verified && (
              <div className="verified-badge">
                <VerifiedIcon size={14} />
                <span>Verified Artist</span>
              </div>
            )}

            {/* Title */}
            <h1 className="hero-title">{title}</h1>

            {/* Subtitle (artist name on album pages) */}
            {subtitle && (
              <p className="hero-subtitle">{subtitle}</p>
            )}

            {/* Custom meta content */}
            {renderMeta?.()}

            {/* Custom badges */}
            {renderBadges?.()}

            {/* Action buttons */}
            <div className="hero-actions">
              <button
                className="hero-play-btn animated-play-btn"
                onClick={onPlay}
                disabled={isPlayDisabled}
              >
                <PlayIcon size={20} />
                <span>Play</span>
              </button>
              <button
                className="hero-shuffle-btn"
                onClick={onShuffle}
                disabled={isPlayDisabled}
                aria-label="Shuffle play"
              >
                <ShuffleIcon size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Static back button in hero */}
        <button className="back-btn-round hero-back-btn" onClick={onBack} aria-label="Go back">
          <BackIcon size={20} />
        </button>
      </div>
    </>
  );
};

export default StickyHeader;
