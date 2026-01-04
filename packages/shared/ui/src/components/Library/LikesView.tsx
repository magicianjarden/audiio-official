import React, { useState, useMemo } from 'react';
import { useLibraryStore, LibraryTrack } from '../../stores/library-store';
import { usePlayerStore } from '../../stores/player-store';
import { useTrackContextMenu } from '../../contexts/ContextMenuContext';
import { TrackRow } from '../TrackRow/TrackRow';
import { LibraryActionBar, SortOption } from './LibraryActionBar';
import { HeartIcon, HeartOutlineIcon } from '@audiio/icons';
import type { Track } from '@audiio/core';

const SORT_OPTIONS: SortOption[] = [
  { value: 'recent', label: 'Recently Added' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'title', label: 'Title A-Z' },
  { value: 'title-desc', label: 'Title Z-A' },
  { value: 'artist', label: 'Artist A-Z' },
  { value: 'artist-desc', label: 'Artist Z-A' },
];

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
};

export const LikesView: React.FC = () => {
  const { likedTracks } = useLibraryStore();
  const { play, setQueue, currentTrack } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');

  const filteredAndSortedTracks = useMemo(() => {
    let libraryTracks = [...likedTracks];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      libraryTracks = libraryTracks.filter(lt =>
        lt.track.title.toLowerCase().includes(query) ||
        lt.track.artists.some(a => a.name.toLowerCase().includes(query)) ||
        lt.track.album?.name?.toLowerCase().includes(query)
      );
    }

    switch (sortBy) {
      case 'recent':
        libraryTracks.sort((a, b) => b.addedAt - a.addedAt);
        break;
      case 'oldest':
        libraryTracks.sort((a, b) => a.addedAt - b.addedAt);
        break;
      case 'title':
        libraryTracks.sort((a, b) => a.track.title.localeCompare(b.track.title));
        break;
      case 'title-desc':
        libraryTracks.sort((a, b) => b.track.title.localeCompare(a.track.title));
        break;
      case 'artist':
        libraryTracks.sort((a, b) => {
          const artistA = a.track.artists[0]?.name || '';
          const artistB = b.track.artists[0]?.name || '';
          return artistA.localeCompare(artistB);
        });
        break;
      case 'artist-desc':
        libraryTracks.sort((a, b) => {
          const artistA = a.track.artists[0]?.name || '';
          const artistB = b.track.artists[0]?.name || '';
          return artistB.localeCompare(artistA);
        });
        break;
    }

    return libraryTracks;
  }, [likedTracks, searchQuery, sortBy]);

  const tracks = useMemo(() => filteredAndSortedTracks.map(lt => lt.track), [filteredAndSortedTracks]);

  const handlePlayTrack = (track: Track, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      setQueue(tracks, 0);
      play(tracks[0]!);
    }
  };

  const handleShuffle = () => {
    if (tracks.length > 0) {
      const shuffled = shuffleArray(tracks);
      setQueue(shuffled, 0);
      play(shuffled[0]!);
    }
  };

  return (
    <div className="library-view">
      <header className="library-header">
        <div className="library-header-icon likes-icon">
          <HeartIcon size={64} />
        </div>
        <div className="library-header-info">
          <span className="library-header-type">Collection</span>
          <h1 className="library-header-title">Liked Songs</h1>
          <span className="library-header-count">{likedTracks.length} songs</span>
        </div>
      </header>

      {likedTracks.length > 0 && (
        <LibraryActionBar
          onPlay={handlePlayAll}
          onShuffle={handleShuffle}
          disablePlay={tracks.length === 0}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search liked songs..."
          sortOptions={SORT_OPTIONS}
          currentSort={sortBy}
          onSortChange={setSortBy}
          totalCount={likedTracks.length}
          filteredCount={filteredAndSortedTracks.length}
        />
      )}

      <div className="library-content">
        {likedTracks.length === 0 ? (
          <div className="library-empty">
            <div className="library-empty-icon"><HeartOutlineIcon size={48} /></div>
            <h3>Songs you like will appear here</h3>
            <p>Save songs by tapping the heart icon</p>
          </div>
        ) : filteredAndSortedTracks.length === 0 ? (
          <div className="library-empty">
            <div className="library-empty-icon"><HeartOutlineIcon size={48} /></div>
            <h3>No matching songs</h3>
            <p>Try adjusting your search</p>
          </div>
        ) : (
          <div className="library-track-list">
            {filteredAndSortedTracks.map((libraryTrack, index) => (
              <TrackRow
                key={libraryTrack.track.id}
                track={libraryTrack.track}
                index={index + 1}
                isPlaying={currentTrack?.id === libraryTrack.track.id}
                onClick={() => handlePlayTrack(libraryTrack.track, index)}
                onContextMenu={showContextMenu}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
