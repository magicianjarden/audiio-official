import React, { useState, useRef, useEffect } from 'react';
import { SearchIcon, CloseIcon, ChevronDownIcon, PlayIcon, ShuffleIcon, SortIcon, FilterIcon } from '@audiio/icons';

export type SortOption = {
  value: string;
  label: string;
};

export type FilterOption = {
  value: string;
  label: string;
  count?: number;
};

type LibraryActionBarProps = {
  // Play/Shuffle actions
  onPlay?: () => void;
  onShuffle?: () => void;
  disablePlay?: boolean;

  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;

  // Sort
  sortOptions?: SortOption[];
  currentSort?: string;
  onSortChange?: (value: string) => void;

  // Filter (optional)
  filterOptions?: FilterOption[];
  currentFilter?: string;
  onFilterChange?: (value: string) => void;
  filterLabel?: string;

  // Results count
  totalCount?: number;
  filteredCount?: number;
};

export const LibraryActionBar: React.FC<LibraryActionBarProps> = ({
  onPlay,
  onShuffle,
  disablePlay = false,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search...',
  sortOptions,
  currentSort,
  onSortChange,
  filterOptions,
  currentFilter,
  onFilterChange,
  filterLabel,
  totalCount,
  filteredCount,
}) => {
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentSortLabel = sortOptions?.find(o => o.value === currentSort)?.label || 'Sort';
  const currentFilterLabel = filterOptions?.find(o => o.value === currentFilter)?.label || filterLabel || 'Filter';
  const showResultsCount = filteredCount !== undefined && totalCount !== undefined && filteredCount !== totalCount;

  return (
    <div className="library-action-bar">
      {/* Play Button */}
      {onPlay && (
        <button
          className="library-play-btn"
          onClick={onPlay}
          disabled={disablePlay}
        >
          <PlayIcon size={18} />
          <span>Play</span>
        </button>
      )}

      {/* Shuffle Button */}
      {onShuffle && (
        <button
          className="library-shuffle-btn"
          onClick={onShuffle}
          disabled={disablePlay}
          title="Shuffle"
        >
          <ShuffleIcon size={20} />
        </button>
      )}

      {/* Separator */}
      {(onPlay || onShuffle) && <div className="library-action-separator" />}

      {/* Search */}
      <div className="library-search">
        <SearchIcon size={16} className="library-search-icon" />
        <input
          ref={searchRef}
          type="text"
          className="library-search-input"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchQuery && (
          <button
            className="library-search-clear"
            onClick={() => {
              onSearchChange('');
              searchRef.current?.focus();
            }}
          >
            <CloseIcon size={14} />
          </button>
        )}
      </div>

      {/* Results count */}
      {showResultsCount && (
        <span className="library-results-count">
          {filteredCount} of {totalCount}
        </span>
      )}

      {/* Filter dropdown */}
      {filterOptions && filterOptions.length > 0 && onFilterChange && (
        <div className="library-filter" ref={filterRef}>
          <button
            className={`library-filter-btn ${filterOpen ? 'active' : ''} ${currentFilter && currentFilter !== filterOptions[0]?.value ? 'has-filter' : ''}`}
            onClick={() => setFilterOpen(!filterOpen)}
          >
            <FilterIcon size={14} />
            <span>{currentFilterLabel}</span>
            <ChevronDownIcon size={12} className={`library-sort-chevron ${filterOpen ? 'open' : ''}`} />
          </button>
          {filterOpen && (
            <div className="library-filter-menu">
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  className={`library-filter-option ${currentFilter === option.value ? 'active' : ''}`}
                  onClick={() => {
                    onFilterChange(option.value);
                    setFilterOpen(false);
                  }}
                >
                  <span>{option.label}</span>
                  {option.count !== undefined && (
                    <span className="library-filter-count">{option.count}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sort dropdown */}
      {sortOptions && sortOptions.length > 0 && onSortChange && (
        <div className="library-sort" ref={sortRef}>
          <button
            className={`library-sort-btn ${sortOpen ? 'active' : ''}`}
            onClick={() => setSortOpen(!sortOpen)}
          >
            <SortIcon size={14} />
            <span>{currentSortLabel}</span>
            <ChevronDownIcon size={12} className={`library-sort-chevron ${sortOpen ? 'open' : ''}`} />
          </button>
          {sortOpen && (
            <div className="library-sort-menu">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  className={`library-sort-option ${currentSort === option.value ? 'active' : ''}`}
                  onClick={() => {
                    onSortChange(option.value);
                    setSortOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
