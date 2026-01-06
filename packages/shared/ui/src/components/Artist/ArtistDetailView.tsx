/**
 * ArtistDetailView - Apple + Spotify Hybrid Design
 * Features: Large hero section, simplified layout, clean aesthetic
 * Layout: Hero -> Popular Tracks -> Discography -> Similar Artists
 * Now includes adaptive enrichment sections from installed plugins
 */

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useNavigationStore } from '../../stores/navigation-store';
import { usePlayerStore } from '../../stores/player-store';
import { useArtistStore } from '../../stores/artist-store';
import { useLibraryStore } from '../../stores/library-store';
import { useSmartQueueStore, type RadioSeed } from '../../stores/smart-queue-store';
import { useSearchStore } from '../../stores/search-store';
import { useTrackContextMenu, useAlbumContextMenu } from '../../contexts/ContextMenuContext';
import { showSuccessToast } from '../../stores/toast-store';
import { FloatingSearch, type SearchAction } from '../Search/FloatingSearch';
import { MusicNoteIcon, PlayIcon, ShuffleIcon, RadioIcon } from '@audiio/icons';
import { getColorsForArtwork, getDefaultColors, type ExtractedColors } from '../../utils/color-extraction';
import { useArtistEnrichment } from '../../hooks/useArtistEnrichment';
import { CollapsibleSection } from './CollapsibleSection';
import {
  MusicVideosSection,
  ConcertsSection,
  SetlistsSection,
  TimelineSection,
  GallerySection,
  MerchandiseSection
} from './sections';
import type { UnifiedTrack, MusicVideo } from '@audiio/core';
import type { SearchAlbum } from '../../stores/search-store';

type DiscographyTab = 'albums' | 'singles' | 'eps';

// Verified badge component (minimal style)
const VerifiedBadge: React.FC = () => (
  <div className="artist-verified-badge-minimal">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
    <span>Verified</span>
  </div>
);

// Stat box component for bento grid
const StatBox: React.FC<{
  value: string | number;
  label: string;
  accent?: boolean;
}> = ({ value, label, accent }) => (
  <div className={`artist-stat-box ${accent ? 'accent' : ''}`}>
    <span className="stat-value">{value}</span>
    <span className="stat-label">{label}</span>
  </div>
);

// Pill tab button for discography
const PillTab: React.FC<{
  label: string;
  isActive: boolean;
  onClick: () => void;
  count?: number;
}> = ({ label, isActive, onClick, count }) => (
  <button
    className={`discography-pill-tab ${isActive ? 'active' : ''}`}
    onClick={onClick}
    role="tab"
    aria-selected={isActive}
  >
    {label}
    {count !== undefined && count > 0 && (
      <span className="pill-tab-count">{count}</span>
    )}
  </button>
);

// Album card for horizontal scroll (minimal design)
const AlbumCard: React.FC<{
  album: SearchAlbum;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}> = ({ album, onClick, onContextMenu }) => (
  <div
    className="album-card-minimal"
    onClick={onClick}
    onContextMenu={onContextMenu}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => e.key === 'Enter' && onClick()}
  >
    <div className="album-card-minimal-artwork">
      {album.artwork ? (
        <img src={album.artwork} alt={album.title} loading="lazy" />
      ) : (
        <div className="album-card-minimal-placeholder">
          <MusicNoteIcon size={32} />
        </div>
      )}
      <div className="album-card-minimal-play">
        <PlayIcon size={20} />
      </div>
    </div>
    <span className="album-card-minimal-title">{album.title}</span>
    {album.year && (
      <span className="album-card-minimal-year">{album.year}</span>
    )}
  </div>
);

// Circular artist card for Similar Artists
const SimilarArtistCard: React.FC<{
  artist: { id: string; name: string; image?: string };
  onClick?: () => void;
}> = ({ artist, onClick }) => (
  <div
    className="similar-artist-card-circular"
    onClick={onClick}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
  >
    <div className="similar-artist-image-circular">
      {artist.image ? (
        <img src={artist.image} alt={artist.name} loading="lazy" />
      ) : (
        <div className="similar-artist-placeholder-circular">
          <MusicNoteIcon size={32} />
        </div>
      )}
    </div>
    <span className="similar-artist-name">{artist.name}</span>
  </div>
);

