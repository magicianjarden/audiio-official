/**
 * QuickMixSection - Mood/genre pill buttons that navigate to MixView
 */

import React from 'react';
import { useNavigationStore, type MixData } from '../../../stores/navigation-store';

export interface QuickMix {
  id: string;
  name: string;
  icon: string;
  query: string;
  description?: string;
  gradient: string;
}

// Default mixes available
export const DEFAULT_QUICK_MIXES: QuickMix[] = [
  {
    id: 'chill',
    name: 'Chill',
    icon: '🎹',
    query: 'chill lofi beats relaxing',
    description: 'Relaxing vibes for your downtime',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  {
    id: 'focus',
    name: 'Focus',
    icon: '🎧',
    query: 'focus concentration study ambient',
    description: 'Music to help you concentrate',
    gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
  },
  {
    id: 'workout',
    name: 'Workout',
    icon: '💪',
    query: 'workout motivation high energy',
    description: 'High energy tracks to power your workout',
    gradient: 'linear-gradient(135deg, #eb3349 0%, #f45c43 100%)',
  },
  {
    id: 'party',
    name: 'Party',
    icon: '🎉',
    query: 'party dance hits 2024',
    description: 'Get the party started',
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  },
  {
    id: 'sleep',
    name: 'Sleep',
    icon: '🌙',
    query: 'sleep ambient calm peaceful',
    description: 'Peaceful sounds for restful sleep',
    gradient: 'linear-gradient(135deg, #4e54c8 0%, #8f94fb 100%)',
  },
  {
    id: 'happy',
    name: 'Happy',
    icon: '☀️',
    query: 'happy uplifting feel good',
    description: 'Feel-good music to brighten your day',
    gradient: 'linear-gradient(135deg, #f5af19 0%, #f12711 100%)',
  },
  {
    id: 'sad',
    name: 'Sad',
    icon: '🌧️',
    query: 'sad emotional melancholy',
    description: 'Music for when you need to feel',
    gradient: 'linear-gradient(135deg, #536976 0%, #292e49 100%)',
  },
  {
    id: 'rock',
    name: 'Rock',
    icon: '🎸',
    query: 'rock classic rock alternative',
    description: 'Rock anthems and guitar riffs',
    gradient: 'linear-gradient(135deg, #232526 0%, #414345 100%)',
  },
];

export interface QuickMixSectionProps {
  id: string;
  title: string;
  mixes?: QuickMix[];
}

export const QuickMixSection: React.FC<QuickMixSectionProps> = ({
  title,
  mixes = DEFAULT_QUICK_MIXES,
}) => {
  const { openMix } = useNavigationStore();

  const handleMixClick = (mix: QuickMix) => {
    const mixData: MixData = {
      id: mix.id,
      name: mix.name,
      description: mix.description,
      query: mix.query,
      gradient: mix.gradient,
      icon: mix.icon,
    };
    openMix(mixData);
  };

  return (
    <section className="discover-quick-mix-section">
      <h2 className="discover-section-title">{title}</h2>
      <div className="quick-mix-grid">
        {mixes.map(mix => (
          <button
            key={mix.id}
            className="quick-mix-pill"
            onClick={() => handleMixClick(mix)}
            style={{ background: mix.gradient }}
          >
            <span className="quick-mix-icon">{mix.icon}</span>
            <span className="quick-mix-name">{mix.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
};

export default QuickMixSection;
