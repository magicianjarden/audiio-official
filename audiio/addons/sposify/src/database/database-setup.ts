/**
 * Sposify Database Setup Service
 *
 * Handles automatic database setup:
 * 1. Check if database exists
 * 2. Download pre-built database from CDN, or
 * 3. Build a sample database for testing
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import * as zlib from 'zlib';
import { createWriteStream, createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import Database from 'better-sqlite3';

// Database download sources (in priority order)
const DOWNLOAD_SOURCES = [
  {
    name: 'GitHub Releases',
    url: 'https://github.com/audiio/sposify-database/releases/latest/download/sposify_bundle.sqlite3.gz',
    compressed: true,
  },
  {
    name: 'Backup Mirror',
    url: 'https://sposify-db.audiio.app/sposify_bundle.sqlite3.gz',
    compressed: true,
  },
];

const DATABASE_FILENAME = 'sposify_bundle.sqlite3';
const TEMP_FILENAME = 'sposify_bundle.download';

export interface SetupProgress {
  phase: 'checking' | 'downloading' | 'extracting' | 'building' | 'verifying' | 'complete' | 'error';
  progress: number; // 0-1
  message: string;
  bytesDownloaded?: number;
  totalBytes?: number;
  speed?: number; // bytes per second
}

export type ProgressCallback = (progress: SetupProgress) => void;

export interface SetupOptions {
  userDataPath: string;
  onProgress?: ProgressCallback;
  forceRebuild?: boolean;
  offlineMode?: boolean;
}

export interface SetupResult {
  success: boolean;
  databasePath: string | null;
  source: 'existing' | 'downloaded' | 'built' | 'failed';
  error?: string;
}

/**
 * Check if database exists and is valid
 */
export function checkDatabaseExists(userDataPath: string): { exists: boolean; path: string; valid: boolean } {
  const dbPath = path.join(userDataPath, 'sposify', DATABASE_FILENAME);

  if (!fs.existsSync(dbPath)) {
    return { exists: false, path: dbPath, valid: false };
  }

  // Verify database is valid
  try {
    const db = new Database(dbPath, { readonly: true });
    const result = db.prepare("SELECT value FROM metadata WHERE key = 'version'").get() as { value: string } | undefined;
    db.close();

    return {
      exists: true,
      path: dbPath,
      valid: !!result?.value,
    };
  } catch {
    return { exists: true, path: dbPath, valid: false };
  }
}

/**
 * Download database from CDN
 */
async function downloadDatabase(
  destPath: string,
  onProgress?: ProgressCallback
): Promise<boolean> {
  const tempPath = destPath.replace(DATABASE_FILENAME, TEMP_FILENAME);

  for (const source of DOWNLOAD_SOURCES) {
    try {
      onProgress?.({
        phase: 'downloading',
        progress: 0,
        message: `Connecting to ${source.name}...`,
      });

      const success = await downloadFile(source.url, tempPath, source.compressed, onProgress);

      if (success) {
        // Rename temp file to final
        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
        }
        fs.renameSync(tempPath, destPath);
        return true;
      }
    } catch (error) {
      console.error(`[Sposify] Download from ${source.name} failed:`, error);
      // Clean up temp file
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  }

  return false;
}

/**
 * Download a file with progress tracking
 */
