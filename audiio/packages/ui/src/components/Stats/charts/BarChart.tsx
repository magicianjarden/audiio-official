/**
 * BarChart - Simple CSS-based bar chart
 */

import React from 'react';

interface BarChartProps {
  data: Array<{ label: string; value: number }>;
  maxBars?: number;
  height?: number;
  showLabels?: boolean;
  showValues?: boolean;
  formatValue?: (value: number) => string;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  maxBars = 10,
  height = 120,
  showLabels = true,
  showValues = true,
  formatValue = (v) => v.toString(),
}) => {
  const displayData = data.slice(0, maxBars);
  const maxValue = Math.max(...displayData.map(d => d.value), 1);

  return (
    <div className="bar-chart" style={{ height }}>
      <div className="bar-chart-bars">
        {displayData.map((item, index) => (
          <div key={index} className="bar-chart-bar-container">
            <div
              className="bar-chart-bar"
              style={{
                height: `${(item.value / maxValue) * 100}%`,
              }}
            >
              {showValues && item.value > 0 && (
                <span className="bar-chart-value">{formatValue(item.value)}</span>
              )}
            </div>
            {showLabels && (
              <span className="bar-chart-label">{item.label}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * HorizontalBarChart - Horizontal bars for comparison
 */
interface HorizontalBarChartProps {
  data: Array<{ label: string; value: number; color?: string }>;
  formatValue?: (value: number) => string;
}

export const HorizontalBarChart: React.FC<HorizontalBarChartProps> = ({
  data,
  formatValue = (v) => v.toString(),
}) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="horizontal-bar-chart">
      {data.map((item, index) => (
        <div key={index} className="horizontal-bar-row">
          <span className="horizontal-bar-label">{item.label}</span>
          <div className="horizontal-bar-container">
            <div
              className="horizontal-bar"
              style={{
                width: `${(item.value / maxValue) * 100}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
          <span className="horizontal-bar-value">{formatValue(item.value)}</span>
        </div>
      ))}
    </div>
  );
};
