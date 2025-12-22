import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePlayerStore } from '../../stores/player-store';
import { useUIStore } from '../../stores/ui-store';
import { useSmartQueueStore, useRadioState, useAutoQueueStatus } from '../../stores/smart-queue-store';
import { useRecommendationStore } from '../../stores/recommendation-store';
import { useTrackContextMenu } from '../../contexts/ContextMenuContext';
import { useMLRanking } from '../../hooks';
import { TrackRow } from '../TrackRow/TrackRow';
import type { UnifiedTrack } from '@audiio/core';
import {
  QueueIcon,
  MusicNoteIcon,
  CloseIcon,
  RadioIcon,
  InfinityIcon,
  SpinnerIcon,
  ShuffleIcon,
  DragHandleIcon
} from '../Icons/Icons';

// Sortable queue item component
interface SortableQueueItemProps {
  id: string;
  track: UnifiedTrack;
  index: number;
  onPlay: () => void;
  onRemove: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent, track: UnifiedTrack) => void;
}

const SortableQueueItem: React.FC<SortableQueueItemProps> = ({
  id,
  track,
  index,
  onPlay,
  onRemove,
  onContextMenu,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`queue-popover-item ${isDragging ? 'dragging' : ''}`}
    >
      <button
        className="queue-popover-item-drag"
        {...attributes}
        {...listeners}
        title="Drag to reorder"
      >
        <DragHandleIcon size={14} />
      </button>
      <TrackRow
        track={track}
        index={index + 1}
        isPlaying={false}
        onClick={onPlay}
        onContextMenu={onContextMenu}
        compact
      />
      <button
        className="queue-popover-item-remove"
        onClick={onRemove}
        title="Remove from queue"
      >
        <CloseIcon size={14} />
      </button>
    </div>
  );
};

