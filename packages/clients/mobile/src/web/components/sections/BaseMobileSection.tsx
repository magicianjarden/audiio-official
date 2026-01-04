/**
 * BaseMobileSection - Common section wrapper
 *
 * Features:
 * - Title with optional "See All" link
 * - Loading skeleton states
 * - Animation delay by section index
 * - Plugin attribution badge
 */

import React from 'react';
import styles from './BaseMobileSection.module.css';

interface BaseMobileSectionProps {
  title: string;
  subtitle?: string;
  index?: number;
  isLoading?: boolean;
  isPluginPowered?: boolean;
  pluginName?: string;
  onSeeAll?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function BaseMobileSection({
  title,
  subtitle,
  index = 0,
  isLoading,
  isPluginPowered,
  pluginName,
  onSeeAll,
  children,
  className,
}: BaseMobileSectionProps) {
  // Stagger animation delay based on index
  const animationDelay = `${index * 50}ms`;

  if (isLoading) {
    return (
      <section className={`${styles.section} ${className || ''}`}>
        <div className={styles.header}>
          <div className={`${styles.titleSkeleton} skeleton`} />
        </div>
        <div className={styles.skeletonContent}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`${styles.cardSkeleton} skeleton`} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      className={`${styles.section} ${className || ''}`}
      style={{ animationDelay }}
    >
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{title}</h2>
          {isPluginPowered && pluginName && (
            <span className={styles.pluginBadge}>via {pluginName}</span>
          )}
        </div>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        {onSeeAll && (
          <button className={styles.seeAll} onClick={onSeeAll}>
            See All
          </button>
        )}
      </div>
      <div className={styles.content}>
        {children}
      </div>
    </section>
  );
}

// Skeleton component for track cards
export function TrackCardSkeleton() {
  return (
    <div className={styles.trackCardSkeleton}>
      <div className={`${styles.artworkSkeleton} skeleton`} />
      <div className={styles.infoSkeleton}>
        <div className={`${styles.titleSkeleton} skeleton`} style={{ width: '80%' }} />
        <div className={`${styles.artistSkeleton} skeleton`} style={{ width: '60%' }} />
      </div>
    </div>
  );
}

// Skeleton component for artist cards
export function ArtistCardSkeleton() {
  return (
    <div className={styles.artistCardSkeleton}>
      <div className={`${styles.avatarSkeleton} skeleton`} />
      <div className={`${styles.nameSkeleton} skeleton`} />
    </div>
  );
}
