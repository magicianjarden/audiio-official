/**
 * Skeleton - Loading state placeholders with shimmer animation
 */

import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  borderRadius,
  className = '',
  style
}) => {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius,
        ...style
      }}
    />
  );
};

// Skeleton for text lines
export const SkeletonText: React.FC<{
  width?: string | number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ width, size = 'md', className = '' }) => {
  const sizeClass = size !== 'md' ? size : '';
  return (
    <div
      className={`skeleton skeleton-text ${sizeClass} ${className}`}
      style={{ width: typeof width === 'number' ? `${width}px` : width }}
    />
  );
};

// Skeleton for a single track row
export const SkeletonTrack: React.FC = () => {
  return (
    <div className="skeleton-track">
      <div className="skeleton skeleton-track-number" />
      <div className="skeleton-track-info">
        <div className="skeleton skeleton-track-title" />
        <div className="skeleton skeleton-track-artist" />
      </div>
      <div className="skeleton skeleton-track-duration" />
    </div>
  );
};

// Skeleton for track list (multiple rows)
export const TrackListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="skeleton-track-list">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonTrack key={i} />
      ))}
    </div>
  );
};

// Skeleton for a single album card
export const SkeletonAlbumCard: React.FC = () => {
  return (
    <div className="skeleton-album-card">
      <div className="skeleton skeleton-album-art" />
      <div className="skeleton skeleton-album-title" />
      <div className="skeleton skeleton-album-artist" />
    </div>
  );
};

// Skeleton for album grid (multiple cards)
export const AlbumGridSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="discography-grid">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonAlbumCard key={i} />
      ))}
    </div>
  );
};

// Skeleton for artist hero section
export const HeroSkeleton: React.FC<{ type?: 'artist' | 'album' }> = ({ type = 'artist' }) => {
  return (
    <div className="detail-hero" style={{ minHeight: '320px' }}>
      <div className="hero-content">
        <div
          className={`skeleton ${type === 'artist' ? 'skeleton-circle' : ''}`}
          style={{ width: '220px', height: '220px', flexShrink: 0 }}
        />
        <div className="hero-info" style={{ flex: 1 }}>
          <Skeleton width="60%" height={40} className="skeleton-text lg" />
          <Skeleton width="40%" height={20} className="skeleton-text" style={{ marginTop: '8px' }} />
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <Skeleton width={80} height={28} borderRadius="999px" />
            <Skeleton width={60} height={28} borderRadius="999px" />
            <Skeleton width={70} height={28} borderRadius="999px" />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <Skeleton width={120} height={48} borderRadius="999px" />
            <Skeleton width={48} height={48} borderRadius="999px" className="skeleton-circle" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Skeleton for artist detail page
export const ArtistDetailSkeleton: React.FC = () => {
  return (
    <div className="artist-detail-view">
      <HeroSkeleton type="artist" />
      <div className="artist-content" style={{ padding: '0 24px' }}>
        {/* Bio section */}
        <section className="artist-section" style={{ marginTop: '32px' }}>
          <SkeletonText width={80} size="lg" />
          <div style={{ marginTop: '16px' }}>
            <SkeletonText width="100%" />
            <SkeletonText width="90%" />
            <SkeletonText width="75%" />
          </div>
        </section>

        {/* Popular tracks */}
        <section className="artist-section" style={{ marginTop: '32px' }}>
          <SkeletonText width={100} size="lg" />
          <div className="artist-tracks-list" style={{ marginTop: '16px' }}>
            <TrackListSkeleton count={5} />
          </div>
        </section>

        {/* Discography */}
        <section className="artist-section" style={{ marginTop: '32px' }}>
          <SkeletonText width={120} size="lg" />
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', marginBottom: '16px' }}>
            <Skeleton width={70} height={32} borderRadius="8px" />
            <Skeleton width={60} height={32} borderRadius="8px" />
            <Skeleton width={50} height={32} borderRadius="8px" />
          </div>
          <AlbumGridSkeleton count={4} />
        </section>
      </div>
    </div>
  );
};

// Skeleton for album detail page
export const AlbumDetailSkeleton: React.FC = () => {
  return (
    <div className="album-detail-view">
      <HeroSkeleton type="album" />
      <div className="album-content" style={{ padding: '0 24px' }}>
        {/* Track list */}
        <div className="album-tracks-section" style={{ marginTop: '24px' }}>
          <div className="album-tracks-header">
            <Skeleton width={20} height={14} />
            <Skeleton width={60} height={14} style={{ flex: 1, marginLeft: '16px' }} />
            <Skeleton width={50} height={14} />
          </div>
          <div className="album-tracks-list">
            <TrackListSkeleton count={8} />
          </div>
        </div>

        {/* Footer info */}
        <div className="album-footer-info" style={{ marginTop: '32px' }}>
          <SkeletonText width={150} />
          <SkeletonText width={100} size="sm" />
        </div>

        {/* More by artist */}
        <section className="album-section" style={{ marginTop: '32px' }}>
          <SkeletonText width={160} size="lg" />
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px', overflowX: 'hidden' }}>
            <AlbumGridSkeleton count={4} />
          </div>
        </section>
      </div>
    </div>
  );
};

export default Skeleton;
