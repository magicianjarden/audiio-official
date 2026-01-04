import React, { useState, useMemo } from 'react';
import { useLibraryStore, LibraryTrack } from '../../stores/library-store';
import { usePlayerStore } from '../../stores/player-store';
import { useRecommendationStore, DISLIKE_REASONS } from '../../stores/recommendation-store';
import { TrackRow } from '../TrackRow/TrackRow';
import { LibraryActionBar, SortOption, FilterOption } from './LibraryActionBar';
import { ThumbDownIcon, CloseIcon } from '@audiio/icons';
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

export const DislikesView: React.FC = () => {
  const { dislikedTracks, undislikeTrack } = useLibraryStore();
  const { play, setQueue, currentTrack } = usePlayerStore();
  const { getDislikeReasons, removeDislike } = useRecommendationStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [filterReason, setFilterReason] = useState<string>('all');

  const filterOptions: FilterOption[] = [
    { value: 'all', label: 'All Reasons' },
    ...DISLIKE_REASONS.map(r => ({ value: r.value, label: r.label })),
  ];

  const getReasonLabels = (trackId: string): string[] => {
    const reasons = getDislikeReasons(trackId);
    if (!reasons) return [];
    return reasons.map(reason =>
      DISLIKE_REASONS.find(r => r.value === reason)?.label || reason
    );
  };

  const filteredAndSortedTracks = useMemo(() => {
    let libraryTracks = [...dislikedTracks];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      libraryTracks = libraryTracks.filter(lt =>
        lt.track.title.toLowerCase().includes(query) ||
        lt.track.artists.some(a => a.name.toLowerCase().includes(query))
      );
    }

    // Filter by reason
    if (filterReason && filterReason !== 'all') {
      libraryTracks = libraryTracks.filter(lt => {
        const reasons = getDislikeReasons(lt.track.id);
        return reasons?.includes(filterReason as any);
      });
    }

    // Sort tracks
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
    }

    return libraryTracks;
  }, [dislikedTracks, searchQuery, sortBy, filterReason, getDislikeReasons]);

  // Extract just the tracks for playback
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

  const handleUndislike = (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeDislike(trackId);
    undislikeTrack(trackId);
  };

  return (
    <div className="library-view">
      <header className="library-header">
        <div className="library-header-icon dislikes-icon"><ThumbDownIcon size={64} /></div>
        <div className="library-header-info">
          <span className="library-header-type">Collection</span>
          <h1 className="library-header-title">Disliked Songs</h1>
          <span className="library-header-count">{dislikedTracks.length} songs</span>
        </div>
      </header>

      {dislikedTracks.length > 0 && (
        <LibraryActionBar
          onPlay={handlePlayAll}
          onShuffle={handleShuffle}
          disablePlay={tracks.length === 0}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search disliked songs..."
          sortOptions={SORT_OPTIONS}
          currentSort={sortBy}
          onSortChange={setSortBy}
          filterOptions={filterOptions}
          currentFilter={filterReason}
          onFilterChange={setFilterReason}
          filterLabel="Reason"
          totalCount={dislikedTracks.length}
          filteredCount={filteredAndSortedTracks.length}
        />
      )}

      <div className="library-content">
        {dislikedTracks.length === 0 ? (
          <div className="library-empty">
            <div className="library-empty-icon"><ThumbDownIcon size={48} /></div>
            <h3>Songs you dislike will appear here</h3>
            <p>Dislike songs to help improve your recommendations</p>
          </div>
        ) : filteredAndSortedTracks.length === 0 ? (
          <div className="library-empty">
            <div className="library-empty-icon"><ThumbDownIcon size={48} /></div>
            <h3>No matching songs</h3>
            <p>Try adjusting your search or filter</p>
          </div>
        ) : (
          <div className="library-track-list">
            {filteredAndSortedTracks.map((libraryTrack, index) => {
              const reasonLabels = getReasonLabels(libraryTrack.track.id);
              return (
                <div key={libraryTrack.track.id} className="dislike-track-item">
                  <TrackRow
                    track={libraryTrack.track}
                    index={index + 1}
                    isPlaying={currentTrack?.id === libraryTrack.track.id}
                    onClick={() => handlePlayTrack(libraryTrack.track, index)}
                  />
                  <div className="dislike-reasons">
                    {reasonLabels.map((label, i) => (
                      <span key={i} className="dislike-reason-tag">{label}</span>
                    ))}
                    <button
                      className="dislike-remove-btn"
                      onClick={(e) => handleUndislike(libraryTrack.track.id, e)}
                      title="Remove from dislikes"
                    >
                      <CloseIcon size={12} />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
