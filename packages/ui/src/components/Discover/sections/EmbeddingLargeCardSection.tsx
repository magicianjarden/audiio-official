/**
 * EmbeddingLargeCardSection - Large card section with embedding support
 * Uses embedding-based playlist generation with search fallback
 */

import React from 'react';
import { LargeCardSection, type LargeCardSectionProps } from './LargeCardSection';
import { useSectionTracks, type EmbeddingConfig } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import { debugLog } from '../../../utils/debug';

export interface EmbeddingLargeCardSectionProps extends BaseSectionProps {
  query?: string;
  embedding?: EmbeddingConfig;
  maxItems?: number;
}

export const EmbeddingLargeCardSection: React.FC<EmbeddingLargeCardSectionProps> = ({
  id,
  title,
  subtitle,
  query,
  embedding,
  maxItems = 6,
}) => {
  const { tracks, isLoading, source } = useSectionTracks(query, {
    limit: maxItems,
    shuffle: true,
    embedding,
  });

  // Log which source is being used (for debugging)
  if (source !== 'none' && tracks.length > 0) {
    debugLog(
      '[EmbeddingLargeCard]',
      `"${title}" using ${source} (${tracks.length} tracks)`
    );
  }

  return (
    <LargeCardSection
      id={id}
      title={title}
      subtitle={subtitle}
      tracks={tracks}
      isLoading={isLoading}
      maxItems={maxItems}
    />
  );
};

export default EmbeddingLargeCardSection;
