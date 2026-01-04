/**
 * StickyHeader - Parallax sticky header for detail pages
 *
 * Features:
 * - Parallax artwork that scales on overscroll
 * - Blur effect as you scroll up
 * - Title condenses into compact header
 * - Smooth spring animations
 * - Back button always visible
 */

import { useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeftIcon, MusicNoteIcon } from '@audiio/icons';
import { useColorExtraction } from '../hooks/useColorExtraction';
import styles from './StickyHeader.module.css';

interface StickyHeaderProps {
  artwork?: string | null;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  onScroll?: (scrollY: number, progress: number) => void;
  /** Additional content to show in compact header */
  compactExtra?: ReactNode;
  /** Whether to use circular artwork (for artists) */
  circular?: boolean;
  /** Height of the expanded header */
  expandedHeight?: number;
}

const COLLAPSED_HEIGHT = 56;
const DEFAULT_EXPANDED_HEIGHT = 320;

export function StickyHeader({
  artwork,
  title,
  subtitle,
  children,
  onScroll,
  compactExtra,
  circular = false,
  expandedHeight = DEFAULT_EXPANDED_HEIGHT,
}: StickyHeaderProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const [isCompact, setIsCompact] = useState(false);

  // Extract colors from artwork for gradient
  const colors = useColorExtraction(artwork || null);

  // Calculate scroll progress (0 = fully expanded, 1 = fully collapsed)
  const collapseStart = expandedHeight - COLLAPSED_HEIGHT - 100;
  const collapseEnd = expandedHeight - COLLAPSED_HEIGHT;
  const progress = Math.max(0, Math.min(1, (scrollY - collapseStart) / (collapseEnd - collapseStart)));

  // Handle scroll
  const handleScroll = useCallback(() => {
    if (!contentRef.current) return;

    const y = contentRef.current.scrollTop;
    setScrollY(y);
    setIsCompact(y > collapseEnd);
    onScroll?.(y, progress);
  }, [collapseEnd, onScroll, progress]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    content.addEventListener('scroll', handleScroll, { passive: true });
    return () => content.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Calculate parallax effect for artwork
  const parallaxOffset = Math.min(0, -scrollY * 0.5);
  const overscrollScale = scrollY < 0 ? 1 + Math.abs(scrollY) / 500 : 1;
  const artworkOpacity = 1 - progress * 0.3;

  // Calculate blur for background
  const blurAmount = Math.min(20, progress * 20);

  return (
    <div className={styles.container} ref={containerRef}>
      {/* Fixed Compact Header */}
      <header
        className={`${styles.compactHeader} ${isCompact ? styles.visible : ''}`}
        style={{
          '--blur': `${blurAmount}px`,
          '--bg-primary': colors.primary,
          '--bg-secondary': colors.secondary,
        } as React.CSSProperties}
      >
        <button
          className={styles.backButton}
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ChevronLeftIcon size={24} />
        </button>

        <div
          className={styles.compactTitle}
          style={{ opacity: isCompact ? 1 : 0 }}
        >
          {title}
        </div>

        {compactExtra && isCompact && (
          <div className={styles.compactExtra}>{compactExtra}</div>
        )}
      </header>

      {/* Floating Back Button (when not compact) */}
      {!isCompact && (
        <button
          className={styles.floatingBack}
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ChevronLeftIcon size={24} />
        </button>
      )}

      {/* Scrollable Content */}
      <div className={styles.scrollContainer} ref={contentRef}>
        {/* Parallax Header Background */}
        <div
          className={styles.headerBackground}
          style={{
            height: expandedHeight,
            transform: `translateY(${parallaxOffset}px) scale(${overscrollScale})`,
            '--bg-primary': colors.primary,
            '--bg-secondary': colors.secondary,
          } as React.CSSProperties}
        >
          {/* Artwork */}
          <div
            className={`${styles.artworkContainer} ${circular ? styles.circular : ''}`}
            style={{
              opacity: artworkOpacity,
              transform: `translateY(${scrollY * 0.3}px)`,
            }}
          >
            {artwork ? (
              <img
                src={artwork}
                alt={title}
                className={styles.artwork}
                loading="eager"
              />
            ) : (
              <div className={styles.artworkPlaceholder}>
                <MusicNoteIcon size={64} />
              </div>
            )}
          </div>

          {/* Gradient Overlay */}
          <div className={styles.gradientOverlay} />

          {/* Title in Hero */}
          <div
            className={styles.heroContent}
            style={{
              opacity: 1 - progress,
              transform: `translateY(${scrollY * 0.2}px)`,
            }}
          >
            <h1 className={styles.heroTitle}>{title}</h1>
            {subtitle && <p className={styles.heroSubtitle}>{subtitle}</p>}
          </div>
        </div>

        {/* Main Content */}
        <div
          className={styles.mainContent}
          style={{ paddingTop: expandedHeight }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export { COLLAPSED_HEIGHT, DEFAULT_EXPANDED_HEIGHT };
