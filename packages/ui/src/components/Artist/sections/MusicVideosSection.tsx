/**
 * MusicVideosSection - Displays artist music videos from YouTube
 */

import React from 'react';
import type { MusicVideo } from '@audiio/core';

interface MusicVideosSectionProps {
  videos: MusicVideo[];
  onVideoClick?: (video: MusicVideo) => void;
}

export const MusicVideosSection: React.FC<MusicVideosSectionProps> = ({
  videos,
  onVideoClick,
}) => {
  if (!videos || videos.length === 0) return null;

  const formatViewCount = (count?: number): string => {
    if (!count) return '';
    if (count >= 1000000000) return `${(count / 1000000000).toFixed(1)}B views`;
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M views`;
    if (count >= 1000) return `${Math.floor(count / 1000)}K views`;
    return `${count} views`;
  };

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="enrichment-videos-grid">
      {videos.slice(0, 8).map((video) => (
        <div
          key={video.id}
          className="video-card"
          onClick={() => onVideoClick?.(video)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onVideoClick?.(video)}
        >
          <div className="video-card-thumbnail">
            <img src={video.thumbnail} alt={video.title} loading="lazy" />
            {video.duration && (
              <span className="video-card-duration">{video.duration}</span>
            )}
            <div className="video-card-play-overlay">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
          <div className="video-card-info">
            <span className="video-card-title">{video.title}</span>
            <span className="video-card-meta">
              {video.viewCount ? formatViewCount(video.viewCount) : ''}
              {video.viewCount && video.publishedAt ? ' • ' : ''}
              {video.publishedAt ? formatDate(video.publishedAt) : ''}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MusicVideosSection;
