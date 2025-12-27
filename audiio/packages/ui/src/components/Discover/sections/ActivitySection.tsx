/**
 * ActivitySection - Running, Cooking, Studying, Gaming playlists
 * Activity-based mood playlists with visual tiles
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { useEmbeddingPlaylist } from '../../../hooks/useEmbeddingPlaylist';
import { BaseSectionWrapper } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import { PlayIcon, MusicNoteIcon } from '@audiio/icons';
import { debugLog } from '../../../utils/debug';

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

  const {
    generateMoodPlaylist,
    getTracksFromPlaylist,
    isReady: embeddingReady,
    tracksIndexed,
  } = useEmbeddingPlaylist();

  const activeProfile = ACTIVITIES.find(a => a.id === activeActivity);

  const tracks = useMemo(() => {
    if (!activeActivity || !embeddingReady || tracksIndexed < 1) {
      return [];
    }

    const activity = ACTIVITIES.find(a => a.id === activeActivity);
    if (!activity) return [];

    const playlist = generateMoodPlaylist(activity.mood, { limit: maxTracks });
    if (!playlist) return [];

    debugLog('[Activity]', `Generated "${activity.name}" playlist: ${playlist.tracks.length} tracks`);
    return getTracksFromPlaylist(playlist);
  }, [activeActivity, embeddingReady, tracksIndexed, maxTracks, generateMoodPlaylist, getTracksFromPlaylist]);

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

  if (!embeddingReady) {
    return null;
  }

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
