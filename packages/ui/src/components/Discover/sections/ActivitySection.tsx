/**
 * ActivitySection - Running, Cooking, Studying, Gaming playlists
 * Activity-based mood playlists with visual tiles
 * Uses the UNIFIED plugin pipeline for data (embedding provider handles mood generation)
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { usePluginData } from '../../../hooks/usePluginData';
import { BaseSectionWrapper } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import type { StructuredSectionQuery } from '../types';
import { PlayIcon, MusicNoteIcon } from '@audiio/icons';

interface ActivityProfile {
  id: string;
  name: string;
  icon: string;
  mood: string;
  gradient: [string, string];
}

const ACTIVITIES: ActivityProfile[] = [
  { id: 'workout', name: 'Workout', icon: '💪', mood: 'energetic', gradient: ['#f12711', '#f5af19'] },
  { id: 'study', name: 'Study', icon: '📚', mood: 'focus', gradient: ['#11998e', '#38ef7d'] },
  { id: 'cooking', name: 'Cooking', icon: '🍳', mood: 'uplifting', gradient: ['#fc4a1a', '#f7b733'] },
  { id: 'gaming', name: 'Gaming', icon: '🎮', mood: 'energetic', gradient: ['#8e2de2', '#4a00e0'] },
  { id: 'running', name: 'Running', icon: '🏃', mood: 'energetic', gradient: ['#f857a6', '#ff5858'] },
  { id: 'relaxing', name: 'Relaxing', icon: '🧘', mood: 'chill', gradient: ['#667eea', '#764ba2'] },
];

export interface ActivitySectionProps extends BaseSectionProps {
  maxTracks?: number;
}

export const ActivitySection: React.FC<ActivitySectionProps> = ({
  id,
  title = 'Activity Playlists',
  subtitle = 'Music for what you\'re doing',
  context,
  onSeeAll,
  maxTracks = 12,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();
  const [activeActivity, setActiveActivity] = useState<string | null>(null);

  const activeProfile = ACTIVITIES.find(a => a.id === activeActivity);

  // Build structured query for the unified pipeline
  // embeddingProvider will handle this with mood-based generation
  const structuredQuery = useMemo((): StructuredSectionQuery => ({
    strategy: 'plugin',
    sectionType: 'activity',
    title: activeProfile ? `${activeProfile.name} Mix` : title,
    subtitle,
    embedding: {
      method: 'mood',
      mood: activeProfile?.mood || 'chill',
      exploration: 0.25,
    },
    limit: maxTracks,
  }), [title, subtitle, activeProfile, maxTracks]);

  // Use unified plugin pipeline - embeddingProvider handles mood generation
  const { tracks, isLoading } = usePluginData(structuredQuery, {
    enabled: !!activeActivity,
    applyMLRanking: true,
    applyTransformers: true,
    limit: maxTracks,
  });

  const handleActivityClick = useCallback((activityId: string) => {
    setActiveActivity(activeActivity === activityId ? null : activityId);
  }, [activeActivity]);

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

  // Always show the activity tiles, only hide track panel if loading/empty
  // The section should render even without an active selection

  return (
    <BaseSectionWrapper
      id={id}
      type="activity"
      title={title}
      subtitle={subtitle}
      context={context}
      onSeeAll={onSeeAll}
      className="activity-section"
    >
      <div className="activity-tiles">
        {ACTIVITIES.map((activity) => (
          <button
            key={activity.id}
            className={`activity-tile ${activeActivity === activity.id ? 'active' : ''}`}
            onClick={() => handleActivityClick(activity.id)}
            style={{
              '--gradient-start': activity.gradient[0],
              '--gradient-end': activity.gradient[1],
            } as React.CSSProperties}
          >
            <span className="activity-icon">{activity.icon}</span>
            <span className="activity-name">{activity.name}</span>
          </button>
        ))}
      </div>

      {activeProfile && tracks.length > 0 && (
        <div className="activity-tracks-panel">
          <div className="activity-tracks-header">
            <span className="activity-tracks-title">
              {activeProfile.icon} {activeProfile.name} Mix
            </span>
            <button className="activity-play-btn" onClick={handlePlayAll}>
              <PlayIcon size={16} />
              Play All
            </button>
          </div>
          <div className="activity-tracks-scroll">
            {tracks.map((track, index) => (
              <div
                key={track.id}
                className="activity-track-item"
                onClick={() => handleTrackClick(track, index)}
                onContextMenu={(e) => showContextMenu(e, track)}
              >
                <div className="activity-track-artwork">
                  {track.artwork?.small ? (
                    <img src={track.artwork.small} alt={track.title} loading="lazy" />
                  ) : (
                    <div className="activity-track-placeholder">
                      <MusicNoteIcon size={16} />
                    </div>
                  )}
                </div>
                <div className="activity-track-info">
                  <span className="activity-track-title">{track.title}</span>
                  <span className="activity-track-artist">
                    {track.artists.map(a => a.name).join(', ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </BaseSectionWrapper>
  );
};

export default ActivitySection;