function downloadFile(
  url: string,
  destPath: string,
  compressed: boolean,
  onProgress?: ProgressCallback
): Promise<boolean> {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;

    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadFile(redirectUrl, destPath, compressed, onProgress)
            .then(resolve)
            .catch(() => resolve(false));
          return;
        }
      }

      if (response.statusCode !== 200) {
        resolve(false);
        return;
      }

      const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedBytes = 0;
      const startTime = Date.now();

      const outputPath = compressed ? destPath + '.gz' : destPath;
      const fileStream = createWriteStream(outputPath);

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = downloadedBytes / elapsed;

        onProgress?.({
          phase: 'downloading',
          progress: totalBytes > 0 ? downloadedBytes / totalBytes : 0,
          message: `Downloading... ${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)}`,
          bytesDownloaded: downloadedBytes,
          totalBytes,
          speed,
        });
      });

      response.pipe(fileStream);

      fileStream.on('finish', async () => {
        fileStream.close();

        if (compressed) {
          try {
            onProgress?.({
              phase: 'extracting',
              progress: 0,
              message: 'Extracting database...',
            });

            await decompressFile(outputPath, destPath, onProgress);
            fs.unlinkSync(outputPath);
            resolve(true);
          } catch (error) {
            console.error('[Sposify] Decompression failed:', error);
            resolve(false);
          }
        } else {
          resolve(true);
        }
      });

      fileStream.on('error', () => {
        resolve(false);
      });
    });

    request.on('error', () => {
      resolve(false);
    });

    request.setTimeout(30000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

/**
 * Decompress gzipped file
 */
async function decompressFile(
  sourcePath: string,
  destPath: string,
  onProgress?: ProgressCallback
): Promise<void> {
  const sourceStats = fs.statSync(sourcePath);
  let processedBytes = 0;

  const source = createReadStream(sourcePath);
  const gunzip = zlib.createGunzip();
  const dest = createWriteStream(destPath);

  gunzip.on('data', (chunk) => {
    processedBytes += chunk.length;
    onProgress?.({
      phase: 'extracting',
      progress: Math.min(processedBytes / (sourceStats.size * 3), 0.99), // Estimate ~3x compression
      message: `Extracting... ${formatBytes(processedBytes)}`,
    });
  });

  await pipeline(source, gunzip, dest);
}

/**
 * Build sample database for offline/testing
 */
async function buildSampleDatabase(
  destPath: string,
  onProgress?: ProgressCallback
): Promise<boolean> {
  onProgress?.({
    phase: 'building',
    progress: 0,
    message: 'Building sample database...',
  });

  try {
    // Ensure directory exists
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const db = new Database(destPath);
    db.pragma('journal_mode = WAL');

    // Create schema
    db.exec(`
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

      CREATE TABLE IF NOT EXISTS audio_features (
        spotify_id TEXT PRIMARY KEY,
        tempo REAL, tempo_confidence REAL,
        key INTEGER, key_confidence REAL,
        mode INTEGER, mode_confidence REAL,
        time_signature INTEGER, time_signature_confidence REAL,
        danceability REAL, energy REAL, loudness REAL,
        speechiness REAL, acousticness REAL,
        instrumentalness REAL, liveness REAL, valence REAL
      );

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

      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_tracks_isrc ON tracks(isrc);
      CREATE INDEX IF NOT EXISTS idx_tracks_popularity ON tracks(popularity DESC);
      CREATE INDEX IF NOT EXISTS idx_tracks_artist_title ON tracks(artist_name, title);
      CREATE INDEX IF NOT EXISTS idx_playlist_followers ON playlist_index(followers DESC);
    `);

    onProgress?.({ phase: 'building', progress: 0.2, message: 'Creating sample tracks...' });

    // Insert sample data
    const sampleData = generateSampleData();

    const insertTrack = db.prepare(`
      INSERT INTO tracks (spotify_id, title, artist_name, artist_id, album_name,
        duration_ms, isrc, popularity, explicit, genres)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertFeatures = db.prepare(`
      INSERT INTO audio_features (spotify_id, tempo, key, mode, danceability,
        energy, loudness, speechiness, acousticness, instrumentalness, liveness, valence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertPlaylist = db.prepare(`
      INSERT INTO playlist_index (playlist_id, name, description, owner_name, followers, track_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      for (let i = 0; i < sampleData.tracks.length; i++) {
        const t = sampleData.tracks[i];
        insertTrack.run(t.id, t.title, t.artist, t.artistId, t.album,
          t.duration, t.isrc, t.popularity, t.explicit ? 1 : 0, JSON.stringify(t.genres));
        insertFeatures.run(t.id, t.tempo, t.key, t.mode, t.danceability,
          t.energy, t.loudness, t.speechiness, t.acousticness,
          t.instrumentalness, t.liveness, t.valence);

        if (i % 1000 === 0) {
          onProgress?.({
            phase: 'building',
            progress: 0.2 + (i / sampleData.tracks.length) * 0.6,
            message: `Creating tracks... ${i.toLocaleString()} / ${sampleData.tracks.length.toLocaleString()}`,
          });
        }
      }
    })();

    onProgress?.({ phase: 'building', progress: 0.85, message: 'Creating playlists...' });

    db.transaction(() => {
      for (const p of sampleData.playlists) {
        insertPlaylist.run(p.id, p.name, p.description, p.owner, p.followers, p.trackCount);
      }
    })();

    // Add metadata
    const insertMeta = db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)');
    insertMeta.run('version', '1.0.0-sample');
    insertMeta.run('built_at', new Date().toISOString());
    insertMeta.run('track_count', sampleData.tracks.length.toString());
    insertMeta.run('source', 'sample-generator');

    onProgress?.({ phase: 'building', progress: 0.95, message: 'Optimizing...' });

    db.pragma('wal_checkpoint(TRUNCATE)');
    db.exec('VACUUM');
    db.exec('ANALYZE');
    db.close();

    onProgress?.({ phase: 'complete', progress: 1, message: 'Sample database ready' });
    return true;
  } catch (error) {
    console.error('[Sposify] Build sample database failed:', error);
    return false;
  }
}

/**
 * Generate sample data for testing
 */
function generateSampleData() {
  const artists = [
    { name: 'The Beatles', id: 'beatles', genres: ['rock', 'pop'] },
    { name: 'Queen', id: 'queen', genres: ['rock', 'arena rock'] },
    { name: 'Pink Floyd', id: 'pinkfloyd', genres: ['progressive rock', 'psychedelic'] },
    { name: 'Led Zeppelin', id: 'ledzeppelin', genres: ['hard rock', 'blues rock'] },
    { name: 'David Bowie', id: 'bowie', genres: ['glam rock', 'art rock'] },
    { name: 'Nirvana', id: 'nirvana', genres: ['grunge', 'alternative'] },
    { name: 'Radiohead', id: 'radiohead', genres: ['alternative', 'art rock'] },
    { name: 'Coldplay', id: 'coldplay', genres: ['alternative rock', 'pop rock'] },
    { name: 'Adele', id: 'adele', genres: ['pop', 'soul'] },
    { name: 'Ed Sheeran', id: 'edsheeran', genres: ['pop', 'folk pop'] },
    { name: 'Taylor Swift', id: 'taylorswift', genres: ['pop', 'country pop'] },
    { name: 'Drake', id: 'drake', genres: ['hip hop', 'r&b'] },
    { name: 'Kendrick Lamar', id: 'kendrick', genres: ['hip hop', 'conscious rap'] },
    { name: 'The Weeknd', id: 'weeknd', genres: ['r&b', 'synth pop'] },
    { name: 'Billie Eilish', id: 'billieeilish', genres: ['pop', 'electropop'] },
    { name: 'Daft Punk', id: 'daftpunk', genres: ['electronic', 'house'] },
    { name: 'Arctic Monkeys', id: 'arcticmonkeys', genres: ['indie rock', 'post-punk'] },
    { name: 'Tame Impala', id: 'tameimpala', genres: ['psychedelic pop', 'synth pop'] },
    { name: 'Frank Ocean', id: 'frankocean', genres: ['r&b', 'neo soul'] },
    { name: 'Beyoncé', id: 'beyonce', genres: ['r&b', 'pop'] },
  ];

  const trackTemplates = [
    'Love Song', 'Dreams', 'Forever', 'Tonight', 'Yesterday',
    'Hello', 'Goodbye', 'Running', 'Falling', 'Rising',
    'Fire', 'Water', 'Earth', 'Sky', 'Stars',
    'Dance', 'Cry', 'Smile', 'Breathe', 'Live',
  ];

  const tracks = [];
  const TRACK_COUNT = 10000; // Sample size

  for (let i = 0; i < TRACK_COUNT; i++) {
    const artist = artists[i % artists.length];
    const template = trackTemplates[i % trackTemplates.length];
    const variant = Math.floor(i / (artists.length * trackTemplates.length));

    tracks.push({
      id: `sp_${i.toString().padStart(8, '0')}`,
      title: variant === 0 ? template : `${template} (Part ${variant + 1})`,
      artist: artist.name,
      artistId: artist.id,
      album: `${artist.name} - Greatest Hits ${Math.floor(i / 100) + 1}`,
      duration: 180000 + Math.floor(Math.random() * 180000),
      isrc: `USRC1${(2000000 + i).toString()}`,
      popularity: Math.max(0, 100 - Math.floor(i / 100)),
      explicit: Math.random() > 0.85,
      genres: artist.genres,
      // Audio features
      tempo: 80 + Math.random() * 100,
      key: Math.floor(Math.random() * 12),
      mode: Math.random() > 0.4 ? 1 : 0,
      danceability: 0.3 + Math.random() * 0.6,
      energy: 0.3 + Math.random() * 0.6,
      loudness: -15 + Math.random() * 10,
      speechiness: Math.random() * 0.3,
      acousticness: Math.random(),
      instrumentalness: Math.random() * 0.5,
      liveness: 0.1 + Math.random() * 0.3,
      valence: 0.2 + Math.random() * 0.6,
    });
  }

  const playlists = [
    { id: 'pl_001', name: "Today's Top Hits", description: 'The hottest tracks right now', owner: 'Spotify', followers: 35000000, trackCount: 50 },
    { id: 'pl_002', name: 'RapCaviar', description: 'New hip hop, all day', owner: 'Spotify', followers: 15000000, trackCount: 50 },
    { id: 'pl_003', name: 'Rock Classics', description: 'Rock legends & epic songs', owner: 'Spotify', followers: 12000000, trackCount: 100 },
    { id: 'pl_004', name: 'Peaceful Piano', description: 'Relax and indulge', owner: 'Spotify', followers: 8000000, trackCount: 150 },
    { id: 'pl_005', name: 'Chill Hits', description: 'Kick back to the best new chill music', owner: 'Spotify', followers: 7500000, trackCount: 100 },
    { id: 'pl_006', name: 'All Out 2010s', description: 'The biggest songs of the 2010s', owner: 'Spotify', followers: 6000000, trackCount: 150 },
    { id: 'pl_007', name: 'Mood Booster', description: 'Get happy with these songs', owner: 'Spotify', followers: 5500000, trackCount: 75 },
    { id: 'pl_008', name: 'Deep Focus', description: 'Keep calm and focus', owner: 'Spotify', followers: 5000000, trackCount: 200 },
    { id: 'pl_009', name: 'Hot Country', description: 'The hottest tracks in country', owner: 'Spotify', followers: 4500000, trackCount: 50 },
    { id: 'pl_010', name: 'Beast Mode', description: 'Get fired up with these songs', owner: 'Spotify', followers: 4000000, trackCount: 80 },
  ];

  // Add more playlists
  for (let i = 11; i <= 100; i++) {
    playlists.push({
      id: `pl_${i.toString().padStart(3, '0')}`,
      name: `Discover Weekly ${i}`,
      description: `Personalized playlist #${i}`,
      owner: 'Spotify',
      followers: Math.floor(4000000 / i),
      trackCount: 30 + Math.floor(Math.random() * 70),
    });
  }

  return { tracks, playlists };
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * Main setup function - call this to ensure database is ready
 */
export async function setupDatabase(options: SetupOptions): Promise<SetupResult> {
  const { userDataPath, onProgress, forceRebuild = false, offlineMode = false } = options;

  const sposifyDir = path.join(userDataPath, 'sposify');
  const dbPath = path.join(sposifyDir, DATABASE_FILENAME);

  // Ensure directory exists
  if (!fs.existsSync(sposifyDir)) {
    fs.mkdirSync(sposifyDir, { recursive: true });
  }

  onProgress?.({
    phase: 'checking',
    progress: 0,
    message: 'Checking database...',
  });

  // Check if database exists and is valid
  if (!forceRebuild) {
    const check = checkDatabaseExists(userDataPath);
    if (check.exists && check.valid) {
      onProgress?.({
        phase: 'complete',
        progress: 1,
        message: 'Database ready',
      });
      return {
        success: true,
        databasePath: dbPath,
        source: 'existing',
      };
    }

    // If exists but invalid, remove it
    if (check.exists && !check.valid) {
      try {
        fs.unlinkSync(dbPath);
      } catch {
        // Ignore
      }
    }
  }

  // Try to download if not offline
  if (!offlineMode) {
    onProgress?.({
      phase: 'downloading',
      progress: 0,
      message: 'Attempting to download database...',
    });

    const downloaded = await downloadDatabase(dbPath, onProgress);

    if (downloaded) {
      onProgress?.({
        phase: 'verifying',
        progress: 0.9,
        message: 'Verifying database...',
      });

      const check = checkDatabaseExists(userDataPath);
      if (check.valid) {
        onProgress?.({
          phase: 'complete',
          progress: 1,
          message: 'Database downloaded and ready',
        });
        return {
          success: true,
          databasePath: dbPath,
          source: 'downloaded',
        };
      }
    }

    onProgress?.({
      phase: 'building',
      progress: 0,
      message: 'Download unavailable, building sample database...',
    });
  }

  // Build sample database as fallback
  const built = await buildSampleDatabase(dbPath, onProgress);

  if (built) {
    return {
      success: true,
      databasePath: dbPath,
      source: 'built',
    };
  }

  onProgress?.({
    phase: 'error',
    progress: 0,
    message: 'Failed to setup database',
  });

  return {
    success: false,
    databasePath: null,
    source: 'failed',
    error: 'Could not download or build database',
  };
}

export default setupDatabase;
