/**
 * StatsView - Listening statistics dashboard with ML insights
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useStatsStore, formatDuration, type ListenEntry } from '../../stores/stats-store';
import { useRecommendationStore } from '../../stores/recommendation-store';
import { useMLStore } from '../../stores/ml-store';
import { useNavigationStore } from '../../stores/navigation-store';
import { useTrackContextMenu, useArtistContextMenu } from '../../contexts/ContextMenuContext';
import { StatCard } from './StatCard';
import { TopArtistsList, TopGenresList } from './TopList';
import { BarChart } from './charts/BarChart';
import { HourlyHeatMap, DayOfWeekHeatMap } from './charts/HeatMap';
import type { UnifiedTrack } from '@audiio/core';
import {
  PlayIcon,
  ArtistIcon,
  ZapIcon,
  HeartIcon,
  SkipForwardIcon,
  MusicNoteIcon,
  SettingsIcon,
  ClockIcon,
  TrendingUpIcon,
  RefreshIcon,
} from '@audiio/icons';

type Period = 'week' | 'month' | 'year' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  week: 'This Week',
  month: 'This Month',
  year: 'This Year',
  all: 'All Time',
};

// Format relative time
function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// Convert ListenEntry to minimal UnifiedTrack for context menu
function entryToTrack(entry: ListenEntry): UnifiedTrack {
  return {
    id: entry.trackId,
    title: entry.trackTitle || 'Unknown Track',
    duration: entry.totalDuration || entry.duration,
    artists: [{
      id: entry.artistId,
      name: entry.artistName,
    }],
    album: entry.albumId ? {
      id: entry.albumId,
      title: entry.albumTitle || 'Unknown Album',
    } : undefined,
    artwork: entry.artwork ? {
      small: entry.artwork,
      medium: entry.artwork,
    } : undefined,
    genre: entry.genre,
    source: 'local' as const,
  };
}

// Recent activity item component
const RecentActivityItem: React.FC<{
  entry: ListenEntry;
  onTrackClick: (entry: ListenEntry) => void;
  onArtistClick: (artistId: string, artistName: string) => void;
  onContextMenu: (e: React.MouseEvent, entry: ListenEntry) => void;
}> = ({ entry, onTrackClick, onArtistClick, onContextMenu }) => {
  const statusIcon = entry.completed ? (
    <HeartIcon size={14} className="activity-icon completed" />
  ) : entry.skipped ? (
    <SkipForwardIcon size={14} className="activity-icon skipped" />
  ) : (
    <PlayIcon size={14} className="activity-icon playing" />
  );

  return (
    <div
      className="recent-activity-item"
      onClick={() => onTrackClick(entry)}
      onContextMenu={(e) => onContextMenu(e, entry)}
    >
      <div className="activity-artwork">
        {entry.artwork ? (
          <img src={entry.artwork} alt={entry.trackTitle} />
        ) : (
          <div className="activity-artwork-placeholder">
            <MusicNoteIcon size={16} />
          </div>
        )}
        <div className="activity-status-badge">{statusIcon}</div>
      </div>
      <div className="activity-info">
        <span className="activity-track">{entry.trackTitle || 'Unknown Track'}</span>
        <span
          className="activity-artist"
          onClick={(e) => {
            e.stopPropagation();
            onArtistClick(entry.artistId, entry.artistName);
          }}
        >
          {entry.artistName}
        </span>
      </div>
      <div className="activity-meta">
        <span className="activity-duration">
          {entry.duration > 0 ? formatDuration(entry.duration) : '--'}
        </span>
        <span className="activity-time">{formatRelativeTime(entry.timestamp)}</span>
      </div>
    </div>
  );
};

export const StatsView: React.FC = () => {
  const [period, setPeriod] = useState<Period>('week');
  const { getStats, getSkipStats, listenHistory } = useStatsStore();
  const { navigateTo, openArtist, openAlbum } = useNavigationStore();
  const { showContextMenu: showTrackMenu } = useTrackContextMenu();
  const { showContextMenu: showArtistMenu } = useArtistContextMenu();

  // ML Store data
  const {
    isModelLoaded,
    isTraining,
    modelVersion,
    lastTrainedAt,
    trainingMetrics,
    trainingProgress,
    trainModel,
  } = useMLStore();

  // Recommendation Store data
  const { userProfile, dislikedTracks, listenHistory: recHistory } = useRecommendationStore();

  const stats = useMemo(() => getStats(period), [period, getStats]);
  const skipStats = useMemo(() => getSkipStats(), [getSkipStats]);

  // Handle artist click - navigate to artist page
  const handleArtistClick = useCallback((artistId: string, artistName?: string) => {
    openArtist(artistId, { id: artistId, name: artistName || 'Unknown Artist' });
  }, [openArtist]);

  // Handle track click - navigate to album if available
  const handleTrackClick = useCallback((entry: ListenEntry) => {
    if (entry.albumId) {
      openAlbum(entry.albumId, {
        id: entry.albumId,
        title: entry.albumTitle || 'Unknown Album',
        artwork: entry.artwork ? { small: entry.artwork, medium: entry.artwork } : undefined,
      });
    } else {
      // If no album, go to artist
      handleArtistClick(entry.artistId, entry.artistName);
    }
  }, [openAlbum, handleArtistClick]);

  // Handle context menu on activity items
  const handleActivityContextMenu = useCallback((e: React.MouseEvent, entry: ListenEntry) => {
    e.preventDefault();
    const track = entryToTrack(entry);
    showTrackMenu(e, track);
  }, [showTrackMenu]);

  // Handle artist context menu
  const handleArtistContextMenu = useCallback((e: React.MouseEvent, artistId: string, artistName: string) => {
    e.preventDefault();
    e.stopPropagation();
    showArtistMenu(e, { id: artistId, name: artistName });
  }, [showArtistMenu]);

  // Prepare daily chart data
  const dailyChartData = useMemo(() => {
    return stats.dailyStats.slice(-7).map(d => ({
      label: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
      value: d.playCount,
    }));
  }, [stats.dailyStats]);

  // Calculate listening behavior stats - use actual skipped entries
  const behaviorStats = useMemo(() => {
    const total = listenHistory.length;
    if (total === 0) return {
      skipRate: 0,
      completionRate: 0,
      avgSessionMinutes: 0,
      totalSkips: 0,
      earlySkips: 0,
    };

    const skipped = listenHistory.filter(e => e.skipped).length;
    const completed = listenHistory.filter(e => e.completed).length;

    // Calculate average session time from user profile
    const avgSessionMinutes = Math.round(userProfile.avgSessionLength / 60000) || 0;

    return {
      skipRate: Math.round((skipped / total) * 100),
      completionRate: Math.round((completed / total) * 100),
      avgSessionMinutes,
      totalSkips: skipStats.totalSkips,
      earlySkips: skipStats.earlySkips,
    };
  }, [listenHistory, userProfile.avgSessionLength, skipStats]);

  // Get top artist/genre affinities
  const affinities = useMemo(() => {
    const artistPrefs = Object.values(userProfile.artistPreferences)
      .filter(a => a.playCount > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const genrePrefs = Object.values(userProfile.genrePreferences)
      .filter(g => g.playCount > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return { artists: artistPrefs, genres: genrePrefs };
  }, [userProfile]);

  // Calculate energy distribution from listening patterns
  const energyDistribution = useMemo(() => {
    const distribution = { low: 0, medium: 0, high: 0 };
    userProfile.timePatterns.forEach(tp => {
      distribution[tp.energy]++;
    });
    const total = 24;
    return {
      low: Math.round((distribution.low / total) * 100),
      medium: Math.round((distribution.medium / total) * 100),
      high: Math.round((distribution.high / total) * 100),
    };
  }, [userProfile.timePatterns]);

  // Format last trained date
  const lastTrainedText = useMemo(() => {
    if (!lastTrainedAt) return 'Never';
    const diff = Date.now() - lastTrainedAt;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  }, [lastTrainedAt]);

  // Recent activity - last 15 listens
  const recentActivity = useMemo(() => {
    return [...listenHistory]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 15);
  }, [listenHistory]);

  // Handle train model button
  const handleTrainModel = async () => {
    if (recHistory.length < 10) {
      console.warn('[Stats] Not enough data to train model');
      return;
    }
    try {
      await trainModel();
    } catch (error) {
      console.error('[Stats] Training failed:', error);
    }
  };

  return (
    <div className="stats-view">
      <header className="stats-header">
        <div className="stats-header-left">
          <h1 className="stats-title">Stats</h1>
          <div className="stats-period-selector">
            {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
              <button
                key={p}
                className={`period-btn ${period === p ? 'active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
        <div className="stats-header-right">
          <div className="stats-header-stat">
            <span className="stats-header-stat-value">{formatDuration(stats.totalListenTime)}</span>
            <span className="stats-header-stat-label">total time</span>
          </div>
        </div>
      </header>

      <div className="stats-content">
        {/* Summary Cards - Hero Section */}
        <section className="stats-section stats-hero">
          <div className="stats-hero-main">
            <StatCard
              icon={<PlayIcon size={28} />}
              label="Listen Time"
              value={formatDuration(stats.totalListenTime)}
              subtitle={`${stats.totalTracks} total plays`}
              variant="accent"
              size="large"
            />
          </div>
          <div className="stats-hero-grid">
            <StatCard
              icon={<MusicNoteIcon size={20} />}
              label="Unique Tracks"
              value={stats.uniqueTracks}
            />
            <StatCard
              icon={<ArtistIcon size={20} />}
              label="Artists"
              value={stats.uniqueArtists}
            />
            <StatCard
              icon={<ZapIcon size={20} />}
              label="Streak"
              value={`${stats.currentStreak}d`}
              subtitle={stats.longestStreak > stats.currentStreak
                ? `Best: ${stats.longestStreak}d`
                : 'Best!'
              }
              variant={stats.currentStreak >= 7 ? 'success' : 'default'}
            />
            <StatCard
              icon={<ClockIcon size={20} />}
              label="Avg Session"
              value={`${behaviorStats.avgSessionMinutes}m`}
            />
          </div>
        </section>

        <div className="stats-divider" />

        {/* Two Column Layout for Middle Sections */}
        <div className="stats-two-col">
          {/* Left Column */}
          <div className="stats-col">
            {/* Listening Behavior */}
            <section className="stats-section stats-card">
              <h2 className="stats-section-title">
                <TrendingUpIcon size={18} />
                <span>Listening Behavior</span>
              </h2>
              <div className="stats-behavior-grid">
                <div className="behavior-stat">
                  <div className="behavior-stat-header">
                    <HeartIcon size={16} className="behavior-icon success" />
                    <span className="behavior-label">Completion</span>
                  </div>
                  <div className="behavior-value">{behaviorStats.completionRate}%</div>
                  <div className="behavior-bar">
                    <div
                      className="behavior-bar-fill success"
                      style={{ width: `${behaviorStats.completionRate}%` }}
                    />
                  </div>
                </div>
                <div className="behavior-stat">
                  <div className="behavior-stat-header">
                    <SkipForwardIcon size={16} className="behavior-icon warning" />
                    <span className="behavior-label">Skip Rate</span>
                  </div>
                  <div className="behavior-value">{behaviorStats.skipRate}%</div>
                  <div className="behavior-bar">
                    <div
                      className="behavior-bar-fill warning"
                      style={{ width: `${behaviorStats.skipRate}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="behavior-details">
                <div className="behavior-detail">
                  <span className="behavior-detail-value">{behaviorStats.totalSkips}</span>
                  <span className="behavior-detail-label">Total Skips</span>
                </div>
                <div className="behavior-detail">
                  <span className="behavior-detail-value">{behaviorStats.earlySkips}</span>
                  <span className="behavior-detail-label">Early Skips</span>
                </div>
                <div className="behavior-detail">
                  <span className="behavior-detail-value">{Object.keys(dislikedTracks).length}</span>
                  <span className="behavior-detail-label">Disliked</span>
                </div>
                <div className="behavior-detail">
                  <span className="behavior-detail-value">{userProfile.totalListens}</span>
                  <span className="behavior-detail-label">Interactions</span>
                </div>
              </div>
            </section>

            {/* ML Model Status */}
            <section className="stats-section stats-card stats-ml">
              <h2 className="stats-section-title">
                <ZapIcon size={18} />
                <span>Recommendations AI</span>
                {!isTraining && isModelLoaded && (
                  <button
                    className="stats-train-btn"
                    onClick={handleTrainModel}
                    title="Retrain model with latest data"
                  >
                    <RefreshIcon size={14} />
                  </button>
                )}
              </h2>
              <div className="stats-ml-content">
                {!isModelLoaded && !isTraining ? (
                  /* Not trained state - show helpful CTA */
                  <div className="stats-ml-untrained">
                    <div className="stats-ml-untrained-icon">
                      <ZapIcon size={32} />
                    </div>
                    <div className="stats-ml-untrained-text">
                      <h3>Personalized Recommendations</h3>
                      <p>
                        {recHistory.length < 10
                          ? `Listen to ${10 - recHistory.length} more tracks to unlock AI-powered recommendations tailored to your taste.`
                          : 'You have enough listening data! Train the model to get personalized recommendations.'
                        }
                      </p>
                    </div>
                    {recHistory.length >= 10 && (
                      <button className="stats-ml-train-cta" onClick={handleTrainModel}>
                        <ZapIcon size={16} />
                        <span>Train Model</span>
                      </button>
                    )}
                    <div className="stats-ml-progress-indicator">
                      <div className="stats-ml-progress-track">
                        <div
                          className="stats-ml-progress-fill"
                          style={{ width: `${Math.min(100, (recHistory.length / 10) * 100)}%` }}
                        />
                      </div>
                      <span className="stats-ml-progress-label">{recHistory.length}/10 samples</span>
                    </div>
                  </div>
                ) : (
                  /* Active or training state */
                  <>
                    <div className="stats-ml-status-row">
                      <span className={`stats-ml-indicator ${isModelLoaded ? 'active' : 'inactive'}`} />
                      <span className="stats-ml-status-text">
                        {isTraining ? 'Training...' : 'Active'}
                      </span>
                      <span className="stats-ml-version">v{modelVersion}</span>
                    </div>
                    {isTraining && trainingProgress && (
                      <div className="stats-ml-progress">
                        <div
                          className="stats-ml-progress-bar"
                          style={{ width: `${(trainingProgress.epoch / trainingProgress.totalEpochs) * 100}%` }}
                        />
                        <span className="stats-ml-progress-text">
                          {trainingProgress.epoch}/{trainingProgress.totalEpochs}
                        </span>
                      </div>
                    )}
                    <div className="stats-ml-metrics-row">
                      <div className="stats-ml-metric">
                        <span className="stats-ml-metric-value">{lastTrainedText}</span>
                        <span className="stats-ml-metric-label">Trained</span>
                      </div>
                      {trainingMetrics && (
                        <>
                          <div className="stats-ml-metric">
                            <span className="stats-ml-metric-value">
                              {(trainingMetrics.accuracy * 100).toFixed(0)}%
                            </span>
                            <span className="stats-ml-metric-label">Accuracy</span>
                          </div>
                          <div className="stats-ml-metric">
                            <span className="stats-ml-metric-value">
                              {trainingMetrics.loss.toFixed(2)}
                            </span>
                            <span className="stats-ml-metric-label">Loss</span>
                          </div>
                        </>
                      )}
                      <div className="stats-ml-metric">
                        <span className="stats-ml-metric-value">{recHistory.length}</span>
                        <span className="stats-ml-metric-label">Samples</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* Daily Activity Chart */}
            <section className="stats-section stats-card">
              <h2 className="stats-section-title">Daily Activity</h2>
              <div className="stats-chart-container">
                {dailyChartData.length > 0 ? (
                  <BarChart
                    data={dailyChartData}
                    height={120}
                    showLabels
                    showValues
                  />
                ) : (
                  <div className="stats-empty">
                    <MusicNoteIcon size={24} />
                    <p>No activity this period</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="stats-col">
            {/* Recent Activity */}
            <section className="stats-section stats-card stats-activity">
              <h2 className="stats-section-title">
                <ClockIcon size={18} />
                <span>Recent Activity</span>
              </h2>
              <div className="recent-activity-list">
                {recentActivity.length > 0 ? (
                  recentActivity.map((entry, i) => (
                    <RecentActivityItem
                      key={`${entry.trackId}-${entry.timestamp}-${i}`}
                      entry={entry}
                      onTrackClick={handleTrackClick}
                      onArtistClick={handleArtistClick}
                      onContextMenu={handleActivityContextMenu}
                    />
                  ))
                ) : (
                  <div className="stats-empty">
                    <MusicNoteIcon size={24} />
                    <p>No recent activity</p>
                  </div>
                )}
              </div>
            </section>

            {/* Energy Preferences */}
            <section className="stats-section stats-card">
              <h2 className="stats-section-title">Energy Preferences</h2>
              <div className="stats-energy-compact">
                <div className="energy-row">
                  <span className="energy-label">Low</span>
                  <div className="energy-bar-track">
                    <div className="energy-bar low" style={{ width: `${energyDistribution.low}%` }} />
                  </div>
                  <span className="energy-value">{energyDistribution.low}%</span>
                </div>
                <div className="energy-row">
                  <span className="energy-label">Med</span>
                  <div className="energy-bar-track">
                    <div className="energy-bar medium" style={{ width: `${energyDistribution.medium}%` }} />
                  </div>
                  <span className="energy-value">{energyDistribution.medium}%</span>
                </div>
                <div className="energy-row">
                  <span className="energy-label">High</span>
                  <div className="energy-bar-track">
                    <div className="energy-bar high" style={{ width: `${energyDistribution.high}%` }} />
                  </div>
                  <span className="energy-value">{energyDistribution.high}%</span>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="stats-divider" />

        {/* Taste Profile - Full Width */}
        {(affinities.artists.length > 0 || affinities.genres.length > 0) && (
          <>
            <section className="stats-section stats-card stats-taste">
              <h2 className="stats-section-title">Your Taste Profile</h2>
              <div className="stats-affinities">
                {affinities.artists.length > 0 && (
                  <div className="stats-affinity-group">
                    <h3 className="stats-affinity-label">Top Artists</h3>
                    <div className="stats-affinity-list">
                      {affinities.artists.map((artist, i) => (
                        <div
                          key={artist.artistId}
                          className="stats-affinity-item"
                          onClick={() => handleArtistClick(artist.artistId, artist.artistName)}
                          onContextMenu={(e) => handleArtistContextMenu(e, artist.artistId, artist.artistName)}
                        >
                          <span className="stats-affinity-rank">{i + 1}</span>
                          <span className="stats-affinity-name">{artist.artistName}</span>
                          <div className="stats-affinity-bar-container">
                            <div
                              className="stats-affinity-bar"
                              style={{ width: `${Math.max(0, Math.min(100, (artist.score + 100) / 2))}%` }}
                            />
                          </div>
                          <span className={`stats-affinity-score ${artist.score >= 0 ? 'positive' : 'negative'}`}>
                            {artist.score >= 0 ? '+' : ''}{artist.score.toFixed(0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {affinities.genres.length > 0 && (
                  <div className="stats-affinity-group">
                    <h3 className="stats-affinity-label">Top Genres</h3>
                    <div className="stats-affinity-list">
                      {affinities.genres.map((genre, i) => (
                        <div key={genre.genre} className="stats-affinity-item stats-affinity-item--genre">
                          <span className="stats-affinity-rank">{i + 1}</span>
                          <span className="stats-affinity-name">{genre.genre}</span>
                          <div className="stats-affinity-bar-container">
                            <div
                              className="stats-affinity-bar genre"
                              style={{ width: `${Math.max(0, Math.min(100, (genre.score + 100) / 2))}%` }}
                            />
                          </div>
                          <span className={`stats-affinity-score ${genre.score >= 0 ? 'positive' : 'negative'}`}>
                            {genre.score >= 0 ? '+' : ''}{genre.score.toFixed(0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
            <div className="stats-divider" />
          </>
        )}

        {/* Top Artists & Genres */}
        <div className="stats-columns">
          <section className="stats-section stats-card">
            <h2 className="stats-section-title">Top Artists</h2>
            <TopArtistsList
              artists={stats.topArtists}
              onArtistClick={handleArtistClick}
            />
          </section>

          <section className="stats-section stats-card">
            <h2 className="stats-section-title">Top Genres</h2>
            <TopGenresList genres={stats.topGenres} />
          </section>
        </div>

        <div className="stats-divider" />

        {/* Listening Patterns */}
        <section className="stats-section stats-card">
          <h2 className="stats-section-title">Listening Patterns</h2>
          <div className="stats-patterns">
            <div className="stats-pattern-group">
              <h3 className="stats-pattern-label">By Hour</h3>
              <HourlyHeatMap data={stats.hourlyDistribution} />
            </div>
            <div className="stats-pattern-group">
              <h3 className="stats-pattern-label">By Day</h3>
              <DayOfWeekHeatMap data={stats.dayOfWeekDistribution} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default StatsView;
