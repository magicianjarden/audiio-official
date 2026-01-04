/**
 * MoodPlaylistSection - Interactive mood-based playlist cards
 *
 * Displays clickable mood tiles that generate playlists based on
 * audio feature profiles (energy, valence, danceability, BPM).
 * Uses the UNIFIED plugin pipeline for data (embedding provider handles mood generation)
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { showSuccessToast } from '../../../stores/toast-store';
import { BaseSectionWrapper } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import type { StructuredSectionQuery } from '../types';
import { PlayIcon, ShuffleIcon, MusicNoteIcon } from '@audiio/icons';
import { usePluginData } from '../../../hooks/usePluginData';

// Mood profile definitions
interface MoodProfile {
  id: string;
  name: string;
  icon: string;
  description: string;
  gradient: [string, string];
  searchTerms: string[];
}

const MOOD_PROFILES: MoodProfile[] = [
  {
    id: 'chill',
    name: 'Chill',
    icon: '🌊',
    description: 'Relaxed vibes',
    gradient: ['#667eea', '#764ba2'],
    searchTerms: ['chill vibes', 'lofi beats', 'relaxing music'],
  },
  {
    id: 'workout',
    name: 'Workout',
    icon: '💪',
    description: 'High energy',
    gradient: ['#f12711', '#f5af19'],
    searchTerms: ['workout music', 'gym motivation', 'high energy'],
  },
  {
    id: 'focus',
    name: 'Focus',
    icon: '🎯',
    description: 'Deep work',
    gradient: ['#11998e', '#38ef7d'],
    searchTerms: ['focus music', 'study beats', 'concentration'],
  },
  {
    id: 'party',
    name: 'Party',
    icon: '🎉',
    description: 'Get moving',
    gradient: ['#ff0844', '#ffb199'],
    searchTerms: ['party music', 'dance hits', 'club bangers'],
  },
  {
    id: 'sleep',
    name: 'Sleep',
    icon: '🌙',
    description: 'Peaceful rest',
    gradient: ['#2c3e50', '#4ca1af'],
    searchTerms: ['sleep music', 'relaxing sleep', 'peaceful'],
  },
  {
    id: 'happy',
    name: 'Happy',
    icon: '☀️',
    description: 'Feel good',
    gradient: ['#ffecd2', '#fcb69f'],
    searchTerms: ['happy music', 'feel good songs', 'uplifting'],
  },
];

export interface MoodPlaylistSectionProps extends BaseSectionProps {
  tracks?: UnifiedTrack[];
}

export const MoodPlaylistSection: React.FC<MoodPlaylistSectionProps> = ({
  id,
  title = 'Moods',
  subtitle = 'Match your vibe',
  isPersonalized,
  context,
  onSeeAll,
}) => {
  const { play, setQueue } = usePlayerStore();
  const [activeMood, setActiveMood] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Get active mood profile
  const activeProfile = MOOD_PROFILES.find(m => m.id === activeMood);

  // Build structured query for the unified pipeline
  // embeddingProvider will handle this with mood-based generation
  const structuredQuery = useMemo((): StructuredSectionQuery => ({
    strategy: 'plugin',
    sectionType: 'mood-playlist',
    title: activeProfile ? `${activeProfile.name} Playlist` : title,
    subtitle,
    embedding: {
      method: 'mood',
      mood: activeMood || 'chill',
      exploration: 0.2,
    },
    limit: 20,
  }), [title, subtitle, activeMood, activeProfile]);

  // Use unified plugin pipeline - embeddingProvider handles mood generation
  const { tracks, isLoading } = usePluginData(structuredQuery, {
    enabled: !!activeMood,
    applyMLRanking: true,
    applyTransformers: true,
    limit: 20,
  });

  const handleMoodClick = useCallback((moodId: string) => {
    if (activeMood === moodId) {
      // Toggle off
      setActiveMood(null);
      setIsExpanded(false);
    } else {
      setActiveMood(moodId);
      setIsExpanded(true);
    }
  }, [activeMood]);

  const handlePlayAll = useCallback(() => {
    if (tracks.length > 0) {
      setQueue(tracks, 0);
      play(tracks[0]);
      showSuccessToast(`Playing ${activeProfile?.name || 'mood'} playlist`);
    }
  }, [tracks, setQueue, play, activeProfile]);

  const handleShuffle = useCallback(() => {
    if (tracks.length > 0) {
      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
      setQueue(shuffled, 0);
      play(shuffled[0]);
      showSuccessToast(`Shuffling ${activeProfile?.name || 'mood'} playlist`);
    }
  }, [tracks, setQueue, play, activeProfile]);

  return (
    <BaseSectionWrapper
      id={id}
      type="mood-playlist"
      title={title}
      subtitle={subtitle}
      isPersonalized={isPersonalized}
      context={context}
      onSeeAll={onSeeAll}
      className="mood-playlist-section"
    >
      {/* Mood tiles grid */}
      <div className="mood-tiles-grid">
        {MOOD_PROFILES.map((mood) => (
          <MoodTile
            key={mood.id}
            mood={mood}
            isActive={activeMood === mood.id}
            onClick={() => handleMoodClick(mood.id)}
          />
        ))}
      </div>

      {/* Expanded track list */}
      {isExpanded && activeProfile && (
        <div
          className="mood-expanded-content"
          style={{
            '--mood-color-1': activeProfile.gradient[0],
            '--mood-color-2': activeProfile.gradient[1],
          } as React.CSSProperties}
        >
          <div className="mood-expanded-header">
            <div className="mood-expanded-info">
              <span className="mood-expanded-icon">{activeProfile.icon}</span>
              <div className="mood-expanded-text">
                <h3>{activeProfile.name} Playlist</h3>
                <span>{tracks.length} tracks</span>
              </div>
            </div>
            <div className="mood-expanded-actions">
              <button
                className="mood-play-btn"
                onClick={handlePlayAll}
                disabled={isLoading || tracks.length === 0}
              >
                <PlayIcon size={18} />
                <span>Play</span>
              </button>
              <button
                className="mood-shuffle-btn"
                onClick={handleShuffle}
                disabled={isLoading || tracks.length === 0}
              >
                <ShuffleIcon size={18} />
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="mood-tracks-loading">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="mood-track-skeleton" />
              ))}
            </div>
          ) : (
            <div className="mood-tracks-list">
              {tracks.slice(0, 8).map((track, index) => (
                <MoodTrackItem
                  key={track.id}
                  track={track}
                  index={index}
                  onPlay={() => {
                    setQueue(tracks, index);
                    play(track);
                  }}
                />
              ))}
              {tracks.length > 8 && (
                <div className="mood-tracks-more">
                  +{tracks.length - 8} more tracks
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </BaseSectionWrapper>
  );
};

interface MoodTileProps {
  mood: MoodProfile;
  isActive: boolean;
  onClick: () => void;
}

const MoodTile: React.FC<MoodTileProps> = ({ mood, isActive, onClick }) => {
  return (
    <button
      className={`mood-tile ${isActive ? 'active' : ''}`}
      onClick={onClick}
      style={{
        '--gradient-start': mood.gradient[0],
        '--gradient-end': mood.gradient[1],
      } as React.CSSProperties}
    >
      <div className="mood-tile-bg" />
      <div className="mood-tile-content">
        <span className="mood-tile-icon">{mood.icon}</span>
        <span className="mood-tile-name">{mood.name}</span>
        <span className="mood-tile-desc">{mood.description}</span>
      </div>
    </button>
  );
};

interface MoodTrackItemProps {
  track: UnifiedTrack;
  index: number;
  onPlay: () => void;
}

const MoodTrackItem: React.FC<MoodTrackItemProps> = ({ track, index, onPlay }) => {
  const { showContextMenu } = useTrackContextMenu();
  const artwork = track.artwork?.small ?? track.artwork?.medium;

  return (
    <div
      className="mood-track-item"
      onClick={onPlay}
      onContextMenu={(e) => showContextMenu(e, track)}
    >
      <div className="mood-track-artwork">
        {artwork ? (
          <img src={artwork} alt={track.title} loading="lazy" />
        ) : (
          <div className="mood-track-placeholder">
            <MusicNoteIcon size={16} />
          </div>
        )}
        <div className="mood-track-overlay">
          <PlayIcon size={14} />
        </div>
      </div>
      <div className="mood-track-info">
        <span className="mood-track-title">{track.title}</span>
        <span className="mood-track-artist">
          {track.artists.map(a => a.name).join(', ')}
        </span>
      </div>
    </div>
  );
};

export default MoodPlaylistSection;
