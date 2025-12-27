/**
 * EmbeddingHorizontalSection - Horizontal section with embedding support
 * Uses embedding-based playlist generation with search fallback
 */

import React from 'react';
import { HorizontalSection, type HorizontalSectionProps } from './HorizontalSection';
import { useSectionTracks, type EmbeddingConfig } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import { debugLog } from '../../../utils/debug';

export interface EmbeddingHorizontalSectionProps extends BaseSectionProps {
  query?: string;
  embedding?: EmbeddingConfig;
  maxItems?: number;
}

export const EmbeddingHorizontalSection: React.FC<EmbeddingHorizontalSectionProps> = ({
  id,
  title,
  subtitle,
  query,
  embedding,
  onSeeAll,
  maxItems = 12,
}) => {
  const { tracks, isLoading, source } = useSectionTracks(query, {
    limit: maxItems,
    shuffle: true,
    embedding,
  });

  // Log which source is being used (for debugging)
  if (source !== 'none' && tracks.length > 0) {
    debugLog(
      '[EmbeddingHorizontal]',
      `"${title}" using ${source} (${tracks.length} tracks)`
    );
  }

  return (
    <HorizontalSection
      id={id}
      title={title}
      subtitle={subtitle}
      tracks={tracks}
      isLoading={isLoading}
      onSeeAll={onSeeAll}
    />
  );
};

export default EmbeddingHorizontalSection;
