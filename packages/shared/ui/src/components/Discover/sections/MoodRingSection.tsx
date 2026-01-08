/**
 * MoodRingSection - Mood-based discovery
 * Interactive section with mood selector pills.
 * Uses the ML genre radio API for mood-based recommendations.
 */

import React, { useState, useEffect } from 'react';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { useGenreRadio } from '../../../hooks/useRecommendations';
import { TrackCard } from '../TrackCard';
import { PlayIcon, ShuffleIcon } from '@audiio/icons';

export interface MoodRingSectionProps {
  id: string;
  title?: string;
  subtitle?: string;
  maxItems?: number;
}

const MOOD_PRESETS = [
  { id: 'chill', label: 'Chill', color: '#667eea' },
  { id: 'energetic', label: 'Energetic', color: '#f5576c' },
  { id: 'focus', label: 'Focus', color: '#4facfe' },
  { id: 'melancholy', label: 'Melancholy', color: '#a8c0ff' },
  { id: 'happy', label: 'Happy', color: '#ffecd2' },
  { id: 'dark', label: 'Dark', color: '#434343' },
] as const;

type MoodId = typeof MOOD_PRESETS[number]['id'];

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

export const MoodRingSection: React.FC<MoodRingSectionProps> = ({
  id,
  title = 'Mood Ring',
  subtitle = 'Match your vibe',
  maxItems = 6,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();
  const [selectedMood, setSelectedMood] = useState<MoodId>('chill');
  const [isVisible, setIsVisible] = useState(false);

  const currentMood = MOOD_PRESETS.find(m => m.id === selectedMood) || MOOD_PRESETS[0];

  // Use the ML genre radio API directly - moods are treated as genres
  const { data: allTracks, isLoading, refetch } = useGenreRadio(currentMood.id, maxItems * 2);
  const tracks = allTracks.slice(0, maxItems);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    refetch();
  }, [selectedMood, refetch]);

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

  const handleShuffle = () => {
    if (tracks.length > 0) {
      const shuffled = shuffleArray(tracks);
      setQueue(shuffled, 0);
      play(shuffled[0]!);
    }
  };

  return (
    <section
      id={id}
      className={`discover-section discover-mood-section ${isVisible ? 'is-visible' : ''}`}
      style={{ animationDelay: '200ms' }}
    >
      <div className="discover-section-header">
        <div className="discover-section-title-row">
          <h2 className="discover-section-title">{title}</h2>
          <span className="discover-section-subtitle">{subtitle}</span>
        </div>
        <div className="discover-section-actions">
          <button className="pill-btn pill-btn--sm" onClick={handlePlayAll} disabled={tracks.length === 0}>
            <PlayIcon size={14} />
            <span>Play</span>
          </button>
          <button className="pill-btn pill-btn--sm pill-btn--glass" onClick={handleShuffle} disabled={tracks.length === 0}>
            <ShuffleIcon size={14} />
          </button>
        </div>
      </div>

      {/* Mood Selector */}
      <div className="mood-selector">
        {MOOD_PRESETS.map((mood) => (
          <button
            key={mood.id}
            className={`mood-pill ${selectedMood === mood.id ? 'active' : ''}`}
            onClick={() => setSelectedMood(mood.id)}
            style={{ '--mood-color': mood.color } as React.CSSProperties}
          >
            <span className="mood-pill-dot" />
            <span className="mood-pill-label">{mood.label}</span>
          </button>
        ))}
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

export default MoodRingSection;
