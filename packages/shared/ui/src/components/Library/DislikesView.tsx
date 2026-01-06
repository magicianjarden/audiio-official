import React, { useState, useMemo, useCallback } from 'react';
import { useLibraryStore } from '../../stores/library-store';
import { usePlayerStore } from '../../stores/player-store';
import { useRecommendationStore, DISLIKE_REASONS } from '../../stores/recommendation-store';
import { TrackRow } from '../TrackRow/TrackRow';
import { FloatingSearch, SearchAction } from '../Search/FloatingSearch';
import {
  ThumbDownIcon,
  CloseIcon,
  ClockIcon,
  SortIcon,
  FilterIcon,
} from '@audiio/icons';
import type { Track } from '@audiio/core';

export const DislikesView: React.FC = () => {
  const { dislikedTracks, undislikeTrack } = useLibraryStore();
  const { play, setQueue, currentTrack } = usePlayerStore();
  const { getDislikeReasons, removeDislike } = useRecommendationStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [filterReason, setFilterReason] = useState<string>('all');

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
    if (searchQuery?.trim()) {
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

  const tracks = useMemo(() => filteredAndSortedTracks.map(lt => lt.track), [filteredAndSortedTracks]);

  const handlePlayTrack = (track: Track, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  const handleUndislike = (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeDislike(trackId);
    undislikeTrack(trackId);
  };

  // Build actions for the search bar
  const actions: SearchAction[] = useMemo(() => {
    const result: SearchAction[] = [];

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

    // Filter options
    result.push({
      id: 'filter-all',
      label: 'All',
      icon: <FilterIcon size={14} />,
      active: filterReason === 'all',
      onClick: () => setFilterReason('all'),
    });

    return result;
  }, [sortBy, filterReason]);

  const isSearching = searchQuery.trim().length > 0;

  const handleClose = useCallback(() => {
    setSearchQuery('');
  }, []);

  return (
    <div className={`library-view dislikes-view ${isSearching ? 'searching' : ''}`}>
      <FloatingSearch
        onSearch={setSearchQuery}
        onClose={handleClose}
        isSearchActive={isSearching}
        actions={actions}
        pageContext={{
          type: 'dislikes',
          label: 'Disliked Songs',
          icon: <ThumbDownIcon size={14} />,
        }}
      />

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
