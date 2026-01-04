/**
 * StatCard - Summary stat card for the stats dashboard
 */

import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle?: string;
  trend?: {
    value: number;
    label: string;
  };
  variant?: 'default' | 'accent' | 'success' | 'warning';
  size?: 'default' | 'large';
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  subtitle,
  trend,
  variant = 'default',
  size = 'default',
}) => {
  return (
    <div className={`stat-card stat-card--${variant} stat-card--${size}`}>
      <div className="stat-card-icon">{icon}</div>
      <div className="stat-card-content">
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{label}</div>
        {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
        {trend && (
          <div className={`stat-card-trend ${trend.value >= 0 ? 'positive' : 'negative'}`}>
            <span className="trend-arrow">{trend.value >= 0 ? '↑' : '↓'}</span>
            <span className="trend-value">{Math.abs(trend.value)}%</span>
            <span className="trend-label">{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  );
};
