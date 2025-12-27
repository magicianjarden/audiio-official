/**
 * StatCard - Summary stat card for the stats dashboard
 */

import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  subtitle?: string;
  trend?: {
    value: number;
    label: string;
  };
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  subtitle,
  trend,
}) => {
  return (
    <div className="stat-card">
      <div className="stat-card-icon">{icon}</div>
      <div className="stat-card-content">
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{label}</div>
        {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
        {trend && (
          <div className={`stat-card-trend ${trend.value >= 0 ? 'positive' : 'negative'}`}>
            <span className="trend-arrow">{trend.value >= 0 ? '+' : ''}</span>
            <span className="trend-value">{trend.value}%</span>
            <span className="trend-label">{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  );
};
