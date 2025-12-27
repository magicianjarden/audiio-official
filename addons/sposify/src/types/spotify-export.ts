/**
 * Types for Spotify Data Export (Privacy Request)
 * These match the JSON structure from Spotify's data export
 */

// StreamingHistory*.json entries
export interface SpotifyStreamingHistoryEntry {
  endTime: string; // "2024-01-15 14:30"
  artistName: string;
  trackName: string;
  msPlayed: number;
}

// Extended streaming history (if available)
export interface SpotifyExtendedStreamingHistory {
  ts: string; // ISO timestamp
  username: string;
  platform: string;
  ms_played: number;
  conn_country: string;
  ip_addr_decrypted: string;
  user_agent_decrypted: string;
  master_metadata_track_name: string;
  master_metadata_album_artist_name: string;
  master_metadata_album_album_name: string;
  spotify_track_uri: string;
  episode_name: string | null;
  episode_show_name: string | null;
  spotify_episode_uri: string | null;
  reason_start: string;
  reason_end: string;
  shuffle: boolean;
  skipped: boolean | null;
  offline: boolean;
  offline_timestamp: number;
  incognito_mode: boolean;
}

// YourLibrary.json structure
export interface SpotifyLibrary {
  tracks: SpotifyLibraryTrack[];
  albums: SpotifyLibraryAlbum[];
  shows: SpotifyLibraryShow[];
  episodes: SpotifyLibraryEpisode[];
  artists: SpotifyLibraryArtist[];
  bannedTracks: SpotifyLibraryTrack[];
  bannedArtists: SpotifyLibraryArtist[];
}

export interface SpotifyLibraryTrack {
  artist: string;
  album: string;
  track: string;
  uri: string;
}

export interface SpotifyLibraryAlbum {
  artist: string;
  album: string;
  uri: string;
}

export interface SpotifyLibraryShow {
  name: string;
  publisher: string;
  uri: string;
}

export interface SpotifyLibraryEpisode {
  name: string;
  show: string;
  uri: string;
}

export interface SpotifyLibraryArtist {
  name: string;
  uri: string;
}

// Playlist*.json structure
export interface SpotifyPlaylistExport {
  name: string;
  lastModifiedDate: string;
  items: SpotifyPlaylistItem[];
  description?: string;
  numberOfFollowers?: number;
}

export interface SpotifyPlaylistItem {
  track: {
    trackName: string;
    artistName: string;
    albumName: string;
    trackUri: string;
  };
  episode: null;
  localTrack: null;
  addedDate: string;
}

// Parsed and normalized data
export interface ParsedSpotifyData {
  history: NormalizedHistoryEntry[];
  likedTracks: NormalizedTrack[];
  playlists: NormalizedPlaylist[];
  bannedTracks: NormalizedTrack[];
  parseErrors: ParseError[];
  stats: {
    totalHistoryEntries: number;
    uniqueTracksPlayed: number;
    totalPlaytimeMs: number;
    dateRange: { start: string; end: string } | null;
    likedTracksCount: number;
    playlistsCount: number;
  };
}

export interface NormalizedHistoryEntry {
  trackName: string;
  artistName: string;
  albumName?: string;
  endTime: string;
  msPlayed: number;
  spotifyUri?: string;
  skipped?: boolean;
}

export interface NormalizedTrack {
  trackName: string;
  artistName: string;
  albumName?: string;
  spotifyUri?: string;
  spotifyId?: string;
}

export interface NormalizedPlaylist {
  name: string;
  description?: string;
  tracks: NormalizedTrack[];
  lastModified?: string;
}

export interface ParseError {
  file: string;
  error: string;
  line?: number;
}

// Matching results
export interface MatchedTrack {
  original: NormalizedTrack;
  spotifyId: string;
  isrc?: string;
  confidence: number;
  matchedBy: 'isrc' | 'exact' | 'normalized' | 'fuzzy';
  audioFeatures?: AudioFeatures;
}

export interface MatchedHistoryEntry extends NormalizedHistoryEntry {
  matchedSpotifyId?: string;
  matchConfidence?: number;
}

export interface MatchedPlaylist extends NormalizedPlaylist {
  matchedTracks: MatchedTrack[];
  unmatchedTracks: NormalizedTrack[];
  matchRate: number;
}

// Audio features from Spotify
export interface AudioFeatures {
  spotifyId: string;
  tempo: number;
  key: number; // 0-11 (C, C#, D, ...)
  mode: number; // 0=minor, 1=major
  timeSignature: number;
  danceability: number; // 0.0-1.0
  energy: number; // 0.0-1.0
  loudness: number; // dB
  speechiness: number; // 0.0-1.0
  acousticness: number; // 0.0-1.0
  instrumentalness: number; // 0.0-1.0
  liveness: number; // 0.0-1.0
  valence: number; // 0.0-1.0 (happiness)
}

// Import options
export interface ImportOptions {
  importHistory: boolean;
  importLikedTracks: boolean;
  importPlaylists: boolean;
  importBannedAsDisliked: boolean;
  mergeHistory: boolean; // Merge with existing or replace
  playlistPrefix: string; // Prefix for imported playlists
  minConfidence: number; // Minimum match confidence (0-1)
}

// Import result
export interface ImportResult {
  historyImported: number;
  tracksLiked: number;
  tracksDisliked: number;
  playlistsCreated: number;
  errors: ImportError[];
  duration: number;
}

export interface ImportError {
  type: 'history' | 'track' | 'playlist';
  item: string;
  error: string;
}
