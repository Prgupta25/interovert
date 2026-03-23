/**
 * Seed script — creates 20 dummy events scattered across Gurugram
 *
 * Usage:
 *   node backend/scripts/seedGurugram.js
 *
 * Set your JWT token in the TOKEN constant below before running.
 */

const BASE_URL = 'http://localhost:5001/api';

// ─── PASTE YOUR JWT HERE ──────────────────────────────────────────────────────
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OWJkN2FiNTU2NmVmYTQ2OGQ2NjkxZjYiLCJpYXQiOjE3NzQyNDk3MjEsImV4cCI6MTc3NDg1NDUyMX0.c4_KgnimdGnIS40MNN1ND7omXXKaeRdISmCCHRxu8HQ';
// ─────────────────────────────────────────────────────────────────────────────

// Real Gurugram localities with accurate street-level addresses
const GURUGRAM_ADDRESSES = [
  { addressLine1: 'DLF Cyber City, Phase 2',       addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122002', addressCountry: 'India' },
  { addressLine1: 'Sector 29 Huda Market',          addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122001', addressCountry: 'India' },
  { addressLine1: 'MG Road, Sikanderpur',           addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122002', addressCountry: 'India' },
  { addressLine1: 'Golf Course Road, Sector 54',    addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122011', addressCountry: 'India' },
  { addressLine1: 'Udyog Vihar Phase 4',            addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122015', addressCountry: 'India' },
  { addressLine1: 'Ambience Mall, NH-48',           addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122003', addressCountry: 'India' },
  { addressLine1: 'Sector 56, Huda City Centre',    addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122011', addressCountry: 'India' },
  { addressLine1: 'Palam Vihar, Block C',           addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122017', addressCountry: 'India' },
  { addressLine1: 'South City 1, Sector 40',        addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122001', addressCountry: 'India' },
  { addressLine1: 'Sohna Road, Sector 49',          addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122018', addressCountry: 'India' },
  { addressLine1: 'DLF Phase 3, Nathupur Road',     addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122002', addressCountry: 'India' },
  { addressLine1: 'Sector 14, Old Gurugram',        addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122001', addressCountry: 'India' },
  { addressLine1: 'Nirvana Country, Sector 50',     addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122018', addressCountry: 'India' },
  { addressLine1: 'Galleria Market, DLF Phase 4',   addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122009', addressCountry: 'India' },
  { addressLine1: 'Sector 83, Dwarka Expressway',   addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122004', addressCountry: 'India' },
  { addressLine1: 'Wazirabad Village Road',         addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122001', addressCountry: 'India' },
  { addressLine1: 'Rapid Metro, Sector 42-43',      addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122009', addressCountry: 'India' },
  { addressLine1: 'IFFCO Chowk, Sector 28',         addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122001', addressCountry: 'India' },
  { addressLine1: 'Sector 31 Leisure Valley Park',  addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122001', addressCountry: 'India' },
  { addressLine1: 'Vatika City, Sector 49',         addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122018', addressCountry: 'India' },
];

// Must match the frontend eventCategories constant exactly (case will be lowercased on index)
const CATEGORIES = ['Adventure', 'Social', 'Learning', 'Wellness', 'Gaming', 'Movies', 'Other'];

const ACTIVITIES = [
  'Jamming session and open mic',
  'Sketching and painting workshop',
  'Hackathon and coding challenge',
  'Cricket match and awards',
  'Street food tasting walk',
  'Board games evening',
  'Sunrise yoga and meditation',
  'Photography walk',
  'Book club discussion',
  'Cycling group ride',
  'Startup networking mixer',
  'Stand-up comedy night',
  'Pottery and clay workshop',
  'Film screening and discussion',
  'Dance workshop — Bollywood',
  'Rock climbing intro session',
  'Chess tournament',
  'Nature bird-watching walk',
  'Improv comedy workshop',
  'Trivia quiz night',
];

const ABOUT_YOU_OPTIONS = [
  'I love meeting new people and exploring the city.',
  'Passionate about arts, culture, and community events.',
  'Tech enthusiast who enjoys collaborative learning.',
  'Fitness lover who enjoys group activities outdoors.',
  'Foodie and travel enthusiast based in Gurugram.',
];

const EXPECTATIONS_OPTIONS = [
  'Come with an open mind and ready to have fun.',
  'Bring your curiosity — no prior experience needed.',
  'Dress comfortably and be punctual.',
  'Bring your own equipment if you have any.',
  'Respect everyone, keep the vibe positive.',
];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomFutureDate(daysAhead = 90) {
  const d = new Date();
  d.setDate(d.getDate() + Math.floor(Math.random() * daysAhead) + 1);
  d.setHours(Math.floor(Math.random() * 12) + 9, 0, 0, 0); // 9am–9pm
  return d.toISOString();
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

  console.log(`🚀  Seeding ${GURUGRAM_ADDRESSES.length} events in Gurugram...\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < GURUGRAM_ADDRESSES.length; i++) {
    const address = GURUGRAM_ADDRESSES[i];
    const activityText = ACTIVITIES[i % ACTIVITIES.length];
    const category = randomFrom(CATEGORIES);

    const payload = {
      name: `${activityText} — Gurugram`,
      description: `A fun community gathering in ${address.addressLine1}. Join us for ${activityText.toLowerCase()}. Everyone is welcome!`,
      datetime: randomFutureDate(),
      category,
      activities: activityText,
      maxAttendees: [5, 10, 15, 20, 25, 30][Math.floor(Math.random() * 6)],
      aboutYou: randomFrom(ABOUT_YOU_OPTIONS),
      expectations: randomFrom(EXPECTATIONS_OPTIONS),
      ...address,
    };

    try {
      const created = await createEvent(payload);
      console.log(`✅  [${i + 1}/${GURUGRAM_ADDRESSES.length}] ${payload.name}`);
      console.log(`    📍  ${address.addressLine1}, ${address.addressPostalCode}`);
      console.log(`    🆔  ${created._id || created.event?._id || 'created'}\n`);
      success++;
    } catch (err) {
      console.error(`❌  [${i + 1}/${GURUGRAM_ADDRESSES.length}] ${payload.name}`);
      console.error(`    Error: ${err.message}\n`);
      failed++;
    }

    // Small delay to avoid hammering Nominatim geocode (1 req/sec limit)
    await new Promise((r) => setTimeout(r, 1100));
  }

  console.log('─'.repeat(50));
  console.log(`Done. ✅ ${success} created  ❌ ${failed} failed`);
}

seed();
