import React, { useState, useMemo, useCallback } from 'react';
import { useLibraryStore } from '../../stores/library-store';
import { usePlayerStore } from '../../stores/player-store';
import { useTrackContextMenu } from '../../contexts/ContextMenuContext';
import { TrackRow } from '../TrackRow/TrackRow';
import { FloatingSearch, SearchAction } from '../Search/FloatingSearch';
import {
  HeartIcon,
  HeartOutlineIcon,
  PlayIcon,
  ShuffleIcon,
  SortIcon,
  ClockIcon,
} from '@audiio/icons';
import type { Track } from '@audiio/core';

export const LikesView: React.FC = () => {
  const { likedTracks } = useLibraryStore();
  const { play, setQueue, shuffle, currentTrack } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');

  const filteredAndSortedTracks = useMemo(() => {
    let libraryTracks = [...likedTracks];

    // Filter by search query
    if (searchQuery?.trim()) {
      const query = searchQuery.toLowerCase();
      libraryTracks = libraryTracks.filter(lt =>
        lt.track.title.toLowerCase().includes(query) ||
        lt.track.artists.some(a => a.name.toLowerCase().includes(query)) ||
        lt.track.album?.name?.toLowerCase().includes(query)
      );
    }

    // Sort
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
      case 'artist':
        libraryTracks.sort((a, b) => {
          const artistA = a.track.artists[0]?.name || '';
          const artistB = b.track.artists[0]?.name || '';
          return artistA.localeCompare(artistB);
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

  const handlePlayAll = useCallback(() => {
    if (tracks.length > 0) {
      setQueue(tracks, 0);
      play(tracks[0]);
    }
  }, [tracks, setQueue, play]);

  const handleShuffle = useCallback(() => {
    if (tracks.length > 0) {
      shuffle();
      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
      setQueue(shuffled, 0);
      play(shuffled[0]);
    }
  }, [tracks, setQueue, play, shuffle]);

  // Build actions for the search bar
  const actions: SearchAction[] = useMemo(() => {
    const result: SearchAction[] = [];

    if (tracks.length > 0) {
      result.push({
        id: 'play',
        label: 'Play All',
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
        onClick: handleShuffle,
      });
    }

    // Sort options
    result.push({
      id: 'sort-recent',
      label: 'Recent',
      icon: <ClockIcon size={14} />,
      active: sortBy === 'recent',
      onClick: () => setSortBy('recent'),
    });
    result.push({
      id: 'sort-title',
      label: 'Title',
      icon: <SortIcon size={14} />,
      active: sortBy === 'title',
      onClick: () => setSortBy('title'),
    });
    result.push({
      id: 'sort-artist',
      label: 'Artist',
      icon: <SortIcon size={14} />,
      active: sortBy === 'artist',
      onClick: () => setSortBy('artist'),
    });

    return result;
  }, [tracks.length, sortBy, handlePlayAll, handleShuffle]);

  const isSearching = searchQuery.trim().length > 0;

  const handleClose = useCallback(() => {
    setSearchQuery('');
  }, []);

  return (
    <div className={`library-view likes-view ${isSearching ? 'searching' : ''}`}>
      {/* Floating search bar - same design as Discover */}
      <FloatingSearch
        onSearch={setSearchQuery}
        onClose={handleClose}
        isSearchActive={isSearching}
        actions={actions}
        pageContext={{
          type: 'likes',
          label: 'Liked Songs',
          icon: <HeartIcon size={14} />,
        }}
      />

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
