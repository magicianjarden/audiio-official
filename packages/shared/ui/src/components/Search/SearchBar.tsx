import React, { useState, useCallback, useRef } from 'react';
import { useSearchStore } from '../../stores/search-store';
import { SearchDropdown } from './SearchDropdown';

interface SearchBarProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onTyping?: () => void;
  showDropdown?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = "Search for songs, artists, or albums...",
  onFocus,
  onBlur,
  onTyping,
  showDropdown = true,
}) => {
  const { query, setQuery, search } = useSearchStore();
  const [inputValue, setInputValue] = useState(query);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(inputValue);
    } else {
      search(inputValue);
    }
    setIsDropdownOpen(false);
  }, [inputValue, search, onSearch]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setQuery(value);
    onTyping?.();
    // Open dropdown when typing
    if (showDropdown && value.length > 0) {
      setIsDropdownOpen(true);
    }
  }, [setQuery, onTyping, showDropdown]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (onSearch) {
        onSearch(inputValue);
      } else {
        search(inputValue);
      }
      setIsDropdownOpen(false);
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      inputRef.current?.blur();
    }
  }, [inputValue, search, onSearch]);

  const handleFocus = useCallback(() => {
    onFocus?.();
    // Open dropdown when focusing with existing value
    if (showDropdown && inputValue.length > 0) {
      setIsDropdownOpen(true);
    }
  }, [onFocus, showDropdown, inputValue]);

  const handleBlur = useCallback(() => {
    onBlur?.();
    // Delay close to allow click on dropdown items
    setTimeout(() => {
      // Don't close if focus moved to dropdown
    }, 150);
  }, [onBlur]);

  const handleCloseDropdown = useCallback(() => {
    setIsDropdownOpen(false);
  }, []);

  const handleFullSearch = useCallback((searchQuery: string) => {
    if (onSearch) {
      onSearch(searchQuery);
    } else {
      search(searchQuery);
    }
    setIsDropdownOpen(false);
  }, [onSearch, search]);

  return (
    <div className="search-bar-container">
      <form className="search-bar" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </form>
      {showDropdown && (
        <SearchDropdown
          isOpen={isDropdownOpen}
          onClose={handleCloseDropdown}
          onFullSearch={handleFullSearch}
          inputValue={inputValue}
        />
      )}
    </div>
  );
};
