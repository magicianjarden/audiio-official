/**
 * ConcertsSection - Displays upcoming concerts from Bandsintown
 */

import React from 'react';
import type { Concert } from '@audiio/core';

interface ConcertsSectionProps {
  concerts: Concert[];
}

export const ConcertsSection: React.FC<ConcertsSectionProps> = ({ concerts }) => {
  if (!concerts || concerts.length === 0) return null;

  const formatDate = (dateStr: string): { day: string; month: string; year: string } => {
    try {
      const date = new Date(dateStr);
      return {
        day: date.getDate().toString(),
        month: date.toLocaleDateString(undefined, { month: 'short' }),
        year: date.getFullYear().toString(),
      };
    } catch {
      return { day: '--', month: '---', year: '----' };
    }
  };

  const formatLocation = (venue: Concert['venue']): string => {
    const parts = [venue.city];
    if (venue.region) parts.push(venue.region);
    if (venue.country) parts.push(venue.country);
    return parts.join(', ');
  };

  return (
    <div className="enrichment-concerts-list">
      {concerts.slice(0, 5).map((concert) => {
        const date = formatDate(concert.datetime);
        return (
          <div key={concert.id} className="concert-card">
            <div className="concert-date">
              <span className="concert-date-month">{date.month}</span>
              <span className="concert-date-day">{date.day}</span>
            </div>
            <div className="concert-info">
              <span className="concert-venue">{concert.venue.name}</span>
              <span className="concert-location">{formatLocation(concert.venue)}</span>
              {concert.lineup && concert.lineup.length > 1 && (
                <span className="concert-lineup">
                  with {concert.lineup.slice(1, 3).join(', ')}
                  {concert.lineup.length > 3 ? ` +${concert.lineup.length - 3} more` : ''}
                </span>
              )}
            </div>
            {concert.ticketUrl && (
              <a
                href={concert.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="concert-tickets-btn"
                onClick={(e) => e.stopPropagation()}
              >
                Tickets
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ConcertsSection;
