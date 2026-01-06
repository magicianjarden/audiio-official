import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLibraryStore, isRuleBasedPlaylist, type PlaylistRule, type RuleDefinition } from '../../stores/library-store';
import { useNavigationStore } from '../../stores/navigation-store';
import { usePlayerStore } from '../../stores/player-store';
import { useTrackContextMenu } from '../../contexts/ContextMenuContext';
import { TrackRow } from '../TrackRow/TrackRow';
import { FloatingSearch, SearchAction } from '../Search/FloatingSearch';
import { getColorsForArtwork, getDefaultColors, type ExtractedColors } from '../../utils/color-extraction';
import {
  CloseIcon,
  MusicNoteIcon,
  EditIcon,
  FolderIcon,
  RefreshIcon,
  SparklesIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  PlayIcon,
  ShuffleIcon,
  SortIcon,
  PlaylistIcon,
  ClockIcon,
} from '@audiio/icons';
import type { Track, UnifiedTrack } from '@audiio/core';

type SortValue = 'custom' | 'title' | 'title-desc' | 'artist' | 'artist-desc';

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
};

// Rule Editor Component
interface RuleEditorProps {
  rule: PlaylistRule;
  definitions: RuleDefinition[];
  onUpdate: (data: Partial<PlaylistRule>) => void;
  onRemove: () => void;
}

const RuleEditor: React.FC<RuleEditorProps> = ({ rule, definitions, onUpdate, onRemove }) => {
  const definition = definitions.find(d => d.field === rule.field);
  const operators = definition?.operators || [];

  return (
    <div className="playlist-rule-row">
      <select
        value={rule.field}
        onChange={(e) => onUpdate({ field: e.target.value, value: '' })}
        className="rule-select rule-field"
      >
        {definitions.map(def => (
          <option key={def.field} value={def.field}>{def.label}</option>
        ))}
      </select>

      <select
        value={rule.operator}
        onChange={(e) => onUpdate({ operator: e.target.value })}
        className="rule-select rule-operator"
      >
        {operators.map(op => (
          <option key={op} value={op}>{op.replace(/_/g, ' ')}</option>
        ))}
      </select>

      {definition?.type === 'boolean' ? (
        <select
          value={String(rule.value)}
          onChange={(e) => onUpdate({ value: e.target.value === 'true' })}
          className="rule-select rule-value"
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      ) : definition?.type === 'number' || definition?.type === 'duration' ? (
        <input
          type="number"
          value={String(rule.value || '')}
          onChange={(e) => onUpdate({ value: Number(e.target.value) })}
          className="rule-input rule-value"
          placeholder="Value"
        />
      ) : (
        <input
          type="text"
          value={String(rule.value || '')}
          onChange={(e) => onUpdate({ value: e.target.value })}
          className="rule-input rule-value"
          placeholder="Value"
        />
      )}

      <button className="rule-remove-btn" onClick={onRemove} title="Remove rule">
        <CloseIcon size={14} />
      </button>
    </div>
  );
};

