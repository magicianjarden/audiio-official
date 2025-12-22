/**
 * WeeklyRotationSection - Timeline showing trending tracks by day
 * Displays what's been popular each day this week
 */

import React, { useState, useEffect, useRef } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { useTrendingStore, type TrendingTrack, type DailyTrending } from '../../../stores/trending-store';
import { BaseSectionWrapper } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import { PlayIcon, MusicNoteIcon, TrendingUpIcon, TrendingDownIcon, MinusIcon } from '../../Icons/Icons';

export interface WeeklyRotationSectionProps extends BaseSectionProps {
  dailyData?: DailyTrending[];
}

// Day names for display
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getDateString(daysAgo: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

function getDayName(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00');
  return DAY_NAMES[date.getDay()];
}

function isToday(dateString: string): boolean {
  return dateString === getDateString(0);
}

export const WeeklyRotationSection: React.FC<WeeklyRotationSectionProps> = ({
  id,
  title,
  subtitle,
  isPersonalized,
  context,
  dailyData: propDailyData,
  onSeeAll,
}) => {
  const { play, setQueue, currentTrack, isPlaying } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();
  const { getWeeklyTrending, updateDailyTrending, computeTrendingFromTracks, getTrendingForDate } = useTrendingStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [selectedDay, setSelectedDay] = useState<string>(getDateString(0));
  const [weeklyData, setWeeklyData] = useState<DailyTrending[]>(propDailyData ?? []);
  const [isLoading, setIsLoading] = useState(!propDailyData);

  // Generate last 7 days
  const days = Array.from({ length: 7 }, (_, i) => getDateString(i)).reverse();

  // Fetch trending data for the week
  useEffect(() => {
    if (propDailyData) {
      setWeeklyData(propDailyData);
      return;
    }

    const fetchWeeklyData = async () => {
      setIsLoading(true);

      try {
        // Check cache first
        const cached = getWeeklyTrending();
        if (cached.length >= 3) {
          setWeeklyData(cached);
          setIsLoading(false);
          return;
        }

        // Fetch fresh data for today if needed
        const todayData = getTrendingForDate(getDateString(0));
        if (!todayData && window.api) {
          const tracks = await window.api.search({
            query: 'top hits trending 2024',
            type: 'track',
          });

          const trendingTracks = computeTrendingFromTracks(tracks);
          updateDailyTrending(getDateString(0), trendingTracks);
        }

        // Get updated weekly data
        setWeeklyData(getWeeklyTrending());
      } catch (err) {
        console.error('[WeeklyRotation] Failed to fetch data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWeeklyData();
  }, [propDailyData, getWeeklyTrending, getTrendingForDate, updateDailyTrending, computeTrendingFromTracks]);

  // Get tracks for selected day
  const selectedDayData = weeklyData.find((d) => d.date === selectedDay);
  const tracks = selectedDayData?.tracks ?? [];

  const handleTrackClick = (track: TrendingTrack) => {
    // In a real implementation, we'd convert TrendingTrack to UnifiedTrack
    // For now, create a minimal playable track
    console.log('Play trending track:', track.id);
  };

  const handleDayClick = (date: string) => {
    setSelectedDay(date);
  };

  return (
    <BaseSectionWrapper
      id={id}
      type="weekly-rotation"
      title={title}
      subtitle={subtitle}
      isPersonalized={isPersonalized}
      isLoading={isLoading}
      context={context}
      onSeeAll={onSeeAll}
      className="weekly-rotation-section"
    >
      {/* Day selector timeline */}
      <div className="rotation-timeline" ref={scrollRef}>
        {days.map((date, index) => {
          const dayData = weeklyData.find((d) => d.date === date);
          const hasData = dayData && dayData.tracks.length > 0;
          const today = isToday(date);

          return (
            <button
              key={date}
              className={`timeline-day ${selectedDay === date ? 'selected' : ''} ${today ? 'today' : ''} ${!hasData ? 'no-data' : ''}`}
              onClick={() => handleDayClick(date)}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <span className="timeline-day-name">{getDayName(date)}</span>
              <span className="timeline-day-date">{date.split('-')[2]}</span>
              {today && <span className="timeline-today-badge">Today</span>}
              {hasData && (
                <span className="timeline-track-count">{dayData!.tracks.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day's tracks */}
      <div className="rotation-tracks">
        {tracks.length === 0 ? (
          <div className="rotation-empty">
            <MusicNoteIcon size={32} />
            <p>No trending data for {getDayName(selectedDay)}</p>
          </div>
        ) : (
          <div className="rotation-list">
            {tracks.slice(0, 5).map((track, index) => (
              <TrendingTrackCard
                key={track.id}
                track={track}
                rank={index + 1}
                onClick={() => handleTrackClick(track)}
              />
            ))}
          </div>
        )}
      </div>
    </BaseSectionWrapper>
  );
};

interface TrendingTrackCardProps {
  track: TrendingTrack;
  rank: number;
  onClick: () => void;
}

const TrendingTrackCard: React.FC<TrendingTrackCardProps> = ({
  track,
  rank,
  onClick,
}) => {
  return (
    <div className="trending-track" onClick={onClick}>
      <span className="trending-rank">#{rank}</span>

      <div className="trending-artwork">
        {track.artwork ? (
          <img src={track.artwork} alt={track.title} />
        ) : (
          <div className="trending-artwork-placeholder">
            <MusicNoteIcon size={20} />
          </div>
        )}
      </div>

      <div className="trending-info">
        <span className="trending-title">{track.title}</span>
        <span className="trending-artist">{track.artist}</span>
      </div>

      <div className={`trending-change trending-change--${track.changeDirection}`}>
        {track.changeDirection === 'up' && (
          <>
            <TrendingUpIcon size={16} />
            {track.previousRank && (
              <span>+{track.previousRank - rank}</span>
            )}
          </>
        )}
        {track.changeDirection === 'down' && (
          <>
            <TrendingDownIcon size={16} />
            {track.previousRank && (
              <span>-{rank - track.previousRank}</span>
            )}
          </>
        )}
        {track.changeDirection === 'stable' && (
          <MinusIcon size={16} />
        )}
        {track.changeDirection === 'new' && (
          <span className="trending-new">NEW</span>
        )}
      </div>

      <button className="trending-play">
        <PlayIcon size={18} />
      </button>
    </div>
  );
};

export default WeeklyRotationSection;
