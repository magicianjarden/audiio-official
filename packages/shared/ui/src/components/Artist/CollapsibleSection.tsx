/**
 * CollapsibleSection - Reusable collapsible section wrapper
 * Features: localStorage persistence, smooth animation, chevron rotation
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from '@audiio/icons';

interface CollapsibleSectionProps {
  title: string;
  sectionId: string; // Unique ID for localStorage persistence
  icon?: React.ReactNode;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  className?: string;
  badge?: React.ReactNode;
  loading?: boolean;
}

const STORAGE_KEY_PREFIX = 'audiio-section-collapsed-';

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  sectionId,
  icon,
  defaultExpanded = true,
  children,
  className = '',
  badge,
  loading = false,
}) => {
  // Initialize from localStorage or default
  const [isExpanded, setIsExpanded] = useState(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${sectionId}`);
      if (stored !== null) {
        return stored !== 'true'; // stored is "collapsed" state, we need "expanded" state
      }
    } catch {
      // localStorage not available
    }
    return defaultExpanded;
  });

  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  // Persist collapsed state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${sectionId}`, (!isExpanded).toString());
    } catch {
      // localStorage not available
    }
  }, [isExpanded, sectionId]);

  // Update content height for animation
  useEffect(() => {
    if (contentRef.current) {
      // Small delay to ensure content is rendered
      requestAnimationFrame(() => {
        if (contentRef.current) {
          setContentHeight(contentRef.current.scrollHeight);
        }
      });
    }
  }, [children, loading]);

  // Recalculate height when loading state changes
  useEffect(() => {
    if (!loading && contentRef.current) {
      // Delay to let content render
      const timer = setTimeout(() => {
        if (contentRef.current) {
          setContentHeight(contentRef.current.scrollHeight);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const toggleExpanded = () => {
    // Ensure we have a height before collapsing
    if (isExpanded && contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
    setIsExpanded((prev) => !prev);
  };

  // Calculate the actual max-height value
  const getMaxHeight = (): string => {
    if (!isExpanded) return '0px';
    if (contentHeight) return `${contentHeight + 20}px`; // Add padding buffer
    return '2000px'; // Fallback large value
  };

  return (
    <section className={`collapsible-section ${isExpanded ? 'expanded' : 'collapsed'} ${className}`}>
      <button
        className="collapsible-section-header"
        onClick={toggleExpanded}
        aria-expanded={isExpanded}
        aria-controls={`section-content-${sectionId}`}
        type="button"
      >
        <div className="collapsible-section-title-wrapper">
          {icon && <span className="collapsible-section-icon">{icon}</span>}
          <h2 className="section-title-spotify">{title}</h2>
          {badge && <span className="collapsible-section-badge">{badge}</span>}
        </div>
        <span className={`collapsible-section-chevron ${isExpanded ? 'rotated' : ''}`}>
          <ChevronDownIcon size={20} />
        </span>
      </button>

      <div
        id={`section-content-${sectionId}`}
        className="collapsible-section-content"
        style={{
          maxHeight: getMaxHeight(),
          opacity: isExpanded ? 1 : 0,
          overflow: 'hidden',
        }}
      >
        <div ref={contentRef}>
          {loading ? (
            <div className="collapsible-section-loading">
              <div className="section-loading-skeleton skeleton" />
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </section>
  );
};

export default CollapsibleSection;
