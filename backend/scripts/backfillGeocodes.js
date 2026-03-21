import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import env from '../config/env.js';
import Address from '../models/Address.js';
import Event from '../models/Event.js';
import EventParticipant from '../models/EventParticipant.js';
import { geocodeAddress } from '../services/geocodeService.js';
import { buildEventDoc, bulkIndexEvents, ensureIndex, isElasticConfigured } from '../services/elasticService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  await mongoose.connect(env.mongoUri);
  console.log('Connected to MongoDB');

  // --- Step 1: Backfill missing geocodes ---
  const addresses = await Address.find({ geocode: null, formattedAddress: { $ne: '' } });
  console.log(`Found ${addresses.length} addresses missing geocodes`);

  let success = 0;
  let fail = 0;
  for (const addr of addresses) {
    const geocode = await geocodeAddress(addr.formattedAddress);
    if (geocode) {
      await Address.updateOne({ _id: addr._id }, { $set: { geocode } });
      success++;
      console.log(`  [${addr._id}] ${addr.formattedAddress} -> ${geocode.lat}, ${geocode.lng}`);
    } else {
      fail++;
      console.warn(`  [${addr._id}] ${addr.formattedAddress} -> no result`);
    }
  }

  console.log(`\nGeocoding done: ${success} geocoded, ${fail} failed`);

  // --- Step 2: Reindex all events into Elasticsearch (adds location field) ---
  if (!isElasticConfigured()) {
    console.log('Elasticsearch not configured — skipping reindex');
    await mongoose.disconnect();
    return;
  }

  console.log('\nReindexing all events into Elasticsearch with geo location...');
  await ensureIndex();

  const events = await Event.find().populate('address').lean();

  const participantCounts = await EventParticipant.aggregate([
    { $group: { _id: '$event_id', count: { $sum: 1 } } },
  ]);
  const pcMap = new Map(participantCounts.map((c) => [String(c._id), c.count]));

  const docs = events.map((e) => ({
    id: String(e._id),
    doc: buildEventDoc({ ...e, participantCount: pcMap.get(String(e._id)) || 0 }),
  }));

  await bulkIndexEvents(docs);
  console.log(`Reindexed ${docs.length} events`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
