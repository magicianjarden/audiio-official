/**
 * HeroSection - Made For You / Ever-Evolving Radio
 *
 * Centered layout with ambient glow, clean typography, and pill-style buttons.
 * Uses the UNIFIED plugin pipeline for personalized featured content.
 * Integrates with Smart Queue for seamless radio mode.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { usePlayerStore } from '../../../stores/player-store';
import { useSmartQueueStore, useRadioState } from '../../../stores/smart-queue-store';
import { useRecommendationStore } from '../../../stores/recommendation-store';
import { useLibraryStore } from '../../../stores/library-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { usePluginData } from '../../../hooks/usePluginData';
import { PlayIcon, ShuffleIcon, MusicNoteIcon, RadioIcon, RefreshIcon } from '@audiio/icons';
import { getColorsForArtwork, getDefaultColors, type ExtractedColors } from '../../../utils/color-extraction';
import type { StructuredSectionQuery } from '../types';

export interface HeroSectionProps {
  id: string;
  title: string;
  subtitle?: string;
  query?: string;
  isPersonalized?: boolean;
  context?: {
    topArtists?: string[];
    topGenres?: string[];
    isNewUser?: boolean;
  };
}

// Shuffle array using Fisher-Yates algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp;
  }
  return shuffled;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  title,
  subtitle,
  query,
  isPersonalized,
  context,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { startRadio, enableAutoQueue } = useSmartQueueStore();
  const { isRadioMode, seed: radioSeed } = useRadioState();
  // Use getState() pattern - don't subscribe to userProfile to avoid re-renders on every listen
  const recStore = useRecommendationStore;
  const { likedTracks } = useLibraryStore();
  const { showContextMenu } = useTrackContextMenu();

  const [refreshKey, setRefreshKey] = useState(0);
  const [colors, setColors] = useState<ExtractedColors>(getDefaultColors());
  const [isVisible, setIsVisible] = useState(false);

  // Check if this mix is currently playing as radio
  const isThisMixRadio = isRadioMode && radioSeed?.type === 'genre' && radioSeed.name === 'Made For You';

  // Build structured query for the unified pipeline
  const structuredQuery = useMemo((): StructuredSectionQuery => {
    const isNewUser = context?.isNewUser;
    const exploration = 0.15 + (refreshKey * 0.05); // More exploration on refreshes

    return {
      strategy: 'plugin',
      sectionType: 'hero',
      title,
      subtitle,
      embedding: {
        method: isNewUser ? 'discovery' : 'personalized',
        exploration,
      },
      limit: 20,
    };
  }, [title, subtitle, context?.isNewUser, refreshKey]);

  // Use unified plugin pipeline
  const { tracks, isLoading, refetch } = usePluginData(structuredQuery, {
    enabled: true,
    applyMLRanking: true,
    applyTransformers: true,
    limit: 20,
  });

  const featuredTrack = tracks?.[0];
  const artworkUrl = featuredTrack?.artwork?.large || featuredTrack?.artwork?.medium;

  // Extract colors from artwork using shared utility
  useEffect(() => {
    if (artworkUrl) {
      getColorsForArtwork(artworkUrl).then(setColors);
    } else {
      setColors(getDefaultColors());
    }
  }, [artworkUrl]);

  // Trigger stagger animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Play the mix
  const handlePlay = useCallback(() => {
    if (tracks.length > 0 && tracks[0]) {
      setQueue(tracks, 0);
      play(tracks[0]);
      // Enable auto-queue for seamless continuation
      enableAutoQueue();
    }
  }, [tracks, setQueue, play, enableAutoQueue]);

  // Shuffle play the mix
  const handleShuffle = useCallback(() => {
    if (tracks.length > 0) {
      const shuffled = shuffleArray(tracks);
      if (shuffled[0]) {
        setQueue(shuffled, 0);
        play(shuffled[0]);
        enableAutoQueue();
      }
    }
  }, [tracks, setQueue, play, enableAutoQueue]);

  // Start radio mode based on user's preferences
  const handleStartRadio = useCallback(async () => {
    if (tracks.length === 0) return;

    // Get userProfile at call time (not via subscription)
    const userProfile = recStore.getState().userProfile;

    // Get user's top genre for the seed
    const topGenre = Object.entries(userProfile.genrePreferences)
      .sort((a, b) => (b[1] as any).score - (a[1] as any).score)[0];

    const seed = {
      type: 'genre' as const,
      id: topGenre?.[0] || 'pop',
      name: 'Made For You',
      genres: Object.keys(userProfile.genrePreferences).slice(0, 3),
      artwork: artworkUrl
    };

    // Combine liked tracks with current mix for radio candidates
    // NOTE: likedTracks is LibraryTrack[], extract .track
    const seenIds = new Set<string>();
    const likedUnified = likedTracks.map(lt => lt.track);
    const candidates = [...tracks, ...likedUnified].filter(t => {
      if (seenIds.has(t.id)) return false;
      seenIds.add(t.id);
      return true;
    });
    await startRadio(seed, candidates);
  }, [tracks, artworkUrl, likedTracks, startRadio]); // Removed userProfile from deps

  // Manual refresh - increment refresh key to trigger re-generation
  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  // Show placeholder if empty instead of returning null
  const showEmptyState = !isLoading && tracks.length === 0;

  // Display title changes based on state
  const displayTitle = isThisMixRadio ? 'Made For You Radio' : title;
  const displaySubtitle = isThisMixRadio
    ? 'Endless personalized music'
    : subtitle;

  return (
    <section
      className={`discover-hero-section discover-hero-section--ambient-band ${isVisible ? 'is-visible' : ''} ${isThisMixRadio ? 'is-radio-active' : ''}`}
      style={{
        '--ambient-color': colors.dominant,
        '--ambient-vibrant': colors.vibrant,
        '--ambient-muted': colors.muted,
        '--ambient-dark': colors.darkVibrant,
        '--ambient-light': colors.lightVibrant,
      } as React.CSSProperties}
      onContextMenu={featuredTrack ? (e) => showContextMenu(e, featuredTrack) : undefined}
    >
      {isLoading ? (
        <div className="hero-skeleton hero-skeleton--ambient">
          <div className="hero-skeleton-artwork" />
          <div className="hero-skeleton-info">
            <div className="hero-skeleton-badge" />
            <div className="hero-skeleton-title" />
            <div className="hero-skeleton-subtitle" />
            <div className="hero-skeleton-actions" />
          </div>
        </div>
      ) : showEmptyState ? (
        <div className="hero-content hero-content--ambient">
          <div className="hero-artwork">
            <div className="hero-artwork-placeholder">
              <MusicNoteIcon size={64} />
            </div>
          </div>
          <div className="hero-info">
            <h1 className="hero-title">{title}</h1>
            <p className="hero-subtitle">Discover new music</p>
          </div>
        </div>
      ) : (
        <>
          {/* Immersive blurred background */}
          <div className="hero-ambient-backdrop">
            {artworkUrl && <img src={artworkUrl} alt="" className="hero-ambient-image" />}
            <div className="hero-ambient-overlay" />
            <div className="hero-ambient-grain" />
          </div>

          {/* Content container */}
          <div className="hero-content hero-content--ambient">
            {/* Floating artwork with glow */}
            <div className="hero-artwork-container">
              <div className="hero-artwork-glow" />
              <div className="hero-artwork">
                {artworkUrl ? (
                  <img src={artworkUrl} alt={featuredTrack?.title} />
                ) : (
                  <div className="hero-artwork-placeholder">
                    <MusicNoteIcon size={64} />
                  </div>
                )}
                {/* Radio indicator overlay */}
                {isThisMixRadio && (
                  <div className="hero-radio-indicator">
                    <RadioIcon size={20} />
                    <span className="radio-pulse" />
                  </div>
                )}
              </div>
            </div>

            {/* Info section */}
            <div className="hero-info">
              {isPersonalized && (
                <span className="hero-badge">
                  {isThisMixRadio ? 'Live Radio' : 'Made for You'}
                </span>
              )}
              <h1 className="hero-title">{displayTitle}</h1>
              {displaySubtitle && <p className="hero-subtitle">{displaySubtitle}</p>}

              {/* Track count */}
              <div className="hero-meta">
                <span>{tracks.length} tracks</span>
                <span className="hero-dot">•</span>
                <span>Updates as you listen</span>
              </div>

              {/* Action buttons */}
              <div className="hero-actions">
                <button className="pill-btn pill-btn--lg hero-play-btn" onClick={handlePlay}>
                  <PlayIcon size={18} />
                  <span>Play</span>
                </button>
                <button className="pill-btn pill-btn--glass hero-shuffle-btn" onClick={handleShuffle}>
                  <ShuffleIcon size={16} />
                  <span>Shuffle</span>
                </button>
                <button
                  className={`pill-btn pill-btn--glass hero-radio-btn ${isThisMixRadio ? 'active' : ''}`}
                  onClick={handleStartRadio}
                  title="Start endless personalized radio"
                >
                  <RadioIcon size={16} />
                  <span>Radio</span>
                </button>
                <button
                  className="pill-btn pill-btn--glass pill-btn--icon hero-refresh-btn"
                  onClick={handleRefresh}
                  title="Refresh mix"
                >
                  <RefreshIcon size={14} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default HeroSection;
