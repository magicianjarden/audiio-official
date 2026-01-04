/**
 * HeatMap - Hour/day activity heatmap
 */

import React from 'react';
import type { HourlyDistribution, DayOfWeekDistribution } from '../../../stores/stats-store';

interface HourlyHeatMapProps {
  data: HourlyDistribution[];
}

const HOUR_LABELS = [
  '12a', '1a', '2a', '3a', '4a', '5a',
  '6a', '7a', '8a', '9a', '10a', '11a',
  '12p', '1p', '2p', '3p', '4p', '5p',
  '6p', '7p', '8p', '9p', '10p', '11p',
];

export const HourlyHeatMap: React.FC<HourlyHeatMapProps> = ({ data }) => {
  const maxPlays = Math.max(...data.map(d => d.playCount), 1);

  return (
    <div className="heatmap hourly-heatmap">
      <div className="heatmap-grid">
        {data.map((item, index) => (
          <div
            key={index}
            className="heatmap-cell"
            style={{
              opacity: 0.2 + (item.playCount / maxPlays) * 0.8,
            }}
            title={`${HOUR_LABELS[index]}: ${item.playCount} plays`}
          >
            {item.playCount > 0 && (
              <span className="heatmap-cell-value">{item.playCount}</span>
            )}
          </div>
        ))}
      </div>
      <div className="heatmap-labels">
        {['12a', '6a', '12p', '6p', '12a'].map((label, i) => (
          <span key={i} className="heatmap-label">{label}</span>
        ))}
      </div>
    </div>
  );
};

interface DayOfWeekHeatMapProps {
  data: DayOfWeekDistribution[];
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DayOfWeekHeatMap: React.FC<DayOfWeekHeatMapProps> = ({ data }) => {
  const maxPlays = Math.max(...data.map(d => d.playCount), 1);

  return (
    <div className="heatmap day-heatmap">
      <div className="heatmap-grid">
        {data.map((item, index) => (
          <div
            key={index}
            className="heatmap-cell day-cell"
            style={{
              opacity: 0.2 + (item.playCount / maxPlays) * 0.8,
            }}
            title={`${DAY_LABELS[index]}: ${item.playCount} plays`}
          >
            <span className="heatmap-cell-label">{DAY_LABELS[index]}</span>
            <span className="heatmap-cell-value">{item.playCount}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Combined weekly activity grid
 */
interface WeeklyActivityGridProps {
  hourlyData: HourlyDistribution[];
  dayData: DayOfWeekDistribution[];
}

export const WeeklyActivityGrid: React.FC<WeeklyActivityGridProps> = ({
  hourlyData,
  dayData,
}) => {
  // Get max for color scaling
  const allValues = [...hourlyData.map(d => d.playCount), ...dayData.map(d => d.playCount)];
  const maxPlays = Math.max(...allValues, 1);

  return (
    <div className="weekly-activity-grid">
      <div className="activity-section">
        <h4 className="activity-section-title">By Hour</h4>
        <HourlyHeatMap data={hourlyData} />
      </div>
      <div className="activity-section">
        <h4 className="activity-section-title">By Day</h4>
        <DayOfWeekHeatMap data={dayData} />
      </div>
    </div>
  );
};
