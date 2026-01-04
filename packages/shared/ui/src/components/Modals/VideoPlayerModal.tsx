/**
 * VideoPlayerModal - Modern floating/theater video player
 * Integrated with main player - shares volume/mute, pauses audio when video plays
 * Clean minimal design with hover controls, resizable, quality selection
 */

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { usePlayerStore, type VideoQuality, type VideoMode } from '../../stores/player-store';
import { useUIStore } from '../../stores/ui-store';
import {
  CloseIcon,
  PlayIcon,
  PauseIcon,
  VolumeHighIcon,
  VolumeLowIcon,
  VolumeMuteIcon,
  ExpandIcon,
  ContractIcon,
  MaximizeIcon,
  MinimizeIcon,
  LyricsIcon,
  SettingsIcon,
  ExternalLinkIcon,
  DragHandleIcon
} from '@audiio/icons';

const formatTime = (seconds: number): string => {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const QUALITY_OPTIONS: { value: VideoQuality; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: '1080p', label: '1080p' },
  { value: '720p', label: '720p' },
  { value: '480p', label: '480p' },
  { value: '360p', label: '360p' },
];

const MIN_SIZE = { width: 320, height: 180 };
const MAX_SIZE = { width: 800, height: 450 };

export const VideoPlayerModal: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const {
    // Audio player state (for integration)
    isPlaying: isAudioPlaying,
    pause: pauseAudio,
    // Video state
    videoMode,
    currentVideo,
    videoStreamInfo,
    isVideoPlaying,
    videoPosition,
    videoDuration,
    isVideoLoading,
    videoError,
    videoQuality,
    videoSize,
    volume,
    isMuted,
    closeVideo,
    setVideoMode,
    toggleVideoMode,
    setVideoPlaying,
    setVideoPosition,
    setVideoDuration,
    setVideoError,
    setVideoQuality,
    setVideoSize,
    setVolume,
    toggleMute,
  } = usePlayerStore();

  const { toggleLyricsPanel, isLyricsPanelOpen } = useUIStore();

  const [showControls, setShowControls] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDir, setResizeDir] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);

  // Sync video and audio playback
  useEffect(() => {
    const videoEl = videoRef.current;
    const audioEl = audioRef.current;
    if (!videoEl || !audioEl || !videoStreamInfo?.audioUrl) return;

    const syncAudio = () => {
      if (Math.abs(audioEl.currentTime - videoEl.currentTime) > 0.3) {
        audioEl.currentTime = videoEl.currentTime;
      }
    };

    const handlePlay = () => audioEl.play().catch(() => {});
    const handlePause = () => audioEl.pause();
    const handleSeek = () => { audioEl.currentTime = videoEl.currentTime; };

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
  }, [videoStreamInfo?.audioUrl]);

  // Sync volume
  useEffect(() => {
    const vol = isMuted ? 0 : volume;
    if (videoRef.current) videoRef.current.volume = vol;
    if (audioRef.current) audioRef.current.volume = vol;
  }, [volume, isMuted]);

  // Pause audio when video starts playing (integration with main player)
  useEffect(() => {
    if (isVideoPlaying && isAudioPlaying) {
      pauseAudio();
    }
  }, [isVideoPlaying, isAudioPlaying, pauseAudio]);

  // Sync video element with isVideoPlaying state (for when audio player pauses video)
  useEffect(() => {
    const videoEl = videoRef.current;
    const audioEl = audioRef.current;
    if (!videoEl) return;

    if (isVideoPlaying) {
      videoEl.play().catch(() => {});
      audioEl?.play().catch(() => {});
    } else {
      videoEl.pause();
      audioEl?.pause();
    }
  }, [isVideoPlaying]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (videoMode === 'off') return;

    switch (e.key) {
      case 'Escape':
        videoMode === 'theater' ? setVideoMode('float') : closeVideo();
        break;
      case ' ':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowLeft':
        seek(-10);
        break;
      case 'ArrowRight':
        seek(10);
        break;
      case 'f':
        toggleFullscreen();
        break;
      case 'm':
        toggleMute();
        break;
      case 't':
        toggleVideoMode();
        break;
      case 'l':
        toggleLyricsPanel();
        break;
    }
  }, [videoMode, closeVideo, setVideoMode, toggleMute, toggleVideoMode, toggleLyricsPanel]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Auto-hide controls
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => {
      if (isVideoPlaying) setShowControls(false);
    }, 2500);
  }, [isVideoPlaying]);

  useEffect(() => {
    if (!isVideoPlaying) {
      setShowControls(true);
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    }
  }, [isVideoPlaying]);

  // Dragging
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!panelRef.current || videoMode !== 'float') return;
    const rect = panelRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setIsDragging(true);
  }, [videoMode]);

  // Resizing
  const handleResizeStart = useCallback((e: React.MouseEvent, dir: string) => {
    e.stopPropagation();
    if (videoMode !== 'float') return;
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: videoSize.width,
      height: videoSize.height,
    };
    setResizeDir(dir);
    setIsResizing(true);
  }, [videoMode, videoSize]);

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.current.x;
        const newY = e.clientY - dragOffset.current.y;
        const maxX = window.innerWidth - videoSize.width;
        const maxY = window.innerHeight - videoSize.height;
        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY)),
        });
      } else if (isResizing && resizeDir) {
        const dx = e.clientX - resizeStart.current.x;
        const dy = e.clientY - resizeStart.current.y;
        let newWidth = resizeStart.current.width;
        let newHeight = resizeStart.current.height;

        if (resizeDir.includes('e')) newWidth = resizeStart.current.width + dx;
        if (resizeDir.includes('w')) newWidth = resizeStart.current.width - dx;
        if (resizeDir.includes('s')) newHeight = resizeStart.current.height + dy;
        if (resizeDir.includes('n')) newHeight = resizeStart.current.height - dy;

        // Maintain 16:9 aspect ratio
        const aspectRatio = 16 / 9;
        if (Math.abs(dx) > Math.abs(dy)) {
          newHeight = newWidth / aspectRatio;
        } else {
          newWidth = newHeight * aspectRatio;
        }

        newWidth = Math.max(MIN_SIZE.width, Math.min(MAX_SIZE.width, newWidth));
        newHeight = Math.max(MIN_SIZE.height, Math.min(MAX_SIZE.height, newHeight));

        setVideoSize({ width: Math.round(newWidth), height: Math.round(newHeight) });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeDir(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, resizeDir, videoSize, setVideoSize]);

  const togglePlay = useCallback(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    videoEl.paused ? videoEl.play() : videoEl.pause();
  }, []);

  const seek = useCallback((delta: number) => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    videoEl.currentTime = Math.max(0, Math.min(videoEl.currentTime + delta, videoEl.duration));
  }, []);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const videoEl = videoRef.current;
    const progressEl = progressRef.current;
    if (!videoEl || !progressEl) return;
    const rect = progressEl.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    videoEl.currentTime = percent * videoEl.duration;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      panel.requestFullscreen();
    }
  }, []);

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Listen for seek events from main player bar
  useEffect(() => {
    const handleVideoSeek = (e: CustomEvent<{ position: number }>) => {
      const videoEl = videoRef.current;
      const audioEl = audioRef.current;
      if (videoEl && e.detail?.position !== undefined) {
        videoEl.currentTime = e.detail.position;
        if (audioEl) {
          audioEl.currentTime = e.detail.position;
        }
        setVideoPosition(e.detail.position);
      }
    };

    window.addEventListener('audiio:video-seek', handleVideoSeek as EventListener);
    return () => window.removeEventListener('audiio:video-seek', handleVideoSeek as EventListener);
  }, [setVideoPosition]);

  const handleOpenExternal = useCallback(() => {
    if (currentVideo) window.open(currentVideo.url, '_blank', 'noopener,noreferrer');
  }, [currentVideo]);

  const handleQualityChange = useCallback((q: VideoQuality) => {
    setVideoQuality(q);
    setShowQualityMenu(false);
  }, [setVideoQuality]);

  const handleModeChange = useCallback((mode: VideoMode | 'fullscreen') => {
    setShowModeMenu(false);
    if (mode === 'fullscreen') {
      toggleFullscreen();
    } else {
      setVideoMode(mode);
    }
  }, [setVideoMode, toggleFullscreen]);

  // Mode options for dropdown
  const MODE_OPTIONS: { value: VideoMode | 'fullscreen'; label: string; icon: React.ReactNode }[] = [
    { value: 'float', label: 'Mini Player', icon: <MinimizeIcon size={16} /> },
    { value: 'theater', label: 'Theater', icon: <MaximizeIcon size={16} /> },
    { value: 'fullscreen', label: 'Fullscreen', icon: <ExpandIcon size={16} /> },
  ];

  if (videoMode === 'off' || !currentVideo) return null;

  const progress = videoDuration > 0 ? (videoPosition / videoDuration) * 100 : 0;
  const isFloatMode = videoMode === 'float';
  const isTheaterMode = videoMode === 'theater';

  const VolumeIcon = isMuted || volume === 0 ? VolumeMuteIcon : volume < 0.5 ? VolumeLowIcon : VolumeHighIcon;

  const panelStyle: React.CSSProperties = isFloatMode
    ? {
        ...(position.x !== 0 || position.y !== 0 ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : {}),
        width: videoSize.width,
        height: videoSize.height,
      }
    : {};

  return (
    <>
      {isTheaterMode && (
        <div className="video-backdrop" onClick={() => setVideoMode('float')} />
      )}

      <div
        ref={panelRef}
        className={`video-panel ${videoMode} ${showControls ? 'show-controls' : ''} ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''}`}
        style={panelStyle}
        onMouseMove={showControlsTemporarily}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => isVideoPlaying && setShowControls(false)}
      >
        {/* Video */}
        <div className="video-container" onClick={togglePlay}>
          {isVideoLoading && (
            <div className="video-loading">
              <div className="video-spinner" />
            </div>
          )}

          {videoError && (
            <div className="video-error">
              <p>{videoError}</p>
              <button onClick={handleOpenExternal}>Open in Browser</button>
            </div>
          )}

          {videoStreamInfo && (
            <>
              <video
                ref={videoRef}
                src={videoStreamInfo.url}
                autoPlay
                playsInline
                onPlay={() => setVideoPlaying(true)}
                onPause={() => setVideoPlaying(false)}
                onTimeUpdate={(e) => setVideoPosition(e.currentTarget.currentTime)}
                onDurationChange={(e) => setVideoDuration(e.currentTarget.duration)}
                onError={() => setVideoError('Playback failed')}
              />
              {videoStreamInfo.audioUrl && (
                <audio ref={audioRef} src={videoStreamInfo.audioUrl} preload="auto" />
              )}
            </>
          )}

          {/* Center play button */}
          {!isVideoPlaying && !isVideoLoading && !videoError && (
            <div className="video-play-button">
              <PlayIcon size={isTheaterMode ? 72 : 48} />
            </div>
          )}
        </div>

        {/* Controls overlay */}
        <div className={`video-controls ${showControls ? 'visible' : ''}`}>
          {/* Top bar - draggable in float mode */}
          <div
            className={`video-controls-top ${isFloatMode ? 'draggable' : ''}`}
            onMouseDown={isFloatMode ? handleDragStart : undefined}
            style={isFloatMode ? { cursor: isDragging ? 'grabbing' : 'grab' } : undefined}
          >
            {isFloatMode && (
              <div className="video-drag-indicator">
                <DragHandleIcon size={16} />
              </div>
            )}
            <span className="video-title">{currentVideo.title}</span>
            <div className="video-top-actions">
              <button onClick={(e) => { e.stopPropagation(); toggleLyricsPanel(); }} className={isLyricsPanelOpen ? 'active' : ''} title="Lyrics (L)">
                <LyricsIcon size={18} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleOpenExternal(); }} title="Open in browser">
                <ExternalLinkIcon size={18} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); closeVideo(); }} title="Close">
                <CloseIcon size={18} />
              </button>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="video-controls-bottom">
            {/* Progress */}
            <div ref={progressRef} className="video-progress" onClick={handleProgressClick}>
              <div className="video-progress-bar">
                <div className="video-progress-fill" style={{ width: `${progress}%` }} />
                <div className="video-progress-thumb" style={{ left: `${progress}%` }} />
              </div>
            </div>

            <div className="video-controls-row">
              {/* Left controls */}
              <div className="video-controls-left">
                <button onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
                  {isVideoPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
                </button>

                <div className="video-volume">
                  <button onClick={(e) => { e.stopPropagation(); toggleMute(); }}>
                    <VolumeIcon size={20} />
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => { e.stopPropagation(); setVolume(parseFloat(e.target.value)); }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                <span className="video-time">
                  {formatTime(videoPosition)} / {formatTime(videoDuration)}
                </span>
              </div>

              {/* Right controls */}
              <div className="video-controls-right">
                {/* Quality selector */}
                <div className="video-quality-wrapper">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowQualityMenu(!showQualityMenu); setShowModeMenu(false); }}
                    className={isVideoLoading ? 'loading' : ''}
                  >
                    <SettingsIcon size={16} />
                    <span>{isVideoLoading ? '...' : (videoStreamInfo?.quality || videoQuality)}</span>
                  </button>
                  {showQualityMenu && (
                    <div className="video-quality-menu" onClick={(e) => e.stopPropagation()}>
                      {QUALITY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          className={`${videoQuality === opt.value ? 'active' : ''} ${videoStreamInfo?.quality === opt.value ? 'current' : ''}`}
                          onClick={() => handleQualityChange(opt.value)}
                        >
                          {opt.label}
                          {videoStreamInfo?.quality === opt.value && <span className="quality-current">Playing</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Mode selector */}
                <div className="video-mode-wrapper">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowModeMenu(!showModeMenu); setShowQualityMenu(false); }}
                    title="Player mode"
                  >
                    {isFullscreen ? <ContractIcon size={18} /> : isTheaterMode ? <MaximizeIcon size={18} /> : <MinimizeIcon size={18} />}
                  </button>
                  {showModeMenu && (
                    <div className="video-mode-menu" onClick={(e) => e.stopPropagation()}>
                      {MODE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          className={
                            (opt.value === 'fullscreen' && isFullscreen) ||
                            (opt.value === videoMode && !isFullscreen) ? 'active' : ''
                          }
                          onClick={() => handleModeChange(opt.value)}
                        >
                          {opt.icon}
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Resize handles (float mode only) */}
        {isFloatMode && (
          <>
            <div className="video-resize-handle nw" onMouseDown={(e) => handleResizeStart(e, 'nw')} />
            <div className="video-resize-handle ne" onMouseDown={(e) => handleResizeStart(e, 'ne')} />
            <div className="video-resize-handle sw" onMouseDown={(e) => handleResizeStart(e, 'sw')} />
            <div className="video-resize-handle se" onMouseDown={(e) => handleResizeStart(e, 'se')} />
          </>
        )}
      </div>
    </>
  );
};

export default VideoPlayerModal;
