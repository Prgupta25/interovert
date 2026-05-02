import { Client } from '@elastic/elasticsearch';
import env from '../config/env.js';

const INDEX = 'events';

let client = null;

function getClient() {
  if (client) return client;
  if (!env.elasticUrl) return null;

  const opts = { node: env.elasticUrl };
  if (env.elasticApiKey) {
    opts.auth = { apiKey: env.elasticApiKey };
  }
  client = new Client(opts);
  return client;
}

const MAPPINGS = {
  properties: {
    name:               { type: 'text', analyzer: 'english', fields: { keyword: { type: 'keyword', ignore_above: 256 } } },
    description:        { type: 'text', analyzer: 'english' },
    activities:         { type: 'text', analyzer: 'english' },
    ownerName:          { type: 'text', analyzer: 'english' },
    venue:              { type: 'text', analyzer: 'english' },
    category:           { type: 'keyword' },
    city:               { type: 'keyword' },
    owner_id:           { type: 'keyword' },
    datetime:           { type: 'date' },
    endDatetime:        { type: 'date' },
    createdAt:          { type: 'date' },
    photo:              { type: 'keyword', index: false },
    maxAttendees:       { type: 'integer' },
    participantCount:   { type: 'integer' },
    location:           { type: 'geo_point' },
    // Recurring events
    recurrenceEnabled:  { type: 'boolean' },
    recurrenceFreq:     { type: 'keyword' },
    seriesId:           { type: 'keyword' },
    occurrenceIndex:    { type: 'integer' },
  },
};

export async function ensureIndex() {
  const es = getClient();
  if (!es) return;

  const exists = await es.indices.exists({ index: INDEX });
  if (!exists) {
    await es.indices.create({
      index: INDEX,
      body: { mappings: MAPPINGS },
    });
    console.log(`[elastic] created index "${INDEX}"`);
  } else {
    // Apply any new field mappings (e.g. geo_point) to existing index
    await es.indices.putMapping({ index: INDEX, body: MAPPINGS });
    console.log(`[elastic] index "${INDEX}" mapping updated`);
  }
}

export async function deleteIndex() {
  const es = getClient();
  if (!es) return;

  const exists = await es.indices.exists({ index: INDEX });
  if (exists) {
    await es.indices.delete({ index: INDEX });
    console.log(`[elastic] deleted index "${INDEX}"`);
  }
}

export function buildEventDoc(event, address) {
  const addr = address || event.address || {};
  const venue = addr.formattedAddress || [addr.line1, addr.city].filter(Boolean).join(', ');
  const geocode = addr.geocode;

  return {
    name:             event.name,
    description:      event.description,
    activities:       event.activities,
    ownerName:        event.ownerName,
    venue,
    category:         (event.category || '').toLowerCase(),
    city:             (addr.city || '').toLowerCase(),
    owner_id:         String(event.owner_id),
    datetime:         event.datetime,
    endDatetime:      event.endDatetime || null,
    createdAt:        event.createdAt,
    photo:             event.photo || '',
    maxAttendees:      event.maxAttendees,
    participantCount:  event.participantCount || 0,
    // Recurring events
    recurrenceEnabled: event.recurrence?.enabled || false,
    recurrenceFreq:    event.recurrence?.frequency || null,
    seriesId:          event.recurrence?.seriesId || null,
    occurrenceIndex:   event.recurrence?.occurrenceIndex ?? 0,
    // geo_point — only set when geocode is available
    ...(geocode?.lat && geocode?.lng && {
      location: { lat: geocode.lat, lon: geocode.lng },
    }),
  };
}

export async function indexEvent(eventId, doc) {
  const es = getClient();
  if (!es) return;

  try {
    await es.index({ index: INDEX, id: String(eventId), body: doc, refresh: 'wait_for' });
  } catch (err) {
    console.error('[elastic] indexEvent failed:', err.message);
  }
}

export async function removeEvent(eventId) {
  const es = getClient();
  if (!es) return;

  try {
    await es.delete({ index: INDEX, id: String(eventId), refresh: 'wait_for' });
  } catch (err) {
    if (err.meta?.statusCode !== 404) {
      console.error('[elastic] removeEvent failed:', err.message);
    }
  }
}

export async function bulkIndexEvents(docs) {
  const es = getClient();
  if (!es || docs.length === 0) return;

  const body = docs.flatMap((d) => [
    { index: { _index: INDEX, _id: d.id } },
    d.doc,
  ]);
  const result = await es.bulk({ body, refresh: 'wait_for' });

  if (result.errors) {
    const failed = result.items.filter((i) => i.index?.error);
    console.error(`[elastic] bulk index: ${failed.length} failures`);
    failed.forEach((item) => {
      console.error(`[elastic]   _id=${item.index._id} error:`, JSON.stringify(item.index.error));
    });
  }
  return result;
}

