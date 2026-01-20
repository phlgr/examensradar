import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const dbDir = './.wrangler/state/v3/d1/miniflare-D1DatabaseObject';

try {
  const files = readdirSync(dbDir);
  const sqliteFiles = files.filter(f => f.endsWith('.sqlite') && !f.startsWith('*.'));
  
  // Find the database file with actual data (non-empty)
  const dbFile = sqliteFiles.find(f => {
    const stats = statSync(join(dbDir, f));
    return stats.size > 1000; // At least 1KB
  });
  
  if (dbFile) {
    console.log(join(dbDir, dbFile));
  } else {
    console.error('No database file found. Make sure to run the dev server first.');
    process.exit(1);
  }
} catch (error) {
  console.error('Database directory not found. Run the dev server first to create the local database.');
  process.exit(1);
}
