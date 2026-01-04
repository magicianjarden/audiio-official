/**
 * MobileSectionRegistry - Maps desktop section types to mobile renderers
 *
 * This registry defines how each section type from the desktop
 * should be rendered on mobile.
 */

import { ComponentType } from 'react';

export interface SectionTrack {
  id: string;
  title: string;
  artists?: { id: string; name: string }[];
  album?: {
    id: string;
    name?: string;
    title?: string;
    artwork?: {
      small?: string;
      medium?: string;
      large?: string;
      original?: string;
    };
  };
  artwork?: {
    small?: string;
    medium?: string;
    large?: string;
    original?: string;
  };
  duration?: number;
  source?: string;
}

export interface SectionArtist {
  id: string;
  name: string;
  image?: string;
  source?: string;
}

export interface SectionAlbum {
  id: string;
  title?: string;
  name?: string;
  artwork?: {
    small?: string;
    medium?: string;
    large?: string;
    original?: string;
  };
  artists?: { id: string; name: string }[];
  source?: string;
}

export interface SectionGenre {
  id: string;
  name: string;
  color?: string;
  image?: string;
}

export interface SectionData {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  tracks?: SectionTrack[];
  artists?: SectionArtist[];
  albums?: SectionAlbum[];
  genres?: SectionGenre[];
  isPersonalized?: boolean;
  isPluginPowered?: boolean;
  pluginName?: string;
}

export interface SectionProps {
  section: SectionData;
  index: number;
  onTrackPlay?: (track: SectionTrack, tracks: SectionTrack[]) => void;
  onArtistClick?: (artist: SectionArtist) => void;
  onAlbumClick?: (album: SectionAlbum) => void;
}

// Section type to renderer mapping
export type SectionRenderer = ComponentType<SectionProps>;

// Layout types for sections
export type SectionLayout = 'horizontal' | 'grid' | 'large-cards' | 'list' | 'compact';

// Map section types to their preferred layout
export const sectionTypeLayouts: Record<string, SectionLayout> = {
  // Horizontal scroll sections
  'trending-tracks': 'horizontal',
  'quick-picks': 'horizontal',
  'recently-played': 'horizontal',
  'for-you': 'horizontal',
  'artist-radio': 'horizontal',
  'similar-tracks': 'horizontal',
  'fresh-finds': 'horizontal',
  'deep-cuts': 'horizontal',
  'lyrics-highlight': 'horizontal',
  'streaming-highlights': 'horizontal',
  'seasonal': 'horizontal',
  'trending': 'horizontal',
  'recommended': 'horizontal',
  'ml-powered': 'horizontal',
  'mixes': 'horizontal',
  'plugin': 'horizontal',

  // Large featured cards
  'featured': 'large-cards',
  'new-releases': 'large-cards',
  'top-albums': 'large-cards',

  // Grid layouts
  'top-artists': 'grid',
  'popular-artists': 'grid',
  'suggested-artists': 'grid',
  'artists': 'grid',
  'genres': 'grid',

  // Compact list layouts
  'audio-analysis': 'compact',
  'focus-mode': 'compact',
};

// Get the preferred layout for a section type
export function getSectionLayout(type: string): SectionLayout {
  return sectionTypeLayouts[type] || 'horizontal';
}
