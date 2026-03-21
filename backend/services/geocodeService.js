import axios from 'axios';

/**
 * Geocode a human-readable address string using OpenStreetMap Nominatim.
 * Returns { lat, lng } or null on failure.
 * Free to use – no API key required.
 */
export async function geocodeAddress(addressString) {
  if (!addressString || !addressString.trim()) return null;

  try {
    const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: addressString.trim(),
        format: 'json',
        limit: 1,
        addressdetails: 0,
      },
      headers: {
        // Nominatim requires a descriptive User-Agent
        'User-Agent': 'Interovert-CollegeProject/1.0 (contact: admin@interovert.local)',
        'Accept-Language': 'en',
      },
      timeout: 6000,
    });

    if (Array.isArray(data) && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
    return null;
  } catch (err) {
    // Geocoding failure is non-fatal — return null so address is still saved
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