export const PlaylistDetailView: React.FC = () => {
  const { selectedPlaylistId, goBack } = useNavigationStore();
  const {
    playlists,
    renamePlaylist,
    removeFromPlaylist,
    getMediaFolderTracks,
    ruleDefinitions,
    evaluatePlaylistRules,
    previewPlaylistRules,
    addPlaylistRule,
    updatePlaylistRule,
    removePlaylistRule,
    clearPlaylistRules,
    updatePlaylist,
  } = useLibraryStore();
  const { play, setQueue, currentTrack } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortValue>('custom');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [colors, setColors] = useState<ExtractedColors>(getDefaultColors());

  // Rules state
  const [isRulesExpanded, setIsRulesExpanded] = useState(false);
  const [isRulesEditing, setIsRulesEditing] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [previewTracks, setPreviewTracks] = useState<UnifiedTrack[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const playlist = playlists.find(p => p.id === selectedPlaylistId);
  const hasRules = playlist && isRuleBasedPlaylist(playlist);

  // Load tracks for media folder playlists
  useEffect(() => {
    const loadMediaFolderTracks = async () => {
      if (playlist?.isMediaFolder && playlist.localFolderId && playlist.tracks.length === 0) {
        setIsLoadingTracks(true);
        try {
          await getMediaFolderTracks(playlist.localFolderId);
        } catch (error) {
          console.error('[PlaylistDetailView] Failed to load media folder tracks:', error);
        } finally {
          setIsLoadingTracks(false);
        }
      }
    };
    loadMediaFolderTracks();
  }, [playlist?.id, playlist?.isMediaFolder, playlist?.localFolderId, playlist?.tracks.length, getMediaFolderTracks]);

  // Load rule tracks when playlist has rules
  useEffect(() => {
    const loadRuleTracks = async () => {
      if (hasRules && playlist && !playlist.ruleTracks) {
        setIsEvaluating(true);
        try {
          await evaluatePlaylistRules(playlist.id);
        } catch (error) {
          console.error('[PlaylistDetailView] Failed to evaluate rules:', error);
        } finally {
          setIsEvaluating(false);
        }
      }
    };
    loadRuleTracks();
  }, [hasRules, playlist?.id, playlist?.ruleTracks, evaluatePlaylistRules]);

  // Extract colors from first track artwork for ambient background
  useEffect(() => {
    const firstTrackArtwork = playlist?.tracks[0]?.artwork?.medium
      ?? playlist?.tracks[0]?.artwork?.small
      ?? playlist?.tracks[0]?.album?.artwork?.medium;

    if (firstTrackArtwork) {
      getColorsForArtwork(firstTrackArtwork).then(setColors);
    }
  }, [playlist?.tracks[0]?.artwork, playlist?.tracks[0]?.album?.artwork]);

  const handleRefreshFolder = async () => {
    if (playlist?.isMediaFolder && playlist.localFolderId) {
      setIsLoadingTracks(true);
      try {
        await window.api?.scanFolder?.(playlist.localFolderId);
        await getMediaFolderTracks(playlist.localFolderId);
      } catch (error) {
        console.error('[PlaylistDetailView] Failed to refresh folder:', error);
      } finally {
        setIsLoadingTracks(false);
      }
    }
  };

  const handleRefreshRules = async () => {
    if (playlist && hasRules) {
      setIsEvaluating(true);
      try {
        await evaluatePlaylistRules(playlist.id);
      } catch (error) {
        console.error('[PlaylistDetailView] Failed to refresh rules:', error);
      } finally {
        setIsEvaluating(false);
      }
    }
  };

  const handlePreviewRules = useCallback(async () => {
    if (!playlist?.rules?.length) {
      setPreviewTracks([]);
      return;
    }

    setIsPreviewLoading(true);
    try {
      const tracks = await previewPlaylistRules(playlist.rules, {
        combinator: playlist.combinator,
        orderBy: playlist.orderBy,
        orderDirection: playlist.orderDirection,
        limit: playlist.limit,
        source: playlist.source || 'local',
      });
      setPreviewTracks(tracks);
    } catch (error) {
      console.error('[PlaylistDetailView] Failed to preview rules:', error);
    } finally {
      setIsPreviewLoading(false);
    }
  }, [playlist?.rules, playlist?.combinator, playlist?.orderBy, playlist?.orderDirection, playlist?.limit, playlist?.source, previewPlaylistRules]);

  const handleSaveRules = async () => {
    if (!playlist) return;

    try {
      await updatePlaylist(playlist.id, {
        rules: playlist.rules || [],
        combinator: playlist.combinator || 'and',
        orderBy: playlist.orderBy || null,
        orderDirection: playlist.orderDirection || 'desc',
        limit: playlist.limit || null,
        source: playlist.source || 'local',
      });
      await evaluatePlaylistRules(playlist.id);
      setIsRulesEditing(false);
      setPreviewTracks([]);
    } catch (error) {
      console.error('[PlaylistDetailView] Failed to save rules:', error);
    }
  };

  const handleAddRule = () => {
    if (!playlist) return;
    const firstField = ruleDefinitions[0]?.field || 'title';
    const firstOperator = ruleDefinitions[0]?.operators[0] || 'contains';
    addPlaylistRule(playlist.id, { field: firstField, operator: firstOperator, value: '' });
    setIsRulesExpanded(true);
    setIsRulesEditing(true);
  };

  const handleClearRules = async () => {
    if (!playlist) return;
    await clearPlaylistRules(playlist.id);
    setIsRulesEditing(false);
    setPreviewTracks([]);
  };

  // Combine manual tracks and rule tracks
  const allTracks = useMemo(() => {
    if (!playlist) return [];

    const manualTracks = playlist.tracks || [];
    const ruleTracks = isRulesEditing ? previewTracks : (playlist.ruleTracks || []);

    // If has rules, combine manual + rule tracks (dedupe by ID)
    if (hasRules && ruleTracks.length > 0) {
      const manualIds = new Set(manualTracks.map(t => t.id));
      const uniqueRuleTracks = ruleTracks.filter(t => !manualIds.has(t.id));
      return { manualTracks, ruleTracks: uniqueRuleTracks };
    }

    return { manualTracks, ruleTracks: [] };
  }, [playlist, hasRules, isRulesEditing, previewTracks]);

  const filteredAndSortedTracks = useMemo(() => {
    const { manualTracks, ruleTracks } = allTracks;
    let tracks = [...manualTracks, ...ruleTracks];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      tracks = tracks.filter(track =>
        track.title.toLowerCase().includes(query) ||
        track.artists.some(a => a.name.toLowerCase().includes(query)) ||
        track.album?.name?.toLowerCase().includes(query)
      );
    }

    // Sort tracks (only if not custom order and not hybrid)
    if (sortBy !== 'custom' && ruleTracks.length === 0) {
      switch (sortBy) {
        case 'title':
          tracks.sort((a, b) => a.title.localeCompare(b.title));
          break;
        case 'title-desc':
          tracks.sort((a, b) => b.title.localeCompare(a.title));
          break;
        case 'artist':
          tracks.sort((a, b) => {
            const artistA = a.artists[0]?.name || '';
            const artistB = b.artists[0]?.name || '';
            return artistA.localeCompare(artistB);
          });
          break;
        case 'artist-desc':
          tracks.sort((a, b) => {
            const artistA = a.artists[0]?.name || '';
            const artistB = b.artists[0]?.name || '';
            return artistB.localeCompare(artistA);
          });
          break;
      }
    }

    return tracks;
  }, [allTracks, searchQuery, sortBy]);

  if (!playlist) {
    return (
      <div className="library-view">
        <div className="library-empty">
          <h3>Playlist not found</h3>
          <button onClick={goBack}>Go back</button>
        </div>
      </div>
    );
  }

  const handlePlayTrack = (track: Track, index: number) => {
    setQueue(filteredAndSortedTracks, index);
    play(track);
  };

  const handlePlayAll = () => {
    if (filteredAndSortedTracks.length > 0) {
      setQueue(filteredAndSortedTracks, 0);
      play(filteredAndSortedTracks[0]!);
    }
  };

  const handleShuffle = () => {
    if (filteredAndSortedTracks.length > 0) {
      const shuffled = shuffleArray(filteredAndSortedTracks);
      setQueue(shuffled, 0);
      play(shuffled[0]!);
    }
  };

  // Search helpers
  const isSearching = searchQuery.trim().length > 0;

  const handleSearchClose = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Derived values needed before actions useMemo
  const firstTrackArtwork = playlist?.tracks[0]?.artwork?.medium ?? playlist?.tracks[0]?.album?.artwork?.medium;
  const isMediaFolder = playlist?.isMediaFolder;
  const totalTrackCount = allTracks.manualTracks.length + allTracks.ruleTracks.length;

  // Build actions for FloatingSearch
  const actions: SearchAction[] = useMemo(() => {
    const result: SearchAction[] = [];

    if (filteredAndSortedTracks.length > 0) {
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

    // Smart Rules action (for non-media-folder playlists)
    if (!isMediaFolder) {
      result.push({
        id: 'smart-rules',
        label: hasRules ? `Rules (${playlist.rules?.length || 0})` : 'Add Rules',
        icon: <SparklesIcon size={14} />,
        active: isRulesExpanded,
        onClick: () => setIsRulesExpanded(!isRulesExpanded),
      });
    }

    // Sort options
    result.push({
      id: 'sort-custom',
      label: 'Custom',
      icon: <SortIcon size={14} />,
      active: sortBy === 'custom',
      onClick: () => setSortBy('custom'),
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
  }, [filteredAndSortedTracks.length, sortBy, handlePlayAll, handleShuffle, isMediaFolder, hasRules, playlist.rules?.length, isRulesExpanded]);

  const handleStartEdit = () => {
    setEditName(playlist.name);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editName.trim() && editName !== playlist.name) {
      renamePlaylist(playlist.id, editName.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const handleRemoveTrack = (e: React.MouseEvent, trackId: string) => {
    e.stopPropagation();
    removeFromPlaylist(playlist.id, trackId);
  };

  return (
    <div className={`library-view playlist-detail-view ${isSearching ? 'searching' : ''}`}>
      <FloatingSearch
        onSearch={setSearchQuery}
        onClose={handleSearchClose}
        isSearchActive={isSearching}
        actions={actions}
        pageContext={{
          type: 'playlist-detail',
          icon: isMediaFolder ? <FolderIcon size={14} /> : hasRules ? <SparklesIcon size={14} /> : <PlaylistIcon size={14} />,
        }}
        detailInfo={{
          title: playlist.name,
          subtitle: isLoadingTracks || isEvaluating
            ? 'Loading...'
            : `${totalTrackCount} ${playlist.mediaFolderType === 'video' ? 'videos' : 'songs'}`,
          artwork: firstTrackArtwork,
          icon: isMediaFolder ? <FolderIcon size={16} /> : hasRules ? <SparklesIcon size={16} /> : <MusicNoteIcon size={16} />,
          onBack: goBack,
        }}
      />
      {/* Ambient Background */}
      {firstTrackArtwork && (
        <div
          className="detail-ambient-bg"
          style={{ backgroundImage: `url(${firstTrackArtwork})` }}
        />
      )}

      {/* Rules Panel (for smart/hybrid playlists) - toggled via CTA button */}
      {!isMediaFolder && isRulesExpanded && (
        <div className="playlist-rules-section">
          <div className="playlist-rules-panel">
              {hasRules && playlist.rules && (
                <>
                  <div className="rules-source-row">
                    <span>Search in</span>
                    <select
                      value={playlist.source || 'local'}
                      onChange={(e) => updatePlaylist(playlist.id, { source: e.target.value as 'local' | 'streams' | 'all' })}
                      className="rule-select rule-source"
                      disabled={!isRulesEditing}
                    >
                      <option value="local">Local Library</option>
                      <option value="streams">Streaming (Plugins)</option>
                      <option value="all">All Sources</option>
                    </select>
                  </div>

                  <div className="rules-combinator">
                    <span>Match</span>
                    <select
                      value={playlist.combinator || 'and'}
                      onChange={(e) => updatePlaylist(playlist.id, { combinator: e.target.value as 'and' | 'or' })}
                      className="rule-select"
                      disabled={!isRulesEditing}
                    >
                      <option value="and">all</option>
                      <option value="or">any</option>
                    </select>
                    <span>of the following:</span>
                  </div>

                  <div className="rules-list">
                    {playlist.rules.map((rule) => (
                      <RuleEditor
                        key={rule.id || `${rule.field}-${rule.operator}`}
                        rule={rule}
                        definitions={ruleDefinitions}
                        onUpdate={(data) => rule.id && updatePlaylistRule(playlist.id, rule.id, data)}
                        onRemove={() => rule.id && removePlaylistRule(playlist.id, rule.id)}
                      />
                    ))}
                  </div>

                  <div className="rules-options">
                    <label>
                      <span>Limit to</span>
                      <input
                        type="number"
                        value={playlist.limit || ''}
                        onChange={(e) => updatePlaylist(playlist.id, { limit: e.target.value ? Number(e.target.value) : null })}
                        className="rule-input rule-limit"
                        placeholder="No limit"
                        min="1"
                        disabled={!isRulesEditing}
                      />
                      <span>tracks</span>
                    </label>
                  </div>
                </>
              )}

              <div className="rules-actions">
                <button className="rules-action-btn" onClick={handleAddRule}>
                  <PlusIcon size={14} />
                  Add Rule
                </button>
                {hasRules && (
                  <>
                    {isRulesEditing ? (
                      <>
                        <button className="rules-action-btn" onClick={handlePreviewRules} disabled={isPreviewLoading}>
                          <PlayIcon size={14} />
                          {isPreviewLoading ? 'Previewing...' : 'Preview'}
                        </button>
                        <button className="rules-action-btn primary" onClick={handleSaveRules}>
                          Save Rules
                        </button>
                        <button className="rules-action-btn" onClick={() => setIsRulesEditing(false)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="rules-action-btn" onClick={() => setIsRulesEditing(true)}>
                          Edit Rules
                        </button>
                        <button className="rules-action-btn" onClick={handleRefreshRules} disabled={isEvaluating}>
                          <RefreshIcon size={14} className={isEvaluating ? 'spinning' : ''} />
                          Refresh
                        </button>
                        <button className="rules-action-btn danger" onClick={handleClearRules}>
                          Clear Rules
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>

              {isRulesEditing && previewTracks.length > 0 && (
                <div className="rules-preview-count">
                  Preview: {previewTracks.length} tracks match
                </div>
              )}
          </div>
        </div>
      )}


      <div className="library-content">
        {isLoadingTracks || isEvaluating ? (
          <div className="library-empty">
            <div className="library-empty-icon"><RefreshIcon size={48} className="spinning" /></div>
            <h3>Loading tracks...</h3>
            <p>{isEvaluating ? 'Evaluating rules' : 'Scanning your music library'}</p>
          </div>
        ) : totalTrackCount === 0 ? (
          <div className="library-empty">
            <div className="library-empty-icon">
              {isMediaFolder ? <FolderIcon size={48} /> : <MusicNoteIcon size={48} />}
            </div>
            <h3>{isMediaFolder ? 'No tracks found' : 'This playlist is empty'}</h3>
            <p>
              {isMediaFolder
                ? 'This folder contains no supported audio files'
                : hasRules
                  ? 'No tracks match your rules. Try adjusting them.'
                  : 'Search for songs and add them here, or add rules to auto-populate.'}
            </p>
            {isMediaFolder && (
              <button className="library-action-btn" onClick={handleRefreshFolder}>
                <RefreshIcon size={16} />
                Rescan Folder
              </button>
            )}
            {!isMediaFolder && !hasRules && (
              <button className="library-action-btn" onClick={handleAddRule}>
                <SparklesIcon size={16} />
                Add Smart Rules
              </button>
            )}
          </div>
        ) : filteredAndSortedTracks.length === 0 ? (
          <div className="library-empty">
            <div className="library-empty-icon"><MusicNoteIcon size={48} /></div>
            <h3>No matching songs</h3>
            <p>Try adjusting your search</p>
          </div>
        ) : (
          <div className="library-track-list">
            {/* Manual tracks section */}
            {allTracks.manualTracks.length > 0 && (
              <>
                {hasRules && allTracks.ruleTracks.length > 0 && (
                  <div className="track-section-header">Manual Tracks</div>
                )}
                {allTracks.manualTracks
                  .filter(track => {
                    if (!searchQuery.trim()) return true;
                    const query = searchQuery.toLowerCase();
                    return track.title.toLowerCase().includes(query) ||
                      track.artists.some(a => a.name.toLowerCase().includes(query));
                  })
                  .map((track, index) => (
                    <div key={track.id} className="playlist-track-row">
                      <TrackRow
                        track={track}
                        index={index + 1}
                        isPlaying={currentTrack?.id === track.id}
                        onClick={() => handlePlayTrack(track, index)}
                        onContextMenu={showContextMenu}
                      />
                      {!isMediaFolder && (
                        <button
                          className="playlist-track-remove"
                          onClick={(e) => handleRemoveTrack(e, track.id)}
                          title="Remove from playlist"
                        >
                          <CloseIcon size={16} />
                        </button>
                      )}
                    </div>
                  ))}
              </>
            )}

            {/* Rule-matched tracks section */}
            {hasRules && allTracks.ruleTracks.length > 0 && (
              <>
                <div className="track-section-header track-section-auto">
                  <SparklesIcon size={14} />
                  Auto-matched Tracks ({allTracks.ruleTracks.length})
                </div>
                {allTracks.ruleTracks
                  .filter(track => {
                    if (!searchQuery.trim()) return true;
                    const query = searchQuery.toLowerCase();
                    return track.title.toLowerCase().includes(query) ||
                      track.artists.some(a => a.name.toLowerCase().includes(query));
                  })
                  .map((track, index) => (
                    <div key={track.id} className="playlist-track-row rule-track">
                      <TrackRow
                        track={track}
                        index={allTracks.manualTracks.length + index + 1}
                        isPlaying={currentTrack?.id === track.id}
                        onClick={() => handlePlayTrack(track, allTracks.manualTracks.length + index)}
                        onContextMenu={showContextMenu}
                      />
                      {/* No remove button for rule-matched tracks */}
                    </div>
                  ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
