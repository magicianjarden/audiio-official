/**
 * LyricsHighlightSection - Shows tracks with notable lyrics
 * Dynamically uses any available lyrics-provider plugin
 */

import React, { useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { usePluginStore } from '../../../stores/plugin-store';
import { useEmbeddingPlaylist } from '../../../hooks/useEmbeddingPlaylist';
import type { BaseSectionProps } from '../section-registry';

export interface LyricsHighlightSectionProps extends BaseSectionProps {
  maxItems?: number;
}

export const LyricsHighlightSection: React.FC<LyricsHighlightSectionProps> = ({
  id,
  title = 'Lyrical Gems',
  subtitle,
  onSeeAll,
  maxItems = 8,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();
  const { hasCapability, getPluginsByRole } = usePluginStore();

  // Check if any lyrics provider is available
  const hasLyricsProvider = hasCapability('lyrics-provider');
  const lyricsPlugins = getPluginsByRole('lyrics-provider');

  const {
    generatePersonalizedPlaylist,
    getTracksFromPlaylist,
    isReady: embeddingReady,
    tracksIndexed,
  } = useEmbeddingPlaylist();

  // Generate tracks - prioritize ones that work well with lyrics
  const tracks = useMemo(() => {
    if (!embeddingReady || tracksIndexed < 1) {
      return [];
    }

    const playlist = generatePersonalizedPlaylist({ limit: maxItems });
    if (!playlist || playlist.tracks.length === 0) {
      return [];
    }

    return getTracksFromPlaylist(playlist);
  }, [embeddingReady, tracksIndexed, maxItems, generatePersonalizedPlaylist, getTracksFromPlaylist]);

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  // Hide if no lyrics capability or no tracks
  if (!hasLyricsProvider || (!embeddingReady && tracksIndexed < 1) || tracks.length === 0) {
    return null;
  }

  const sectionTitle = title;
  const sectionSubtitle = subtitle || `Powered by ${lyricsPlugins[0]?.name || 'lyrics provider'}`;

  return (
    <section id={id} className="discover-horizontal-section discover-lyrics-section">
      <div className="discover-section-header">
        <div className="discover-section-title-row">
          <h2 className="discover-section-title">{sectionTitle}</h2>
          <span className="discover-section-subtitle">{sectionSubtitle}</span>
        </div>
        {onSeeAll && (
          <button className="discover-section-more" onClick={onSeeAll}>
            See all
          </button>
        )}
      </div>

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
    </section>
  );
};

export default LyricsHighlightSection;
