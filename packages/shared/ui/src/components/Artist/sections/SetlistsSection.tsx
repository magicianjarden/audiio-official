/**
 * SetlistsSection - Displays past concert setlists from Setlist.fm
 */

import React, { useState } from 'react';
import type { Setlist } from '@audiio/core';

interface SetlistsSectionProps {
  setlists: Setlist[];
}

export const SetlistsSection: React.FC<SetlistsSectionProps> = ({ setlists }) => {
  const [expandedSetlist, setExpandedSetlist] = useState<string | null>(null);

  if (!setlists || setlists.length === 0) return null;

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatLocation = (venue: Setlist['venue']): string => {
    return `${venue.name}, ${venue.city}, ${venue.country}`;
  };

  const toggleSetlist = (id: string) => {
    setExpandedSetlist(prev => prev === id ? null : id);
  };

  return (
    <div className="enrichment-setlists-list">
      {setlists.slice(0, 5).map((setlist) => {
        const isExpanded = expandedSetlist === setlist.id;
        return (
          <div key={setlist.id} className={`setlist-card ${isExpanded ? 'expanded' : ''}`}>
            <button
              className="setlist-header"
              onClick={() => toggleSetlist(setlist.id)}
              aria-expanded={isExpanded}
            >
              <div className="setlist-info">
                <span className="setlist-date">{formatDate(setlist.eventDate)}</span>
                <span className="setlist-venue">{formatLocation(setlist.venue)}</span>
                {setlist.tour && (
                  <span className="setlist-tour">{setlist.tour}</span>
                )}
              </div>
              <div className="setlist-meta">
                <span className="setlist-song-count">{setlist.songs.length} songs</span>
                <span className={`setlist-chevron ${isExpanded ? 'rotated' : ''}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 10l5 5 5-5z"/>
                  </svg>
                </span>
              </div>
            </button>

            {isExpanded && setlist.songs.length > 0 && (
              <div className="setlist-songs">
                <ol className="setlist-songs-list">
                  {setlist.songs.map((song, index) => (
                    <li key={index} className={`setlist-song ${song.cover ? 'cover' : ''}`}>
                      <span className="setlist-song-number">{index + 1}</span>
                      <span className="setlist-song-name">{song.name}</span>
                      {song.cover && <span className="setlist-song-cover-badge">Cover</span>}
                      {song.info && <span className="setlist-song-info">{song.info}</span>}
                    </li>
                  ))}
                </ol>
                {setlist.url && (
                  <a
                    href={setlist.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="setlist-view-link"
                  >
                    View on Setlist.fm
                  </a>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SetlistsSection;
