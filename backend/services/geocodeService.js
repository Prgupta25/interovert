import axios from 'axios';

const NOMINATIM_HEADERS = {
  'User-Agent': 'Interovert-CollegeProject/1.0 (contact: admin@interovert.local)',
  'Accept-Language': 'en',
};

async function nominatimSearch(query) {
  const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: { q: query.trim(), format: 'json', limit: 1, addressdetails: 0 },
    headers: NOMINATIM_HEADERS,
    timeout: 6000,
  });
  if (Array.isArray(data) && data.length > 0) {
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  }
  return null;
}

/**
 * Geocode a human-readable address string using OpenStreetMap Nominatim.
 * Tries the full address first, then progressively shorter versions
 * (dropping the most specific parts) so building names etc. don't
 * prevent a match on the broader locality.
 * Returns { lat, lng } or null on failure.
 */
export async function geocodeAddress(addressString) {
  if (!addressString || !addressString.trim()) return null;

  const parts = addressString.split(',').map((p) => p.trim()).filter(Boolean);

  try {
    for (let i = 0; i < parts.length - 1; i++) {
      const query = parts.slice(i).join(', ');
      const result = await nominatimSearch(query);
      if (result) {
        if (i > 0) console.log(`[geocode] matched on simplified query: "${query}"`);
        return result;
      }
    }
    return null;
  } catch (err) {
    console.warn('[geocode] Failed to geocode address:', err?.message || 'unknown error');
    return null;
  }
}

/**
 * Build a single formatted address string from parts.
 */
export function buildFormattedAddress({ line1, line2, city, state, postalCode, country }) {
  return [line1, line2, city, state, postalCode, country]
    .map((p) => (p || '').trim())
    .filter(Boolean)
    .join(', ');
}
