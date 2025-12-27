/**
 * Genre Taxonomy - Hierarchical genre classification
 * Used by GenreExplorerSection for visual genre exploration
 */

export interface GenreNode {
  id: string;
  name: string;
  color: string;
  icon?: string;
  children?: GenreNode[];
  searchQuery?: string; // Custom search query for this genre
}

export interface GenreTaxonomy {
  root: GenreNode[];
}

// Color palette for genre categories - using CSS variables for theme support
export const GENRE_COLORS = {
  rock: 'var(--color-genre-rock)',
  pop: 'var(--color-genre-pop)',
  hiphop: 'var(--color-genre-hiphop)',
  electronic: 'var(--color-genre-electronic)',
  rnb: 'var(--color-genre-rnb)',
  jazz: 'var(--color-genre-jazz)',
  classical: 'var(--color-genre-classical)',
  country: 'var(--color-genre-country)',
  latin: 'var(--color-genre-latin)',
  metal: 'var(--color-genre-metal)',
  folk: 'var(--color-genre-folk)',
  blues: 'var(--color-genre-blues)',
  reggae: 'var(--color-genre-reggae)',
  world: 'var(--color-genre-world)',
  ambient: 'var(--color-genre-ambient)',
} as const;

export const GENRE_TAXONOMY: GenreTaxonomy = {
  root: [
    {
      id: 'pop',
      name: 'Pop',
      color: GENRE_COLORS.pop,
      searchQuery: 'pop music',
      children: [
        { id: 'synth-pop', name: 'Synth Pop', color: '#a855f7', searchQuery: 'synth pop' },
        { id: 'dance-pop', name: 'Dance Pop', color: '#c084fc', searchQuery: 'dance pop' },
        { id: 'indie-pop', name: 'Indie Pop', color: '#d8b4fe', searchQuery: 'indie pop' },
        { id: 'k-pop', name: 'K-Pop', color: '#e879f9', searchQuery: 'k-pop' },
        { id: 'j-pop', name: 'J-Pop', color: '#f0abfc', searchQuery: 'j-pop' },
        { id: 'art-pop', name: 'Art Pop', color: '#f5d0fe', searchQuery: 'art pop' },
      ],
    },
    {
      id: 'rock',
      name: 'Rock',
      color: GENRE_COLORS.rock,
      searchQuery: 'rock music',
      children: [
        { id: 'indie-rock', name: 'Indie Rock', color: '#ef4444', searchQuery: 'indie rock' },
        { id: 'alt-rock', name: 'Alternative', color: '#dc2626', searchQuery: 'alternative rock' },
        { id: 'classic-rock', name: 'Classic Rock', color: '#b91c1c', searchQuery: 'classic rock' },
        { id: 'punk-rock', name: 'Punk', color: '#991b1b', searchQuery: 'punk rock' },
        { id: 'prog-rock', name: 'Progressive', color: '#7f1d1d', searchQuery: 'progressive rock' },
        { id: 'garage-rock', name: 'Garage', color: '#fca5a5', searchQuery: 'garage rock' },
      ],
    },
    {
      id: 'hiphop',
      name: 'Hip Hop',
      color: GENRE_COLORS.hiphop,
      searchQuery: 'hip hop music',
      children: [
        { id: 'trap', name: 'Trap', color: '#f59e0b', searchQuery: 'trap music' },
        { id: 'boom-bap', name: 'Boom Bap', color: '#d97706', searchQuery: 'boom bap' },
        { id: 'conscious', name: 'Conscious', color: '#b45309', searchQuery: 'conscious hip hop' },
        { id: 'drill', name: 'Drill', color: '#92400e', searchQuery: 'drill music' },
        { id: 'lo-fi-hiphop', name: 'Lo-Fi Hip Hop', color: '#fbbf24', searchQuery: 'lo-fi hip hop' },
        { id: 'old-school', name: 'Old School', color: '#fcd34d', searchQuery: 'old school hip hop' },
      ],
    },
    {
      id: 'electronic',
      name: 'Electronic',
      color: GENRE_COLORS.electronic,
      searchQuery: 'electronic music',
      children: [
        { id: 'house', name: 'House', color: '#06b6d4', searchQuery: 'house music' },
        { id: 'techno', name: 'Techno', color: '#0891b2', searchQuery: 'techno' },
        { id: 'edm', name: 'EDM', color: '#0e7490', searchQuery: 'edm' },
        { id: 'dubstep', name: 'Dubstep', color: '#155e75', searchQuery: 'dubstep' },
        { id: 'dnb', name: 'Drum & Bass', color: '#164e63', searchQuery: 'drum and bass' },
        { id: 'trance', name: 'Trance', color: '#22d3ee', searchQuery: 'trance music' },
        { id: 'ambient-electronic', name: 'Ambient', color: '#67e8f9', searchQuery: 'ambient electronic' },
      ],
    },
    {
      id: 'rnb',
      name: 'R&B / Soul',
      color: GENRE_COLORS.rnb,
      searchQuery: 'r&b soul music',
      children: [
        { id: 'contemporary-rnb', name: 'Contemporary R&B', color: '#ec4899', searchQuery: 'contemporary r&b' },
        { id: 'neo-soul', name: 'Neo Soul', color: '#db2777', searchQuery: 'neo soul' },
        { id: 'classic-soul', name: 'Classic Soul', color: '#be185d', searchQuery: 'classic soul' },
        { id: 'funk', name: 'Funk', color: '#9d174d', searchQuery: 'funk music' },
        { id: 'motown', name: 'Motown', color: '#f472b6', searchQuery: 'motown' },
      ],
    },
    {
      id: 'jazz',
      name: 'Jazz',
      color: GENRE_COLORS.jazz,
      searchQuery: 'jazz music',
      children: [
        { id: 'smooth-jazz', name: 'Smooth Jazz', color: '#3b82f6', searchQuery: 'smooth jazz' },
        { id: 'bebop', name: 'Bebop', color: '#2563eb', searchQuery: 'bebop jazz' },
        { id: 'fusion', name: 'Fusion', color: '#1d4ed8', searchQuery: 'jazz fusion' },
        { id: 'vocal-jazz', name: 'Vocal Jazz', color: '#1e40af', searchQuery: 'vocal jazz' },
        { id: 'free-jazz', name: 'Free Jazz', color: '#60a5fa', searchQuery: 'free jazz' },
      ],
    },
    {
      id: 'classical',
      name: 'Classical',
      color: GENRE_COLORS.classical,
      searchQuery: 'classical music',
      children: [
        { id: 'orchestral', name: 'Orchestral', color: '#a855f7', searchQuery: 'orchestral classical' },
        { id: 'chamber', name: 'Chamber', color: '#9333ea', searchQuery: 'chamber music' },
        { id: 'piano', name: 'Piano', color: '#7c3aed', searchQuery: 'classical piano' },
        { id: 'opera', name: 'Opera', color: '#6d28d9', searchQuery: 'opera' },
        { id: 'modern-classical', name: 'Modern', color: '#c084fc', searchQuery: 'modern classical' },
      ],
    },
    {
      id: 'country',
      name: 'Country',
      color: GENRE_COLORS.country,
      searchQuery: 'country music',
      children: [
        { id: 'modern-country', name: 'Modern Country', color: '#ea580c', searchQuery: 'modern country' },
        { id: 'classic-country', name: 'Classic Country', color: '#c2410c', searchQuery: 'classic country' },
        { id: 'country-rock', name: 'Country Rock', color: '#9a3412', searchQuery: 'country rock' },
        { id: 'americana', name: 'Americana', color: '#fb923c', searchQuery: 'americana' },
        { id: 'bluegrass', name: 'Bluegrass', color: '#fdba74', searchQuery: 'bluegrass' },
      ],
    },
    {
      id: 'latin',
      name: 'Latin',
      color: GENRE_COLORS.latin,
      searchQuery: 'latin music',
      children: [
        { id: 'reggaeton', name: 'Reggaeton', color: '#f97316', searchQuery: 'reggaeton' },
        { id: 'salsa', name: 'Salsa', color: '#ea580c', searchQuery: 'salsa' },
        { id: 'bachata', name: 'Bachata', color: '#c2410c', searchQuery: 'bachata' },
        { id: 'latin-pop', name: 'Latin Pop', color: '#fb923c', searchQuery: 'latin pop' },
        { id: 'cumbia', name: 'Cumbia', color: '#fed7aa', searchQuery: 'cumbia' },
      ],
    },
    {
      id: 'metal',
      name: 'Metal',
      color: GENRE_COLORS.metal,
      searchQuery: 'metal music',
      children: [
        { id: 'heavy-metal', name: 'Heavy Metal', color: '#334155', searchQuery: 'heavy metal' },
        { id: 'death-metal', name: 'Death Metal', color: '#1e293b', searchQuery: 'death metal' },
        { id: 'black-metal', name: 'Black Metal', color: '#0f172a', searchQuery: 'black metal' },
        { id: 'prog-metal', name: 'Progressive Metal', color: '#475569', searchQuery: 'progressive metal' },
        { id: 'metalcore', name: 'Metalcore', color: '#64748b', searchQuery: 'metalcore' },
      ],
    },
    {
      id: 'folk',
      name: 'Folk',
      color: GENRE_COLORS.folk,
      searchQuery: 'folk music',
      children: [
        { id: 'indie-folk', name: 'Indie Folk', color: '#22c55e', searchQuery: 'indie folk' },
        { id: 'traditional-folk', name: 'Traditional', color: '#16a34a', searchQuery: 'traditional folk' },
        { id: 'folk-rock', name: 'Folk Rock', color: '#15803d', searchQuery: 'folk rock' },
        { id: 'singer-songwriter', name: 'Singer-Songwriter', color: '#4ade80', searchQuery: 'singer songwriter' },
      ],
    },
    {
      id: 'blues',
      name: 'Blues',
      color: GENRE_COLORS.blues,
      searchQuery: 'blues music',
      children: [
        { id: 'electric-blues', name: 'Electric Blues', color: '#3b82f6', searchQuery: 'electric blues' },
        { id: 'delta-blues', name: 'Delta Blues', color: '#2563eb', searchQuery: 'delta blues' },
        { id: 'chicago-blues', name: 'Chicago Blues', color: '#1d4ed8', searchQuery: 'chicago blues' },
        { id: 'blues-rock', name: 'Blues Rock', color: '#60a5fa', searchQuery: 'blues rock' },
      ],
    },
    {
      id: 'reggae',
      name: 'Reggae',
      color: GENRE_COLORS.reggae,
      searchQuery: 'reggae music',
      children: [
        { id: 'roots-reggae', name: 'Roots Reggae', color: '#14b8a6', searchQuery: 'roots reggae' },
        { id: 'dub', name: 'Dub', color: '#0d9488', searchQuery: 'dub music' },
        { id: 'dancehall', name: 'Dancehall', color: '#0f766e', searchQuery: 'dancehall' },
        { id: 'ska', name: 'Ska', color: '#2dd4bf', searchQuery: 'ska' },
      ],
    },
    {
      id: 'world',
      name: 'World',
      color: GENRE_COLORS.world,
      searchQuery: 'world music',
      children: [
        { id: 'afrobeat', name: 'Afrobeat', color: '#78350f', searchQuery: 'afrobeat' },
        { id: 'indian', name: 'Indian', color: '#92400e', searchQuery: 'indian music' },
        { id: 'celtic', name: 'Celtic', color: '#a16207', searchQuery: 'celtic music' },
        { id: 'middle-eastern', name: 'Middle Eastern', color: '#854d0e', searchQuery: 'middle eastern music' },
        { id: 'asian', name: 'Asian', color: '#a3a3a3', searchQuery: 'asian music' },
      ],
    },
    {
      id: 'ambient',
      name: 'Ambient / Chill',
      color: GENRE_COLORS.ambient,
      searchQuery: 'ambient chill music',
      children: [
        { id: 'lofi', name: 'Lo-Fi', color: '#64748b', searchQuery: 'lo-fi beats' },
        { id: 'chillout', name: 'Chillout', color: '#475569', searchQuery: 'chillout' },
        { id: 'downtempo', name: 'Downtempo', color: '#334155', searchQuery: 'downtempo' },
        { id: 'new-age', name: 'New Age', color: '#94a3b8', searchQuery: 'new age music' },
        { id: 'sleep', name: 'Sleep', color: '#cbd5e1', searchQuery: 'sleep music' },
      ],
    },
  ],
};

