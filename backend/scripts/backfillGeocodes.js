import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import env from '../config/env.js';
import Address from '../models/Address.js';
import { geocodeAddress } from '../services/geocodeService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  await mongoose.connect(env.mongoUri);
  console.log('Connected to MongoDB');

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

  console.log(`\nDone: ${success} geocoded, ${fail} failed`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
