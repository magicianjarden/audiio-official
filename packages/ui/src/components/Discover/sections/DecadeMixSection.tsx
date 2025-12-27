/**
 * DecadeMixSection - 80s, 90s, 2000s, 2010s vibes
 * Era-based music exploration
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { useEmbeddingPlaylist } from '../../../hooks/useEmbeddingPlaylist';
import { BaseSectionWrapper } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import { debugLog } from '../../../utils/debug';

interface DecadeProfile {
  id: string;
  name: string;
  years: string;
  color: string;
}

const DECADES: DecadeProfile[] = [
  { id: '80s', name: "80s", years: '1980-1989', color: '#ff6b9d' },
  { id: '90s', name: "90s", years: '1990-1999', color: '#4ecdc4' },
  { id: '2000s', name: "2000s", years: '2000-2009', color: '#45b7d1' },
  { id: '2010s', name: "2010s", years: '2010-2019', color: '#96ceb4' },
  { id: '2020s', name: "2020s", years: '2020-now', color: '#9b59b6' },
];

export interface DecadeMixSectionProps extends BaseSectionProps {
  maxItems?: number;
}

export const DecadeMixSection: React.FC<DecadeMixSectionProps> = ({
  id,
  title = 'Decade Mixes',
  subtitle = 'Music through the years',
  context,
  onSeeAll,
  maxItems = 10,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();
  const [activeDecade, setActiveDecade] = useState<string | null>(null);

  const {
    generateGenrePlaylist,
    getTracksFromPlaylist,
    isReady: embeddingReady,
    tracksIndexed,
  } = useEmbeddingPlaylist();

  const tracks = useMemo(() => {
    if (!activeDecade || !embeddingReady || tracksIndexed < 1) {
      return [];
    }

    // Use decade as a "genre" for playlist generation
    const playlist = generateGenrePlaylist(activeDecade, { limit: maxItems });
    if (!playlist) return [];

    debugLog('[DecadeMix]', `Generated "${activeDecade}" playlist: ${playlist.tracks.length} tracks`);
    return getTracksFromPlaylist(playlist);
  }, [activeDecade, embeddingReady, tracksIndexed, maxItems, generateGenrePlaylist, getTracksFromPlaylist]);

  const handleDecadeClick = useCallback((decadeId: string) => {
    setActiveDecade(activeDecade === decadeId ? null : decadeId);
  }, [activeDecade]);

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  if (!embeddingReady) {
    return null;
  }

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
      <div className="decade-tabs">
        {DECADES.map((decade) => (
          <button
            key={decade.id}
            className={`decade-tab ${activeDecade === decade.id ? 'active' : ''}`}
            onClick={() => handleDecadeClick(decade.id)}
            style={{ '--decade-color': decade.color } as React.CSSProperties}
          >
            <span className="decade-name">{decade.name}</span>
            <span className="decade-years">{decade.years}</span>
          </button>
        ))}
      </div>

      {activeDecade && tracks.length > 0 && (
        <div className="discover-horizontal-scroll decade-tracks">
          {tracks.map((track, index) => (
            <TrackCard
              key={track.id}
              track={track}
              onClick={() => handleTrackClick(track, index)}
              onContextMenu={showContextMenu}
            />
          ))}
        </div>
      )}
    </BaseSectionWrapper>
  );
};

export default DecadeMixSection;
