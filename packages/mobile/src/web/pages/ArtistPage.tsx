/**
 * ArtistPage - Artist detail view for mobile
 *
 * Features:
 * - Hero header with artwork and stats
 * - Top tracks
 * - Discography tabs (Albums/Singles)
 * - Similar artists
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { usePlayerStore, usePlaybackControls, useQueueControls } from '../stores/player-store';
import { tunnelFetch } from '../stores/auth-store';
import { TrackList } from '../components/TrackList';
import { PullToRefresh } from '../components/PullToRefresh';
import { triggerHaptic } from '../utils/haptics';
import {
  ChevronLeftIcon,
  PlayIcon,
  ShuffleIcon,
  MusicNoteIcon,
  SpinnerIcon
} from '@audiio/icons';
import styles from './ArtistPage.module.css';

interface Artist {
  id: string;
  name: string;
  image?: string;
  followers?: number;
  genres?: string[];
  bio?: string;
  source: string;
  topTracks: any[];
  albums: any[];
  singles: any[];
  similarArtists: Array<{
    id: string;
    name: string;
    image?: string;
  }>;
}

type DiscographyTab = 'albums' | 'singles';

export function ArtistPage() {
  const { artistId } = useParams<{ artistId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [artist, setArtist] = useState<Artist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DiscographyTab>('albums');

  const { setQueue } = useQueueControls();
  const { play } = usePlaybackControls();

  // Get artist name from search params (for initial display)
  const artistName = searchParams.get('name') || '';
  const source = searchParams.get('source') || 'spotify';

  const fetchArtist = useCallback(async () => {
    if (!artistId) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (artistName) params.set('name', artistName);
      if (source) params.set('source', source);

      const response = await tunnelFetch(`/api/artist/${artistId}?${params}`);
      if (!response.ok) {
        throw new Error('Failed to load artist');
      }

      const data = await response.json();
      setArtist(data);
    } catch (err) {
      setError('Could not load artist details');
      console.error('Artist fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [artistId, artistName, source]);

  useEffect(() => {
    fetchArtist();
  }, [fetchArtist]);

  const handlePlayAll = () => {
    if (artist?.topTracks && artist.topTracks.length > 0) {
      triggerHaptic('medium');
      setQueue(artist.topTracks, 0);
      play(artist.topTracks[0]);
    }
  };

  const handleShuffle = () => {
    if (artist?.topTracks && artist.topTracks.length > 0) {
      triggerHaptic('medium');
      const shuffled = [...artist.topTracks].sort(() => Math.random() - 0.5);
      setQueue(shuffled, 0);
      play(shuffled[0]);
    }
  };

  const handleAlbumClick = (album: any) => {
    navigate(`/album/${album.id}?name=${encodeURIComponent(album.title)}&source=${album.source || source}`);
  };

  const handleSimilarArtistClick = (similarArtist: { id: string; name: string }) => {
    navigate(`/artist/${similarArtist.id}?name=${encodeURIComponent(similarArtist.name)}&source=${source}`);
  };

  const formatFollowers = (count?: number): string => {
    if (!count) return '';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${Math.floor(count / 1000)}K`;
    return `${count}`;
  };

  const discographyContent = activeTab === 'albums' ? artist?.albums : artist?.singles;

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          <ChevronLeftIcon size={24} />
        </button>
      </header>

      <PullToRefresh onRefresh={fetchArtist} disabled={isLoading}>
        <div className={styles.content}>
          {isLoading ? (
            <div className={styles.loading}>
              <SpinnerIcon size={32} />
              <p>Loading artist...</p>
            </div>
          ) : error ? (
            <div className={styles.error}>
              <p>{error}</p>
              <button onClick={fetchArtist}>Retry</button>
            </div>
          ) : artist ? (
            <>
              {/* Hero Section */}
              <div className={styles.hero}>
                <div className={styles.artwork}>
                  {artist.image ? (
                    <img src={artist.image} alt={artist.name} />
                  ) : (
                    <div className={styles.artworkPlaceholder}>
                      <MusicNoteIcon size={64} />
                    </div>
                  )}
                </div>

                <h1 className={styles.name}>{artist.name}</h1>

                {/* Genres */}
                {artist.genres && artist.genres.length > 0 && (
                  <div className={styles.genres}>
                    {artist.genres.slice(0, 3).map((genre) => (
                      <span key={genre} className={styles.genre}>{genre}</span>
                    ))}
                  </div>
                )}

                {/* Stats */}
                <div className={styles.stats}>
                  {artist.followers && artist.followers > 0 && (
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{formatFollowers(artist.followers)}</span>
                      <span className={styles.statLabel}>Followers</span>
                    </div>
                  )}
                  {artist.topTracks.length > 0 && (
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{artist.topTracks.length}</span>
                      <span className={styles.statLabel}>Tracks</span>
                    </div>
                  )}
                  {artist.albums?.length > 0 && (
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{artist.albums.length}</span>
                      <span className={styles.statLabel}>Albums</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className={styles.actions}>
                  <button
                    className={styles.playButton}
                    onClick={handlePlayAll}
                    disabled={!artist.topTracks.length}
                  >
                    <PlayIcon size={20} />
                    Play
                  </button>
                  <button
                    className={styles.shuffleButton}
                    onClick={handleShuffle}
                    disabled={!artist.topTracks.length}
                  >
                    <ShuffleIcon size={18} />
                    Shuffle
                  </button>
                </div>
              </div>

              {/* Top Tracks */}
              {artist.topTracks.length > 0 && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Popular</h2>
                  <TrackList tracks={artist.topTracks.slice(0, 5)} showIndex />
                </section>
              )}

              {/* Discography */}
              {((artist.albums?.length || 0) > 0 || (artist.singles?.length || 0) > 0) && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Discography</h2>

                  {/* Tabs */}
                  <div className={styles.tabs}>
                    {artist.albums?.length > 0 && (
                      <button
                        className={`${styles.tab} ${activeTab === 'albums' ? styles.active : ''}`}
                        onClick={() => setActiveTab('albums')}
                      >
                        Albums
                        <span className={styles.tabCount}>{artist.albums.length}</span>
                      </button>
                    )}
                    {artist.singles?.length > 0 && (
                      <button
                        className={`${styles.tab} ${activeTab === 'singles' ? styles.active : ''}`}
                        onClick={() => setActiveTab('singles')}
                      >
                        Singles
                        <span className={styles.tabCount}>{artist.singles.length}</span>
                      </button>
                    )}
                  </div>

                  {/* Album Grid */}
                  <div className={styles.albumScroll}>
                    {discographyContent?.map((album) => (
                      <button
                        key={album.id}
                        className={styles.albumCard}
                        onClick={() => handleAlbumClick(album)}
                      >
                        <div className={styles.albumArtwork}>
                          {album.artwork ? (
                            <img src={album.artwork} alt={album.title} />
                          ) : (
                            <div className={styles.albumPlaceholder}>
                              <MusicNoteIcon size={24} />
                            </div>
                          )}
                        </div>
                        <span className={styles.albumTitle}>{album.title}</span>
                        {album.year && (
                          <span className={styles.albumYear}>{album.year}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Similar Artists */}
              {artist.similarArtists?.length > 0 && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Fans Also Like</h2>
                  <div className={styles.similarScroll}>
                    {artist.similarArtists.map((similar) => (
                      <button
                        key={similar.id}
                        className={styles.similarCard}
                        onClick={() => handleSimilarArtistClick(similar)}
                      >
                        <div className={styles.similarImage}>
                          {similar.image ? (
                            <img src={similar.image} alt={similar.name} />
                          ) : (
                            <div className={styles.similarPlaceholder}>
                              <MusicNoteIcon size={24} />
                            </div>
                          )}
                        </div>
                        <span className={styles.similarName}>{similar.name}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Bio */}
              {artist.bio && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>About</h2>
                  <p className={styles.bio}>{artist.bio}</p>
                </section>
              )}
            </>
          ) : null}
        </div>
      </PullToRefresh>
    </div>
  );
}
