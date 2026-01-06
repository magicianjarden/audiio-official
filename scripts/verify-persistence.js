
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Path to the database - using the one from the project
const dbPath = path.resolve('c:/Users/magic/Documents/Coding/audiio-official/packages/server/data/audiio.db');

console.log('--- Persistence Verification Script ---');
console.log(`Database Path: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
    console.error('ERROR: Database file not found!');
    process.exit(1);
}

const db = new Database(dbPath);

// 1. Check current likes
const currentLikes = db.prepare('SELECT COUNT(*) as count FROM liked_tracks').get();
console.log(`Current Like Count: ${currentLikes.count}`);

// 2. Insert a "Fake" Like directly (simulating server write)
const testTrackId = `test-persistence-${Date.now()}`;
const testTrack = {
    id: testTrackId,
    title: 'Test Persistence Track',
    artist: 'Test Artist',
    album: 'Test Album',
    duration: 120,
    streamSources: []
};

console.log(`Inserting test track: ${testTrack.title} (${testTrack.id})`);

try {
    // Ensure the track exists in tracks table first (if your schema requires it, usually liked_tracks stores the blob or references it)
    // Based on previous code, library-db store JSON in liked_tracks or references it.
    // Let's check the schema of liked_tracks first to be sure.
    const schema = db.prepare("PRAGMA table_info(liked_tracks)").all();
    // console.log('Schema:', schema);

    const stmt = db.prepare(`
    INSERT OR REPLACE INTO liked_tracks (id, track_data, liked_at)
    VALUES (@id, @data, STRFTIME('%s', 'now') * 1000)
  `);

    stmt.run({
        id: testTrack.id,
        data: JSON.stringify(testTrack)
    });

    console.log('Write operation successful.');

    // 3. Force WAL Checkpoint (Simulate standard operation or restart behavior)
    console.log('Executing WAL Checkpoint...');
    db.pragma('wal_checkpoint(RESTART)');

    // 4. Verify Read
    const verify = db.prepare('SELECT * FROM liked_tracks WHERE id = ?').get(testTrackId);

    if (verify) {
        console.log('✅ VERIFICATION SUCCESS: Track found in database after write.');
        console.log(`   ID: ${verify.id}`);

        // Cleanup
        // db.prepare('DELETE FROM liked_tracks WHERE id = ?').run(testTrackId);
        // console.log('   (Cleaned up test track)');
        console.log('   (Leaving test track for manual verification if desired. ID: ' + testTrackId + ')');

    } else {
        console.error('❌ VERIFICATION FAILED: Track NOT found in database after write.');
    }

} catch (err) {
    console.error('❌ Error during verification:', err);
}

db.close();
console.log('--- End of Script ---');
