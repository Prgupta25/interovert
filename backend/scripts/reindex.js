import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import env from '../config/env.js';
import Event from '../models/Event.js';
import Address from '../models/Address.js';
import EventParticipant from '../models/EventParticipant.js';
import { deleteIndex, ensureIndex, buildEventDoc, bulkIndexEvents, isElasticConfigured } from '../services/elasticService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  if (!isElasticConfigured()) {
    console.error('Elasticsearch is not configured. Set ELASTICSEARCH_URL in .env');
    process.exit(1);
  }

  await mongoose.connect(env.mongoUri);
  console.log('Connected to MongoDB');

  await deleteIndex();
  await ensureIndex();

  const events = await Event.find().populate('address').lean();
  console.log(`Found ${events.length} events in MongoDB`);

  const participantCounts = await EventParticipant.aggregate([
    { $group: { _id: '$event_id', count: { $sum: 1 } } },
  ]);
  const pcMap = new Map(participantCounts.map((c) => [String(c._id), c.count]));

  const docs = events.map((e) => ({
    id: String(e._id),
    doc: buildEventDoc({ ...e, participantCount: pcMap.get(String(e._id)) || 0 }),
  }));

  if (docs.length === 0) {
    console.log('No events to index');
  } else {
    const result = await bulkIndexEvents(docs);
    const failed = result?.errors ? result.items.filter((i) => i.index?.error).length : 0;
    console.log(`Reindexed ${docs.length} events (${failed} failures)`);
  }

  await mongoose.disconnect();
  console.log('Done');
}

main().catch((err) => {
  console.error('Reindex failed:', err);
  process.exit(1);
});
