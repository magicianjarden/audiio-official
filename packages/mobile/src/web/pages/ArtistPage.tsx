/**
 * ArtistPage - Artist detail view for mobile
 *
 * Features:
 * - Parallax sticky header with artwork
 * - Top tracks
 * - Discography tabs (Albums/Singles)
 * - Similar artists
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueueControls } from '../stores/player-store';
import { tunnelFetch } from '../stores/auth-store';
import { TrackList } from '../components/TrackList';
import { StickyHeader } from '../components/StickyHeader';
import { triggerHaptic } from '../utils/haptics';
import {
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
      // setQueue already calls play() internally
      setQueue(artist.topTracks, 0);
    }
  };

  const handleShuffle = () => {
    if (artist?.topTracks && artist.topTracks.length > 0) {
      triggerHaptic('medium');
      const shuffled = [...artist.topTracks].sort(() => Math.random() - 0.5);
      // setQueue already calls play() internally
      setQueue(shuffled, 0);
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

  // Build subtitle from genres
  const subtitle = artist?.genres?.slice(0, 2).join(' • ') || '';

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>
          <SpinnerIcon size={32} />
          <p>Loading artist...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>
          <p>{error}</p>
          <button onClick={fetchArtist}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <StickyHeader
        artwork={artist?.image}
        title={artist?.name || artistName}
        subtitle={subtitle}
        circular
        expandedHeight={340}
      >
        {artist && (
          <div className={styles.content}>
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
          </div>
        )}
      </StickyHeader>
    </div>
  );
}