/**
 * Get all genres as a flat list
 */
export function getAllGenres(): GenreNode[] {
  const genres: GenreNode[] = [];

  function traverse(nodes: GenreNode[]) {
    for (const node of nodes) {
      genres.push(node);
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(GENRE_TAXONOMY.root);
  return genres;
}

/**
 * Find a genre by ID
 */
export function findGenreById(id: string): GenreNode | undefined {
  function search(nodes: GenreNode[]): GenreNode | undefined {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = search(node.children);
        if (found) return found;
      }
    }
    return undefined;
  }

  return search(GENRE_TAXONOMY.root);
}

/**
 * Get parent genres (top-level only)
 */
export function getParentGenres(): GenreNode[] {
  return GENRE_TAXONOMY.root;
}

/**
 * Get child genres for a parent
 */
export function getChildGenres(parentId: string): GenreNode[] {
  const parent = findGenreById(parentId);
  return parent?.children ?? [];
}

/**
 * Match a genre string to taxonomy node
 */
export function matchGenreToTaxonomy(genreString: string): GenreNode | undefined {
  const normalized = genreString.toLowerCase().trim();
  const allGenres = getAllGenres();

  // Exact match
  let match = allGenres.find((g) => g.id === normalized || g.name.toLowerCase() === normalized);
  if (match) return match;

  // Partial match
  match = allGenres.find(
    (g) => normalized.includes(g.id) || normalized.includes(g.name.toLowerCase())
  );

  return match;
}

export default GENRE_TAXONOMY;
