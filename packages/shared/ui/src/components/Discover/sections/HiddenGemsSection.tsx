/**
 * HiddenGemsSection - Underrated tracks discovery
 * Showcases quality tracks with lower play counts.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { usePluginData } from '../../../hooks/usePluginData';
import { TrackCard } from '../TrackCard';
import { PlayIcon, SparklesIcon, ChevronRightIcon } from '@audiio/icons';
import type { StructuredSectionQuery } from '../types';

export interface HiddenGemsSectionProps {
  id: string;
  title?: string;
  subtitle?: string;
  maxItems?: number;
  onSeeAll?: () => void;
}

export const HiddenGemsSection: React.FC<HiddenGemsSectionProps> = ({
  id,
  title = 'Hidden Gems',
  subtitle = 'Underrated tracks worth discovering',
  maxItems = 6,
  onSeeAll,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();
  const [isVisible, setIsVisible] = useState(false);

  const structuredQuery = useMemo((): StructuredSectionQuery => ({
    strategy: 'plugin',
    sectionType: 'deep-cuts',
    title,
    embedding: {
      method: 'discovery',
      exploration: 0.5,
    },
    filters: {
      maxPlayCount: 5000,
      minQualityScore: 0.7,
    },
    limit: maxItems,
  }), [title, maxItems]);

  const { tracks, isLoading } = usePluginData(structuredQuery, {
    enabled: true,
    applyMLRanking: true,
    applyTransformers: true,
    limit: maxItems,
  });

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 250);
    return () => clearTimeout(timer);
  }, []);

  const handlePlayTrack = (index: number) => {
    setQueue(tracks, index);
    play(tracks[index]!);
  };

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      setQueue(tracks, 0);
      play(tracks[0]!);
    }
  };

  const showEmptyState = !isLoading && tracks.length === 0;

  if (showEmptyState) return null;

  return (
    <section
      id={id}
      className={`discover-section ${isVisible ? 'is-visible' : ''}`}
      style={{ animationDelay: '250ms' }}
    >
      <div className="discover-section-header">
        <div className="discover-section-title-row">
          <SparklesIcon size={20} className="discover-section-icon discover-section-icon--gem" />
          <h2 className="discover-section-title">{title}</h2>
          <span className="discover-section-subtitle">{subtitle}</span>
        </div>
        <div className="discover-section-actions">
          <button className="pill-btn pill-btn--sm" onClick={handlePlayAll}>
            <PlayIcon size={14} />
            <span>Discover</span>
          </button>
          {onSeeAll && (
            <button className="discover-section-more" onClick={onSeeAll}>
              More gems <ChevronRightIcon size={16} />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="discover-section-grid">
          {Array.from({ length: maxItems }).map((_, i) => (
            <div key={i} className="track-card skeleton" style={{ animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
      ) : (
        <div className="discover-section-grid">
          {tracks.map((track, index) => (
            <TrackCard
              key={track.id}
              track={track}
              onClick={() => handlePlayTrack(index)}
              onContextMenu={showContextMenu}
              style={{ animationDelay: `${index * 50}ms` }}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default HiddenGemsSection;
