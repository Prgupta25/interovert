/**
 * recommendationService.js
 *
 * Manages a dedicated Elasticsearch index — "user_event_signals" —
 * that records every user→event interaction (join / favorite).
 *
 * Flow:
 *   1. recordSignal()   — called after joinEvent / toggleFavorite(add)
 *   2. getRecommendations() — aggregates the user's top categories from
 *      their signal history, then queries the main "events" index with
 *      category boosts to surface relevant future events they haven't
 *      already interacted with.
 */

import { Client } from '@elastic/elasticsearch';
import env from '../config/env.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const SIGNALS_INDEX = 'user_event_signals';
const EVENTS_INDEX  = 'events';

/** Weights per signal type — higher = stronger preference signal */
const SIGNAL_WEIGHTS = {
  join:     3,
  favorite: 2,
};

// ─── Client (shared singleton, lazy-init) ─────────────────────────────────────

let _client = null;

function getClient() {
  if (_client) return _client;
  if (!env.elasticUrl) return null;

  const opts = { node: env.elasticUrl };
  if (env.elasticApiKey) opts.auth = { apiKey: env.elasticApiKey };

  _client = new Client(opts);
  return _client;
}

// ─── Index setup ──────────────────────────────────────────────────────────────

const SIGNALS_MAPPINGS = {
  properties: {
    userId:     { type: 'keyword' },
    eventId:    { type: 'keyword' },
    category:   { type: 'keyword' },
    city:       { type: 'keyword' },
    signalType: { type: 'keyword' },  // 'join' | 'favorite'
    weight:     { type: 'float'   },
    timestamp:  { type: 'date'    },
  },
};

/**
 * Create the user_event_signals index if it doesn't already exist.
 * Called once at server startup (alongside ensureElasticIndex).
 */
export async function ensureSignalsIndex() {
  const es = getClient();
  if (!es) return;

  try {
    const exists = await es.indices.exists({ index: SIGNALS_INDEX });
    if (!exists) {
      await es.indices.create({
        index: SIGNALS_INDEX,
        body: { mappings: SIGNALS_MAPPINGS },
      });
      console.log(`[recommend] created index "${SIGNALS_INDEX}"`);
    } else {
      await es.indices.putMapping({ index: SIGNALS_INDEX, body: SIGNALS_MAPPINGS });
      console.log(`[recommend] index "${SIGNALS_INDEX}" mapping synced`);
    }
  } catch (err) {
    console.warn('[recommend] ensureSignalsIndex failed:', err.message);
  }
}

// ─── Write a signal ───────────────────────────────────────────────────────────

/**
 * Upsert a single interaction signal.
 * Uses a deterministic document ID (userId_eventId_signalType) so the
 * same signal can never be double-counted.
 *
 * @param {{ userId:string, eventId:string, category:string, city?:string, signalType:'join'|'favorite' }} opts
 */
export async function recordSignal({ userId, eventId, category, city = '', signalType }) {
  const es = getClient();
  if (!es) return;

  try {
    const docId = `${userId}_${eventId}_${signalType}`;
    await es.index({
      index: SIGNALS_INDEX,
      id: docId,
      body: {
        userId:     String(userId),
        eventId:    String(eventId),
        category:   category || 'other',
        city:       city || '',
        signalType,
        weight:     SIGNAL_WEIGHTS[signalType] ?? 1,
        timestamp:  new Date().toISOString(),
      },
      refresh: false, // fire-and-forget — no need to wait
    });
    console.log(`[recommend] signal recorded: ${signalType} userId=${userId} eventId=${eventId} cat=${category}`);
  } catch (err) {
    // Never throw — recommendations are non-critical
    console.warn('[recommend] recordSignal failed:', err.message);
  }
}

// ─── Query recommendations ────────────────────────────────────────────────────

/**
 * Build a list of recommended events for a user.
 *
 * Algorithm:
 *   1. Aggregate the user's signals → top categories (by sum of weights)
 *   2. Build a bool.should query on the events index, boosting each
 *      preferred category proportionally to its signal weight.
 *   3. Filter: only future events; exclude already-interacted event IDs.
 *   4. Sort by relevance score first, then date ascending.
 *
 * @param {string} userId
 * @param {number} [limit=8]
 * @returns {{ hits: object[], total: number, topCategory: string|null }}
 */
export async function getRecommendations(userId, limit = 8) {
  const es = getClient();
  if (!es) return { hits: [], total: 0, topCategory: null };

  try {
    // ── Step 1: aggregate user's signal history ──────────────────────────────
    const aggResult = await es.search({
      index: SIGNALS_INDEX,
      body: {
        query: { term: { userId: String(userId) } },
        size: 0,  // we only need aggregations, not documents
        aggs: {
          top_categories: {
            terms: { field: 'category', size: 10 },
            aggs: {
              total_weight: { sum: { field: 'weight' } },
            },
          },
          interacted_events: {
            terms: { field: 'eventId', size: 200 },
          },
        },
      },
    });

    const topCategories = aggResult.aggregations?.top_categories?.buckets ?? [];
    const interactedIds = (aggResult.aggregations?.interacted_events?.buckets ?? [])
      .map((b) => b.key);

    // No signal history yet → nothing to recommend
    if (topCategories.length === 0) {
      return { hits: [], total: 0, topCategory: null };
    }

    const topCategory = topCategories[0]?.key ?? null;

    // ── Step 2: build boosted category query against events index ────────────
    // Each category becomes a should clause; boost is proportional to the
    // accumulated signal weight so heavily-joined categories rank higher.
    const maxWeight = topCategories[0]?.total_weight?.value ?? 1;

    const shouldClauses = topCategories.map((cat) => ({
      term: {
        category: {
          value:            cat.key,
          case_insensitive: true,
          boost:            (cat.total_weight.value / maxWeight) * 10, // normalise to 0–10
        },
      },
    }));

    // ── Step 3: execute recommendations query ────────────────────────────────
    const recResult = await es.search({
      index: EVENTS_INDEX,
      body: {
        query: {
          bool: {
            should:   shouldClauses,
            minimum_should_match: 1,
            must_not: interactedIds.length
              ? [{ ids: { values: interactedIds } }]
              : [],
            filter: [
              { range: { datetime: { gte: 'now' } } }, // future events only
            ],
          },
        },
        sort: [
          '_score',                // most relevant category first
          { datetime: 'asc' },    // then soonest
        ],
        size: limit,
      },
    });

    const hits = recResult.hits.hits.map((h) => ({
      _id:   h._id,
      score: h._score,
      ...h._source,
    }));

    const total =
      typeof recResult.hits.total === 'number'
        ? recResult.hits.total
        : recResult.hits.total?.value ?? 0;

    console.log(`[recommend] userId=${userId} → ${hits.length} recommendations (topCat: ${topCategory})`);
    return { hits, total, topCategory };

  } catch (err) {
    console.error('[recommend] getRecommendations failed:', err.message);
    return { hits: [], total: 0, topCategory: null };
  }
}

export function isRecommendationConfigured() {
  return Boolean(getClient());
}
