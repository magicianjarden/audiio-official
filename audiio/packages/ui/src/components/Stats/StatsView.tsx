/**
 * StatsView - Listening statistics dashboard
 */

import React, { useState, useMemo } from 'react';
import { useStatsStore, formatDuration } from '../../stores/stats-store';
import { useNavigationStore } from '../../stores/navigation-store';
import { StatCard } from './StatCard';
import { TopArtistsList, TopGenresList } from './TopList';
import { BarChart } from './charts/BarChart';
import { HourlyHeatMap, DayOfWeekHeatMap } from './charts/HeatMap';
import { ChevronLeftIcon } from '@audiio/icons';

type Period = 'week' | 'month' | 'year' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  week: 'This Week',
  month: 'This Month',
  year: 'This Year',
  all: 'All Time',
};

export const StatsView: React.FC = () => {
  const [period, setPeriod] = useState<Period>('week');
  const { getStats } = useStatsStore();
  const { navigateTo } = useNavigationStore();

  const stats = useMemo(() => getStats(period), [period, getStats]);

  const handleArtistClick = (artistId: string) => {
    navigateTo('artist-detail', { artistId });
  };

  // Prepare daily chart data
  const dailyChartData = useMemo(() => {
    return stats.dailyStats.slice(-7).map(d => ({
      label: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
      value: d.playCount,
    }));
  }, [stats.dailyStats]);

  return (
    <div className="stats-view">
      <header className="stats-header">
        <button className="stats-back-btn" onClick={() => navigateTo('home')}>
          <ChevronLeftIcon size={20} />
        </button>
        <div className="stats-header-content">
          <h1 className="stats-title">Your Listening Stats</h1>
          <p className="stats-subtitle">Insights into your music habits</p>
        </div>
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
      </header>

      <div className="stats-content">
        {/* Summary Cards */}
        <section className="stats-section stats-summary">
          <StatCard
            icon="clock"
            label="Listen Time"
            value={formatDuration(stats.totalListenTime)}
            subtitle={`${stats.totalTracks} total plays`}
          />
          <StatCard
            icon="disc"
            label="Unique Tracks"
            value={stats.uniqueTracks}
          />
          <StatCard
            icon="mic"
            label="Artists"
            value={stats.uniqueArtists}
          />
          <StatCard
            icon="fire"
            label="Current Streak"
            value={`${stats.currentStreak} days`}
            subtitle={stats.longestStreak > stats.currentStreak
              ? `Best: ${stats.longestStreak} days`
              : 'Your best streak!'
            }
          />
        </section>

        {/* Top Artists & Genres */}
        <div className="stats-columns">
          <section className="stats-section">
            <h2 className="stats-section-title">Top Artists</h2>
            <TopArtistsList
              artists={stats.topArtists}
              onArtistClick={handleArtistClick}
            />
          </section>

          <section className="stats-section">
            <h2 className="stats-section-title">Top Genres</h2>
            <TopGenresList genres={stats.topGenres} />
          </section>
        </div>

        {/* Daily Activity */}
        <section className="stats-section">
          <h2 className="stats-section-title">Daily Activity</h2>
          <div className="stats-chart-container">
            {dailyChartData.length > 0 ? (
              <BarChart
                data={dailyChartData}
                height={140}
                showLabels
                showValues
              />
            ) : (
              <div className="stats-empty">
                <p>No activity data for this period</p>
              </div>
            )}
          </div>
        </section>

        {/* Listening Patterns */}
        <section className="stats-section">
          <h2 className="stats-section-title">Listening Patterns</h2>
          <div className="stats-patterns">
            <div className="stats-pattern-group">
              <h3 className="stats-pattern-label">By Hour of Day</h3>
              <HourlyHeatMap data={stats.hourlyDistribution} />
            </div>
            <div className="stats-pattern-group">
              <h3 className="stats-pattern-label">By Day of Week</h3>
              <DayOfWeekHeatMap data={stats.dayOfWeekDistribution} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default StatsView;