export const QueuePopover: React.FC = () => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(15);
  const { currentTrack, queue, queueIndex, play, setQueue, reorderQueue } = usePlayerStore();
  const { recordReorder } = useRecommendationStore();
  const { isQueueOpen, queueAnchorRect, closeQueue } = useUIStore();
  const { showContextMenu } = useTrackContextMenu();
  const { rankTracks, isMLReady } = useMLRanking();

  // Smart queue state
  const { isRadioMode, seed: radioSeed } = useRadioState();
  const { isEnabled: isAutoQueueEnabled, isFetching } = useAutoQueueStatus();
  const { stopRadio, toggleAutoQueue } = useSmartQueueStore();
  const isSmartQueueActive = isRadioMode || isAutoQueueEnabled;

  // Re-ranking state
  const [isReranking, setIsReranking] = useState(false);

  const upNext = queue.slice(queueIndex + 1);

  // Re-rank the queue using ML preferences
  const handleRerank = useCallback(async () => {
    if (upNext.length < 2 || isReranking) return;

    setIsReranking(true);
    try {
      // Apply ML ranking to the "up next" tracks
      const ranked = await rankTracks(upNext, {
        enabled: true,
        explorationMode: 'balanced',
        shuffle: true,
        shuffleIntensity: 0.15
      });

      // Rebuild queue with current track + ranked upcoming
      const currentAndPlayed = queue.slice(0, queueIndex + 1);
      const rerankedTracks = ranked.map(r => r.track);
      const newQueue = [...currentAndPlayed, ...rerankedTracks];

      setQueue(newQueue, queueIndex);
      console.log('[QueuePopover] Re-ranked queue using ML preferences');
    } catch (error) {
      console.error('[QueuePopover] Re-ranking failed:', error);
    } finally {
      setIsReranking(false);
    }
  }, [upNext, queue, queueIndex, rankTracks, setQueue, isReranking]);

  // DnD sensors setup
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end - reorder queue and record for ML
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const visibleTracks = upNext.slice(0, visibleCount);
      const oldIndex = visibleTracks.findIndex(t => `queue-${t.id}` === active.id);
      const newIndex = visibleTracks.findIndex(t => `queue-${t.id}` === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const track = visibleTracks[oldIndex];
        reorderQueue(oldIndex, newIndex);

        // Record reorder for ML learning
        if (track) {
          recordReorder(track, oldIndex, newIndex);
        }
      }
    }
  }, [upNext, visibleCount, reorderQueue, recordReorder]);

  // Close on click outside
  useEffect(() => {
    if (!isQueueOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        closeQueue();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeQueue();
      }
    };

    // Delay adding listener to avoid immediate close
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isQueueOpen, closeQueue]);

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;

    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (nearBottom && visibleCount < upNext.length) {
      setVisibleCount(prev => Math.min(prev + 10, upNext.length));
    }
  }, [visibleCount, upNext.length]);

  // Reset visible count when queue closes or changes significantly
  useEffect(() => {
    if (!isQueueOpen) {
      setVisibleCount(15);
    }
  }, [isQueueOpen]);

  if (!isQueueOpen || !queueAnchorRect) return null;

  const handleRemoveFromQueue = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const actualIndex = queueIndex + 1 + index;
    const newQueue = [...queue];
    newQueue.splice(actualIndex, 1);
    setQueue(newQueue, queueIndex);
  };

  const handlePlayFromQueue = (index: number) => {
    const actualIndex = queueIndex + 1 + index;
    const track = queue[actualIndex];
    if (track) {
      play(track);
    }
  };

  const handleClearUpNext = () => {
    const newQueue = queue.slice(0, queueIndex + 1);
    setQueue(newQueue, queueIndex);
  };

  // Position popover above the anchor (queue button)
  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: `calc(100vh - ${queueAnchorRect.top}px + 8px)`,
    right: `calc(100vw - ${queueAnchorRect.right}px)`,
  };

  const artworkUrl = currentTrack?.artwork?.medium ?? currentTrack?.album?.artwork?.medium;

  return (
    <div className="queue-popover" ref={popoverRef} style={popoverStyle}>
      <header className="queue-popover-header">
        <div className="queue-popover-title">
          <QueueIcon size={20} />
          <h3>Queue</h3>
        </div>
        <div className="queue-popover-actions">
          <button
            className={`queue-smart-toggle ${isSmartQueueActive ? 'active' : ''}`}
            onClick={isRadioMode ? stopRadio : toggleAutoQueue}
            title={
              isRadioMode
                ? `Radio: ${radioSeed?.name || 'Active'} (click to stop)`
                : isSmartQueueActive
                  ? 'Disable Smart Queue'
                  : 'Enable Smart Queue'
            }
          >
            {isRadioMode ? <RadioIcon size={18} /> : <InfinityIcon size={18} />}
          </button>
          <button className="queue-popover-close" onClick={closeQueue}>
            <CloseIcon size={18} />
          </button>
        </div>
      </header>

      <div className="queue-popover-content" ref={contentRef} onScroll={handleScroll}>
        {/* Radio Mode Banner */}
        {isRadioMode && radioSeed && (
          <div className="queue-radio-banner">
            <div className="queue-radio-info">
              <span className="queue-radio-label">Playing from</span>
              <span className="queue-radio-seed">{radioSeed.name}</span>
            </div>
          </div>
        )}

        {/* Auto-Queue Info */}
        {!isRadioMode && isAutoQueueEnabled && (
          <div className="queue-auto-banner">
            <span className="queue-auto-label">Automatically adding tracks when queue runs low</span>
          </div>
        )}

        {/* Now Playing */}
        {currentTrack && (
          <section className="queue-popover-section">
            <h4 className="queue-popover-section-title">Now Playing</h4>
            <div className="queue-popover-now-playing">
              <div className="queue-popover-artwork">
                {artworkUrl ? (
                  <img src={artworkUrl} alt={currentTrack.title} />
                ) : (
                  <div className="queue-popover-artwork-placeholder">
                    <MusicNoteIcon size={20} />
                  </div>
                )}
                <span className="queue-popover-playing-indicator">
                  <span /><span /><span />
                </span>
              </div>
              <div className="queue-popover-track-info">
                <div className="queue-popover-track-title">{currentTrack.title}</div>
                <div className="queue-popover-track-artist">
                  {currentTrack.artists.map(a => a.name).join(', ')}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Up Next */}
        <section className="queue-popover-section">
          <div className="queue-popover-section-header">
            <h4 className="queue-popover-section-title">Up Next</h4>
            <div className="queue-popover-section-actions">
              {upNext.length >= 2 && (
                <button
                  className={`queue-popover-rerank ${isReranking ? 'loading' : ''}`}
                  onClick={handleRerank}
                  disabled={isReranking}
                  title={isMLReady ? 'Re-order based on your preferences' : 'Learning your preferences...'}
                >
                  {isReranking ? <SpinnerIcon size={14} /> : <ShuffleIcon size={14} />}
                  <span>Optimize</span>
                </button>
              )}
              {upNext.length > 0 && (
                <button className="queue-popover-clear" onClick={handleClearUpNext}>
                  Clear
                </button>
              )}
            </div>
          </div>
          {upNext.length === 0 ? (
            <div className="queue-popover-empty">
              <p>No tracks in queue</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={upNext.slice(0, visibleCount).map(t => `queue-${t.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="queue-popover-list">
                  {upNext.slice(0, visibleCount).map((track, index) => (
                    <SortableQueueItem
                      key={`queue-${track.id}`}
                      id={`queue-${track.id}`}
                      track={track}
                      index={index}
                      onPlay={() => handlePlayFromQueue(index)}
                      onRemove={(e) => handleRemoveFromQueue(e, index)}
                      onContextMenu={showContextMenu}
                    />
                  ))}
                  {upNext.length > visibleCount && (
                    <div className="queue-popover-more">
                      Scroll for {upNext.length - visibleCount} more tracks
                    </div>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Loading indicator for auto-queue */}
          {isFetching && (
            <div className="queue-loading">
              <SpinnerIcon size={16} />
              <span>Finding more music...</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
