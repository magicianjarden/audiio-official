/**
 * DecadeMixSection - 80s, 90s, 2000s, 2010s vibes
 * Uses the plugin pipeline for decade-based music exploration
 */

import React, { useState, useCallback } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { usePluginData } from '../../../hooks/usePluginData';
import { BaseSectionWrapper } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import type { StructuredSectionQuery } from '../types';
import { PlayIcon } from '@audiio/icons';

interface DecadeProfile {
  id: string;
  name: string;
  years: string;
  startYear: number;
  endYear: number;
  color: string;
  searchTerms: string;
}

const DECADES: DecadeProfile[] = [
  { id: '80s', name: "80s", years: '1980-89', startYear: 1980, endYear: 1989, color: '#ff6b9d', searchTerms: '80s hits synthwave retro' },
  { id: '90s', name: "90s", years: '1990-99', startYear: 1990, endYear: 1999, color: '#4ecdc4', searchTerms: '90s hits grunge alternative' },
  { id: '2000s', name: "00s", years: '2000-09', startYear: 2000, endYear: 2009, color: '#45b7d1', searchTerms: '2000s hits pop rock rnb' },
  { id: '2010s', name: "10s", years: '2010-19', startYear: 2010, endYear: 2019, color: '#96ceb4', searchTerms: '2010s hits edm pop indie' },
  { id: '2020s', name: "20s", years: '2020-now', startYear: 2020, endYear: 2030, color: '#9b59b6', searchTerms: '2024 hits trending new music' },
];

export interface DecadeMixSectionProps extends BaseSectionProps {
  maxItems?: number;
}

export const DecadeMixSection: React.FC<DecadeMixSectionProps> = ({
  id,
  title = 'Decades',
  subtitle = 'Music through the years',
  context,
  onSeeAll,
  maxItems = 12,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();
  const [activeDecade, setActiveDecade] = useState<string | null>(null);

  // Get decade profile
  const activeProfile = DECADES.find(d => d.id === activeDecade);

  // Build structured query for plugin pipeline
  const structuredQuery: StructuredSectionQuery | null = activeProfile
    ? {
        strategy: 'plugin',
        sectionType: 'decade-mix',
        title: `${activeProfile.name} Hits`,
        search: { query: activeProfile.searchTerms },
        embedding: {
          method: 'discovery',
          exploration: 0.3,
          yearRange: [activeProfile.startYear, activeProfile.endYear],
        },
        limit: maxItems,
      }
    : null;

  // Use plugin pipeline for data fetching
  const { tracks, isLoading } = usePluginData(structuredQuery, {
    enabled: !!activeDecade,
    applyMLRanking: true,
    applyTransformers: true,
    limit: maxItems,
  });

  const handleDecadeClick = useCallback((decadeId: string) => {
    setActiveDecade(activeDecade === decadeId ? null : decadeId);
  }, [activeDecade]);

  const handlePlayAll = useCallback(() => {
    if (tracks.length > 0 && tracks[0]) {
      setQueue(tracks, 0);
      play(tracks[0]);
    }
  }, [tracks, setQueue, play]);

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  return (
    <BaseSectionWrapper
      id={id}
      type="decade-mix"
      title={title}
      subtitle={subtitle}
      context={context}
      onSeeAll={onSeeAll}
      className="decade-mix-section"
    >
      {/* Decade pills */}
      <div className="decade-pills">
        {DECADES.map((decade) => (
          <button
            key={decade.id}
            className={`decade-pill ${activeDecade === decade.id ? 'active' : ''}`}
            onClick={() => handleDecadeClick(decade.id)}
            style={{ '--decade-color': decade.color } as React.CSSProperties}
          >
            <span className="decade-pill-name">{decade.name}</span>
          </button>
        ))}
      </div>

      {/* Selected decade tracks */}
      {activeProfile && (
        <div className="decade-tracks-panel">
          <div className="decade-tracks-header">
            <div className="decade-tracks-info">
              <span className="decade-tracks-name">{activeProfile.name} Hits</span>
              {!isLoading && <span className="decade-tracks-count">{tracks.length} tracks</span>}
            </div>
            <button
              className="decade-play-btn"
              onClick={handlePlayAll}
              disabled={isLoading || tracks.length === 0}
            >
              <PlayIcon size={16} />
              <span>Play</span>
            </button>
          </div>

          {isLoading ? (
            <div className="discover-horizontal-scroll">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="discover-card-skeleton" />
              ))}
            </div>
          ) : tracks.length > 0 ? (
            <div className="discover-horizontal-scroll">
              {tracks.map((track, index) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  onClick={() => handleTrackClick(track, index)}
                  onContextMenu={showContextMenu}
                />
              ))}
            </div>
          ) : (
            <div className="decade-empty">
              <p>No {activeProfile.name} tracks found</p>
            </div>
          )}
        </div>
      )}
    </BaseSectionWrapper>
  );
};

export default DecadeMixSection;