export async function searchEvents({
  q,
  category,
  city,
  dateFrom,
  dateTo,
  sortBy,
  page = 1,
  limit = 12,
  userLat,
  userLng,
  radius = 50,
  ownerId,
  /** When set (incl. []), "my events" = owned OR joined; requires ownerId. */
  joinedEventIds,
}) {
  const es = getClient();
  if (!es) return null;

  const must   = [];
  const filter = [];
  const should = []; // outer should — adds bonus score but never filters

  // ─── Text search ─────────────────────────────────────────────────────────
  if (q && q.trim()) {
    const trimQ = q.trim();

    // Inner bool: at least ONE clause must match (ensures relevance).
    // Multiple clauses score on top of each other — higher tiers win.
    must.push({
      bool: {
        should: [
          // ── Tier 1: Exact phrase ─ "yoga park" matches "Yoga in the Park" ──
          { match_phrase: { name:        { query: trimQ, boost: 10 } } },
          { match_phrase: { description: { query: trimQ, boost: 3  } } },
          { match_phrase: { activities:  { query: trimQ, boost: 3  } } },

          // ── Tier 2: Phrase prefix ─ partial input "yog" → "Yoga session" ──
          { match_phrase_prefix: { name:        { query: trimQ, boost: 6, max_expansions: 20 } } },
          { match_phrase_prefix: { description: { query: trimQ, boost: 2, max_expansions: 10 } } },

          // ── Tier 3: Best-fields multi_match ─ standard token match ────────
          {
            multi_match: {
              query:    trimQ,
              fields:   ['name^4', 'description^2', 'activities^2', 'ownerName', 'venue'],
              type:     'best_fields',
              operator: 'or',
            },
          },

          // ── Tier 4: Fuzzy fallback ─ catches typos ("yofa" → "yoga") ──────
          {
            multi_match: {
              query:          trimQ,
              fields:         ['name^3', 'description', 'activities'],
              fuzziness:      'AUTO',
              prefix_length:  1,   // first char must be correct — avoids noise
              max_expansions: 10,
              boost:          0.8,
            },
          },
        ],
        minimum_should_match: 1,
      },
    });

    // Outer should: bonus score for an exact full-title match (case-sensitive keyword)
    // Does NOT filter — only lifts the score of an exact match to the very top.
    should.push({ term: { 'name.keyword': { value: trimQ, boost: 15 } } });
  }

  // ─── Filters (do not affect score) ───────────────────────────────────────
  if (category && category !== 'all') {
    filter.push({ term: { category: category.toLowerCase() } });
  }

  if (city && String(city).trim()) {
    filter.push({ term: { city: String(city).toLowerCase().trim() } });
  }

  if (ownerId && joinedEventIds !== undefined) {
    const should = [{ term: { owner_id: String(ownerId) } }];
    if (joinedEventIds.length > 0) {
      should.push({ ids: { values: joinedEventIds.map(String) } });
    }
    filter.push({ bool: { should, minimum_should_match: 1 } });
  } else if (ownerId) {
    filter.push({ term: { owner_id: String(ownerId) } });
  }

  const range = {};
  if (dateFrom) range.gte = dateFrom;
  if (dateTo)   range.lte = dateTo;
  if (Object.keys(range).length) {
    filter.push({ range: { datetime: range } });
  }

  const hasGeo = userLat != null && userLng != null;
  if (hasGeo) {
    filter.push({
      geo_distance: {
        distance: `${radius}km`,
        location: { lat: Number(userLat), lon: Number(userLng) },
      },
    });
  }

  // ─── Sort ─────────────────────────────────────────────────────────────────
  // Priority: geo (nearest first) > text relevance > explicit sortBy > date
  const sort = [];
  if (hasGeo) {
    sort.push({
      _geo_distance: {
        location: { lat: Number(userLat), lon: Number(userLng) },
        order: 'asc',
        unit:  'km',
      },
    });
  } else if (q && q.trim()) {
    // When searching by text, sort by relevance score first, then date
    sort.push({ _score: 'desc' });
    sort.push({ datetime: 'asc' });
  } else if (sortBy === 'name') {
    sort.push({ 'name.keyword': 'asc' });
  } else {
    sort.push({ datetime: 'asc' });
  }

  const from = (Math.max(1, Number(page)) - 1) * limit;

  const body = {
    query: {
      bool: {
        must:   must.length   ? must   : [{ match_all: {} }],
        filter,
        ...(should.length && { should }),
      },
    },
    sort,
    from,
    size: Number(limit),
  };

  console.log('[elastic] query:', JSON.stringify(body, null, 2));

  try {
    const result = await es.search({ index: INDEX, body });
    const hits = result.hits.hits.map((h) => ({
      _id: h._id,
      ...h._source,
      _score: h._score,
      ...(hasGeo && h.sort?.[0] != null && { distanceKm: Number(h.sort[0].toFixed(1)) }),
    }));
    const total = typeof result.hits.total === 'number' ? result.hits.total : result.hits.total.value;
    console.log(`[elastic] search "${q || '*'}" → ${total} hits (page ${page})${hasGeo ? ` within ${radius}km` : ''}`);
    return { hits, total, page: Number(page), limit: Number(limit) };
  } catch (err) {
    console.error('[elastic] searchEvents failed:', err.message);
    return null;
  }
}

export function isElasticConfigured() {
  return Boolean(getClient());
}
