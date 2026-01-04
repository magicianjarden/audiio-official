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
import { getAccentColor } from '../../../utils/theme-utils';
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

// Simple color extraction - average RGB from image
async function extractDominantColor(imageUrl: string): Promise<string> {
  const fallbackColor = getAccentColor();
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 50;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(fallbackColor);
          return;
        }
        ctx.drawImage(img, 0, 0, 50, 50);
        const data = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i]!;
          g += data[i + 1]!;
          b += data[i + 2]!;
        }
        const pixels = data.length / 4;
        resolve(`rgb(${Math.round(r / pixels)}, ${Math.round(g / pixels)}, ${Math.round(b / pixels)})`);
      } catch {
        resolve(fallbackColor);
      }
    };
    img.onerror = () => resolve(fallbackColor);
    img.src = imageUrl;
  });
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
  const [ambientColor, setAmbientColor] = useState<string>('var(--accent-primary)');
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

  // Extract ambient color from artwork
  useEffect(() => {
    if (artworkUrl) {
      extractDominantColor(artworkUrl).then(setAmbientColor);
    } else {
      setAmbientColor('var(--accent-primary)');
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
      className={`discover-hero-section discover-hero-section--centered ${isVisible ? 'is-visible' : ''} ${isThisMixRadio ? 'is-radio-active' : ''}`}
      style={{ '--ambient-color': ambientColor } as React.CSSProperties}
      onContextMenu={featuredTrack ? (e) => showContextMenu(e, featuredTrack) : undefined}
    >
      {isLoading ? (
        <div className="hero-skeleton hero-skeleton--centered">
          <div className="hero-skeleton-artwork hero-skeleton-artwork--centered" />
          <div className="hero-skeleton-info hero-skeleton-info--centered">
            <div className="hero-skeleton-badge" />
            <div className="hero-skeleton-title" />
            <div className="hero-skeleton-subtitle" />
            <div className="hero-skeleton-actions" />
          </div>
        </div>
      ) : showEmptyState ? (
        <div className="hero-content hero-content--centered">
          <div className="hero-artwork hero-artwork--centered">
            <div className="hero-artwork-placeholder">
              <MusicNoteIcon size={80} />
            </div>
          </div>
          <div className="hero-info hero-info--centered">
            <h1 className="hero-title hero-title--centered">{title}</h1>
            <p className="hero-subtitle hero-subtitle--centered">Discover new music</p>
          </div>
        </div>
      ) : (
        <>
          {/* Subtle ambient background - blurred artwork with low opacity */}
          <div
            className="hero-ambient-bg hero-ambient-bg--subtle"
            style={{ backgroundImage: artworkUrl ? `url(${artworkUrl})` : 'none' }}
          />

          {/* Centered content layout */}
          <div className="hero-content hero-content--centered">
            {/* Large artwork with soft glow */}
            <div className="hero-artwork hero-artwork--centered">
              {artworkUrl ? (
                <img src={artworkUrl} alt={featuredTrack?.title} />
              ) : (
                <div className="hero-artwork-placeholder">
                  <MusicNoteIcon size={80} />
                </div>
              )}
              {/* Radio indicator overlay */}
              {isThisMixRadio && (
                <div className="hero-radio-indicator">
                  <RadioIcon size={24} />
                  <span className="radio-pulse" />
                </div>
              )}
            </div>

            {/* Info section below artwork */}
            <div className="hero-info hero-info--centered">
              {isPersonalized && (
                <span className="hero-badge hero-badge--centered">
                  {isThisMixRadio ? 'Live Radio' : 'Made for You'}
                </span>
              )}
              <h1 className="hero-title hero-title--centered">{displayTitle}</h1>
              {displaySubtitle && <p className="hero-subtitle hero-subtitle--centered">{displaySubtitle}</p>}

              {/* Track count indicator */}
              <div className="hero-track-info">
                <span>{tracks.length} tracks</span>
                <span className="hero-dot">•</span>
                <span>Updates as you listen</span>
              </div>

              {/* Pill-style action buttons */}
              <div className="hero-actions hero-actions--centered">
                <button className="hero-play-btn hero-play-btn--pill" onClick={handlePlay}>
                  <PlayIcon size={20} />
                  <span>Play</span>
                </button>
                <button className="hero-shuffle-btn hero-shuffle-btn--pill" onClick={handleShuffle}>
                  <ShuffleIcon size={18} />
                  <span>Shuffle</span>
                </button>
                <button
                  className={`hero-radio-btn hero-radio-btn--pill ${isThisMixRadio ? 'active' : ''}`}
                  onClick={handleStartRadio}
                  title="Start endless personalized radio"
                >
                  <RadioIcon size={18} />
                  <span>Radio</span>
                </button>
                <button
                  className="hero-refresh-btn"
                  onClick={handleRefresh}
                  title="Refresh mix"
                >
                  <RefreshIcon size={16} />
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
