/**
 * GallerySection - Displays artist images with enhanced lightbox viewer
 * Features: Tab navigation, image grid, lightbox with prev/next and keyboard support
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { ArtistImages } from '@audiio/core';

interface GallerySectionProps {
  gallery: ArtistImages;
}

type GalleryTab = 'backgrounds' | 'thumbs' | 'logos';

export const GallerySection: React.FC<GallerySectionProps> = ({ gallery }) => {
  const [activeTab, setActiveTab] = useState<GalleryTab>('backgrounds');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!gallery) return null;

  // Check what content is available
  const hasBackgrounds = gallery.backgrounds && gallery.backgrounds.length > 0;
  const hasThumbs = gallery.thumbs && gallery.thumbs.length > 0;
  const hasLogos = (gallery.logos && gallery.logos.length > 0) || (gallery.hdLogos && gallery.hdLogos.length > 0);

  if (!hasBackgrounds && !hasThumbs && !hasLogos) return null;

  const getActiveImages = (): Array<{ url: string; likes?: number }> => {
    switch (activeTab) {
      case 'backgrounds':
        return gallery.backgrounds || [];
      case 'thumbs':
        return gallery.thumbs || [];
      case 'logos':
        return [...(gallery.hdLogos || []), ...(gallery.logos || [])];
      default:
        return [];
    }
  };

  const activeImages = getActiveImages();
  const displayedImages = activeImages.slice(0, 12);

  // Navigation handlers
  const handlePrev = useCallback(() => {
    setLightboxIndex(i => (i !== null && i > 0) ? i - 1 : i);
  }, []);

  const handleNext = useCallback(() => {
    setLightboxIndex(i => (i !== null && i < displayedImages.length - 1) ? i + 1 : i);
  }, [displayedImages.length]);

  const handleClose = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (lightboxIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          handleClose();
          break;
        case 'ArrowLeft':
          handlePrev();
          break;
        case 'ArrowRight':
          handleNext();
          break;
      }
    };

    // Prevent body scroll when lightbox is open
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [lightboxIndex, handleClose, handlePrev, handleNext]);

  const currentImage = lightboxIndex !== null ? displayedImages[lightboxIndex] : null;
  const canGoPrev = lightboxIndex !== null && lightboxIndex > 0;
  const canGoNext = lightboxIndex !== null && lightboxIndex < displayedImages.length - 1;

  return (
    <div className="enrichment-gallery">
      {/* Tabs */}
      <div className="gallery-tabs">
        {hasBackgrounds && (
          <button
            className={`gallery-tab ${activeTab === 'backgrounds' ? 'active' : ''}`}
            onClick={() => setActiveTab('backgrounds')}
          >
            Backgrounds
            <span className="gallery-tab-count">{gallery.backgrounds?.length || 0}</span>
          </button>
        )}
        {hasThumbs && (
          <button
            className={`gallery-tab ${activeTab === 'thumbs' ? 'active' : ''}`}
            onClick={() => setActiveTab('thumbs')}
          >
            Photos
            <span className="gallery-tab-count">{gallery.thumbs?.length || 0}</span>
          </button>
        )}
        {hasLogos && (
          <button
            className={`gallery-tab ${activeTab === 'logos' ? 'active' : ''}`}
            onClick={() => setActiveTab('logos')}
          >
            Logos
            <span className="gallery-tab-count">
              {(gallery.hdLogos?.length || 0) + (gallery.logos?.length || 0)}
            </span>
          </button>
        )}
      </div>

      {/* Image Grid */}
      <div className={`gallery-grid gallery-grid-${activeTab}`}>
        {displayedImages.map((image, index) => (
          <div
            key={`${image.url}-${index}`}
            className="gallery-image"
            onClick={() => setLightboxIndex(index)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setLightboxIndex(index)}
          >
            <img src={image.url} alt={`Gallery image ${index + 1}`} loading="lazy" />
            {image.likes !== undefined && image.likes > 0 && (
              <span className="gallery-image-likes">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
                {image.likes}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Enhanced Lightbox */}
      {currentImage && (
        <div
          className="gallery-lightbox"
          onClick={(e) => e.target === e.currentTarget && handleClose()}
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
        >
          {/* Close button */}
          <button
            className="gallery-lightbox-close"
            onClick={handleClose}
            aria-label="Close lightbox"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>

          {/* Image counter */}
          <div className="gallery-lightbox-counter">
            {lightboxIndex! + 1} / {displayedImages.length}
          </div>

          {/* Previous button */}
          <button
            className={`gallery-lightbox-nav gallery-lightbox-prev ${!canGoPrev ? 'disabled' : ''}`}
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            disabled={!canGoPrev}
            aria-label="Previous image"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
            </svg>
          </button>

          {/* Image container */}
          <div className="gallery-lightbox-image-container">
            <img
              src={currentImage.url}
              alt={`Gallery image ${lightboxIndex! + 1}`}
              className="gallery-lightbox-image"
            />
            {currentImage.likes !== undefined && currentImage.likes > 0 && (
              <div className="gallery-lightbox-info">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
                <span>{currentImage.likes} likes</span>
              </div>
            )}
          </div>

          {/* Next button */}
          <button
            className={`gallery-lightbox-nav gallery-lightbox-next ${!canGoNext ? 'disabled' : ''}`}
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            disabled={!canGoNext}
            aria-label="Next image"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default GallerySection;
