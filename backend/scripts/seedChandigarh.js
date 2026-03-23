/**
 * Seed script — creates 20 dummy events scattered across Chandigarh WITH photos
 *
 * Usage:
 *   node backend/scripts/seedChandigarh.js
 */

const BASE_URL = 'http://localhost:5001/api';

// ─── PASTE YOUR JWT HERE ──────────────────────────────────────────────────────
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OWJkN2FiNTU2NmVmYTQ2OGQ2NjkxZjYiLCJpYXQiOjE3NzQyNDk3MjEsImV4cCI6MTc3NDg1NDUyMX0.c4_KgnimdGnIS40MNN1ND7omXXKaeRdISmCCHRxu8HQ';
// ─────────────────────────────────────────────────────────────────────────────

const CHANDIGARH_ADDRESSES = [
  { addressLine1: 'Sector 17 Plaza',                  addressCity: 'Chandigarh', addressState: 'Chandigarh', addressPostalCode: '160017', addressCountry: 'India' },
  { addressLine1: 'Rock Garden, Sector 1',            addressCity: 'Chandigarh', addressState: 'Chandigarh', addressPostalCode: '160001', addressCountry: 'India' },
  { addressLine1: 'Sukhna Lake Promenade',            addressCity: 'Chandigarh', addressState: 'Chandigarh', addressPostalCode: '160002', addressCountry: 'India' },
  { addressLine1: 'Elante Mall, Industrial Area',     addressCity: 'Chandigarh', addressState: 'Chandigarh', addressPostalCode: '160002', addressCountry: 'India' },
  { addressLine1: 'Sector 35 B Market',               addressCity: 'Chandigarh', addressState: 'Chandigarh', addressPostalCode: '160035', addressCountry: 'India' },
  { addressLine1: 'Sector 22 B, Madhya Marg',         addressCity: 'Chandigarh', addressState: 'Chandigarh', addressPostalCode: '160022', addressCountry: 'India' },
  { addressLine1: 'Panjab University, Sector 14',     addressCity: 'Chandigarh', addressState: 'Chandigarh', addressPostalCode: '160014', addressCountry: 'India' },
  { addressLine1: 'Sector 43 Bus Terminus',           addressCity: 'Chandigarh', addressState: 'Chandigarh', addressPostalCode: '160043', addressCountry: 'India' },
  { addressLine1: 'Leisure Valley, Sector 10',        addressCity: 'Chandigarh', addressState: 'Chandigarh', addressPostalCode: '160011', addressCountry: 'India' },
  { addressLine1: 'Rose Garden, Sector 16',           addressCity: 'Chandigarh', addressState: 'Chandigarh', addressPostalCode: '160015', addressCountry: 'India' },
  { addressLine1: 'Sector 9 D, Madhya Marg',          addressCity: 'Chandigarh', addressState: 'Chandigarh', addressPostalCode: '160009', addressCountry: 'India' },
  { addressLine1: 'TDI City, Mohali Phase 7',         addressCity: 'Chandigarh', addressState: 'Punjab',     addressPostalCode: '160055', addressCountry: 'India' },
  { addressLine1: 'Sector 26 Grain Market',           addressCity: 'Chandigarh', addressState: 'Chandigarh', addressPostalCode: '160026', addressCountry: 'India' },
  { addressLine1: 'Chandigarh Railway Station, Sector 17', addressCity: 'Chandigarh', addressState: 'Chandigarh', addressPostalCode: '160017', addressCountry: 'India' },
  { addressLine1: 'Botanical Garden, Sector 5',       addressCity: 'Chandigarh', addressState: 'Chandigarh', addressPostalCode: '160005', addressCountry: 'India' },
  { addressLine1: 'Sector 7 C, Jan Marg',             addressCity: 'Chandigarh', addressState: 'Chandigarh', addressPostalCode: '160007', addressCountry: 'India' },
  { addressLine1: 'Chandigarh Golf Club, Sector 6',   addressCity: 'Chandigarh', addressState: 'Chandigarh', addressPostalCode: '160006', addressCountry: 'India' },
  { addressLine1: 'ISBT Sector 43',                   addressCity: 'Chandigarh', addressState: 'Chandigarh', addressPostalCode: '160043', addressCountry: 'India' },
  { addressLine1: 'Sector 20 D Market',               addressCity: 'Chandigarh', addressState: 'Chandigarh', addressPostalCode: '160020', addressCountry: 'India' },
  { addressLine1: 'Lake Club, Sukhna Lake',           addressCity: 'Chandigarh', addressState: 'Chandigarh', addressPostalCode: '160002', addressCountry: 'India' },
];