export const ArtistDetailView: React.FC = () => {
  const { selectedArtistId, selectedArtistData, goBack, openAlbum, openArtist, setSearchQuery, setSearchActive } = useNavigationStore();
  const { play, setQueue, currentTrack, playVideo } = usePlayerStore();
  const { likedTracks } = useLibraryStore();
  const { startRadio } = useSmartQueueStore();
  const { fetchArtist, getArtist, loadingArtistId, error } = useArtistStore();
  const { showContextMenu: showTrackContextMenu } = useTrackContextMenu();
  const { showContextMenu: showAlbumContextMenu } = useAlbumContextMenu();
  const { search } = useSearchStore();

  // Global search redirect
  const handleSearch = useCallback((query: string) => {
    if (query.trim()) {
      setSearchQuery(query);
      setSearchActive(true);
      search(query);
    }
  }, [search, setSearchQuery, setSearchActive]);

  const [colors, setColors] = useState<ExtractedColors>(getDefaultColors());
  const [activeTab, setActiveTab] = useState<DiscographyTab>('albums');
  const discographyScrollRef = useRef<HTMLDivElement>(null);
  const similarArtistsScrollRef = useRef<HTMLDivElement>(null);

  // Get artist data
  const artistDetail = getArtist(selectedArtistId || '');
  const artist = artistDetail || selectedArtistData;
  const isLoading = loadingArtistId === selectedArtistId;

  // Fetch enrichment data from plugins (adaptive - only shows if plugins installed)
  const enrichment = useArtistEnrichment(artistDetail?.name || selectedArtistData?.name, {
    enabled: !isLoading && !!(artistDetail?.name || selectedArtistData?.name),
    mbid: artistDetail?.mbid,
  });

  // Extract colors from artwork
  useEffect(() => {
    if (artist?.image) {
      getColorsForArtwork(artist.image).then(setColors);
    }
  }, [artist?.image]);

  // Fetch artist data when ID changes
  useEffect(() => {
    if (selectedArtistId && selectedArtistData?.name) {
      fetchArtist(selectedArtistId, selectedArtistData.name, {
        image: selectedArtistData.image,
        followers: selectedArtistData.followers,
        source: selectedArtistData.source
      });
    }
  }, [selectedArtistId, selectedArtistData?.name]);

  // Reset tab when artist changes
  useEffect(() => {
    setActiveTab('albums');
  }, [selectedArtistId]);

  if (!selectedArtistId) {
    return (
      <div className="artist-detail-view-spotify">
        <div className="artist-not-found">
          <p>Artist not found</p>
          <button onClick={goBack}>Go Back</button>
        </div>
      </div>
    );
  }

  const handlePlayAll = useCallback(() => {
    if (artistDetail?.topTracks && artistDetail.topTracks.length > 0) {
      const firstTrack = artistDetail.topTracks[0];
      setQueue(artistDetail.topTracks, 0);
      if (firstTrack) play(firstTrack);
    }
  }, [artistDetail?.topTracks, setQueue, play]);

  const handleShufflePlay = useCallback(() => {
    if (artistDetail?.topTracks && artistDetail.topTracks.length > 0) {
      const shuffled = [...artistDetail.topTracks].sort(() => Math.random() - 0.5);
      const firstTrack = shuffled[0];
      setQueue(shuffled, 0);
      if (firstTrack) play(firstTrack);
    }
  }, [artistDetail?.topTracks, setQueue, play]);

  const handleStartRadio = useCallback(async () => {
    const artistName = artistDetail?.name || selectedArtistData?.name || 'Artist';
    const artistId = artistDetail?.id || selectedArtistId || '';
    const seed: RadioSeed = {
      type: 'artist',
      id: artistId,
      name: `${artistName} Radio`,
      artwork: artistDetail?.image,
      artistIds: [artistId],
      genres: artistDetail?.genres,
    };
    await startRadio(seed, [...likedTracks, ...(artistDetail?.topTracks || [])]);
    showSuccessToast(`Started ${artistName} Radio`);
  }, [artistDetail, selectedArtistData, selectedArtistId, startRadio, likedTracks]);

  // Build actions for FloatingSearch
  const actions: SearchAction[] = useMemo(() => {
    const result: SearchAction[] = [];
    if (artistDetail?.topTracks?.length) {
      result.push({
        id: 'play',
        label: 'Play',
        icon: <PlayIcon size={14} />,
        shortcut: 'P',
        primary: true,
        onClick: handlePlayAll,
      });
      result.push({
        id: 'shuffle',
        label: 'Shuffle',
        icon: <ShuffleIcon size={14} />,
        shortcut: 'S',
        primary: true,
        onClick: handleShufflePlay,
      });
    }
    result.push({
      id: 'radio',
      label: 'Radio',
      icon: <RadioIcon size={14} />,
      shortcut: 'R',
      onClick: handleStartRadio,
    });
    return result;
  }, [artistDetail?.topTracks?.length, handlePlayAll, handleShufflePlay, handleStartRadio]);

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    if (artistDetail?.topTracks) {
      setQueue(artistDetail.topTracks, index);
      play(track);
    }
  };

  const handleAlbumClick = (album: SearchAlbum) => {
    openAlbum(album.id, album);
  };

  const handleSimilarArtistClick = (similarArtist: { id: string; name: string; image?: string }) => {
    openArtist(similarArtist.id, {
      id: similarArtist.id,
      name: similarArtist.name,
      image: similarArtist.image,
      source: artistDetail?.source
    });
  };

  const handleVideoClick = (video: MusicVideo) => {
    // Open video in floating player
    playVideo(video);
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFollowers = (count?: number): string => {
    if (!count) return '';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M followers`;
    if (count >= 1000) return `${Math.floor(count / 1000)}K followers`;
    return `${count} followers`;
  };

  // Get content for current discography tab
  const getDiscographyContent = (): SearchAlbum[] => {
    switch (activeTab) {
      case 'albums':
        return artistDetail?.albums || [];
      case 'singles':
        return artistDetail?.singles || [];
      case 'eps':
        return artistDetail?.eps || [];
      default:
        return [];
    }
  };

  const discographyContent = getDiscographyContent();

  // Check if tabs have content
  const albumsCount = artistDetail?.albums?.length || 0;
  const singlesCount = artistDetail?.singles?.length || 0;
  const epsCount = artistDetail?.eps?.length || 0;
  const hasDiscography = albumsCount > 0 || singlesCount > 0 || epsCount > 0;

  return (
    <div
      className="artist-detail-view-spotify"
      style={{
        '--ambient-color': colors.dominant,
        '--ambient-muted': colors.muted,
        '--ambient-vibrant': colors.vibrant
      } as React.CSSProperties}
    >
      {/* Floating Search Bar with Detail Info */}
      <FloatingSearch
        onSearch={handleSearch}
        onClose={() => {}}
        isSearchActive={false}
        actions={actions}
        detailInfo={{
          title: artist?.name || 'Artist',
          subtitle: artistDetail?.genres?.slice(0, 2).join(', '),
          artwork: artist?.image,
          onBack: goBack,
        }}
      />

      {/* ===== SPLIT MAGAZINE HEADER ===== */}
      <div className="artist-header-magazine">
        {/* Ambient Background */}
        <div className="artist-header-ambient" />

        {/* Split Content */}
        <div className="artist-header-split">
          {/* Left: Artist Image */}
          <div className="artist-header-image-container">
            {artist?.image ? (
              <img
                className="artist-header-image"
                src={artist.image}
                alt={artist?.name || 'Artist'}
              />
            ) : (
              <div className="artist-header-image-placeholder">
                <MusicNoteIcon size={80} />
              </div>
            )}
          </div>

          {/* Right: Info */}
          <div className="artist-header-info">
            {/* Verified + Artist Type */}
            <div className="artist-header-meta">
              {artistDetail?.verified && (
                <span className="artist-verified-pill">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                  Verified
                </span>
              )}
              <span className="artist-type-label">Artist</span>
            </div>

            {/* Artist Name */}
            <h1 className="artist-name-magazine">{artist?.name || 'Unknown Artist'}</h1>

            {/* Genre Tags */}
            {artistDetail?.genres && artistDetail.genres.length > 0 && (
              <div className="artist-genres-magazine">
                {artistDetail.genres.slice(0, 3).map(genre => (
                  <span key={genre} className="artist-genre-tag">{genre}</span>
                ))}
              </div>
            )}

            {/* Bio Excerpt */}
            {artistDetail?.bio && (
              <p className="artist-bio-excerpt">
                {artistDetail.bio.length > 150
                  ? `${artistDetail.bio.substring(0, 150)}...`
                  : artistDetail.bio}
              </p>
            )}

            {/* Stats Row */}
            <div className="artist-stats-row">
              {artistDetail?.followers && artistDetail.followers > 0 && (
                <div className="artist-stat">
                  <span className="artist-stat-value">{formatFollowers(artistDetail.followers).replace(' followers', '')}</span>
                  <span className="artist-stat-label">Followers</span>
                </div>
              )}
              {artistDetail?.topTracks && artistDetail.topTracks.length > 0 && (
                <div className="artist-stat">
                  <span className="artist-stat-value">{artistDetail.topTracks.length}</span>
                  <span className="artist-stat-label">Top Tracks</span>
                </div>
              )}
              {albumsCount > 0 && (
                <div className="artist-stat">
                  <span className="artist-stat-value">{albumsCount}</span>
                  <span className="artist-stat-label">Albums</span>
                </div>
              )}
              {singlesCount > 0 && (
                <div className="artist-stat">
                  <span className="artist-stat-value">{singlesCount}</span>
                  <span className="artist-stat-label">Singles</span>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ===== CONTENT SECTIONS ===== */}
      <div className="artist-content-spotify">
        {/* ===== LATEST RELEASE SECTION (within last year) ===== */}
        {artistDetail?.latestRelease && (
          <section className="artist-section-latest-release">
            <h2 className="section-title-spotify">Latest Release</h2>
            <div
              className="latest-release-card"
              onClick={() => handleAlbumClick(artistDetail.latestRelease!)}
              onContextMenu={(e) => showAlbumContextMenu(e, artistDetail.latestRelease!)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleAlbumClick(artistDetail.latestRelease!)}
            >
              <div className="latest-release-artwork">
                {artistDetail.latestRelease.artwork ? (
                  <img src={artistDetail.latestRelease.artwork} alt={artistDetail.latestRelease.title} />
                ) : (
                  <div className="latest-release-artwork-placeholder">
                    <MusicNoteIcon size={48} />
                  </div>
                )}
                <span className="latest-release-badge">NEW</span>
                <div className="latest-release-play">
                  <PlayIcon size={28} />
                </div>
              </div>
              <div className="latest-release-info">
                <span className="latest-release-title">{artistDetail.latestRelease.title}</span>
                <span className="latest-release-meta">
                  {artistDetail.latestRelease.year}
                  {artistDetail.latestRelease.trackCount && ` • ${artistDetail.latestRelease.trackCount} songs`}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* ===== POPULAR TRACKS SECTION ===== */}
        <section className="artist-section-popular">
          <h2 className="section-title-spotify">Popular</h2>

          <div className="popular-tracks-list">
            {isLoading ? (
              <div className="popular-tracks-loading">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="track-row-skeleton skeleton" />
                ))}
              </div>
            ) : error ? (
              <p className="section-error">{error}</p>
            ) : artistDetail?.topTracks && artistDetail.topTracks.length > 0 ? (
              artistDetail.topTracks.slice(0, 5).map((track, index) => (
                <div
                  key={track.id}
                  className={`track-row-clean ${currentTrack?.id === track.id ? 'playing' : ''}`}
                  onClick={() => handleTrackClick(track, index)}
                  onContextMenu={(e) => showTrackContextMenu(e, track)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleTrackClick(track, index)}
                >
                  {/* Track Number / Play Icon */}
                  <div className="track-number-cell">
                    <span className="track-number">{index + 1}</span>
                    <span className="track-play-icon">
                      <PlayIcon size={16} />
                    </span>
                  </div>

                  {/* Artwork Thumbnail */}
                  <div className="track-artwork-cell">
                    {track.artwork?.small ? (
                      <img src={track.artwork.small} alt={track.title} />
                    ) : (
                      <div className="track-artwork-placeholder">
                        <MusicNoteIcon size={16} />
                      </div>
                    )}
                  </div>

                  {/* Title + Album */}
                  <div className="track-info-cell">
                    <span className="track-title-clean">{track.title}</span>
                    {track.album && (
                      <span className="track-album-clean">{track.album.title}</span>
                    )}
                  </div>

                  {/* Explicit Badge */}
                  {track.explicit && (
                    <span className="explicit-badge-small">E</span>
                  )}

                  {/* Duration */}
                  <span className="track-duration-cell">
                    {formatDuration(track.duration)}
                  </span>
                </div>
              ))
            ) : (
              <p className="section-placeholder">No tracks available</p>
            )}
          </div>
        </section>

        {/* ===== DISCOGRAPHY SECTION ===== */}
        {hasDiscography && (
          <section className="artist-section-discography">
            <h2 className="section-title-spotify">Discography</h2>

            {/* Pill-style Tabs */}
            <div className="discography-tabs-pills" role="tablist">
              {albumsCount > 0 && (
                <PillTab
                  label="Albums"
                  isActive={activeTab === 'albums'}
                  onClick={() => setActiveTab('albums')}
                  count={albumsCount}
                />
              )}
              {singlesCount > 0 && (
                <PillTab
                  label="Singles"
                  isActive={activeTab === 'singles'}
                  onClick={() => setActiveTab('singles')}
                  count={singlesCount}
                />
              )}
              {epsCount > 0 && (
                <PillTab
                  label="EPs"
                  isActive={activeTab === 'eps'}
                  onClick={() => setActiveTab('eps')}
                  count={epsCount}
                />
              )}
            </div>

            {/* Horizontal Scroll Album Cards */}
            <div className="discography-scroll-container" ref={discographyScrollRef}>
              {isLoading ? (
                <div className="discography-scroll-loading">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="album-card-skeleton skeleton" />
                  ))}
                </div>
              ) : discographyContent.length > 0 ? (
                <div className="discography-scroll">
                  {discographyContent.map(album => (
                    <AlbumCard
                      key={album.id}
                      album={album}
                      onClick={() => handleAlbumClick(album)}
                      onContextMenu={(e) => showAlbumContextMenu(e, album)}
                    />
                  ))}
                </div>
              ) : (
                <p className="section-placeholder">No {activeTab} found</p>
              )}
            </div>
          </section>
        )}

        {/* ===== APPEARS ON SECTION ===== */}
        {artistDetail?.appearsOn && artistDetail.appearsOn.length > 0 && (
          <section className="artist-section-appears-on">
            <h2 className="section-title-spotify">Appears On</h2>
            <div className="discography-scroll-container">
              <div className="discography-scroll">
                {artistDetail.appearsOn.map(album => (
                  <AlbumCard
                    key={album.id}
                    album={album}
                    onClick={() => handleAlbumClick(album)}
                    onContextMenu={(e) => showAlbumContextMenu(e, album)}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ===== SIMILAR ARTISTS SECTION ===== */}
        {artistDetail?.similarArtists && artistDetail.similarArtists.length > 0 && (
          <section className="artist-section-similar">
            <h2 className="section-title-spotify">Fans Also Like</h2>

            <div className="similar-artists-scroll-container" ref={similarArtistsScrollRef}>
              <div className="similar-artists-scroll">
                {artistDetail.similarArtists.map(similarArtist => (
                  <SimilarArtistCard
                    key={similarArtist.id}
                    artist={similarArtist}
                    onClick={() => handleSimilarArtistClick(similarArtist)}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ===== ENRICHMENT SECTIONS (Adaptive - only show if plugins provide data) ===== */}

        {/* Upcoming Concerts */}
        {(enrichment.loading.concerts || enrichment.data.concerts.length > 0) && (
          <CollapsibleSection
            title="Upcoming Shows"
            sectionId={`artist-concerts-${selectedArtistId}`}
            className="artist-section-enrichment"
            loading={enrichment.loading.concerts}
          >
            <ConcertsSection concerts={enrichment.data.concerts} />
          </CollapsibleSection>
        )}

        {/* Music Videos */}
        {(enrichment.loading.videos || enrichment.data.videos.length > 0) && (
          <CollapsibleSection
            title="Music Videos"
            sectionId={`artist-videos-${selectedArtistId}`}
            className="artist-section-enrichment"
            loading={enrichment.loading.videos}
          >
            <MusicVideosSection
              videos={enrichment.data.videos}
              onVideoClick={handleVideoClick}
            />
          </CollapsibleSection>
        )}

        {/* Timeline */}
        {(enrichment.loading.timeline || enrichment.data.timeline.length > 0) && (
          <CollapsibleSection
            title="Timeline"
            sectionId={`artist-timeline-${selectedArtistId}`}
            className="artist-section-enrichment"
            loading={enrichment.loading.timeline}
          >
            <TimelineSection timeline={enrichment.data.timeline} />
          </CollapsibleSection>
        )}

        {/* Gallery */}
        {(enrichment.loading.gallery || enrichment.data.gallery) && (
          <CollapsibleSection
            title="Gallery"
            sectionId={`artist-gallery-${selectedArtistId}`}
            className="artist-section-enrichment"
            loading={enrichment.loading.gallery}
          >
            {enrichment.data.gallery && (
              <GallerySection gallery={enrichment.data.gallery} />
            )}
          </CollapsibleSection>
        )}

        {/* Recent Setlists */}
        {(enrichment.loading.setlists || enrichment.data.setlists.length > 0) && (
          <CollapsibleSection
            title="Recent Setlists"
            sectionId={`artist-setlists-${selectedArtistId}`}
            className="artist-section-enrichment"
            loading={enrichment.loading.setlists}
          >
            <SetlistsSection setlists={enrichment.data.setlists} />
          </CollapsibleSection>
        )}

        {/* Merchandise */}
        {(enrichment.loading.merchandise || enrichment.data.merchandiseUrl) && (
          <CollapsibleSection
            title="Merchandise"
            sectionId={`artist-merch-${selectedArtistId}`}
            className="artist-section-enrichment"
            loading={enrichment.loading.merchandise}
          >
            {enrichment.data.merchandiseUrl && (
              <MerchandiseSection
                merchandiseUrl={enrichment.data.merchandiseUrl}
                artistName={artistDetail?.name || selectedArtistData?.name || 'Artist'}
              />
            )}
          </CollapsibleSection>
        )}

        {/* ===== ABOUT SECTION (Bio) ===== */}
        {artistDetail?.bio && (
          <section className="artist-section-about">
            <h2 className="section-title-spotify">About</h2>
            <div className="artist-about-card">
              {artist?.image && (
                <div className="artist-about-image">
                  <img src={artist.image} alt={artist.name} />
                </div>
              )}
              <div className="artist-about-content">
                <p className="artist-bio-text">{artistDetail.bio}</p>

                {/* External Links */}
                {artistDetail.externalUrls && Object.keys(artistDetail.externalUrls).length > 0 && (
                  <div className="artist-external-links">
                    {artistDetail.externalUrls.spotify && (
                      <a
                        href={artistDetail.externalUrls.spotify}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="artist-external-link"
                      >
                        Spotify
                      </a>
                    )}
                    {artistDetail.externalUrls.instagram && (
                      <a
                        href={artistDetail.externalUrls.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="artist-external-link"
                      >
                        Instagram
                      </a>
                    )}
                    {artistDetail.externalUrls.twitter && (
                      <a
                        href={artistDetail.externalUrls.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="artist-external-link"
                      >
                        Twitter
                      </a>
                    )}
                    {artistDetail.externalUrls.website && (
                      <a
                        href={artistDetail.externalUrls.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="artist-external-link"
                      >
                        Website
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default ArtistDetailView;
