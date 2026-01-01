/**
 * TimelineSection - Displays artist discography timeline from Discogs
 */

import React from 'react';
import type { TimelineEntry } from '@audiio/core';
import { MusicNoteIcon } from '@audiio/icons';

interface TimelineSectionProps {
  timeline: TimelineEntry[];
  onEntryClick?: (entry: TimelineEntry) => void;
}

export const TimelineSection: React.FC<TimelineSectionProps> = ({
  timeline,
  onEntryClick,
}) => {
  if (!timeline || timeline.length === 0) return null;

  // Group by year
  const groupedByYear = timeline.reduce((acc, entry) => {
    const year = entry.year.toString();
    if (!acc[year]) acc[year] = [];
    acc[year].push(entry);
    return acc;
  }, {} as Record<string, TimelineEntry[]>);

  // Sort years descending
  const sortedYears = Object.keys(groupedByYear).sort((a, b) => parseInt(b) - parseInt(a));

  const getTypeLabel = (type: TimelineEntry['type']): string => {
    switch (type) {
      case 'album': return 'Album';
      case 'single': return 'Single';
      case 'ep': return 'EP';
      case 'compilation': return 'Compilation';
      case 'live': return 'Live';
      default: return type;
    }
  };

  const getTypeColor = (type: TimelineEntry['type']): string => {
    switch (type) {
      case 'album': return 'var(--accent-primary)';
      case 'single': return 'var(--accent-success)';
      case 'ep': return 'var(--accent-warning)';
      case 'compilation': return 'var(--text-muted)';
      case 'live': return 'var(--accent-error)';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div className="enrichment-timeline">
      {sortedYears.slice(0, 10).map((year) => (
        <div key={year} className="timeline-year-group">
          <div className="timeline-year-marker">
            <span className="timeline-year">{year}</span>
            <div className="timeline-year-line" />
          </div>
          <div className="timeline-entries">
            {groupedByYear[year].map((entry, index) => (
              <div
                key={`${entry.title}-${index}`}
                className="timeline-entry"
                onClick={() => onEntryClick?.(entry)}
                role={onEntryClick ? 'button' : undefined}
                tabIndex={onEntryClick ? 0 : undefined}
                onKeyDown={(e) => e.key === 'Enter' && onEntryClick?.(entry)}
              >
                <div className="timeline-entry-artwork">
                  {entry.artwork ? (
                    <img src={entry.artwork} alt={entry.title} loading="lazy" />
                  ) : (
                    <div className="timeline-entry-artwork-placeholder">
                      <MusicNoteIcon size={20} />
                    </div>
                  )}
                </div>
                <div className="timeline-entry-info">
                  <span className="timeline-entry-title">{entry.title}</span>
                  <div className="timeline-entry-meta">
                    <span
                      className="timeline-entry-type"
                      style={{ color: getTypeColor(entry.type) }}
                    >
                      {getTypeLabel(entry.type)}
                    </span>
                    {entry.label && (
                      <span className="timeline-entry-label">{entry.label}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TimelineSection;
