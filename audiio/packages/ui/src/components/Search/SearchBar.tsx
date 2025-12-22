import React, { useState, useCallback, useRef } from 'react';
import { useSearchStore } from '../../stores/search-store';

interface SearchBarProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onTyping?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = "Search for songs, artists, or albums...",
  onFocus,
  onBlur,
  onTyping,
}) => {
  const { query, setQuery, search } = useSearchStore();
  const [inputValue, setInputValue] = useState(query);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(inputValue);
    } else {
      search(inputValue);
    }
  }, [inputValue, search, onSearch]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setQuery(e.target.value);
    onTyping?.();
  }, [setQuery, onTyping]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (onSearch) {
        onSearch(inputValue);
      } else {
        search(inputValue);
      }
    }
  }, [inputValue, search, onSearch]);

  const handleFocus = useCallback(() => {
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    onBlur?.();
  }, [onBlur]);

  return (
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
  );
};
