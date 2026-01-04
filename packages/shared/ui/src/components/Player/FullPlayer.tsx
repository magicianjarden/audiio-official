import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../../stores/player-store';
import { useLibraryStore } from '../../stores/library-store';
import { useUIStore } from '../../stores/ui-store';
import { useLyricsStore } from '../../stores/lyrics-store';
import { useNavigationStore } from '../../stores/navigation-store';
import { LyricsDisplay } from './LyricsDisplay';
import { extractColorsFromImage, type ExtractedColors } from '../../utils/color-extractor';
import { useArtwork } from '../../hooks/useArtwork';
import {
  PlayIcon,
  PauseIcon,
  NextIcon,
  PrevIcon,
  ShuffleIcon,
  RepeatIcon,
  RepeatOneIcon,
  HeartIcon,
  HeartOutlineIcon,
  ChevronDownIcon,
  LyricsIcon,
  MusicNoteIcon
} from '@audiio/icons';

export const FullPlayer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  // Dynamic background colors extracted from artwork
  const [colors, setColors] = useState<ExtractedColors | null>(null);

  const {
    currentTrack,
    isPlaying,
    position,
    duration,
    isLoading,
    shuffle,
    repeat,
    pause,
    resume,
    seek,
    next,
    previous,
    toggleShuffle,
    cycleRepeat
  } = usePlayerStore();

  const { playerMode, collapsePlayer, isLyricsVisible, toggleLyrics } = useUIStore();
  const { isLiked, toggleLike } = useLibraryStore();
  const { fetchLyrics, updateCurrentLine, updatePositionAtomic, singAlongEnabled, clearLyrics } = useLyricsStore();
  const { openAlbum, openArtist } = useNavigationStore();

  const trackIsLiked = currentTrack ? isLiked(currentTrack.id) : false;

  // Resolve artwork (handles embedded artwork from local files)
  const { artworkUrl } = useArtwork(currentTrack);
  const [artworkError, setArtworkError] = useState(false);

  // Reset artwork error when track changes
  useEffect(() => {
    setArtworkError(false);
  }, [currentTrack?.id]);

  const handleGoToAlbum = useCallback(() => {
    if (currentTrack?.album) {
      collapsePlayer();
      openAlbum(currentTrack.album.id, {
        id: currentTrack.album.id,
        title: currentTrack.album.title,
        artist: currentTrack.artists[0]?.name || 'Unknown Artist',
        artwork: currentTrack.album.artwork?.medium,
        source: currentTrack.source
      });
    }
  }, [currentTrack, openAlbum, collapsePlayer]);

  const handleGoToArtist = useCallback(() => {
    const primaryArtist = currentTrack?.artists[0];
    if (primaryArtist) {
      collapsePlayer();
      openArtist(primaryArtist.id, {
        id: primaryArtist.id,
        name: primaryArtist.name,
        image: currentTrack?.artwork?.medium,
        source: currentTrack?.source || 'unknown'
      });
    }
  }, [currentTrack, openArtist, collapsePlayer]);

  // Fetch lyrics when track changes
  useEffect(() => {
    if (currentTrack && playerMode === 'full') {
      const artistName = currentTrack.artists[0]?.name || '';
      fetchLyrics(artistName, currentTrack.title, currentTrack.id);
    }
  }, [currentTrack?.id, playerMode, fetchLyrics]);

  // Clear lyrics when collapsing
  useEffect(() => {
    if (playerMode === 'mini') {
      clearLyrics();
    }
  }, [playerMode, clearLyrics]);

  // Extract colors from artwork for animated background
  useEffect(() => {
    if (artworkUrl && playerMode === 'full') {
      extractColorsFromImage(artworkUrl).then(setColors);
    }
  }, [artworkUrl, playerMode]);

  // Note: Full player always uses light text (defined in CSS as --fp-text-*)
  // because the background is always darkened via CSS filters (brightness: 0.25)

  // Update current lyric line and word based on position
  // Use atomic update when sing-along is enabled for smooth word tracking
  useEffect(() => {
    if (isLyricsVisible) {
      if (singAlongEnabled) {
        updatePositionAtomic(position);
      } else {
        updateCurrentLine(position);
      }
    }
  }, [position, isLyricsVisible, singAlongEnabled, updateCurrentLine, updatePositionAtomic]);

  // Note: Keyboard shortcuts are now handled globally by GlobalShortcutManager
  // Escape to collapse and Space for play/pause work app-wide

  // Check for animated artwork (compute before hook so it's stable)
  const animatedArtwork = currentTrack?.artwork?.animated ?? currentTrack?.album?.artwork?.animated;
  const animatedVideoUrl = animatedArtwork?.videoUrl;

  // Handle video playback to avoid "play() request was interrupted" errors
  // This must be before any conditional returns
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !animatedVideoUrl || playerMode !== 'full') return;

    const safePlay = async () => {
      // Wait for any pending play operation to complete
      if (playPromiseRef.current) {
        try {
          await playPromiseRef.current;
        } catch {
          // Ignore - play was interrupted, which is fine
        }
      }

      // Now try to play
      playPromiseRef.current = video.play();
      try {
        await playPromiseRef.current;
      } catch (error) {
        // AbortError means play was interrupted, which is expected
        if ((error as Error).name !== 'AbortError') {
          console.error('Video playback failed:', error);
        }
      }
      playPromiseRef.current = null;
    };

    // Attempt to play when video is ready
    if (video.readyState >= 2) {
      safePlay();
    } else {
      video.addEventListener('canplay', safePlay, { once: true });
    }

    return () => {
      video.removeEventListener('canplay', safePlay);
    };
  }, [animatedVideoUrl, playerMode]);

  // Progress bar dragging
  const progressBarRef = useRef<HTMLDivElement>(null);
  const isDraggingProgress = useRef(false);

  const updateProgress = useCallback((clientX: number) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newPosition = percent * duration;
    seek(newPosition);
  }, [duration, seek]);

  const handleProgressMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    isDraggingProgress.current = true;
    updateProgress(e.clientX);

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingProgress.current) {
        updateProgress(e.clientX);
      }
    };

    const handleMouseUp = () => {
      isDraggingProgress.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [updateProgress]);

  // Format time
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (playerMode !== 'full' || !currentTrack) return null;

  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;
  const artistNames = currentTrack.artists.map(a => a.name).join(', ');
  const hasAnimatedArtwork = !!animatedVideoUrl;
  const showArtwork = artworkUrl && !artworkError;

  return (
    <div
      className="full-player"
      ref={containerRef}
    >
      {/* Animated Gradient Background */}
      <div
        className="full-player-animated-bg"
        style={{
          '--bg-primary': colors?.primary,
          '--bg-secondary': colors?.secondary,
          '--bg-accent': colors?.accent,
        } as React.CSSProperties}
      />

      {/* Blurred Artwork Overlay */}
      {showArtwork && (
        <div
          className="full-player-bg"
          style={{ backgroundImage: `url(${artworkUrl})` }}
        />
      )}

      {/* Header */}
      <header className="full-player-header">
        <button
          className="full-player-collapse"
          onClick={collapsePlayer}
          title="Collapse (Esc)"
        >
          <ChevronDownIcon size={28} />
        </button>
        <div className="full-player-header-info">
          <span className="full-player-from">Playing from</span>
          <span
            className={`full-player-source ${currentTrack.album ? 'clickable' : ''}`}
            onClick={currentTrack.album ? handleGoToAlbum : undefined}
            title={currentTrack.album ? `Go to ${currentTrack.album.title}` : undefined}
          >
            {currentTrack.album?.title || 'Unknown Album'}
          </span>
        </div>
        <button
          className={`full-player-lyrics-toggle ${isLyricsVisible ? 'active' : ''}`}
          onClick={toggleLyrics}
          title={isLyricsVisible ? 'Hide lyrics' : 'Show lyrics'}
        >
          <LyricsIcon size={22} />
        </button>
      </header>

      {/* Main Content */}
      <div className={`full-player-content ${isLyricsVisible ? 'with-lyrics' : ''}`}>
        {/* Artwork */}
        <div className="full-player-artwork-container">
          {hasAnimatedArtwork && animatedArtwork ? (
            <video
              ref={videoRef}
              className="full-player-artwork full-player-video"
              src={animatedArtwork.videoUrl}
              poster={animatedArtwork.previewFrame || artworkUrl}
              loop
              muted={!animatedArtwork.hasAudio}
              playsInline
            />
          ) : showArtwork ? (
            <img
              className="full-player-artwork"
              src={artworkUrl}
              alt={currentTrack.title}
              onError={() => setArtworkError(true)}
            />
          ) : (
            <div className="full-player-artwork full-player-artwork-placeholder">
              <MusicNoteIcon size={80} />
            </div>
          )}
        </div>

        {/* Lyrics */}
        {isLyricsVisible && (
          <div className="full-player-lyrics-container">
            <LyricsDisplay onSeek={seek} />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="full-player-footer">
        {/* Track Info */}
        <div className="full-player-track-info">
          <h2
            className={`full-player-title ${currentTrack.album ? 'clickable' : ''}`}
            onClick={currentTrack.album ? handleGoToAlbum : undefined}
            title={currentTrack.album ? `Go to ${currentTrack.album.title}` : undefined}
          >
            {currentTrack.title}
          </h2>
          <p
            className={`full-player-artist ${currentTrack.artists.length > 0 ? 'clickable' : ''}`}
            onClick={currentTrack.artists.length > 0 ? handleGoToArtist : undefined}
            title={currentTrack.artists.length > 0 ? `Go to ${currentTrack.artists[0].name}` : undefined}
          >
            {artistNames}
          </p>
        </div>

        {/* Progress */}
        <div className="full-player-progress">
          <span className="full-player-time">{formatTime(position)}</span>
          <div className="full-player-progress-bar" ref={progressBarRef} onMouseDown={handleProgressMouseDown}>
            <div
              className="full-player-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="full-player-time">{formatTime(duration)}</span>
        </div>

        {/* Controls */}
        <div className="full-player-controls">
          <button
            className={`full-player-btn secondary ${shuffle ? 'active' : ''}`}
            onClick={toggleShuffle}
            title={shuffle ? 'Disable shuffle' : 'Enable shuffle'}
          >
            <ShuffleIcon size={24} />
          </button>
          <button
            className="full-player-btn"
            onClick={previous}
            title="Previous"
          >
            <PrevIcon size={32} />
          </button>
          <button
            className="full-player-btn primary"
            onClick={isPlaying ? pause : resume}
            disabled={isLoading}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading ? (
              <span className="full-player-loading" />
            ) : isPlaying ? (
              <PauseIcon size={36} />
            ) : (
              <PlayIcon size={36} />
            )}
          </button>
          <button
            className="full-player-btn"
            onClick={next}
            title="Next"
          >
            <NextIcon size={32} />
          </button>
          <button
            className={`full-player-btn secondary ${repeat !== 'off' ? 'active' : ''}`}
            onClick={cycleRepeat}
            title={repeat === 'off' ? 'Enable repeat' : repeat === 'all' ? 'Repeat one' : 'Disable repeat'}
          >
            {repeat === 'one' ? <RepeatOneIcon size={24} /> : <RepeatIcon size={24} />}
          </button>
        </div>

        {/* Actions */}
        <div className="full-player-actions">
          <button
            className={`full-player-action ${trackIsLiked ? 'active' : ''}`}
            onClick={() => toggleLike(currentTrack)}
            title={trackIsLiked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
          >
            {trackIsLiked ? <HeartIcon size={24} /> : <HeartOutlineIcon size={24} />}
          </button>
        </div>
      </footer>
    </div>
  );
};
