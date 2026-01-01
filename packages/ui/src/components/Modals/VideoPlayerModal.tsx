/**
 * VideoPlayerModal - Source-agnostic video player modal
 * Supports embedded playback from various video providers (YouTube, Vimeo, etc.)
 */

import React, { useEffect, useCallback } from 'react';
import type { MusicVideo } from '@audiio/core';
import { CloseIcon } from '@audiio/icons';

interface VideoPlayerModalProps {
  video: MusicVideo | null;
  onClose: () => void;
}

/**
 * Get the embed URL for a video based on its source or URL pattern
 */
const getEmbedUrl = (video: MusicVideo): string | null => {
  const { url, source, id } = video;

  // Try source-specific embed formats first
  switch (source) {
    case 'youtube':
      return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
    case 'vimeo':
      return `https://player.vimeo.com/video/${id}?autoplay=1`;
    case 'dailymotion':
      return `https://www.dailymotion.com/embed/video/${id}?autoplay=1`;
  }

  // Try to detect from URL patterns
  return detectEmbedFromUrl(url, id);
};

/**
 * Detect embed URL from various video platform URL patterns
 */
const detectEmbedFromUrl = (url: string, videoId: string): string | null => {
  // YouTube patterns
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|embed\/)([^&\n?#]+)/);
    const id = ytMatch?.[1] || videoId;
    return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
  }

  // Vimeo patterns
  if (url.includes('vimeo.com')) {
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    const id = vimeoMatch?.[1] || videoId;
    return `https://player.vimeo.com/video/${id}?autoplay=1`;
  }

  // Dailymotion patterns
  if (url.includes('dailymotion.com')) {
    const dmMatch = url.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/);
    const id = dmMatch?.[1] || videoId;
    return `https://www.dailymotion.com/embed/video/${id}?autoplay=1`;
  }

  return null;
};

/**
 * Get display name for video source
 */
const getSourceLabel = (source: string): string => {
  const labels: Record<string, string> = {
    youtube: 'YouTube',
    vimeo: 'Vimeo',
    dailymotion: 'Dailymotion',
  };
  return labels[source] || source.charAt(0).toUpperCase() + source.slice(1);
};

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  video,
  onClose,
}) => {
  // Handle escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (!video) return;

    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [video, handleKeyDown]);

  if (!video) return null;

  const embedUrl = getEmbedUrl(video);

  // Handle click on backdrop
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Fallback to external if can't embed
  const handleOpenExternal = () => {
    window.open(video.url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <div className="video-player-modal" onClick={handleBackdropClick}>
      <div className="video-player-modal-content">
        {/* Header */}
        <header className="video-player-modal-header">
          <div className="video-player-modal-title">
            <h3>{video.title}</h3>
            <span className="video-player-modal-source">
              {getSourceLabel(video.source)}
            </span>
          </div>
          <button
            className="video-player-modal-close"
            onClick={onClose}
            aria-label="Close video"
          >
            <CloseIcon size={24} />
          </button>
        </header>

        {/* Video Player */}
        <div className="video-player-modal-player">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={video.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            />
          ) : (
            <div className="video-player-modal-fallback">
              <p>Unable to embed this video.</p>
              <button onClick={handleOpenExternal}>
                Open in Browser
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoPlayerModal;
