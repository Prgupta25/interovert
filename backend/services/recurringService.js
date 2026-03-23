/**
 * recurringService.js
 *
 * Handles auto-spawning of the next occurrence for recurring events.
 *
 * Flow:
 *   processDueRecurrences()  ← called every hour by setInterval in server.js
 *     └── for each past, un-spawned recurring event:
 *           spawnNextOccurrence(event)
 *               ├── compute next datetime (+7d or +1 month)
 *               ├── check endAfterOccurrences limit
 *               ├── clone the event doc with advanced datetime
 *               ├── mark current event.recurrence.spawnedNext = true
 *               └── index new event in Elasticsearch
 */

import crypto from 'crypto';
import Event  from '../models/Event.js';
import { indexEvent as esIndex, buildEventDoc } from './elasticService.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Advance a Date by one recurrence step */
function nextDatetime(current, frequency) {
  const d = new Date(current);
  if (frequency === 'weekly') {
    d.setDate(d.getDate() + 7);
  } else {
    // monthly — same day next month, clamped to end-of-month
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

// ─── Core: spawn one next occurrence ─────────────────────────────────────────

/**
 * Given a recurring event whose datetime has passed, create the next occurrence.
 * Returns the new event document, or null if the series has ended.
 *
 * @param {import('mongoose').Document} event  — populated event document
 */
export async function spawnNextOccurrence(event) {
  const rec = event.recurrence;
  if (!rec?.enabled) return null;

  const nextIndex = rec.occurrenceIndex + 1;

  // Respect endAfterOccurrences limit (null = infinite)
  if (rec.endAfterOccurrences != null && nextIndex >= rec.endAfterOccurrences) {
    // Series is over — just mark current as done so the cron skips it
    await Event.updateOne(
      { _id: event._id },
      { $set: { 'recurrence.spawnedNext': true } }
    );
    console.log(`[recurring] series ${rec.seriesId} ended after ${rec.endAfterOccurrences} occurrences`);
    return null;
  }

  const newDatetime = nextDatetime(event.datetime, rec.frequency);
  const parentId    = rec.parentEventId || event._id; // occurrence #0 is its own parent ref

  // ── Clone the event ────────────────────────────────────────────────────────
  const nextEvent = await Event.create({
    photo:        event.photo,
    name:         event.name,
    description:  event.description,
    address:      event.address,      // reuse same address document
    datetime:     newDatetime,
    category:     event.category,
    activities:   event.activities,
    maxAttendees: event.maxAttendees,
    aboutYou:     event.aboutYou,
    expectations: event.expectations,
    owner_id:     event.owner_id,
    ownerName:    event.ownerName,
    recurrence: {
      enabled:             true,
      frequency:           rec.frequency,
      seriesId:            rec.seriesId,
      parentEventId:       parentId,
      occurrenceIndex:     nextIndex,
      endAfterOccurrences: rec.endAfterOccurrences,
      spawnedNext:         false,
    },
  });

  // ── Mark current occurrence as done ───────────────────────────────────────
  await Event.updateOne(
    { _id: event._id },
    { $set: { 'recurrence.spawnedNext': true } }
  );

  // ── Index new event in Elasticsearch ──────────────────────────────────────
  try {
    const populated = await nextEvent.populate('address');
    const esDoc = buildEventDoc(populated.toObject());
    await esIndex(String(nextEvent._id), esDoc);
  } catch (err) {
    console.warn('[recurring] ES index of new occurrence failed:', err.message);
  }

  console.log(
    `[recurring] spawned occurrence #${nextIndex} for series ${rec.seriesId}` +
    ` | new event: ${nextEvent._id}` +
    ` | datetime: ${newDatetime.toISOString()}`
  );

  return nextEvent;
}

// ─── Cron entry point ─────────────────────────────────────────────────────────

/**
 * Called every hour.
 * Finds all recurring events whose datetime has passed and haven't spawned
 * the next occurrence yet, then spawns them one by one.
 *
 * @returns {Promise<number>} number of occurrences spawned
 */
export async function processDueRecurrences() {
  try {
    const now = new Date();

    const due = await Event.find({
      'recurrence.enabled':     true,
      'recurrence.spawnedNext': false,
      datetime:                 { $lt: now },
    })
      .populate('address')
      .lean({ virtuals: false });

    if (due.length === 0) return 0;

    console.log(`[recurring] processing ${due.length} due recurring event(s)…`);

    let spawned = 0;
    for (const eventDoc of due) {
      try {
        // lean() returns plain objects — re-fetch as mongoose doc for .save() inside spawnNextOccurrence
        const event = await Event.findById(eventDoc._id).populate('address');
        if (!event) continue;
        const result = await spawnNextOccurrence(event);
        if (result) spawned++;
      } catch (err) {
        console.error(`[recurring] failed to spawn for event ${eventDoc._id}:`, err.message);
      }
    }

    if (spawned > 0) {
      console.log(`[recurring] spawned ${spawned} new occurrence(s)`);
    }

    return spawned;
  } catch (err) {
    console.error('[recurring] processDueRecurrences error:', err.message);
    return 0;
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/** Generate a fresh seriesId (used when creating a new recurring event) */
export function generateSeriesId() {
  return crypto.randomUUID();
}
