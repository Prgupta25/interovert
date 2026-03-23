/**
 * fixCategories.js
 *
 * One-time migration: updates all MongoDB event documents that have
 * old seed categories (music, art, tech, sports, food, outdoor, social, wellness)
 * to the correct frontend categories (Adventure, Social, Learning, Wellness,
 * Gaming, Movies, Other).
 *
 * Then calls the reindex endpoint to sync everything to Elasticsearch.
 *
 * Usage:
 *   node backend/scripts/fixCategories.js
 */

import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

// ── Category mapping: old seed value → correct frontend value ────────────────
const CATEGORY_MAP = {
  music:    'Other',      // closest match
  art:      'Other',
  tech:     'Learning',
  sports:   'Adventure',
  food:     'Social',
  outdoor:  'Adventure',
  social:   'Social',
  wellness: 'Wellness',
  // Also normalise any PascalCase that already exists but is correct
  Adventure: 'Adventure',
  Social:    'Social',
  Learning:  'Learning',
  Wellness:  'Wellness',
  Gaming:    'Gaming',
  Movies:    'Movies',
  Other:     'Other',
};

const VALID_CATEGORIES = new Set(['Adventure', 'Social', 'Learning', 'Wellness', 'Gaming', 'Movies', 'Other']);

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || process.env.VITE_MONGO_URI);
  console.log('Connected to MongoDB\n');

  const Event = mongoose.model('Event', new mongoose.Schema({
    category: String,
  }, { strict: false }));

  const events = await Event.find({}).select('_id category').lean();
  console.log(`Found ${events.length} events total\n`);

  let updated = 0;
  let skipped = 0;

  for (const event of events) {
    const oldCat = event.category || '';
    const newCat = CATEGORY_MAP[oldCat];

    if (!newCat) {
      console.log(`  ⚠️  Unknown category "${oldCat}" on event ${event._id} → setting "Other"`);
      await Event.updateOne({ _id: event._id }, { $set: { category: 'Other' } });
      updated++;
      continue;
    }

    if (VALID_CATEGORIES.has(oldCat)) {
      // Already correct
      skipped++;
      continue;
    }

    await Event.updateOne({ _id: event._id }, { $set: { category: newCat } });
    console.log(`  ✅  ${oldCat.padEnd(12)} → ${newCat}  (${event._id})`);
    updated++;
  }

  console.log(`\n─────────────────────────────────────`);
  console.log(`Updated: ${updated}  Skipped (already correct): ${skipped}`);

  await mongoose.disconnect();
  console.log('\nMongoDB disconnected.');
  console.log('\n⚡  Now run the reindex to sync ES:');
  console.log('   curl -X POST http://localhost:5001/api/events/reindex \\');
  console.log('     -H "Authorization: Bearer YOUR_JWT"');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