// Picsum photo IDs by category
// Categories match frontend eventCategories: Adventure, Social, Learning, Wellness, Gaming, Movies, Other
const PHOTO_BY_CATEGORY = {
  Adventure: [[15,  800, 500], [29,  800, 500], [371, 800, 500]],
  Social:    [[217, 800, 500], [338, 800, 500], [375, 800, 500]],
  Learning:  [[180, 800, 500], [119, 800, 500], [423, 800, 500]],
  Wellness:  [[230, 800, 500], [239, 800, 500], [274, 800, 500]],
  Gaming:    [[326, 800, 500], [287, 800, 500], [447, 800, 500]],
  Movies:    [[167, 800, 500], [164, 800, 500], [395, 800, 500]],
  Other:     [[292, 800, 500], [431, 800, 500], [488, 800, 500]],
};

const EVENTS = [
  { name: 'Sukhna Lake Sunrise Yoga',          category: 'Wellness',  activities: 'Lakeside yoga and pranayama for all levels' },
  { name: 'Rock Garden Photography Tour',      category: 'Other',     activities: 'Guided photo walk through the iconic sculpture park' },
  { name: 'Chandigarh Tech Founders Mixer',    category: 'Learning',  activities: 'Speed networking, startup pitches, open mic Q&A' },
  { name: 'Sector 17 Street Art Walk',         category: 'Other',     activities: 'Explore murals, public sculptures, and architecture' },
  { name: 'Rose Garden Picnic & Games',        category: 'Adventure', activities: 'Lawn games, picnic baskets, meet the community' },
  { name: 'Open Mic Night — Sector 26',        category: 'Social',    activities: 'Poetry, comedy, and live music sign-ups on arrival' },
  { name: 'Board Games at Elante',             category: 'Gaming',    activities: 'Catan, Pandemic, Uno tournament — all welcome' },
  { name: 'Chandigarh Cycling Club Ride',      category: 'Adventure', activities: '20 km group ride along Sukhna Lake loop' },
  { name: 'Pottery Wheel Workshop',            category: 'Other',     activities: 'Learn to throw clay — all materials included' },
  { name: 'AI Tools Bootcamp',                 category: 'Learning',  activities: 'Hands-on with ChatGPT, Midjourney, and Claude' },
  { name: 'Bollywood Retro Night',             category: 'Movies',    activities: 'Live DJ, retro classics, costume contest' },
  { name: 'Dawn Birding Walk',                 category: 'Adventure', activities: 'Botanical garden bird spotting with binoculars' },
  { name: 'Mindfulness & Journaling Circle',   category: 'Wellness',  activities: 'Guided mindfulness, reflective journaling prompts' },
  { name: 'Punjabi Dhaba Food Crawl',          category: 'Social',    activities: 'Visit 5 legendary dhabas in Old Chandigarh' },
  { name: 'Indie Singer-Songwriter Showcase',  category: 'Other',     activities: 'Four emerging artists, each performing original sets' },
  { name: 'Table Tennis Open Tournament',      category: 'Adventure', activities: 'Singles & doubles brackets, prizes for top 3' },
  { name: 'DIY Terracotta Jewellery',          category: 'Other',     activities: 'Make your own clay pendants and earrings' },
  { name: 'Improv Comedy Workshop',            category: 'Social',    activities: 'Yes-and exercises, short-form games, zero experience needed' },
  { name: 'Startup Weekend Chandigarh',        category: 'Learning',  activities: '54-hour build, pitch, and demo competition' },
  { name: 'Community Garden Day',              category: 'Adventure', activities: 'Plant saplings, learn composting, group lunch after' },
];

