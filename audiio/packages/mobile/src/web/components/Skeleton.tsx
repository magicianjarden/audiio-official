/**
 * Skeleton - Loading placeholder components
 *
 * Native-like shimmer loading states for:
 * - Track rows
 * - Album cards
 * - Artist cards
 * - Section headers
 */

import React from 'react';
import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
}

/**
 * Base skeleton element with shimmer animation
 */
export function Skeleton({
  width,
  height,
  borderRadius,
  className = '',
}: SkeletonProps) {
  return (
    <div
      className={`${styles.skeleton} ${className}`}
      style={{
        width,
        height,
        borderRadius,
      }}
    />
  );
}

/**
 * Skeleton for track list rows
 */
export function TrackRowSkeleton() {
  return (
    <div className={styles.trackRow}>
      <Skeleton width={48} height={48} borderRadius={6} />
      <div className={styles.trackInfo}>
        <Skeleton width="70%" height={14} borderRadius={4} />
        <Skeleton width="50%" height={12} borderRadius={4} />
      </div>
      <Skeleton width={32} height={32} borderRadius="50%" />
    </div>
  );
}

/**
 * Multiple track row skeletons
 */
export function TrackListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className={styles.trackList}>
      {Array.from({ length: count }).map((_, i) => (
        <TrackRowSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for album/playlist cards
 */
export function CardSkeleton() {
  return (
    <div className={styles.card}>
      <Skeleton className={styles.cardImage} borderRadius={8} />
      <Skeleton width="80%" height={14} borderRadius={4} className={styles.cardTitle} />
      <Skeleton width="60%" height={12} borderRadius={4} />
    </div>
  );
}

/**
 * Horizontal scroll of card skeletons
 */
export function CardRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={styles.cardRow}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Section with title and content skeleton
 */
export function SectionSkeleton({ variant = 'cards' }: { variant?: 'cards' | 'tracks' }) {
  return (
    <div className={styles.section}>
      <Skeleton width={140} height={20} borderRadius={4} className={styles.sectionTitle} />
      {variant === 'cards' ? <CardRowSkeleton /> : <TrackListSkeleton count={4} />}
    </div>
  );
}

/**
 * Artist card skeleton (circular)
 */
export function ArtistCardSkeleton() {
  return (
    <div className={styles.artistCard}>
      <Skeleton width={100} height={100} borderRadius="50%" />
      <Skeleton width="70%" height={14} borderRadius={4} className={styles.artistName} />
    </div>
  );
}

/**
 * Now Playing page skeleton
 */
export function NowPlayingSkeleton() {
  return (
    <div className={styles.nowPlaying}>
      <div className={styles.nowPlayingHeader}>
        <Skeleton width={32} height={32} borderRadius="50%" />
        <Skeleton width={120} height={14} borderRadius={4} />
        <Skeleton width={32} height={32} borderRadius="50%" />
      </div>
      <Skeleton className={styles.nowPlayingArtwork} borderRadius={12} />
      <div className={styles.nowPlayingInfo}>
        <Skeleton width="80%" height={24} borderRadius={4} />
        <Skeleton width="50%" height={16} borderRadius={4} />
      </div>
      <Skeleton width="100%" height={4} borderRadius={2} />
      <div className={styles.nowPlayingControls}>
        <Skeleton width={48} height={48} borderRadius="50%" />
        <Skeleton width={48} height={48} borderRadius="50%" />
        <Skeleton width={64} height={64} borderRadius="50%" />
        <Skeleton width={48} height={48} borderRadius="50%" />
        <Skeleton width={48} height={48} borderRadius="50%" />
      </div>
    </div>
  );
}

/**
 * Library page skeleton
 */
export function LibrarySkeleton() {
  return (
    <div className={styles.library}>
      {/* Filter chips */}
      <div className={styles.filterRow}>
        <Skeleton width={80} height={32} borderRadius={16} />
        <Skeleton width={90} height={32} borderRadius={16} />
        <Skeleton width={70} height={32} borderRadius={16} />
        <Skeleton width={85} height={32} borderRadius={16} />
      </div>
      {/* Track list */}
      <TrackListSkeleton count={8} />
    </div>
  );
}

/**
 * Search results skeleton
 */
export function SearchResultsSkeleton() {
  return (
    <div className={styles.searchResults}>
      <SectionSkeleton variant="cards" />
      <SectionSkeleton variant="tracks" />
    </div>
  );
}
