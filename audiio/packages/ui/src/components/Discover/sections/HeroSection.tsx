/**
 * HeroSection - Made For You / Ever-Evolving Radio
 *
 * Centered layout with ambient glow, clean typography, and pill-style buttons.
 * Uses ML ranking for personalized featured content that evolves as you listen.
 * Integrates with Smart Queue for seamless radio mode.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { usePlayerStore } from '../../../stores/player-store';
import { useSmartQueueStore, useRadioState } from '../../../stores/smart-queue-store';
import { useRecommendationStore } from '../../../stores/recommendation-store';
import { useLibraryStore } from '../../../stores/library-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { useMLRanking } from '../../../hooks';
import { PlayIcon, ShuffleIcon, MusicNoteIcon, RadioIcon, RefreshIcon } from '../../Icons/Icons';

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
          resolve('#1db954');
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
        resolve('#1db954');
      }
    };
    img.onerror = () => resolve('#1db954');
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
  const { userProfile } = useRecommendationStore();
  const { likedTracks } = useLibraryStore();
  const { showContextMenu } = useTrackContextMenu();
  const { rankTracks } = useMLRanking();

  const [tracks, setTracks] = useState<UnifiedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [ambientColor, setAmbientColor] = useState<string>('var(--accent-primary)');
  const [isVisible, setIsVisible] = useState(false);

  // Track listening activity to trigger refreshes
  const listenCountRef = useRef(userProfile.totalListens);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if this mix is currently playing as radio
  const isThisMixRadio = isRadioMode && radioSeed?.type === 'genre' && radioSeed.name === 'Made For You';

  // Fetch and rank tracks for the hero section
  const fetchHeroTracks = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      let fetchedTracks: UnifiedTrack[] = [];
      const allCandidates: UnifiedTrack[] = [];

      // Source 1: User's liked tracks (familiar content)
      if (likedTracks.length > 0) {
        allCandidates.push(...likedTracks.slice(0, 30));
      }

      // Source 2: API recommendations based on user preferences
      if (window.api?.getRecommendedTracks) {
        const topGenres = Object.entries(userProfile.genrePreferences)
          .sort((a, b) => (b[1] as any).score - (a[1] as any).score)
          .slice(0, 2)
          .map(([genre]) => genre);

        const topArtists = Object.entries(userProfile.artistPreferences)
          .sort((a, b) => (b[1] as any).score - (a[1] as any).score)
          .slice(0, 2)
          .map(([_, pref]) => (pref as any).artistName);

        // Get recommendations from top genres
        for (const genre of topGenres) {
          try {
            const recs = await window.api.getRecommendedTracks('genre', genre);
            if (recs?.length > 0) {
              allCandidates.push(...recs.slice(0, 15));
            }
          } catch { /* ignore */ }
        }

        // Get recommendations from top artists
        for (const artist of topArtists) {
          if (artist) {
            try {
              const recs = await window.api.getRecommendedTracks('artist', artist);
              if (recs?.length > 0) {
                allCandidates.push(...recs.slice(0, 10));
              }
            } catch { /* ignore */ }
          }
        }
      }

      // Source 3: Trending for discovery
      if (window.api?.getTrending) {
        try {
          const trending = await window.api.getTrending();
          if (trending?.tracks?.length > 0) {
            allCandidates.push(...trending.tracks.slice(0, 15).map(track => ({
              ...track,
              streamSources: [],
              _meta: {
                metadataProvider: track._provider || 'hero',
                matchConfidence: 1,
                externalIds: track.externalIds || {},
                lastUpdated: new Date()
              }
            })) as UnifiedTrack[]);
          }
        } catch { /* ignore */ }
      }

      // Source 4: Search fallback
      if (allCandidates.length < 10 && window.api?.search) {
        const searchQuery = query ||
          (context?.topArtists?.[0] ? `${context.topArtists[0]} best songs` : 'top hits 2024 popular');
        try {
          const results = await window.api.search({ query: searchQuery, type: 'track' });
          if (results?.length > 0) {
            allCandidates.push(...results.slice(0, 20));
          }
        } catch { /* ignore */ }
      }

      // Deduplicate
      const seen = new Set<string>();
      fetchedTracks = allCandidates.filter(t => {
        if (!t?.id || seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });

      if (fetchedTracks.length === 0) {
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      // Apply ML ranking - balanced exploration for evolving mix
      // Use more exploration on refreshes to keep things fresh
      const ranked = await rankTracks(fetchedTracks, {
        enabled: true,
        explorationMode: isRefresh ? 'balanced' : 'exploit',
        limit: 20,
        shuffle: true,
        shuffleIntensity: isRefresh ? 0.3 : 0.15 // More variety on refresh
      });

      setTracks(ranked.map(r => r.track));
    } catch (error) {
      console.error('[HeroSection] Failed to fetch:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [query, context?.topArtists, rankTracks, likedTracks, userProfile]);

  // Initial fetch
  useEffect(() => {
    fetchHeroTracks(false);
  }, [fetchHeroTracks]);

  // Auto-refresh when user listens to more tracks (evolving behavior)
  useEffect(() => {
    // Only refresh if listen count increased significantly
    const listenDiff = userProfile.totalListens - listenCountRef.current;

    if (listenDiff >= 5) {
      // User has listened to 5+ more tracks, refresh the mix
      console.log('[HeroSection] Evolving mix - refreshing after', listenDiff, 'new listens');
      listenCountRef.current = userProfile.totalListens;

      // Debounce refresh
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = setTimeout(() => {
        fetchHeroTracks(true);
      }, 2000);
    }

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [userProfile.totalListens, fetchHeroTracks]);

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

    // Combine liked tracks with current mix for radio candidates (deduplicate by id)
    const seenIds = new Set<string>();
    const candidates = [...tracks, ...likedTracks].filter(t => {
      if (seenIds.has(t.id)) return false;
      seenIds.add(t.id);
      return true;
    });
    await startRadio(seed, candidates);
  }, [tracks, userProfile, artworkUrl, likedTracks, startRadio]);

  // Manual refresh
  const handleRefresh = useCallback(() => {
    if (!isRefreshing) {
      fetchHeroTracks(true);
    }
  }, [isRefreshing, fetchHeroTracks]);

  // Show placeholder if empty instead of returning null
  const showEmptyState = !isLoading && tracks.length === 0;

  // Display title changes based on state
  const displayTitle = isThisMixRadio ? 'Made For You Radio' : title;
  const displaySubtitle = isThisMixRadio
    ? 'Endless personalized music'
    : isRefreshing
      ? 'Updating your mix...'
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

          {/* Refresh indicator */}
          {isRefreshing && (
            <div className="hero-refresh-indicator">
              <RefreshIcon size={16} className="spinning" />
            </div>
          )}

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
                  disabled={isRefreshing}
                  title="Refresh mix"
                >
                  <RefreshIcon size={16} className={isRefreshing ? 'spinning' : ''} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        /* ============================================
           HeroSection - Made For You / Ever-Evolving Radio
           Centered layout with ambient glow effects
           Uses CSS variables for full theming support
           ============================================ */

        /* Container - centered flexbox layout */
        .discover-hero-section--centered {
          position: relative;
          width: 100%;
          min-height: 280px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border-radius: var(--radius-xl, 16px);
          background: var(--surface-primary);
          border: 1px solid var(--border-subtle, transparent);
          transition: border-color 0.3s ease;
        }

        /* Radio active state - accent border glow */
        .discover-hero-section--centered.is-radio-active {
          border-color: var(--accent-primary);
          box-shadow: 0 0 20px color-mix(in srgb, var(--accent-primary) 20%, transparent);
        }

        /* Subtle ambient background - LOW opacity */
        .discover-hero-section--centered .hero-ambient-bg--subtle {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          filter: blur(80px) saturate(1.2);
          opacity: 0;
          transform: scale(1.2);
          transition: opacity 0.6s ease-out;
        }

        .discover-hero-section--centered .hero-ambient-bg--subtle::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to bottom,
            color-mix(in srgb, var(--bg-primary) 60%, transparent) 0%,
            color-mix(in srgb, var(--bg-primary) 40%, transparent) 50%,
            color-mix(in srgb, var(--bg-primary) 70%, transparent) 100%
          );
        }

        .discover-hero-section--centered.is-visible .hero-ambient-bg--subtle {
          opacity: 0.25;
        }

        /* Refresh indicator */
        .discover-hero-section--centered .hero-refresh-indicator {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          font-size: 11px;
          color: var(--text-secondary);
          background: color-mix(in srgb, var(--surface-secondary) 80%, transparent);
          border-radius: var(--radius-full, 9999px);
          backdrop-filter: blur(8px);
        }

        /* Centered content layout */
        .discover-hero-section--centered .hero-content--centered {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: var(--spacing-2xl, 32px);
          gap: var(--spacing-lg, 20px);
        }

        /* Compact artwork with soft ambient glow */
        .discover-hero-section--centered .hero-artwork--centered {
          width: 160px;
          height: 160px;
          border-radius: var(--radius-lg, 12px);
          overflow: hidden;
          position: relative;
          opacity: 0;
          transform: translateY(20px) scale(0.95);
          transition: opacity 0.5s ease-out, transform 0.5s ease-out, box-shadow 0.5s ease-out;
          box-shadow:
            0 6px 24px var(--shadow-color, rgba(0, 0, 0, 0.4)),
            0 0 40px var(--ambient-color, var(--accent-primary));
        }

        .discover-hero-section--centered.is-visible .hero-artwork--centered {
          opacity: 1;
          transform: translateY(0) scale(1);
          box-shadow:
            0 8px 32px var(--shadow-color, rgba(0, 0, 0, 0.5)),
            0 0 50px color-mix(in srgb, var(--ambient-color, var(--accent-primary)) 35%, transparent);
        }

        .discover-hero-section--centered .hero-artwork--centered img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .discover-hero-section--centered .hero-artwork-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--surface-secondary);
          color: var(--text-muted);
        }

        /* Radio indicator overlay on artwork */
        .discover-hero-section--centered .hero-radio-indicator {
          position: absolute;
          bottom: 8px;
          right: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: var(--accent-primary);
          color: var(--text-on-accent, #fff);
          border-radius: 50%;
          box-shadow: 0 2px 8px color-mix(in srgb, var(--accent-primary) 50%, transparent);
        }

        .discover-hero-section--centered .hero-radio-indicator .radio-pulse {
          position: absolute;
          inset: -4px;
          border: 2px solid var(--accent-primary);
          border-radius: 50%;
          animation: radio-pulse 1.5s ease-out infinite;
        }

        @keyframes radio-pulse {
          0% {
            transform: scale(1);
            opacity: 0.8;
          }
          100% {
            transform: scale(1.4);
            opacity: 0;
          }
        }

        /* Centered info section */
        .discover-hero-section--centered .hero-info--centered {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-sm, 8px);
          max-width: 400px;
        }

        /* Made for You badge */
        .discover-hero-section--centered .hero-badge--centered {
          display: inline-flex;
          align-items: center;
          padding: 6px 14px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-primary);
          background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--accent-primary) 30%, transparent),
            color-mix(in srgb, var(--accent-primary) 15%, transparent)
          );
          border: 1px solid color-mix(in srgb, var(--accent-primary) 40%, transparent);
          border-radius: var(--radius-full, 9999px);
          backdrop-filter: blur(8px);
          opacity: 0;
          transform: translateY(10px);
          transition: opacity 0.4s ease-out, transform 0.4s ease-out;
        }

        .discover-hero-section--centered.is-visible .hero-badge--centered {
          opacity: 1;
          transform: translateY(0);
          transition-delay: 150ms;
        }

        /* Clean title typography - 24px bold */
        .discover-hero-section--centered .hero-title--centered {
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1.2;
          color: var(--text-primary);
          margin: 0;
          opacity: 0;
          transform: translateY(10px);
          transition: opacity 0.4s ease-out, transform 0.4s ease-out;
        }

        .discover-hero-section--centered.is-visible .hero-title--centered {
          opacity: 1;
          transform: translateY(0);
          transition-delay: 200ms;
        }

        /* Subtitle - 14px muted */
        .discover-hero-section--centered .hero-subtitle--centered {
          font-size: 14px;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.5;
          opacity: 0;
          transform: translateY(10px);
          transition: opacity 0.4s ease-out, transform 0.4s ease-out;
        }

        .discover-hero-section--centered.is-visible .hero-subtitle--centered {
          opacity: 1;
          transform: translateY(0);
          transition-delay: 250ms;
        }

        /* Track info line */
        .discover-hero-section--centered .hero-track-info {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-muted);
          opacity: 0;
          transform: translateY(10px);
          transition: opacity 0.4s ease-out, transform 0.4s ease-out;
        }

        .discover-hero-section--centered.is-visible .hero-track-info {
          opacity: 1;
          transform: translateY(0);
          transition-delay: 275ms;
        }

        .discover-hero-section--centered .hero-dot {
          font-size: 8px;
        }

        /* Pill-style action buttons - horizontal layout */
        .discover-hero-section--centered .hero-actions--centered {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-sm, 12px);
          margin-top: var(--spacing-md, 16px);
          opacity: 0;
          transform: translateY(10px);
          transition: opacity 0.4s ease-out, transform 0.4s ease-out;
          flex-wrap: wrap;
        }

        .discover-hero-section--centered.is-visible .hero-actions--centered {
          opacity: 1;
          transform: translateY(0);
          transition-delay: 300ms;
        }

        /* Play button - pill shape, accent color */
        .discover-hero-section--centered .hero-play-btn--pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 28px;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-on-accent, #fff);
          background: var(--accent-primary);
          border: none;
          border-radius: var(--radius-full, 9999px);
          cursor: pointer;
          transition: all 0.2s ease-out;
          box-shadow: 0 4px 16px color-mix(in srgb, var(--accent-primary) 40%, transparent);
        }

        .discover-hero-section--centered .hero-play-btn--pill:hover {
          transform: scale(1.04);
          filter: brightness(1.1);
          box-shadow: 0 6px 24px color-mix(in srgb, var(--accent-primary) 50%, transparent);
        }

        .discover-hero-section--centered .hero-play-btn--pill:active {
          transform: scale(0.98);
        }

        /* Shuffle button - pill shape, transparent */
        .discover-hero-section--centered .hero-shuffle-btn--pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 24px;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
          background: transparent;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-full, 9999px);
          cursor: pointer;
          transition: all 0.2s ease-out;
        }

        .discover-hero-section--centered .hero-shuffle-btn--pill:hover {
          background: var(--surface-hover);
          border-color: var(--border-hover);
          transform: scale(1.02);
        }

        .discover-hero-section--centered .hero-shuffle-btn--pill:active {
          transform: scale(0.98);
        }

        /* Radio button - pill shape */
        .discover-hero-section--centered .hero-radio-btn--pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 24px;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
          background: transparent;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-full, 9999px);
          cursor: pointer;
          transition: all 0.2s ease-out;
        }

        .discover-hero-section--centered .hero-radio-btn--pill:hover {
          background: var(--surface-hover);
          border-color: var(--accent-primary);
          color: var(--accent-primary);
          transform: scale(1.02);
        }

        .discover-hero-section--centered .hero-radio-btn--pill.active {
          background: color-mix(in srgb, var(--accent-primary) 15%, transparent);
          border-color: var(--accent-primary);
          color: var(--accent-primary);
        }

        .discover-hero-section--centered .hero-radio-btn--pill:active {
          transform: scale(0.98);
        }

        /* Refresh button - icon only */
        .discover-hero-section--centered .hero-refresh-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          padding: 0;
          color: var(--text-muted);
          background: transparent;
          border: 1px solid var(--border-subtle);
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.2s ease-out;
        }

        .discover-hero-section--centered .hero-refresh-btn:hover:not(:disabled) {
          background: var(--surface-hover);
          border-color: var(--border-default);
          color: var(--text-primary);
        }

        .discover-hero-section--centered .hero-refresh-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .discover-hero-section--centered .hero-refresh-btn .spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Skeleton loading state - centered */
        .discover-hero-section--centered .hero-skeleton--centered {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-lg, 20px);
          padding: var(--spacing-2xl, 32px);
        }

        .discover-hero-section--centered .hero-skeleton-artwork--centered {
          width: 160px;
          height: 160px;
          border-radius: var(--radius-lg, 12px);
          background: linear-gradient(
            90deg,
            var(--skeleton-base, rgba(255, 255, 255, 0.05)) 0%,
            var(--skeleton-highlight, rgba(255, 255, 255, 0.1)) 50%,
            var(--skeleton-base, rgba(255, 255, 255, 0.05)) 100%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }

        .discover-hero-section--centered .hero-skeleton-info--centered {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-sm, 8px);
        }

        .discover-hero-section--centered .hero-skeleton-badge {
          width: 100px;
          height: 24px;
          border-radius: var(--radius-full, 9999px);
          background: linear-gradient(
            90deg,
            var(--skeleton-base, rgba(255, 255, 255, 0.05)) 0%,
            var(--skeleton-highlight, rgba(255, 255, 255, 0.1)) 50%,
            var(--skeleton-base, rgba(255, 255, 255, 0.05)) 100%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }

        .discover-hero-section--centered .hero-skeleton-title {
          width: 220px;
          height: 38px;
          border-radius: var(--radius-sm, 6px);
          background: linear-gradient(
            90deg,
            var(--skeleton-base, rgba(255, 255, 255, 0.05)) 0%,
            var(--skeleton-highlight, rgba(255, 255, 255, 0.1)) 50%,
            var(--skeleton-base, rgba(255, 255, 255, 0.05)) 100%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          animation-delay: 0.1s;
        }

        .discover-hero-section--centered .hero-skeleton-subtitle {
          width: 160px;
          height: 20px;
          border-radius: var(--radius-sm, 6px);
          background: linear-gradient(
            90deg,
            var(--skeleton-base, rgba(255, 255, 255, 0.05)) 0%,
            var(--skeleton-highlight, rgba(255, 255, 255, 0.1)) 50%,
            var(--skeleton-base, rgba(255, 255, 255, 0.05)) 100%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          animation-delay: 0.2s;
        }

        .discover-hero-section--centered .hero-skeleton-actions {
          width: 200px;
          height: 44px;
          border-radius: var(--radius-full, 9999px);
          margin-top: var(--spacing-md, 16px);
          background: linear-gradient(
            90deg,
            var(--skeleton-base, rgba(255, 255, 255, 0.05)) 0%,
            var(--skeleton-highlight, rgba(255, 255, 255, 0.1)) 50%,
            var(--skeleton-base, rgba(255, 255, 255, 0.05)) 100%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          animation-delay: 0.3s;
        }

        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* Responsive adjustments */
        @media (max-width: 600px) {
          .discover-hero-section--centered {
            min-height: 260px;
          }

          .discover-hero-section--centered .hero-artwork--centered,
          .discover-hero-section--centered .hero-skeleton-artwork--centered {
            width: 140px;
            height: 140px;
          }

          .discover-hero-section--centered .hero-title--centered {
            font-size: 20px;
          }

          .discover-hero-section--centered .hero-actions--centered {
            gap: 8px;
          }

          .discover-hero-section--centered .hero-play-btn--pill,
          .discover-hero-section--centered .hero-shuffle-btn--pill,
          .discover-hero-section--centered .hero-radio-btn--pill {
            padding: 10px 18px;
            font-size: 13px;
          }

          .discover-hero-section--centered .hero-radio-btn--pill span {
            display: none;
          }

          .discover-hero-section--centered .hero-refresh-btn {
            width: 32px;
            height: 32px;
          }
        }

        @media (max-width: 400px) {
          .discover-hero-section--centered .hero-artwork--centered,
          .discover-hero-section--centered .hero-skeleton-artwork--centered {
            width: 120px;
            height: 120px;
          }

          .discover-hero-section--centered .hero-title--centered {
            font-size: 18px;
          }

          .discover-hero-section--centered .hero-shuffle-btn--pill span,
          .discover-hero-section--centered .hero-play-btn--pill span {
            display: none;
          }

          .discover-hero-section--centered .hero-play-btn--pill,
          .discover-hero-section--centered .hero-shuffle-btn--pill {
            padding: 10px 14px;
          }
        }
      `}</style>
    </section>
  );
};

export default HeroSection;
