import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import env from '../config/env.js';
import Address from '../models/Address.js';
import { geocodeAddress, buildFormattedAddress } from '../services/geocodeService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const FORCE = args.has('--force');
// Nominatim asks for max 1 req/sec from the public endpoint. Default to 1100ms.
const DELAY_MS = Number(process.env.GEOCODE_DELAY_MS) || 1100;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await mongoose.connect(env.mongoUri);
  console.log(`Connected to MongoDB${DRY_RUN ? ' (dry run)' : ''}${FORCE ? ' (force)' : ''}`);

  const filter = FORCE ? {} : { is_verified: { $ne: true } };
  const addresses = await Address.find(filter);
  console.log(`Scanning ${addresses.length} address(es)`);

  let verified = 0;
  let stillUnverified = 0;
  let unchanged = 0;

  for (let i = 0; i < addresses.length; i++) {
    const addr = addresses[i];
    const formatted =
      (addr.formattedAddress || '').trim() ||
      buildFormattedAddress({
        line1: addr.line1,
        line2: addr.line2,
        city: addr.city,
        state: addr.state,
        postalCode: addr.postalCode,
        country: addr.country,
      });

    if (!formatted) {
      stillUnverified++;
      console.warn(`  [${i + 1}/${addresses.length}] ${addr._id} skipped — empty address`);
      continue;
    }

    const geocode = await geocodeAddress(formatted);
    const isVerified =
      !!geocode &&
      Number.isFinite(Number(geocode.lat)) &&
      Number.isFinite(Number(geocode.lng));

    const willChange =
      isVerified !== !!addr.is_verified ||
      (isVerified && (!addr.geocode || addr.geocode.lat !== geocode.lat || addr.geocode.lng !== geocode.lng)) ||
      addr.formattedAddress !== formatted;

    if (!willChange) {
      unchanged++;
      console.log(`  [${i + 1}/${addresses.length}] ${addr._id} unchanged (verified=${isVerified})`);
    } else if (DRY_RUN) {
      if (isVerified) verified++;
      else stillUnverified++;
      console.log(
        `  [${i + 1}/${addresses.length}] ${addr._id} would set is_verified=${isVerified}` +
          (isVerified ? ` (${geocode.lat}, ${geocode.lng})` : ''),
      );
    } else {
      await Address.updateOne(
        { _id: addr._id },
        {
          $set: {
            is_verified: isVerified,
            geocode: isVerified ? geocode : null,
            formattedAddress: formatted,
          },
        },
      );
      if (isVerified) verified++;
      else stillUnverified++;
      console.log(
        `  [${i + 1}/${addresses.length}] ${addr._id} -> is_verified=${isVerified}` +
          (isVerified ? ` (${geocode.lat}, ${geocode.lng})` : ''),
      );
    }

    if (i < addresses.length - 1) await sleep(DELAY_MS);
  }

  console.log('');
  console.log(`Verified:   ${verified}`);
  console.log(`Unverified: ${stillUnverified}`);
  console.log(`Unchanged:  ${unchanged}`);
  console.log(DRY_RUN ? '(dry run — no DB writes)' : 'Done.');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('verifyAllAddresses failed:', err);
  process.exit(1);
});
