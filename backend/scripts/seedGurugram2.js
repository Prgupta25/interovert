/**
 * Seed script — creates 20 more dummy events in Gurugram WITH photos
 *
 * Usage:
 *   node backend/scripts/seedGurugram2.js
 *
 * Photos are fetched from picsum.photos (free, stable, no auth needed),
 * converted to base64 and sent as the photo field — the backend uploads
 * them to Cloudinary automatically via uploadIfBase64.
 */

const BASE_URL = 'http://localhost:5001/api';

// ─── PASTE YOUR JWT HERE ──────────────────────────────────────────────────────
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OWJkN2FiNTU2NmVmYTQ2OGQ2NjkxZjYiLCJpYXQiOjE3NzQyNDk3MjEsImV4cCI6MTc3NDg1NDUyMX0.c4_KgnimdGnIS40MNN1ND7omXXKaeRdISmCCHRxu8HQ';
// ─────────────────────────────────────────────────────────────────────────────

// New Gurugram localities (different from the first batch)
const GURUGRAM_ADDRESSES = [
  { addressLine1: 'Cyber Hub, DLF Cyber City',        addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122002', addressCountry: 'India' },
  { addressLine1: 'Sector 22 Bus Stand Road',         addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122015', addressCountry: 'India' },
  { addressLine1: 'Sheetla Mata Road, Sector 38',     addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122001', addressCountry: 'India' },
  { addressLine1: 'Sushant Lok, Phase 1',             addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122002', addressCountry: 'India' },
  { addressLine1: 'Sector 45, Subhash Nagar',         addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122003', addressCountry: 'India' },
  { addressLine1: 'Manesar Industrial Area',          addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122050', addressCountry: 'India' },
  { addressLine1: 'Heritage City, Sector 25',         addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122002', addressCountry: 'India' },
  { addressLine1: 'DLF Garden City, Sector 91',       addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122505', addressCountry: 'India' },
  { addressLine1: 'Sector 67, Southern Periphery',    addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122102', addressCountry: 'India' },
  { addressLine1: 'Ardee City, Sector 52',            addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122011', addressCountry: 'India' },
  { addressLine1: 'Sector 10, New Colony',            addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122001', addressCountry: 'India' },
  { addressLine1: 'Unitech Cyber Park, Sector 39',    addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122003', addressCountry: 'India' },
  { addressLine1: 'M3M Urbana, Southern Peripheral',  addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122002', addressCountry: 'India' },
  { addressLine1: 'Tau Devi Lal Bio Diversity Park',  addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122001', addressCountry: 'India' },
  { addressLine1: 'Guru Dronacharya Metro Station',   addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122002', addressCountry: 'India' },
  { addressLine1: 'Sector 78, New Gurugram',          addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122004', addressCountry: 'India' },
  { addressLine1: 'Khandsa Road, Sector 37',          addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122001', addressCountry: 'India' },
  { addressLine1: 'Saraswati Kunj, Sector 53',        addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122011', addressCountry: 'India' },
  { addressLine1: 'DLF Phase 1, Qutab Plaza',         addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122002', addressCountry: 'India' },
  { addressLine1: 'Sector 47, Central Park',          addressCity: 'Gurugram', addressState: 'Haryana', addressPostalCode: '122018', addressCountry: 'India' },
];

// Picsum photo IDs mapped to categories for relevant-looking images
// Each entry: [id, width, height]
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
  { name: 'Rooftop Stargazing Night',            category: 'Adventure', activities: 'Telescope setup, star mapping, constellation talk' },
  { name: 'Gurugram Graffiti Walk',              category: 'Other',     activities: 'Street art tour, live spray-paint demo, photo ops' },
  { name: 'AI & Chai Meetup',                    category: 'Learning',  activities: 'Lightning talks on AI tools, networking, Q&A' },
  { name: 'Zumba in the Park',                   category: 'Wellness',  activities: 'One-hour Zumba class for all fitness levels' },
  { name: 'Sunday Brunch Potluck',               category: 'Social',    activities: 'Bring a dish, share recipes, meet new people' },
  { name: 'Acoustic Open Mic',                   category: 'Other',     activities: 'Solo and group performances, sign-up on arrival' },
  { name: 'Board Game Bonanza',                  category: 'Gaming',    activities: 'Catan, Ticket to Ride, Codenames and more' },
  { name: 'Morning Trail Run',                   category: 'Adventure', activities: '5 km trail run followed by a group cool-down' },
  { name: 'Watercolour for Beginners',           category: 'Other',     activities: 'Guided watercolour class, all supplies provided' },
  { name: 'React & Node.js Workshop',            category: 'Learning',  activities: 'Hands-on full-stack project build in 3 hours' },
  { name: 'Bollywood Dance Flashmob',            category: 'Social',    activities: 'Learn the routine, rehearse, then perform together' },
  { name: 'Midnight Cycling Spree',              category: 'Adventure', activities: 'Night ride through Gurugram with safety lights' },
  { name: 'Meditation & Sound Bath',             category: 'Wellness',  activities: 'Guided meditation with Tibetan singing bowls' },
  { name: 'Street Food Crawl',                   category: 'Social',    activities: 'Visit 6 legendary stalls across Old Gurugram' },
  { name: 'Indie Band Showcase',                 category: 'Other',     activities: 'Four emerging bands, each performing a 20-min set' },
  { name: 'Badminton Round Robin',               category: 'Adventure', activities: 'Mixed-doubles tournament, all skill levels welcome' },
  { name: 'Lego Architecture Build-Off',         category: 'Gaming',    activities: 'Teams compete to build the best Gurugram skyline' },
  { name: 'Astrophotography Workshop',           category: 'Learning',  activities: 'Long-exposure night photography tips and practice' },
  { name: 'Entrepreneurship Lunch',              category: 'Learning',  activities: 'Pitch your idea in 2 min, get live feedback' },
  { name: 'Community Cleanup & Picnic',          category: 'Adventure', activities: 'One-hour park cleanup followed by a group picnic' },
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
  d.setHours(Math.floor(Math.random() * 12) + 9, 0, 0, 0);
  return d.toISOString();
}

/** Fetch a Picsum image and return it as a base64 data URI */
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

  console.log(`🚀  Seeding ${EVENTS.length} events in Gurugram (with photos)...\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < EVENTS.length; i++) {
    const event = EVENTS[i];
    const address = GURUGRAM_ADDRESSES[i];
    const photoOptions = PHOTO_BY_CATEGORY[event.category] || PHOTO_BY_CATEGORY.social;
    const [photoId, pw, ph] = photoOptions[i % photoOptions.length];

    console.log(`🖼️   Fetching photo for [${i + 1}/${EVENTS.length}] ${event.name}...`);
    const photo = await fetchPhotoAsBase64(photoId, pw, ph);

    const payload = {
      name: event.name,
      description: `Join us for ${event.activities.toLowerCase()} at ${address.addressLine1}, Gurugram. Everyone is welcome — bring a friend!`,
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
