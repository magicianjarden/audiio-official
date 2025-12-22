/**
 * PlaylistCarouselSection - Horizontal swipeable carousel of playlist cards
 * Features user playlists and curated playlists with cover collages
 */

import React, { useRef, useState } from 'react';
import { useNavigationStore } from '../../../stores/navigation-store';
import { useLibraryStore } from '../../../stores/library-store';
import { BaseSectionWrapper } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import { PlayIcon, ChevronLeftIcon, ChevronRightIcon, MusicNoteIcon } from '../../Icons/Icons';

export interface PlaylistData {
  id: string;
  name: string;
  description?: string;
  trackCount: number;
  coverUrls: string[]; // Up to 4 for collage
  isUserPlaylist?: boolean;
}

export interface PlaylistCarouselSectionProps extends BaseSectionProps {
  playlists?: PlaylistData[];
}

// Default curated playlists when user has none
const CURATED_PLAYLISTS: PlaylistData[] = [
  {
    id: 'curated-chill',
    name: 'Chill Vibes',
    description: 'Relax and unwind',
    trackCount: 50,
    coverUrls: [],
    isUserPlaylist: false,
  },
  {
    id: 'curated-workout',
    name: 'Workout Mix',
    description: 'Get pumped up',
    trackCount: 45,
    coverUrls: [],
    isUserPlaylist: false,
  },
  {
    id: 'curated-focus',
    name: 'Focus Flow',
    description: 'Stay productive',
    trackCount: 40,
    coverUrls: [],
    isUserPlaylist: false,
  },
  {
    id: 'curated-party',
    name: 'Party Hits',
    description: 'Turn it up',
    trackCount: 60,
    coverUrls: [],
    isUserPlaylist: false,
  },
  {
    id: 'curated-throwback',
    name: 'Throwback',
    description: 'Nostalgic favorites',
    trackCount: 55,
    coverUrls: [],
    isUserPlaylist: false,
  },
];

export const PlaylistCarouselSection: React.FC<PlaylistCarouselSectionProps> = ({
  id,
  title,
  subtitle,
  isPersonalized,
  context,
  playlists: propPlaylists,
  onSeeAll,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { setView, setPlaylistId } = useNavigationStore();
  const { playlists: userPlaylists } = useLibraryStore();
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Convert user playlists to PlaylistData format
  const convertedUserPlaylists: PlaylistData[] = userPlaylists.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    trackCount: p.trackIds.length,
    coverUrls: [], // Would need to fetch track artwork
    isUserPlaylist: true,
  }));

  // Use provided playlists, user playlists, or curated
  const playlists = propPlaylists ??
    (convertedUserPlaylists.length > 0 ? convertedUserPlaylists : CURATED_PLAYLISTS);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  };

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 320; // Card width + gap
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const handlePlaylistClick = (playlist: PlaylistData) => {
    if (playlist.isUserPlaylist) {
      setPlaylistId(playlist.id);
      setView('playlist-detail');
    } else {
      // For curated playlists, could navigate to a search or special view
      console.log('Open curated playlist:', playlist.id);
    }
  };

  if (playlists.length === 0) {
    return null;
  }

  return (
    <BaseSectionWrapper
      id={id}
      type="playlist-carousel"
      title={title}
      subtitle={subtitle}
      isPersonalized={isPersonalized}
      context={context}
      onSeeAll={onSeeAll}
      className="playlist-carousel-section"
    >
      <div className="carousel-container">
        {/* Left scroll button */}
        <button
          className={`carousel-nav carousel-nav--left ${!canScrollLeft ? 'hidden' : ''}`}
          onClick={() => scroll('left')}
          disabled={!canScrollLeft}
        >
          <ChevronLeftIcon size={24} />
        </button>

        {/* Scrollable playlist cards */}
        <div
          ref={scrollRef}
          className="carousel-scroll"
          onScroll={handleScroll}
        >
          {playlists.map((playlist, index) => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              index={index}
              onClick={() => handlePlaylistClick(playlist)}
            />
          ))}
        </div>

        {/* Right scroll button */}
        <button
          className={`carousel-nav carousel-nav--right ${!canScrollRight ? 'hidden' : ''}`}
          onClick={() => scroll('right')}
          disabled={!canScrollRight}
        >
          <ChevronRightIcon size={24} />
        </button>
      </div>
    </BaseSectionWrapper>
  );
};

interface PlaylistCardProps {
  playlist: PlaylistData;
  index: number;
  onClick: () => void;
}

const PlaylistCard: React.FC<PlaylistCardProps> = ({ playlist, index, onClick }) => {
  const hasCovers = playlist.coverUrls.length > 0;

  return (
    <div
      className="playlist-card"
      onClick={onClick}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="playlist-card-cover">
        {hasCovers ? (
          <PlaylistCoverCollage covers={playlist.coverUrls} />
        ) : (
          <PlaylistCoverGradient name={playlist.name} />
        )}

        <div className="playlist-card-overlay">
          <button className="playlist-card-play">
            <PlayIcon size={32} />
          </button>
        </div>
      </div>

      <div className="playlist-card-info">
        <h3 className="playlist-card-name">{playlist.name}</h3>
        {playlist.description && (
          <p className="playlist-card-description">{playlist.description}</p>
        )}
        <span className="playlist-card-count">
          {playlist.trackCount} tracks
        </span>
      </div>

      {playlist.isUserPlaylist && (
        <span className="playlist-card-badge">Your Playlist</span>
      )}
    </div>
  );
};

// Collage of up to 4 album covers
const PlaylistCoverCollage: React.FC<{ covers: string[] }> = ({ covers }) => {
  const displayCovers = covers.slice(0, 4);

  if (displayCovers.length === 1) {
    return <img src={displayCovers[0]} alt="Playlist cover" className="cover-single" />;
  }

  return (
    <div className={`cover-collage cover-collage--${Math.min(displayCovers.length, 4)}`}>
      {displayCovers.map((url, i) => (
        <img key={i} src={url} alt="" />
      ))}
    </div>
  );
};

// Gradient placeholder with playlist initial
const PlaylistCoverGradient: React.FC<{ name: string }> = ({ name }) => {
  // Generate consistent gradient based on name
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue1 = hash % 360;
  const hue2 = (hash * 2) % 360;

  return (
    <div
      className="cover-gradient"
      style={{
        background: `linear-gradient(135deg, hsl(${hue1}, 70%, 50%) 0%, hsl(${hue2}, 70%, 40%) 100%)`,
      }}
    >
      <MusicNoteIcon size={48} />
    </div>
  );
};

export default PlaylistCarouselSection;
