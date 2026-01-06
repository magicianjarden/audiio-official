/**
 * FloatingSearch - Floating search bar with smooth animations
 * Features: smooth expand/contract, morphing icon, keyboard shortcuts, page-adaptive actions
 *
 * Shortcuts:
 * - Cmd/Ctrl+K: Focus search
 * - Escape: Close search
 * - Action shortcuts when expanded (P for Play, S for Shuffle, etc.)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SearchBar } from './SearchBar';
import { SearchHistoryPopover } from './SearchHistoryPopover';
import { useSearchStore } from '../../stores/search-store';
import {
  SearchIcon,
  CloseIcon,
  BackIcon,
  PlayIcon,
  ShuffleIcon,
  SortIcon,
  HeartIcon,
  DownloadIcon,
  PlaylistIcon,
  FolderIcon,
  MusicNoteIcon,
  ClockIcon,
  FilterIcon,
} from '@audiio/icons';

export interface SearchAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  primary?: boolean;
  active?: boolean;
  onClick: () => void;
}

export interface PageContext {
  type: 'home' | 'likes' | 'dislikes' | 'downloads' | 'playlists' | 'playlist-detail' | 'collections' | 'collection-detail' | 'tags' | 'tag-detail' | 'other';
  label?: string;
  icon?: React.ReactNode;
}

export interface DetailInfo {
  title: string;
  subtitle?: string;
  artwork?: string;
  icon?: React.ReactNode;
  color?: string; // For tags
  onBack: () => void;
}

interface FloatingSearchProps {
  onSearch: (query: string) => void;
  onClose: () => void;
  isSearchActive: boolean;
  /** Page-specific actions to show when expanded */
  actions?: SearchAction[];
  /** Current page context */
  pageContext?: PageContext;
  /** Detail page info (back button, artwork, title) */
  detailInfo?: DetailInfo;
}

