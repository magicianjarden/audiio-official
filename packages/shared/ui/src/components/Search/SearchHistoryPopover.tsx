/**
 * SearchHistoryPopover - Popover showing recent search history
 *
 * Features:
 * - Shows recent searches from server
 * - Click to re-run search
 * - Remove individual items
 * - Clear all history
 */

import React, { useEffect, useRef } from 'react';
import { useSearchStore, type SearchHistoryEntry } from '../../stores/search-store';
import { ClockIcon, CloseIcon, TrashIcon } from '@audiio/icons';

interface SearchHistoryPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement>;
}

export const SearchHistoryPopover: React.FC<SearchHistoryPopoverProps> = ({
  isOpen,
  onClose,
  anchorRef,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const {
    searchHistory,
    isLoadingHistory,
    loadHistory,
    clearHistory,
    removeHistoryItem,
    useHistoryItem,
  } = useSearchStore();

  // Load history when opened
  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, loadHistory]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        anchorRef?.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  const handleItemClick = (entry: SearchHistoryEntry) => {
    useHistoryItem(entry);
    onClose();
  };

  const handleRemoveItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeHistoryItem(id);
  };

  const handleClearAll = () => {
    clearHistory();
  };

  const formatTimestamp = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="search-history-popover" ref={popoverRef}>
      <div className="search-history-popover-header">
        <div className="search-history-popover-title">
          <ClockIcon size={14} />
          <span>Recent Searches</span>
        </div>
        {searchHistory.length > 0 && (
          <button
            className="search-history-popover-clear"
            onClick={handleClearAll}
            title="Clear all history"
          >
            <TrashIcon size={14} />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="search-history-popover-content">
        {isLoadingHistory && (
          <div className="search-history-popover-loading">
            <div className="search-history-popover-spinner" />
            <span>Loading...</span>
          </div>
        )}

        {!isLoadingHistory && searchHistory.length === 0 && (
          <div className="search-history-popover-empty">
            <ClockIcon size={24} />
            <span>No recent searches</span>
          </div>
        )}

        {!isLoadingHistory && searchHistory.length > 0 && (
          <div className="search-history-popover-list">
            {searchHistory.map((entry) => (
              <button
                key={entry.id}
                className="search-history-popover-item"
                onClick={() => handleItemClick(entry)}
              >
                <div className="search-history-popover-item-content">
                  <span className="search-history-popover-item-query">
                    {entry.query}
                  </span>
                  <span className="search-history-popover-item-time">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </div>
                <button
                  className="search-history-popover-item-remove"
                  onClick={(e) => handleRemoveItem(e, entry.id)}
                  title="Remove from history"
                >
                  <CloseIcon size={12} />
                </button>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchHistoryPopover;
