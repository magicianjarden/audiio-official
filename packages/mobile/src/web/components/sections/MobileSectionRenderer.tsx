/**
 * MobileSectionRenderer - Renders sections based on their type
 *
 * Takes section data from the API and renders the appropriate
 * section component based on the section type.
 */

import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueueControls } from '../../stores/player-store';
import { triggerHaptic } from '../../utils/haptics';
import { MobileHorizontalSection } from './MobileHorizontalSection';
import { SectionData, SectionTrack, SectionArtist, SectionAlbum, getSectionLayout } from './MobileSectionRegistry';

interface MobileSectionRendererProps {
  sections: SectionData[];
  isLoading?: boolean;
}

export function MobileSectionRenderer({ sections, isLoading }: MobileSectionRendererProps) {
  const navigate = useNavigate();
  const { setQueue } = useQueueControls();

  const handleTrackPlay = useCallback((track: SectionTrack, tracks: SectionTrack[]) => {
    triggerHaptic('medium');
    const trackIndex = tracks.findIndex(t => t.id === track.id);
    // setQueue already calls play() internally with the track at startIndex
    setQueue(tracks as any[], Math.max(0, trackIndex));
  }, [setQueue]);

  const handleArtistClick = useCallback((artist: SectionArtist) => {
    triggerHaptic('light');
    navigate(`/artist/${artist.id}?name=${encodeURIComponent(artist.name)}&source=${artist.source || 'deezer'}`);
  }, [navigate]);

  const handleAlbumClick = useCallback((album: SectionAlbum) => {
    triggerHaptic('light');
    const albumName = album.title || album.name || '';
    navigate(`/album/${album.id}?name=${encodeURIComponent(albumName)}&source=${album.source || 'deezer'}`);
  }, [navigate]);

  if (isLoading) {
    return (
      <div>
        {[0, 1, 2].map((i) => (
          <MobileHorizontalSection
            key={i}
            section={{ id: `skeleton-${i}`, type: 'loading', title: '' }}
            index={i}
          />
        ))}
      </div>
    );
  }

  if (!sections || sections.length === 0) {
    return null;
  }

  return (
    <>
      {sections.map((section, index) => {
        const layout = getSectionLayout(section.type);

        // For now, render everything as horizontal sections
        // More section types can be added here as needed
        switch (layout) {
          case 'horizontal':
          case 'large-cards':
          case 'grid':
          case 'list':
          case 'compact':
          default:
            return (
              <MobileHorizontalSection
                key={section.id}
                section={section}
                index={index}
                onTrackPlay={handleTrackPlay}
                onArtistClick={handleArtistClick}
                onAlbumClick={handleAlbumClick}
              />
            );
        }
      })}
    </>
  );
}

// Re-export types for convenience
export type { SectionData, SectionTrack, SectionArtist, SectionAlbum };