export const FloatingSearch: React.FC<FloatingSearchProps> = ({
  onSearch,
  onClose,
  isSearchActive,
  actions = [],
  pageContext,
  detailInfo,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const historyButtonRef = useRef<HTMLButtonElement | null>(null);

  // Search store for history and filters
  const {
    showHistory,
    setShowHistory,
    showFilters,
    setShowFilters,
    activeFilterCount,
  } = useSearchStore();

  // Toggle history popover
  const handleHistoryToggle = useCallback(() => {
    setShowHistory(!showHistory);
  }, [showHistory, setShowHistory]);

  // Toggle filter panel
  const handleFilterToggle = useCallback(() => {
    setShowFilters(!showFilters);
  }, [showFilters, setShowFilters]);

  // Focus the search input programmatically
  const focusSearch = useCallback(() => {
    // Find the search input within the SearchBar component
    const input = document.querySelector('.search-bar input') as HTMLInputElement;
    if (input) {
      input.focus();
    }
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        focusSearch();
      }

      // Escape to close (only when search is active)
      if (e.key === 'Escape' && isSearchActive) {
        e.preventDefault();
        onClose();
      }

      // "/" to focus search (when not in an input)
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as Element).tagName)) {
        e.preventDefault();
        focusSearch();
      }

      // Action shortcuts (only when expanded and not typing in input)
      if ((isFocused || isSearchActive) && !['INPUT', 'TEXTAREA'].includes((e.target as Element).tagName)) {
        for (const action of actions) {
          if (action.shortcut && e.key.toLowerCase() === action.shortcut.toLowerCase()) {
            e.preventDefault();
            action.onClick();
            break;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchActive, isFocused, onClose, focusSearch, actions]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleTyping = () => {
    setIsTyping(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 500);
  };

  const handleClose = () => {
    onClose();
  };

  // Build class names
  const containerClasses = [
    'floating-search',
    isSearchActive ? 'active' : '',
    isFocused ? 'focused' : '',
    isTyping ? 'typing' : '',
  ].filter(Boolean).join(' ');

  // Show actions when has actions (always visible as stacked card behind)
  const hasActions = actions.length > 0;

  return (
    <>
      {/* Backdrop overlay when searching */}
      <div
        className={`floating-search-backdrop ${isSearchActive ? 'visible' : ''}`}
        onClick={handleClose}
      />

      {/* Stacked container for search + CTA card */}
      <div className={`floating-search-stack ${hasActions ? 'has-actions' : ''} ${isFocused ? 'focused' : ''} ${isSearchActive ? 'active' : ''}`}>
        {/* CTA card - sits behind and below search */}
        {(hasActions || detailInfo) && (
          <div className={`floating-search-cta ${detailInfo ? 'has-detail' : ''}`}>
            {/* Detail page info (back, artwork, title) */}
            {detailInfo && (
              <div className="floating-search-detail">
                <button
                  className="floating-search-detail-back"
                  onClick={detailInfo.onBack}
                  title="Go back"
                >
                  <BackIcon size={16} />
                </button>

                <div className="floating-search-detail-artwork">
                  {detailInfo.artwork ? (
                    <img src={detailInfo.artwork} alt={detailInfo.title} />
                  ) : detailInfo.color ? (
                    <div
                      className="floating-search-detail-color"
                      style={{ background: detailInfo.color }}
                    />
                  ) : detailInfo.icon ? (
                    detailInfo.icon
                  ) : (
                    <MusicNoteIcon size={16} />
                  )}
                </div>

                <div className="floating-search-detail-info">
                  <span className="floating-search-detail-title">{detailInfo.title}</span>
                  {detailInfo.subtitle && (
                    <span className="floating-search-detail-subtitle">{detailInfo.subtitle}</span>
                  )}
                </div>
              </div>
            )}

            {/* Page context indicator */}
            {pageContext && pageContext.label && !detailInfo && (
              <div className="floating-search-cta-context">
                {pageContext.icon && (
                  <span className="floating-search-cta-context-icon">{pageContext.icon}</span>
                )}
                <span>{pageContext.label}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="floating-search-cta-actions">
              {actions.map((action, index) => (
                <React.Fragment key={action.id}>
                  <button
                    className={`floating-search-cta-btn ${action.primary ? 'primary' : ''} ${action.active ? 'active' : ''}`}
                    onClick={action.onClick}
                    title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
                  >
                    {action.icon}
                    <span>{action.label}</span>
                    {action.shortcut && (
                      <kbd className="floating-search-cta-shortcut">{action.shortcut}</kbd>
                    )}
                  </button>
                  {/* Add separator between groups - after primary actions */}
                  {action.primary && index < actions.length - 1 && !actions[index + 1]?.primary && (
                    <div className="floating-search-cta-separator" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Main search card - sits on top */}
        <div className={containerClasses}>
          {/* Focus spotlight effect */}
          <div className="floating-search-spotlight" />

          {/* Search bar */}
          <div className="floating-search-bar">
            {/* Morphing icon - transforms from search to close */}
            <button
              className={`floating-search-morph-icon ${isSearchActive ? 'is-close' : ''}`}
              onClick={isSearchActive ? handleClose : undefined}
              aria-label={isSearchActive ? 'Close search' : 'Search'}
              type="button"
              tabIndex={isSearchActive ? 0 : -1}
            >
              <span className="morph-icon morph-icon--search">
                <SearchIcon size={18} />
              </span>
              <span className="morph-icon morph-icon--close">
                <CloseIcon size={18} />
              </span>
            </button>

            <SearchBar
              onSearch={onSearch}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onTyping={handleTyping}
            />

            {/* History and Filter buttons */}
            <div className="floating-search-bar-actions">
              {/* History button */}
              <button
                ref={historyButtonRef}
                className={`floating-search-action-btn ${showHistory ? 'active' : ''}`}
                onClick={handleHistoryToggle}
                aria-label="Search history"
                title="Search history"
                type="button"
              >
                <ClockIcon size={16} />
              </button>

              {/* Filter button */}
              <button
                className={`floating-search-action-btn ${showFilters ? 'active' : ''} ${activeFilterCount > 0 ? 'has-filters' : ''}`}
                onClick={handleFilterToggle}
                aria-label="Filters"
                title="Filters"
                type="button"
              >
                <FilterIcon size={16} />
                {activeFilterCount > 0 && (
                  <span className="floating-search-filter-count">{activeFilterCount}</span>
                )}
              </button>
            </div>

            {/* History Popover */}
            <SearchHistoryPopover
              isOpen={showHistory}
              onClose={() => setShowHistory(false)}
              anchorRef={historyButtonRef}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default FloatingSearch;
