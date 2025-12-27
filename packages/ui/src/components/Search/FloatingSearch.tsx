/**
 * FloatingSearch - Floating search bar with smooth animations
 * Features: smooth expand/contract, morphing icon
 */

import React, { useState, useEffect, useRef } from 'react';
import { SearchBar } from './SearchBar';
import { SearchIcon, CloseIcon } from '@audiio/icons';

interface FloatingSearchProps {
  onSearch: (query: string) => void;
  onClose: () => void;
  isSearchActive: boolean;
}

export const FloatingSearch: React.FC<FloatingSearchProps> = ({
  onSearch,
  onClose,
  isSearchActive
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  return (
    <>
      {/* Backdrop overlay when searching */}
      <div
        className={`floating-search-backdrop ${isSearchActive ? 'visible' : ''}`}
        onClick={handleClose}
      />

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
        </div>
      </div>
    </>
  );
};

export default FloatingSearch;
