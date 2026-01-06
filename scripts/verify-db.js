
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Path to the database - adjust if your server data path is different
const DB_PATH = path.join(__dirname, '../packages/server/data/audiio.db');

console.log('Checking database at:', DB_PATH);

if (!fs.existsSync(DB_PATH)) {
    console.error('❌ Database file not found at path!');
    process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true });

try {
    // Check Liked Tracks
    const likedCount = db.prepare('SELECT COUNT(*) as count FROM liked_tracks').get();
    console.log(`\n❤️  Liked Tracks: ${likedCount.count}`);

    if (likedCount.count > 0) {
        const tracks = db.prepare('SELECT id, track_data, liked_at FROM liked_tracks ORDER BY liked_at DESC LIMIT 5').all();
        console.log('Last 5 liked tracks:');
        tracks.forEach(row => {
            const data = JSON.parse(row.track_data);
            console.log(` - [${new Date(row.liked_at).toISOString()}] ${data.title} by ${data.artists?.[0]?.name || 'Unknown'}`);
        });
    }

    // Check Playlists
    const playlistCount = db.prepare('SELECT COUNT(*) as count FROM playlists').get();
    console.log(`\nTb  Playlists: ${playlistCount.count}`);

    // Check WAL Mode
    const journalMode = db.pragma('journal_mode', { simple: true });
    console.log(`\n💾 Journal Mode: ${journalMode} (Should be 'wal')`);

} catch (err) {
    console.error('❌ Error reading database:', err);
} finally {
    db.close();
}
