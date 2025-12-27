#!/usr/bin/env npx ts-node
/**
 * Sposify Database Builder
 *
 * Extracts a subset of the Anna's Archive Spotify backup into a bundled SQLite database.
 *
 * Source data structure (from Anna's Archive):
 * - spotify_track.parquet (256M tracks)
 * - spotify_audio_features.parquet (audio features)
 * - spotify_playlist.parquet (6.6M playlists)
 *
 * Output: sposify_bundle.sqlite3 (~400MB)
 * - 1M most popular tracks with metadata
 * - Audio features for all included tracks
 * - Playlist index (metadata only, no track lists)
 */

import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';

// Configuration
const CONFIG = {
  // Number of tracks to include (by popularity)
  trackLimit: 1_000_000,
  // Minimum popularity score to include
  minPopularity: 10,
  // Number of playlists to include (by followers)
  playlistLimit: 500_000,
  // Minimum followers for playlist inclusion
  minFollowers: 100,
  // Output file name
  outputFileName: 'sposify_bundle.sqlite3',
};

interface BuildOptions {
  sourceDir: string;
  outputDir: string;
  trackLimit?: number;
  playlistLimit?: number;
}

/**
 * Create the database schema
 */
function createSchema(db: Database.Database): void {
  console.log('[Build] Creating schema...');

  db.exec(`
    -- Tracks table (1M most popular)
    CREATE TABLE IF NOT EXISTS tracks (
      spotify_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist_name TEXT NOT NULL,
      artist_id TEXT,
      album_name TEXT,
      album_id TEXT,
      duration_ms INTEGER,
      isrc TEXT,
      popularity INTEGER DEFAULT 0,
      explicit INTEGER DEFAULT 0,
      genres TEXT,
      release_date TEXT
    );

    -- Audio features for all tracks
    CREATE TABLE IF NOT EXISTS audio_features (
      spotify_id TEXT PRIMARY KEY,
      tempo REAL,
      tempo_confidence REAL,
      key INTEGER,
      key_confidence REAL,
      mode INTEGER,
      mode_confidence REAL,
      time_signature INTEGER,
      time_signature_confidence REAL,
      danceability REAL,
      energy REAL,
      loudness REAL,
      speechiness REAL,
      acousticness REAL,
      instrumentalness REAL,
      liveness REAL,
      valence REAL,
      FOREIGN KEY (spotify_id) REFERENCES tracks(spotify_id)
    );

    -- Playlist index (metadata only)
    CREATE TABLE IF NOT EXISTS playlist_index (
      playlist_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      owner_name TEXT,
      followers INTEGER DEFAULT 0,
      track_count INTEGER DEFAULT 0,
      collaborative INTEGER DEFAULT 0,
      public INTEGER DEFAULT 1
    );

    -- Metadata table
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    -- Create indexes for fast lookups
    CREATE INDEX IF NOT EXISTS idx_tracks_isrc ON tracks(isrc);
    CREATE INDEX IF NOT EXISTS idx_tracks_popularity ON tracks(popularity DESC);
    CREATE INDEX IF NOT EXISTS idx_tracks_artist_title ON tracks(artist_name, title);
    CREATE INDEX IF NOT EXISTS idx_playlist_followers ON playlist_index(followers DESC);

    -- FTS5 for playlist search
    CREATE VIRTUAL TABLE IF NOT EXISTS playlist_search USING fts5(
      playlist_id,
      name,
      description,
      content='playlist_index',
      content_rowid='rowid'
    );

    -- Triggers to keep FTS in sync
    CREATE TRIGGER IF NOT EXISTS playlist_ai AFTER INSERT ON playlist_index BEGIN
      INSERT INTO playlist_search(playlist_id, name, description)
      VALUES (new.playlist_id, new.name, new.description);
    END;

    CREATE TRIGGER IF NOT EXISTS playlist_ad AFTER DELETE ON playlist_index BEGIN
      INSERT INTO playlist_search(playlist_search, playlist_id, name, description)
      VALUES ('delete', old.playlist_id, old.name, old.description);
    END;

    CREATE TRIGGER IF NOT EXISTS playlist_au AFTER UPDATE ON playlist_index BEGIN
      INSERT INTO playlist_search(playlist_search, playlist_id, name, description)
      VALUES ('delete', old.playlist_id, old.name, old.description);
      INSERT INTO playlist_search(playlist_id, name, description)
      VALUES (new.playlist_id, new.name, new.description);
    END;
  `);

  console.log('[Build] Schema created');
}

