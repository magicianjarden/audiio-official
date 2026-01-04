/**
 * Brand Icons - Audiio logo and branding
 */

import React from 'react';
import type { IconProps } from '../types';

// ============================================
// Audiio Logo - Sound wave bars
// ============================================

export const AudiioLogoIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    {...props}
  >
    {/* Sound wave bars - simplified version of the app icon */}
    <rect x="2" y="9" width="2.5" height="6" rx="1.25" />
    <rect x="6" y="6" width="2.5" height="12" rx="1.25" />
    <rect x="10" y="4" width="2.5" height="16" rx="1.25" />
    <rect x="14" y="6" width="2.5" height="12" rx="1.25" />
    <rect x="18" y="9" width="2.5" height="6" rx="1.25" />
  </svg>
);

// Gradient version for special use cases
export const AudiioLogoGradientIcon: React.FC<IconProps & { gradientId?: string }> = ({
  size = 24,
  className,
  gradientId = 'audiio-gradient',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
    {...props}
  >
    <defs>
      <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#6366f1' }} />
        <stop offset="50%" style={{ stopColor: '#8b5cf6' }} />
        <stop offset="100%" style={{ stopColor: '#a855f7' }} />
      </linearGradient>
    </defs>
    <rect x="2" y="9" width="2.5" height="6" rx="1.25" fill={`url(#${gradientId})`} />
    <rect x="6" y="6" width="2.5" height="12" rx="1.25" fill={`url(#${gradientId})`} />
    <rect x="10" y="4" width="2.5" height="16" rx="1.25" fill={`url(#${gradientId})`} />
    <rect x="14" y="6" width="2.5" height="12" rx="1.25" fill={`url(#${gradientId})`} />
    <rect x="18" y="9" width="2.5" height="6" rx="1.25" fill={`url(#${gradientId})`} />
  </svg>
);
