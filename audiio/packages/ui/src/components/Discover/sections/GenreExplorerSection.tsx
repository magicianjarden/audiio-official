/**
 * GenreExplorerSection - Visual genre tiles with nested sub-genres
 * Allows users to explore and discover music by genre
 */

import React, { useState } from 'react';
import { useNavigationStore } from '../../../stores/navigation-store';
import { useSearchStore } from '../../../stores/search-store';
import { useRecommendationStore } from '../../../stores/recommendation-store';
import { BaseSectionWrapper } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import {
  GENRE_TAXONOMY,
  getParentGenres,
  getChildGenres,
  type GenreNode,
} from '../../../constants/genre-taxonomy';
import { ChevronRightIcon, ChevronDownIcon } from '../../Icons/Icons';

export interface GenreExplorerSectionProps extends BaseSectionProps {
  highlightedGenres?: string[];
  maxGenres?: number;
}

export const GenreExplorerSection: React.FC<GenreExplorerSectionProps> = ({
  id,
  title,
  subtitle,
  isPersonalized,
  context,
  highlightedGenres,
  maxGenres = 8,
  onSeeAll,
}) => {
  const { setSearchQuery } = useNavigationStore();
  const { search } = useSearchStore();
  const { getTopGenres } = useRecommendationStore();

  const [expandedGenre, setExpandedGenre] = useState<string | null>(null);

  // Get user's top genres for highlighting
  const userTopGenres = highlightedGenres ?? getTopGenres(3);
  const parentGenres = getParentGenres().slice(0, maxGenres);

  const handleGenreClick = (genre: GenreNode) => {
    if (genre.children && genre.children.length > 0) {
      // Toggle expansion
      setExpandedGenre(expandedGenre === genre.id ? null : genre.id);
    } else {
      // Navigate to search
      const query = genre.searchQuery ?? genre.name;
      setSearchQuery(query);
      search(query);
    }
  };

  const handleSubgenreClick = (genre: GenreNode) => {
    const query = genre.searchQuery ?? genre.name;
    setSearchQuery(query);
    search(query);
  };

  const isHighlighted = (genreId: string): boolean => {
    return userTopGenres.some((g) => g.toLowerCase().includes(genreId.toLowerCase()));
  };

  return (
    <BaseSectionWrapper
      id={id}
      type="genre-explorer"
      title={title}
      subtitle={subtitle}
      isPersonalized={isPersonalized}
      context={context}
      onSeeAll={onSeeAll}
      className="genre-explorer-section"
    >
      <div className="genre-grid">
        {parentGenres.map((genre, index) => (
          <GenreTile
            key={genre.id}
            genre={genre}
            index={index}
            isExpanded={expandedGenre === genre.id}
            isHighlighted={isHighlighted(genre.id)}
            onClick={() => handleGenreClick(genre)}
            onSubgenreClick={handleSubgenreClick}
          />
        ))}
      </div>

      {/* Expanded subgenres panel */}
      {expandedGenre && (
        <ExpandedSubgenres
          parentId={expandedGenre}
          onSubgenreClick={handleSubgenreClick}
          onClose={() => setExpandedGenre(null)}
        />
      )}
    </BaseSectionWrapper>
  );
};

interface GenreTileProps {
  genre: GenreNode;
  index: number;
  isExpanded: boolean;
  isHighlighted: boolean;
  onClick: () => void;
  onSubgenreClick: (genre: GenreNode) => void;
}

const GenreTile: React.FC<GenreTileProps> = ({
  genre,
  index,
  isExpanded,
  isHighlighted,
  onClick,
}) => {
  const hasChildren = genre.children && genre.children.length > 0;

  return (
    <div
      className={`genre-tile ${isExpanded ? 'expanded' : ''} ${isHighlighted ? 'highlighted' : ''}`}
      style={{
        '--genre-color': genre.color,
        animationDelay: `${index * 50}ms`,
      } as React.CSSProperties}
      onClick={onClick}
    >
      <div
        className="genre-tile-bg"
        style={{
          background: `linear-gradient(135deg, ${genre.color}40 0%, ${genre.color}10 100%)`,
        }}
      />

      <div className="genre-tile-content">
        <span className="genre-tile-name">{genre.name}</span>

        {hasChildren && (
          <span className="genre-tile-expand">
            {isExpanded ? (
              <ChevronDownIcon size={16} />
            ) : (
              <ChevronRightIcon size={16} />
            )}
          </span>
        )}
      </div>

      {isHighlighted && (
        <span className="genre-tile-badge">Your Taste</span>
      )}

      {/* Decorative accent */}
      <div
        className="genre-tile-accent"
        style={{ backgroundColor: genre.color }}
      />
    </div>
  );
};

interface ExpandedSubgenresProps {
  parentId: string;
  onSubgenreClick: (genre: GenreNode) => void;
  onClose: () => void;
}

const ExpandedSubgenres: React.FC<ExpandedSubgenresProps> = ({
  parentId,
  onSubgenreClick,
  onClose,
}) => {
  const subgenres = getChildGenres(parentId);
  const parent = getParentGenres().find((g) => g.id === parentId);

  if (subgenres.length === 0 || !parent) {
    return null;
  }

  return (
    <div className="subgenres-panel" onClick={(e) => e.stopPropagation()}>
      <div className="subgenres-header">
        <h4 className="subgenres-title">
          Explore <span style={{ color: parent.color }}>{parent.name}</span>
        </h4>
        <button className="subgenres-close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="subgenres-grid">
        {subgenres.map((subgenre, index) => (
          <button
            key={subgenre.id}
            className="subgenre-pill"
            style={{
              '--subgenre-color': subgenre.color,
              animationDelay: `${index * 30}ms`,
            } as React.CSSProperties}
            onClick={() => onSubgenreClick(subgenre)}
          >
            <span
              className="subgenre-dot"
              style={{ backgroundColor: subgenre.color }}
            />
            {subgenre.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default GenreExplorerSection;