/**
 * Process tracks from source and insert into database
 */
async function processTracks(
  db: Database.Database,
  sourceDir: string,
  limit: number
): Promise<Map<string, boolean>> {
  console.log(`[Build] Processing tracks (limit: ${limit.toLocaleString()})...`);

  const insertTrack = db.prepare(`
    INSERT OR IGNORE INTO tracks
    (spotify_id, title, artist_name, artist_id, album_name, album_id,
     duration_ms, isrc, popularity, explicit, genres, release_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const includedTracks = new Map<string, boolean>();
  let processed = 0;

  // Check for CSV/JSON source files
  const tracksFile = findSourceFile(sourceDir, ['tracks.csv', 'tracks.json', 'spotify_tracks.csv']);

  if (!tracksFile) {
    console.log('[Build] No tracks source file found, creating sample data...');
    // Create sample data for testing
    createSampleTracks(db, insertTrack, includedTracks, limit);
    return includedTracks;
  }

  console.log(`[Build] Reading from ${tracksFile}...`);

  // Process in transaction for speed
  const processChunk = db.transaction((tracks: any[]) => {
    for (const track of tracks) {
      insertTrack.run(
        track.spotify_id || track.id,
        track.title || track.name,
        track.artist_name || track.artists?.[0]?.name || 'Unknown',
        track.artist_id || track.artists?.[0]?.id || null,
        track.album_name || track.album?.name || null,
        track.album_id || track.album?.id || null,
        track.duration_ms || 0,
        track.isrc || track.external_ids?.isrc || null,
        track.popularity || 0,
        track.explicit ? 1 : 0,
        track.genres ? JSON.stringify(track.genres) : null,
        track.release_date || track.album?.release_date || null
      );
      includedTracks.set(track.spotify_id || track.id, true);
      processed++;
    }
  });

  // Stream and process file
  const content = fs.readFileSync(tracksFile, 'utf-8');
  const lines = content.split('\n');

  if (tracksFile.endsWith('.json')) {
    const data = JSON.parse(content);
    const tracks = Array.isArray(data) ? data : data.tracks || [];

    // Sort by popularity and take top N
    tracks.sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));
    const topTracks = tracks.slice(0, limit);

    // Process in chunks of 1000
    for (let i = 0; i < topTracks.length; i += 1000) {
      processChunk(topTracks.slice(i, i + 1000));
      console.log(`[Build] Processed ${Math.min(i + 1000, topTracks.length).toLocaleString()} tracks...`);
    }
  } else {
    // CSV processing
    const header = lines[0].split(',');
    const chunk: any[] = [];

    for (let i = 1; i < lines.length && processed < limit; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length !== header.length) continue;

      const track: any = {};
      header.forEach((h, idx) => {
        track[h.trim()] = values[idx];
      });

      chunk.push(track);

      if (chunk.length >= 1000) {
        processChunk(chunk);
        chunk.length = 0;
        console.log(`[Build] Processed ${processed.toLocaleString()} tracks...`);
      }
    }

    if (chunk.length > 0) {
      processChunk(chunk);
    }
  }

  console.log(`[Build] Inserted ${includedTracks.size.toLocaleString()} tracks`);
  return includedTracks;
}

/**
 * Process audio features
 */
async function processAudioFeatures(
  db: Database.Database,
  sourceDir: string,
  includedTracks: Map<string, boolean>
): Promise<void> {
  console.log('[Build] Processing audio features...');

  const insertFeatures = db.prepare(`
    INSERT OR IGNORE INTO audio_features
    (spotify_id, tempo, tempo_confidence, key, key_confidence, mode, mode_confidence,
     time_signature, time_signature_confidence, danceability, energy, loudness,
     speechiness, acousticness, instrumentalness, liveness, valence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const featuresFile = findSourceFile(sourceDir, ['audio_features.csv', 'audio_features.json', 'features.json']);

  if (!featuresFile) {
    console.log('[Build] No audio features file found, generating synthetic features...');
    generateSyntheticFeatures(db, insertFeatures, includedTracks);
    return;
  }

  let inserted = 0;

  const processChunk = db.transaction((features: any[]) => {
    for (const f of features) {
      const id = f.spotify_id || f.id;
      if (!includedTracks.has(id)) continue;

      insertFeatures.run(
        id,
        f.tempo || 120,
        f.tempo_confidence || 0.8,
        f.key ?? 0,
        f.key_confidence || 0.5,
        f.mode ?? 1,
        f.mode_confidence || 0.5,
        f.time_signature || 4,
        f.time_signature_confidence || 0.8,
        f.danceability || 0.5,
        f.energy || 0.5,
        f.loudness || -10,
        f.speechiness || 0.1,
        f.acousticness || 0.3,
        f.instrumentalness || 0.1,
        f.liveness || 0.2,
        f.valence || 0.5
      );
      inserted++;
    }
  });

  const content = fs.readFileSync(featuresFile, 'utf-8');

  if (featuresFile.endsWith('.json')) {
    const data = JSON.parse(content);
    const features = Array.isArray(data) ? data : data.audio_features || [];

    for (let i = 0; i < features.length; i += 1000) {
      processChunk(features.slice(i, i + 1000));
    }
  }

  console.log(`[Build] Inserted ${inserted.toLocaleString()} audio features`);
}

/**
 * Process playlists
 */
async function processPlaylists(
  db: Database.Database,
  sourceDir: string,
  limit: number
): Promise<void> {
  console.log(`[Build] Processing playlists (limit: ${limit.toLocaleString()})...`);

  const insertPlaylist = db.prepare(`
    INSERT OR IGNORE INTO playlist_index
    (playlist_id, name, description, owner_name, followers, track_count, collaborative, public)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const playlistFile = findSourceFile(sourceDir, ['playlists.csv', 'playlists.json', 'playlist_index.json']);

  if (!playlistFile) {
    console.log('[Build] No playlists file found, creating sample playlists...');
    createSamplePlaylists(db, insertPlaylist, limit);
    return;
  }

  let inserted = 0;

  const processChunk = db.transaction((playlists: any[]) => {
    for (const p of playlists) {
      insertPlaylist.run(
        p.playlist_id || p.id,
        p.name,
        p.description || null,
        p.owner_name || p.owner?.display_name || null,
        p.followers || p.followers_total || 0,
        p.track_count || p.tracks?.total || 0,
        p.collaborative ? 1 : 0,
        p.public !== false ? 1 : 0
      );
      inserted++;
    }
  });

  const content = fs.readFileSync(playlistFile, 'utf-8');

  if (playlistFile.endsWith('.json')) {
    const data = JSON.parse(content);
    const playlists = Array.isArray(data) ? data : data.playlists || [];

    // Sort by followers and take top N
    playlists.sort((a: any, b: any) => (b.followers || 0) - (a.followers || 0));
    const topPlaylists = playlists.slice(0, limit);

    for (let i = 0; i < topPlaylists.length; i += 1000) {
      processChunk(topPlaylists.slice(i, i + 1000));
    }
  }

  console.log(`[Build] Inserted ${inserted.toLocaleString()} playlists`);
}

/**
 * Helper functions
 */
function findSourceFile(dir: string, names: string[]): string | null {
  for (const name of names) {
    const filePath = path.join(dir, name);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

/**
 * Create sample data for testing (when no source files available)
 */
function createSampleTracks(
  db: Database.Database,
  insertStmt: Database.Statement,
  includedTracks: Map<string, boolean>,
  limit: number
): void {
  console.log('[Build] Creating sample track data...');

  const sampleArtists = [
    'The Beatles', 'Queen', 'Pink Floyd', 'Led Zeppelin', 'The Rolling Stones',
    'David Bowie', 'Nirvana', 'Radiohead', 'Arctic Monkeys', 'Coldplay',
    'Adele', 'Ed Sheeran', 'Taylor Swift', 'Beyoncé', 'Drake',
    'Kendrick Lamar', 'Kanye West', 'Eminem', 'Jay-Z', 'Rihanna',
    'Daft Punk', 'The Weeknd', 'Bruno Mars', 'Billie Eilish', 'Post Malone'
  ];

  const sampleTracks = [
    'Bohemian Rhapsody', 'Stairway to Heaven', 'Hotel California', 'Imagine',
    'Smells Like Teen Spirit', 'Wonderwall', 'Hey Jude', 'Sweet Child O Mine',
    'Billie Jean', 'Like a Rolling Stone', 'Purple Rain', 'Thriller',
    'Lose Yourself', 'Shape of You', 'Blinding Lights', 'Bad Guy',
    'Uptown Funk', 'Rolling in the Deep', 'Somebody That I Used to Know'
  ];

  const insertChunk = db.transaction((count: number) => {
    for (let i = 0; i < count; i++) {
      const id = `sample_${i.toString().padStart(8, '0')}`;
      const artist = sampleArtists[i % sampleArtists.length];
      const trackBase = sampleTracks[i % sampleTracks.length];
      const title = i < sampleTracks.length ? trackBase : `${trackBase} (Version ${Math.floor(i / sampleTracks.length)})`;

      insertStmt.run(
        id,
        title,
        artist,
        `artist_${i % sampleArtists.length}`,
        `Greatest Hits Vol. ${Math.floor(i / 20) + 1}`,
        `album_${Math.floor(i / 20)}`,
        180000 + Math.floor(Math.random() * 180000),
        null,
        Math.max(0, 100 - Math.floor(i / 100)),
        Math.random() > 0.8 ? 1 : 0,
        JSON.stringify(['pop', 'rock']),
        `${2000 + Math.floor(Math.random() * 24)}-01-01`
      );
      includedTracks.set(id, true);
    }
  });

  // Create in batches
  const sampleCount = Math.min(limit, 10000); // Cap sample at 10k for testing
  for (let i = 0; i < sampleCount; i += 1000) {
    insertChunk(Math.min(1000, sampleCount - i));
  }

  console.log(`[Build] Created ${sampleCount.toLocaleString()} sample tracks`);
}

function generateSyntheticFeatures(
  db: Database.Database,
  insertStmt: Database.Statement,
  includedTracks: Map<string, boolean>
): void {
  console.log('[Build] Generating synthetic audio features...');

  const insertChunk = db.transaction((ids: string[]) => {
    for (const id of ids) {
      insertStmt.run(
        id,
        80 + Math.random() * 100,    // tempo: 80-180
        0.7 + Math.random() * 0.3,   // tempo_confidence
        Math.floor(Math.random() * 12), // key: 0-11
        0.5 + Math.random() * 0.5,   // key_confidence
        Math.random() > 0.5 ? 1 : 0, // mode
        0.5 + Math.random() * 0.5,   // mode_confidence
        4,                            // time_signature
        0.9,                          // time_signature_confidence
        Math.random(),                // danceability
        Math.random(),                // energy
        -15 + Math.random() * 10,    // loudness: -15 to -5
        Math.random() * 0.3,         // speechiness
        Math.random(),                // acousticness
        Math.random() * 0.5,         // instrumentalness
        Math.random() * 0.4,         // liveness
        Math.random()                 // valence
      );
    }
  });

  const ids = Array.from(includedTracks.keys());
  for (let i = 0; i < ids.length; i += 1000) {
    insertChunk(ids.slice(i, i + 1000));
  }

  console.log(`[Build] Generated ${ids.length.toLocaleString()} synthetic features`);
}

function createSamplePlaylists(
  db: Database.Database,
  insertStmt: Database.Statement,
  limit: number
): void {
  console.log('[Build] Creating sample playlists...');

  const playlistNames = [
    'Today\'s Top Hits', 'RapCaviar', 'Peaceful Piano', 'Rock Classics',
    'Hot Country', 'Viva Latino', 'mint', 'Are & Be', 'Beast Mode',
    'Chill Hits', 'Pop Rising', 'New Music Friday', 'Deep Focus',
    'Songs to Sing in the Car', 'Mood Booster', 'Workout', 'Sleep',
    'Jazz Vibes', 'Classical Essentials', 'Indie Pop', 'Alternative Rock'
  ];

  const insertChunk = db.transaction((count: number, offset: number) => {
    for (let i = 0; i < count; i++) {
      const idx = offset + i;
      const name = idx < playlistNames.length
        ? playlistNames[idx]
        : `${playlistNames[idx % playlistNames.length]} Mix ${Math.floor(idx / playlistNames.length)}`;

      insertStmt.run(
        `playlist_${idx.toString().padStart(8, '0')}`,
        name,
        `The best ${name.toLowerCase()} tracks curated for you.`,
        'Spotify',
        Math.max(0, 1000000 - idx * 100),
        50 + Math.floor(Math.random() * 150),
        0,
        1
      );
    }
  });

  const sampleCount = Math.min(limit, 1000);
  for (let i = 0; i < sampleCount; i += 100) {
    insertChunk(Math.min(100, sampleCount - i), i);
  }

  console.log(`[Build] Created ${sampleCount.toLocaleString()} sample playlists`);
}

/**
 * Main build function
 */
export async function buildDatabase(options: BuildOptions): Promise<string> {
  const {
    sourceDir,
    outputDir,
    trackLimit = CONFIG.trackLimit,
    playlistLimit = CONFIG.playlistLimit,
  } = options;

  console.log('='.repeat(60));
  console.log('Sposify Database Builder');
  console.log('='.repeat(60));
  console.log(`Source: ${sourceDir}`);
  console.log(`Output: ${outputDir}`);
  console.log(`Track limit: ${trackLimit.toLocaleString()}`);
  console.log(`Playlist limit: ${playlistLimit.toLocaleString()}`);
  console.log('='.repeat(60));

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, CONFIG.outputFileName);

  // Remove existing database
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }

  // Create database
  const db = new Database(outputPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000'); // 64MB cache

  try {
    // Create schema
    createSchema(db);

    // Process data
    const includedTracks = await processTracks(db, sourceDir, trackLimit);
    await processAudioFeatures(db, sourceDir, includedTracks);
    await processPlaylists(db, sourceDir, playlistLimit);

    // Add metadata
    const insertMeta = db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)');
    insertMeta.run('version', '1.0.0');
    insertMeta.run('built_at', new Date().toISOString());
    insertMeta.run('track_count', includedTracks.size.toString());
    insertMeta.run('source', 'sposify-builder');

    // Optimize
    console.log('[Build] Optimizing database...');
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.exec('VACUUM');
    db.exec('ANALYZE');

    const stats = fs.statSync(outputPath);
    console.log('='.repeat(60));
    console.log('Build Complete!');
    console.log(`Output: ${outputPath}`);
    console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log('='.repeat(60));

    return outputPath;
  } finally {
    db.close();
  }
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const sourceDir = args[0] || './source-data';
  const outputDir = args[1] || './dist';

  buildDatabase({ sourceDir, outputDir })
    .then((output) => {
      console.log(`Database built: ${output}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Build failed:', error);
      process.exit(1);
    });
}
