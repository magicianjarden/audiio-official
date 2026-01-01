/**
 * VideoPlayerModal - Custom HTML5 video player modal
 * Fetches direct stream URLs from plugins for native playback
 */

import React, { useEffect, useCallback, useState, useRef } from 'react';
import type { MusicVideo, VideoStreamInfo } from '@audiio/core';
import { CloseIcon, PlayIcon, PauseIcon, VolumeHighIcon, ExpandIcon } from '@audiio/icons';

// Extend Window type for video stream API
declare global {
  interface Window {
    api?: {
      enrichment?: {
        getVideoStream?: (
          videoId: string,
          source: string,
          preferredQuality?: string
        ) => Promise<{
          success: boolean;
          data?: VideoStreamInfo;
          error?: string;
        }>;
      };
    };
  }
}

interface VideoPlayerModalProps {
  video: MusicVideo | null;
  onClose: () => void;
}

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

/**
 * Format duration for display
 */
const formatTime = (seconds: number): string => {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  video,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [streamInfo, setStreamInfo] = useState<VideoStreamInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);

  // Fetch stream URL when video changes
  useEffect(() => {
    if (!video) {
      setStreamInfo(null);
      setError(null);
      return;
    }

    const fetchStream = async () => {
      if (!window.api?.enrichment?.getVideoStream) {
        setError('Video streaming not available');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await window.api.enrichment.getVideoStream(
          video.id,
          video.source,
          '720p'
        );

        if (result.success && result.data) {
          setStreamInfo(result.data);
        } else {
          setError(result.error || 'Failed to get video stream');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load video');
      } finally {
        setLoading(false);
      }
    };

    fetchStream();
  }, [video]);

  // Sync video and audio playback for adaptive streams
  useEffect(() => {
    const videoEl = videoRef.current;
    const audioEl = audioRef.current;

    if (!videoEl || !audioEl || !streamInfo?.audioUrl) return;

    const syncAudio = () => {
      if (Math.abs(audioEl.currentTime - videoEl.currentTime) > 0.3) {
        audioEl.currentTime = videoEl.currentTime;
      }
    };

    const handlePlay = () => {
      audioEl.play().catch(() => {});
    };

    const handlePause = () => {
      audioEl.pause();
    };

    const handleSeek = () => {
      audioEl.currentTime = videoEl.currentTime;
    };

    videoEl.addEventListener('play', handlePlay);
    videoEl.addEventListener('pause', handlePause);
    videoEl.addEventListener('seeked', handleSeek);
    videoEl.addEventListener('timeupdate', syncAudio);

    return () => {
      videoEl.removeEventListener('play', handlePlay);
      videoEl.removeEventListener('pause', handlePause);
      videoEl.removeEventListener('seeked', handleSeek);
      videoEl.removeEventListener('timeupdate', syncAudio);
    };
  }, [streamInfo?.audioUrl]);

  // Handle escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === ' ') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'ArrowLeft') {
      seek(-10);
    } else if (e.key === 'ArrowRight') {
      seek(10);
    } else if (e.key === 'f') {
      toggleFullscreen();
    }
  }, [onClose]);

  useEffect(() => {
    if (!video) return;

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [video, handleKeyDown]);

  // Auto-hide controls
  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      return;
    }

    const timer = setTimeout(() => setShowControls(false), 3000);
    return () => clearTimeout(timer);
  }, [isPlaying, showControls]);

  const togglePlay = () => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (videoEl.paused) {
      videoEl.play();
    } else {
      videoEl.pause();
    }
  };

  const seek = (delta: number) => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    videoEl.currentTime = Math.max(0, Math.min(videoEl.currentTime + delta, videoEl.duration));
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const videoEl = videoRef.current;
    const progressEl = progressRef.current;
    if (!videoEl || !progressEl) return;

    const rect = progressEl.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    videoEl.currentTime = percent * videoEl.duration;
  };

  const toggleFullscreen = () => {
    const container = document.querySelector('.video-player-modal-content');
    if (!container) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleOpenExternal = () => {
    if (video) {
      window.open(video.url, '_blank', 'noopener,noreferrer');
    }
    onClose();
  };

  if (!video) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="video-player-modal" onClick={handleBackdropClick}>
      <div
        className="video-player-modal-content"
        onMouseMove={() => setShowControls(true)}
      >
        {/* Header */}
        <header className={`video-player-modal-header ${showControls ? 'visible' : 'hidden'}`}>
          <div className="video-player-modal-title">
            <h3>{video.title}</h3>
            <span className="video-player-modal-source">
              {getSourceLabel(video.source)}
              {streamInfo && ` • ${streamInfo.quality}`}
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
        <div className="video-player-modal-player" onClick={togglePlay}>
          {loading && (
            <div className="video-player-loading">
              <div className="video-player-spinner" />
              <span>Loading video...</span>
            </div>
          )}

          {error && (
            <div className="video-player-error">
              <p>{error}</p>
              <button onClick={handleOpenExternal}>Open in Browser</button>
            </div>
          )}

          {streamInfo && (
            <>
              <video
                ref={videoRef}
                src={streamInfo.url}
                autoPlay
                playsInline
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onDurationChange={(e) => setDuration(e.currentTarget.duration)}
                onVolumeChange={(e) => setVolume(e.currentTarget.volume)}
                onError={() => setError('Video playback failed')}
              />

              {/* Separate audio track for adaptive streams */}
              {streamInfo.audioUrl && (
                <audio
                  ref={audioRef}
                  src={streamInfo.audioUrl}
                  preload="auto"
                />
              )}

              {/* Play/Pause overlay */}
              {!isPlaying && (
                <div className="video-player-play-overlay">
                  <PlayIcon size={64} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Controls */}
        {streamInfo && (
          <div className={`video-player-controls ${showControls ? 'visible' : 'hidden'}`}>
            {/* Progress bar */}
            <div
              ref={progressRef}
              className="video-player-progress"
              onClick={handleProgressClick}
            >
              <div className="video-player-progress-bg" />
              <div
                className="video-player-progress-fill"
                style={{ width: `${progress}%` }}
              />
              <div
                className="video-player-progress-handle"
                style={{ left: `${progress}%` }}
              />
            </div>

            <div className="video-player-controls-row">
              {/* Play/Pause */}
              <button className="video-player-btn" onClick={togglePlay}>
                {isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
              </button>

              {/* Time */}
              <span className="video-player-time">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <div className="video-player-controls-spacer" />

              {/* Volume */}
              <div className="video-player-volume">
                <VolumeHighIcon size={20} />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={(e) => {
                    const vol = parseFloat(e.target.value);
                    setVolume(vol);
                    if (videoRef.current) videoRef.current.volume = vol;
                    if (audioRef.current) audioRef.current.volume = vol;
                  }}
                />
              </div>

              {/* Fullscreen */}
              <button className="video-player-btn" onClick={toggleFullscreen}>
                <ExpandIcon size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayerModal;
