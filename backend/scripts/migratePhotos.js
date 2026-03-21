import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import env from '../config/env.js';
import Event from '../models/Event.js';
import User from '../models/User.js';
import { uploadImage, isCloudinaryConfigured } from '../services/cloudinaryService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  if (!isCloudinaryConfigured()) {
    console.error('Cloudinary is not configured. Set CLOUDINARY_* vars in .env');
    process.exit(1);
  }

  await mongoose.connect(env.mongoUri);
  console.log('Connected to MongoDB');

  // --- Migrate event photos ---
  const events = await Event.find({ photo: { $regex: /^data:/ } });
  console.log(`Found ${events.length} events with base64 photos`);

  let eventSuccess = 0;
  let eventFail = 0;
  for (const event of events) {
    const url = await uploadImage(event.photo, 'interovert/events');
    if (url) {
      await Event.updateOne({ _id: event._id }, { $set: { photo: url } });
      eventSuccess++;
      console.log(`  [event] ${event._id} -> ${url.slice(0, 60)}...`);
    } else {
      eventFail++;
      console.error(`  [event] ${event._id} upload FAILED`);
    }
  }
  console.log(`Events: ${eventSuccess} migrated, ${eventFail} failed\n`);

  // --- Migrate user avatars ---
  const users = await User.find({ 'profile.avatar': { $regex: /^data:/ } });
  console.log(`Found ${users.length} users with base64 avatars`);

  let userSuccess = 0;
  let userFail = 0;
  for (const user of users) {
    const url = await uploadImage(user.profile.avatar, 'interovert/avatars');
    if (url) {
      await User.updateOne({ _id: user._id }, { $set: { 'profile.avatar': url } });
      userSuccess++;
      console.log(`  [user] ${user._id} -> ${url.slice(0, 60)}...`);
    } else {
      userFail++;
      console.error(`  [user] ${user._id} upload FAILED`);
    }
  }
  console.log(`Users: ${userSuccess} migrated, ${userFail} failed`);

  await mongoose.disconnect();
  console.log('\nDone. Run "node backend/scripts/reindex.js" to update Elasticsearch.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
