/**
 * TagDetailView - Shows all tracks with a specific tag
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { useNavigationStore } from '../../stores/navigation-store';
import { useTagStore } from '../../stores/tag-store';
import { useLibraryStore } from '../../stores/library-store';
import { usePlayerStore } from '../../stores/player-store';
import { useTrackContextMenu } from '../../contexts/ContextMenuContext';
import { TrackRow } from '../TrackRow/TrackRow';
import { FloatingSearch, SearchAction } from '../Search/FloatingSearch';
import {
  PlayIcon,
  ShuffleIcon,
  TagIcon,
  SortIcon,
} from '@audiio/icons';

type SortValue = 'recent' | 'title' | 'title-desc' | 'artist' | 'artist-desc';

export const TagDetailView: React.FC = () => {
  const { selectedTagName, goBack } = useNavigationStore();
  const { tags, getTracksByTag } = useTagStore();
  const { likedTracks } = useLibraryStore();
  const { playTrackList, currentTrack } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  const [trackIds, setTrackIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortValue>('recent');

  // Find the tag data
  const tag = useMemo(
    () => tags.find(t => t.name === selectedTagName),
    [tags, selectedTagName]
  );

  // Load tracks with this tag
  useEffect(() => {
    if (!selectedTagName) return;

    const loadTracks = async () => {
      setIsLoading(true);
      try {
        const ids = await getTracksByTag(selectedTagName);
        setTrackIds(ids);
      } catch (error) {
        console.error('[TagDetailView] Failed to load tracks:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTracks();
  }, [selectedTagName, getTracksByTag]);

  // Get full track objects from liked tracks (our source of truth for track data)
  const tracks = useMemo(() => {
    // Build a map of all known tracks for quick lookup
    const trackMap = new Map<string, UnifiedTrack>();
    likedTracks.forEach(track => trackMap.set(track.id, track));

    // Return tracks in the order they were tagged
    return trackIds
      .map(id => trackMap.get(id))
      .filter((t): t is UnifiedTrack => t !== undefined);
  }, [trackIds, likedTracks]);

  // Filter and sort tracks
  const filteredTracks = useMemo(() => {
    let result = [...tracks];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(track =>
        track.title.toLowerCase().includes(query) ||
        track.artists.some(a => a.name.toLowerCase().includes(query)) ||
        track.album?.name?.toLowerCase().includes(query)
      );
    }

    // Sort tracks
    switch (sortBy) {
      case 'title':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        result.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'artist':
        result.sort((a, b) => (a.artists[0]?.name || '').localeCompare(b.artists[0]?.name || ''));
        break;
      case 'artist-desc':
        result.sort((a, b) => (b.artists[0]?.name || '').localeCompare(a.artists[0]?.name || ''));
        break;
      // 'recent' keeps the original order
    }

    return result;
  }, [tracks, searchQuery, sortBy]);

  // Search helpers
  const isSearching = searchQuery.trim().length > 0;

  const handleSearchClose = useCallback(() => {
    setSearchQuery('');
  }, []);

  const handlePlayAll = useCallback(() => {
    if (filteredTracks.length === 0) return;
    playTrackList(filteredTracks, 0);
  }, [filteredTracks, playTrackList]);

  const handleShuffle = useCallback(() => {
    if (filteredTracks.length === 0) return;
    const shuffled = [...filteredTracks].sort(() => Math.random() - 0.5);
    playTrackList(shuffled, 0);
  }, [filteredTracks, playTrackList]);

  const handleTrackClick = (_track: UnifiedTrack, index: number) => {
    playTrackList(filteredTracks, index);
  };

  // Build actions for FloatingSearch
  const actions: SearchAction[] = useMemo(() => {
    const result: SearchAction[] = [];

    if (filteredTracks.length > 0) {
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
      icon: <SortIcon size={14} />,
      active: sortBy === 'recent',
      onClick: () => setSortBy('recent'),
    });
    result.push({
      id: 'sort-title',
      label: 'Title',
      icon: <SortIcon size={14} />,
      active: sortBy === 'title' || sortBy === 'title-desc',
      onClick: () => setSortBy(sortBy === 'title' ? 'title-desc' : 'title'),
    });
    result.push({
      id: 'sort-artist',
      label: 'Artist',
      icon: <SortIcon size={14} />,
      active: sortBy === 'artist' || sortBy === 'artist-desc',
      onClick: () => setSortBy(sortBy === 'artist' ? 'artist-desc' : 'artist'),
    });

    return result;
  }, [filteredTracks.length, sortBy, handlePlayAll, handleShuffle]);

  if (!selectedTagName) {
    return (
      <div className="tag-detail-view">
        <div className="tag-detail-empty">
          <TagIcon size={48} />
          <p>No tag selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`tag-detail-view ${isSearching ? 'searching' : ''}`}>
      <FloatingSearch
        onSearch={setSearchQuery}
        onClose={handleSearchClose}
        isSearchActive={isSearching}
        actions={actions}
        pageContext={{
          type: 'tag-detail',
          icon: <TagIcon size={14} />,
        }}
        detailInfo={{
          title: selectedTagName || 'Tag',
          subtitle: isLoading ? 'Loading...' : `${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'}`,
          color: tag?.color,
          icon: <TagIcon size={16} />,
          onBack: goBack,
        }}
      />
      {/* Ambient Background - Tag color gradient */}
      {tag && (
        <div
          className="detail-ambient-bg tag-ambient"
          style={{ background: `radial-gradient(ellipse at top, ${tag.color}80 0%, transparent 70%)` }}
        />
      )}

      {/* Track List */}
      <div className="tag-detail-content">
        {isLoading ? (
          <div className="tag-detail-loading">
            <p>Loading tracks...</p>
          </div>
        ) : tracks.length === 0 ? (
          <div className="tag-detail-empty">
            <TagIcon size={48} />
            <p>No tracks with this tag</p>
            <p className="tag-detail-empty-hint">
              Right-click on tracks and select "Tag Track" to add this tag
            </p>
          </div>
        ) : filteredTracks.length === 0 && isSearching ? (
          <div className="tag-detail-empty">
            <TagIcon size={48} />
            <p>No matching tracks</p>
            <p className="tag-detail-empty-hint">
              Try adjusting your search
            </p>
          </div>
        ) : (
          <div className="tag-detail-tracks">
            {filteredTracks.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index + 1}
                showArtwork
                showAlbum
                isPlaying={currentTrack?.id === track.id}
                onClick={() => handleTrackClick(track, index)}
                onContextMenu={(e) => showContextMenu(e, track)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagDetailView;