const ABOUT_YOU_OPTIONS = [
  'Lover of gardens, heritage, and slow mornings by the lake.',
  'Tech builder who enjoys collaborative learning sessions.',
  'Outdoor enthusiast and avid cyclist based in Chandigarh.',
  'Foodie who chases authentic Punjabi flavours every weekend.',
  'Creative soul passionate about art, music, and community.',
];

const EXPECTATIONS_OPTIONS = [
  'Come with an open mind and ready to have fun.',
  'Bring your curiosity — no prior experience needed.',
  'Dress comfortably and be punctual.',
  'Bring your own gear if you have any.',
  'Respect everyone and keep the vibe positive.',
];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomFutureDate(daysAhead = 90) {
  const d = new Date();
  d.setDate(d.getDate() + Math.floor(Math.random() * daysAhead) + 1);
  d.setHours(Math.floor(Math.random() * 12) + 9, 0, 0, 0);
  return d.toISOString();
}

async function fetchPhotoAsBase64(id, w = 800, h = 500) {
  try {
    const url = `https://picsum.photos/id/${id}/${w}/${h}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mime = res.headers.get('content-type') || 'image/jpeg';
    return `data:${mime};base64,${base64}`;
  } catch (err) {
    console.warn(`    ⚠️  Photo fetch failed (id=${id}): ${err.message} — skipping photo`);
    return null;
  }
}

async function createEvent(payload) {
  const res = await fetch(`${BASE_URL}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || res.statusText);
  return data;
}

async function seed() {
  if (TOKEN === 'PASTE_YOUR_JWT_TOKEN_HERE') {
    console.error('❌  Set your JWT token in the TOKEN constant at the top of the script.');
    process.exit(1);
  }

  console.log(`🚀  Seeding ${EVENTS.length} events in Chandigarh (with photos)...\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < EVENTS.length; i++) {
    const event = EVENTS[i];
    const address = CHANDIGARH_ADDRESSES[i];
    const photoOptions = PHOTO_BY_CATEGORY[event.category] || PHOTO_BY_CATEGORY.social;
    const [photoId, pw, ph] = photoOptions[i % photoOptions.length];

    console.log(`🖼️   Fetching photo for [${i + 1}/${EVENTS.length}] ${event.name}...`);
    const photo = await fetchPhotoAsBase64(photoId, pw, ph);

    const payload = {
      name: event.name,
      description: `Join us for ${event.activities.toLowerCase()} at ${address.addressLine1}, Chandigarh. Everyone is welcome — bring a friend!`,
      datetime: randomFutureDate(),
      category: event.category,
      activities: event.activities,
      maxAttendees: [5, 10, 15, 20, 25, 30][Math.floor(Math.random() * 6)],
      aboutYou: randomFrom(ABOUT_YOU_OPTIONS),
      expectations: randomFrom(EXPECTATIONS_OPTIONS),
      ...(photo ? { photo } : {}),
      ...address,
    };

    try {
      const created = await createEvent(payload);
      console.log(`✅  [${i + 1}/${EVENTS.length}] ${event.name}`);
      console.log(`    📍  ${address.addressLine1}, ${address.addressPostalCode}`);
      console.log(`    🖼️   photo: ${photo ? 'uploaded' : 'skipped'}`);
      console.log(`    🆔  ${created._id || created.event?._id || 'created'}\n`);
      success++;
    } catch (err) {
      console.error(`❌  [${i + 1}/${EVENTS.length}] ${event.name}`);
      console.error(`    Error: ${err.message}\n`);
      failed++;
    }

    // Respect Nominatim 1 req/sec geocode limit
    await new Promise((r) => setTimeout(r, 1100));
  }

  console.log('─'.repeat(50));
  console.log(`Done. ✅ ${success} created  ❌ ${failed} failed`);
}

seed();
