import React, { useRef, useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePlayerStore } from '../../stores/player-store';
import { useLibraryStore } from '../../stores/library-store';
import { useUIStore } from '../../stores/ui-store';
import { useRecommendationStore } from '../../stores/recommendation-store';
import { useNavigationStore } from '../../stores/navigation-store';
import { useTrackContextMenu } from '../../contexts/ContextMenuContext';
import { DislikeModal } from '../Modals/DislikeModal';
import {
  PlayIcon,
  PauseIcon,
  NextIcon,
  PrevIcon,
  VolumeHighIcon,
  VolumeLowIcon,
  VolumeMuteIcon,
  HeartIcon,
  HeartOutlineIcon,
  ThumbDownIcon,
  MusicNoteIcon,
  ShuffleIcon,
  RepeatIcon,
  RepeatOneIcon,
  QueueIcon,
  LyricsIcon,
  CloseIcon
} from '@audiio/icons';
import { useArtwork } from '../../hooks/useArtwork';

export const Player: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const {
    // Audio state
    currentTrack,
    isPlaying,
    position,
    duration,
    volume,
    isMuted,
    isLoading,
    shuffle,
    repeat,
    pause,
    resume,
    seek,
    next,
    previous,
    setVolume,
    toggleMute,
    setPosition,
    setIsPlaying,
    toggleShuffle,
    cycleRepeat,
    // Video state
    videoMode,
    currentVideo,
    isVideoPlaying,
    videoPosition,
    videoDuration,
    isVideoLoading,
    setVideoPlaying,
    closeVideo
  } = usePlayerStore();

  // Determine if video is active (takes priority over audio)
  const isVideoActive = videoMode !== 'off' && currentVideo !== null;

  // Unified state - use video state when video is active
  const unifiedIsPlaying = isVideoActive ? isVideoPlaying : isPlaying;
  const unifiedPosition = isVideoActive ? videoPosition * 1000 : position; // video is in seconds, audio in ms
  const unifiedDuration = isVideoActive ? videoDuration * 1000 : duration;
  const unifiedIsLoading = isVideoActive ? isVideoLoading : isLoading;

  const { isQueueOpen, toggleQueue, expandPlayer, isLyricsPanelOpen, toggleLyricsPanel } = useUIStore();
  const { recordListen } = useRecommendationStore();
  const { openAlbum, openArtist } = useNavigationStore();
  const { showContextMenu } = useTrackContextMenu();

  // Resolve artwork (handles embedded artwork from local files)
  const { artworkUrl } = useArtwork(currentTrack);
  const [artworkError, setArtworkError] = useState(false);

  // Reset artwork error when track changes
  useEffect(() => {
    setArtworkError(false);
  }, [currentTrack?.id]);

  // Capture audio element ref after mount
  const audioRefCallback = useCallback((node: HTMLAudioElement | null) => {
    audioRef.current = node;
    setAudioElement(node);
  }, []);


  // Track listen start time for analytics
  const listenStartRef = useRef<number>(0);
  const lastTrackIdRef = useRef<string | null>(null);

  // Safe play function that handles promises correctly
  const safePlay = useCallback(async (audio: HTMLAudioElement) => {
    // Wait for any pending play to complete
    if (playPromiseRef.current) {
      try {
        await playPromiseRef.current;
      } catch {
        // Previous play was interrupted, which is fine
      }
    }

    playPromiseRef.current = audio.play();
    try {
      await playPromiseRef.current;
    } catch (error) {
      // AbortError is expected when play is interrupted
      if ((error as Error).name !== 'AbortError') {
        console.error('Audio playback error:', error);
      }
    }
    playPromiseRef.current = null;
  }, []);

  // Safe pause function
  const safePause = useCallback(async (audio: HTMLAudioElement) => {
    // Wait for any pending play to complete before pausing
    if (playPromiseRef.current) {
      try {
        await playPromiseRef.current;
      } catch {
        // Ignore - play was interrupted
      }
      playPromiseRef.current = null;
    }
    audio.pause();
  }, []);

  // Sync audio element with store state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying && currentTrack?.streamInfo) {
      safePlay(audio);
    } else {
      safePause(audio);
    }
  }, [isPlaying, currentTrack?.streamInfo, safePlay, safePause]);

  // Update volume
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Load new track - only when URL changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.streamInfo) return;

    const targetUrl = currentTrack.streamInfo.url;

    // Only set src when URL actually changes
    if (audio.src !== targetUrl) {
      const wasPlaying = !audio.paused;
      audio.src = targetUrl;
      if (isPlaying || wasPlaying) {
        safePlay(audio);
      }
    }
  }, [currentTrack?.streamInfo?.url, isPlaying, safePlay]);

  // Track listening analytics
  useEffect(() => {
    if (currentTrack) {
      // Record previous track listen if switching tracks
      if (lastTrackIdRef.current && lastTrackIdRef.current !== currentTrack.id) {
        const listenDuration = Date.now() - listenStartRef.current;
        const prevTrack = lastTrackIdRef.current;
        // Note: We'd need the previous track object here for full implementation
        // For now, we'll record on track end (handleEnded)
      }

      // Start tracking new track
      listenStartRef.current = Date.now();
      lastTrackIdRef.current = currentTrack.id;
    }
  }, [currentTrack?.id]);

  // Handle time update from audio element
  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setPosition(audioRef.current.currentTime * 1000);
    }
  }, [setPosition]);

  // Sync audio element when position is changed externally (e.g., from lyrics click)
  const lastSyncedPosition = useRef<number>(0);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Check if position changed significantly from what audio is playing
    // This indicates an external seek (from lyrics, etc.)
    const audioPosition = audio.currentTime * 1000;
    const positionDiff = Math.abs(position - audioPosition);

    // If difference is more than 500ms, it's likely an external seek
    if (positionDiff > 500 && Math.abs(position - lastSyncedPosition.current) > 100) {
      audio.currentTime = position / 1000;
      lastSyncedPosition.current = position;
    }
  }, [position]);

  // Handle track end
  const handleEnded = useCallback(() => {
    // Record completed listen
    if (currentTrack) {
      const listenDuration = Date.now() - listenStartRef.current;
      recordListen(currentTrack, listenDuration, true, false);
    }
    next();
  }, [next, currentTrack, recordListen]);

  // Handle errors
  const handleError = useCallback(() => {
    setIsPlaying(false);
    console.error('Audio playback error');
  }, [setIsPlaying]);

  // Unified seek handler (for progress bar) - defined before updateProgress which uses it
  const handleUnifiedSeek = useCallback((newPositionMs: number) => {
    if (isVideoActive) {
      // Video position is in seconds, we receive ms
      // Dispatch event to sync with VideoPlayerModal
      window.dispatchEvent(new CustomEvent('audiio:video-seek', { detail: { position: newPositionMs / 1000 } }));
    } else {
      seek(newPositionMs);
      if (audioRef.current) {
        audioRef.current.currentTime = newPositionMs / 1000;
      }
    }
  }, [isVideoActive, seek]);

  // Progress bar dragging
  const progressBarRef = useRef<HTMLDivElement>(null);
  const isDraggingProgress = useRef(false);

  const updateProgress = useCallback((clientX: number) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newPosition = percent * unifiedDuration;
    handleUnifiedSeek(newPosition);
  }, [unifiedDuration, handleUnifiedSeek]);

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

  // Volume slider dragging
  const volumeBarRef = useRef<HTMLDivElement>(null);
  const isDraggingVolume = useRef(false);

  const updateVolume = useCallback((clientX: number) => {
    if (!volumeBarRef.current) return;
    const rect = volumeBarRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setVolume(percent);
  }, [setVolume]);

  const handleVolumeMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    isDraggingVolume.current = true;
    updateVolume(e.clientX);

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingVolume.current) {
        updateVolume(e.clientX);
      }
    };

    const handleMouseUp = () => {
      isDraggingVolume.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [updateVolume]);

  // Format time
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Unified progress using video or audio based on what's active
  const progressPercent = unifiedDuration > 0 ? (unifiedPosition / unifiedDuration) * 100 : 0;

  // Unified play/pause handler
  const handlePlayPause = useCallback(() => {
    if (isVideoActive) {
      setVideoPlaying(!isVideoPlaying);
    } else {
      if (isPlaying) {
        pause();
      } else {
        resume();
      }
    }
  }, [isVideoActive, isVideoPlaying, isPlaying, setVideoPlaying, pause, resume]);

  const { isLiked, toggleLike } = useLibraryStore();
  const trackIsLiked = currentTrack ? isLiked(currentTrack.id) : false;
  const [isDislikeModalOpen, setIsDislikeModalOpen] = useState(false);

  const handleNotForMe = useCallback(() => {
    if (currentTrack) {
      setIsDislikeModalOpen(true);
    }
  }, [currentTrack]);

  const handleDislikeModalClose = useCallback(() => {
    setIsDislikeModalOpen(false);
    next();
  }, [next]);

  // These hooks must be before the early return to satisfy React's rules of hooks
  const handleGoToAlbum = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentTrack?.album) {
      openAlbum(currentTrack.album.id, {
        id: currentTrack.album.id,
        title: currentTrack.album.title,
        artist: currentTrack.artists[0]?.name || 'Unknown Artist',
        artwork: currentTrack.album.artwork?.medium,
        source: currentTrack.source
      });
    }
  }, [currentTrack, openAlbum]);

  const handleGoToArtist = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const primaryArtist = currentTrack?.artists[0];
    if (primaryArtist) {
      openArtist(primaryArtist.id, {
        id: primaryArtist.id,
        name: primaryArtist.name,
        image: currentTrack?.artwork?.medium,
        source: currentTrack?.source || 'unknown'
      });
    }
  }, [currentTrack, openArtist]);

  const VolumeIcon = isMuted || volume === 0 ? VolumeMuteIcon : volume < 0.5 ? VolumeLowIcon : VolumeHighIcon;

  // Show player if we have either a track or an active video
  if (!currentTrack && !isVideoActive) {
    return (
      <div className="player">
        <div className="player-empty">
          <MusicNoteIcon size={20} />
          <span>Select a track to play</span>
        </div>
      </div>
    );
  }

  const artistNames = currentTrack?.artists.map(a => a.name).join(', ') || '';

  // Display info - video title when video is active, track title otherwise
  const displayTitle = isVideoActive ? currentVideo?.title : currentTrack?.title;
  const displayArtist = isVideoActive ? 'Video' : artistNames;
  const displayArtwork = isVideoActive ? currentVideo?.thumbnail : artworkUrl;

  return (
    <div className="player">
      <audio
        ref={audioRefCallback}
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleError}
      />

      {/* Track Info */}
      <div
        className={`player-track ${isVideoActive ? 'video-active' : ''}`}
        onClick={isVideoActive ? undefined : expandPlayer}
        onContextMenu={currentTrack ? (e) => showContextMenu(e, currentTrack) : undefined}
        role="button"
        tabIndex={0}
      >
        {displayArtwork && !artworkError ? (
          <img
            className="player-artwork"
            src={displayArtwork}
            alt={displayTitle || 'Now playing'}
            onError={() => setArtworkError(true)}
          />
        ) : (
          <div className="player-artwork player-artwork-placeholder">
            <MusicNoteIcon size={24} />
          </div>
        )}
        <div className="player-track-info">
          <div
            className={`player-track-title ${!isVideoActive && currentTrack?.album ? 'clickable' : ''}`}
            onClick={!isVideoActive && currentTrack?.album ? handleGoToAlbum : undefined}
            title={!isVideoActive && currentTrack?.album ? `Go to ${currentTrack.album.title}` : undefined}
          >
            {displayTitle}
          </div>
          <div
            className={`player-track-artist ${!isVideoActive && currentTrack && currentTrack.artists.length > 0 ? 'clickable' : ''}`}
            onClick={!isVideoActive && currentTrack && currentTrack.artists.length > 0 ? handleGoToArtist : undefined}
            title={!isVideoActive && currentTrack?.artists?.[0] ? `Go to ${currentTrack.artists[0].name}` : undefined}
          >
            {displayArtist}
          </div>
        </div>
        {!isVideoActive && currentTrack && (
          <>
            <button
              className={`player-like-button ${trackIsLiked ? 'liked' : ''}`}
              onClick={(e) => { e.stopPropagation(); toggleLike(currentTrack); }}
              title={trackIsLiked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
            >
              {trackIsLiked ? <HeartIcon size={18} /> : <HeartOutlineIcon size={18} />}
            </button>
            <button
              className="player-dislike-button"
              onClick={(e) => { e.stopPropagation(); handleNotForMe(); }}
              title="Not for me"
            >
              <ThumbDownIcon size={18} />
            </button>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="player-controls">
        <div className="player-buttons">
          {!isVideoActive && (
            <button
              className={`player-button small ${shuffle ? 'active' : ''}`}
              onClick={toggleShuffle}
              title={shuffle ? 'Disable shuffle' : 'Enable shuffle'}
            >
              <ShuffleIcon size={18} />
            </button>
          )}
          {isVideoActive && (
            <button
              className="player-button small"
              onClick={closeVideo}
              title="Close video"
            >
              <CloseIcon size={18} />
            </button>
          )}
          <button className="player-button" onClick={isVideoActive ? undefined : previous} disabled={isVideoActive} title="Previous">
            <PrevIcon size={20} />
          </button>
          <button
            className="player-button play"
            onClick={handlePlayPause}
            disabled={unifiedIsLoading}
            title={unifiedIsPlaying ? 'Pause' : 'Play'}
          >
            {unifiedIsLoading ? (
              <span className="player-loading" />
            ) : unifiedIsPlaying ? (
              <PauseIcon size={24} />
            ) : (
              <PlayIcon size={24} />
            )}
          </button>
          <button className="player-button" onClick={isVideoActive ? undefined : next} disabled={isVideoActive} title="Next">
            <NextIcon size={20} />
          </button>
          {!isVideoActive && (
            <button
              className={`player-button small ${repeat !== 'off' ? 'active' : ''}`}
              onClick={cycleRepeat}
              title={repeat === 'off' ? 'Enable repeat' : repeat === 'all' ? 'Repeat one' : 'Disable repeat'}
            >
              {repeat === 'one' ? <RepeatOneIcon size={18} /> : <RepeatIcon size={18} />}
            </button>
          )}
        </div>

        <div className="progress-container">
          <span className="progress-time">{formatTime(unifiedPosition)}</span>
          <div className="progress-bar" ref={progressBarRef} onMouseDown={handleProgressMouseDown}>
            <div
              className="progress-bar-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="progress-time">{formatTime(unifiedDuration)}</span>
        </div>
      </div>

      {/* Volume & Extra Controls */}
      <div className="player-extra">
        <button
          className={`player-button small ${isLyricsPanelOpen ? 'active' : ''}`}
          onClick={toggleLyricsPanel}
          title="Lyrics"
        >
          <LyricsIcon size={18} />
        </button>
        <button
          className={`player-button small ${isQueueOpen ? 'active' : ''}`}
          onClick={(e) => toggleQueue(e.currentTarget.getBoundingClientRect())}
          title="Queue"
        >
          <QueueIcon size={18} />
        </button>
        <div className="player-volume">
          <button className="player-button small" onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
            <VolumeIcon size={18} />
          </button>
          <div className="volume-slider" ref={volumeBarRef} onMouseDown={handleVolumeMouseDown}>
            <div
              className="volume-slider-fill"
              style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Dislike Modal - rendered via portal to avoid z-index issues */}
      {isDislikeModalOpen && currentTrack && createPortal(
        <DislikeModal
          track={currentTrack}
          onClose={handleDislikeModalClose}
        />,
        document.body
      )}
    </div>
  );
};
