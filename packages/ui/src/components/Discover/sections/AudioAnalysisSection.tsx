/**
 * AudioAnalysisSection - Shows enhanced tracks when audio analysis plugins are available
 * Dynamically adapts to audio-processor plugins for enhanced recommendations
 * Uses the UNIFIED plugin pipeline for data (embedding provider handles analysis-based generation)
 */

import React, { useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { usePluginStore } from '../../../stores/plugin-store';
import { usePluginData } from '../../../hooks/usePluginData';
import type { BaseSectionProps } from '../section-registry';
import type { StructuredSectionQuery } from '../types';

export interface AudioAnalysisSectionProps extends BaseSectionProps {
  maxItems?: number;
  analysisType?: 'energy' | 'mood' | 'tempo' | 'mixed';
}

const analysisTitles: Record<string, { title: string; subtitle: string }> = {
  energy: { title: 'High Energy', subtitle: 'AI-analyzed energetic tracks' },
  mood: { title: 'Mood Match', subtitle: 'AI-curated for your vibe' },
  tempo: { title: 'Perfect Tempo', subtitle: 'Matched to your rhythm' },
  mixed: { title: 'AI Enhanced', subtitle: 'Smart recommendations' },
};

export const AudioAnalysisSection: React.FC<AudioAnalysisSectionProps> = ({
  id,
  title,
  subtitle,
  onSeeAll,
  maxItems = 8,
  analysisType = 'mixed',
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();
  const { hasCapability, getPluginsByRole } = usePluginStore();

  // Check for audio processor plugins
  const hasAudioProcessor = hasCapability('audio-processor');
  const audioPlugins = getPluginsByRole('audio-processor');

  const defaultTitles = analysisTitles[analysisType] || analysisTitles.mixed;
  const sectionTitle = title || defaultTitles.title;
  const pluginInfo = audioPlugins.length > 0 ? ` via ${audioPlugins[0]?.name}` : '';
  const sectionSubtitle = subtitle || defaultTitles.subtitle + pluginInfo;

  // Determine mood based on analysis type
  const mood = analysisType === 'energy' ? 'energetic' : analysisType === 'mood' ? 'uplifting' : undefined;
  const method = mood ? 'mood' : 'personalized';

  // Build structured query for the unified pipeline
  // embeddingProvider will handle this with mood or personalized generation
  const structuredQuery = useMemo((): StructuredSectionQuery => ({
    strategy: 'plugin',
    sectionType: 'audio-analysis',
    title: sectionTitle,
    subtitle: sectionSubtitle,
    embedding: {
      method,
      mood,
      exploration: analysisType === 'energy' ? 0.3 : analysisType === 'mood' ? 0.4 : 0.35,
    },
    limit: maxItems,
  }), [sectionTitle, sectionSubtitle, method, mood, analysisType, maxItems]);

  // Use unified plugin pipeline - embeddingProvider handles generation
  const { tracks, isLoading } = usePluginData(structuredQuery, {
    enabled: true,
    applyMLRanking: true,
    applyTransformers: true,
    limit: maxItems,
  });

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  // Show section if we have audio processor OR ML is ready
  if (!hasAudioProcessor && (!isLoading && tracks.length === 0)) {
    return null;
  }

  return (
    <section id={id} className="discover-horizontal-section discover-audio-analysis-section">
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

      {isLoading ? (
        <div className="discover-horizontal-scroll">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="discover-card-skeleton" />
          ))}
        </div>
      ) : (
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
      )}
    </section>
  );
};

export default AudioAnalysisSection;
