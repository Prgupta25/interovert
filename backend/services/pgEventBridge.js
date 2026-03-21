import Event from '../models/Event.js';
import EventParticipant from '../models/EventParticipant.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Resolve URL param to Postgres events.id (UUID): by UUID or Mongo legacy_event_id.
 */
export async function resolvePgEventId(pool, rawEventId) {
  const raw = String(rawEventId || '').trim();
  if (!raw) return null;

  if (UUID_REGEX.test(raw)) {
    const { rows } = await pool.query(
      `SELECT id FROM events WHERE id = $1::uuid AND deleted_at IS NULL`,
      [raw]
    );
    if (rows.length) return rows[0].id;
  }

  const { rows } = await pool.query(
    `SELECT id FROM events WHERE legacy_event_id = $1 AND deleted_at IS NULL LIMIT 1`,
    [raw]
  );
  return rows[0]?.id || null;
}

export async function resolveUserPgId(pool, idOrLegacy) {
  const { rows } = await pool.query(
    `SELECT id
       FROM users
      WHERE deleted_at IS NULL
        AND (id::text = $1 OR legacy_user_id = $1)
      LIMIT 1`,
    [String(idOrLegacy)]
  );
  return rows[0]?.id || null;
}

export async function canAccessChatPg(pool, chatUuid, userPgId) {
  const id = String(chatUuid || '').trim();
  if (!UUID_REGEX.test(id)) return false;
  const { rows } = await pool.query(
    `SELECT event_id
       FROM chats
      WHERE id = $1::uuid
        AND deleted_at IS NULL
      LIMIT 1`,
    [id]
  );
  if (!rows.length) return false;
  return canAccessEventPg(pool, rows[0].event_id, userPgId);
}

export async function canAccessEventPg(pool, eventUuid, userPgId) {
  const { rows } = await pool.query(
    `SELECT 1
       FROM events e
      WHERE e.id = $1
        AND e.deleted_at IS NULL
        AND (
          e.creator_id = $2 OR EXISTS (
            SELECT 1
              FROM event_participants ep
             WHERE ep.event_id = e.id
               AND ep.user_id = $2
               AND ep.status = 'JOINED'
               AND ep.deleted_at IS NULL
          )
        )`,
    [eventUuid, userPgId]
  );
  return rows.length > 0;
}

function venueFromMongoEvent(ev) {
  const a = ev.address;
  if (a && typeof a === 'object') {
    const s = a.formattedAddress || [a.line1, a.city].filter(Boolean).join(', ').trim();
    if (s) return s;
  }
  return 'See event details';
}

/**
 * Upsert a Mongo-backed event into Postgres; returns PG UUID or null if host has no PG user row.
 */
export async function upsertMongoEventToPostgres(pool, mongoEventLean) {
  if (!mongoEventLean?._id) return null;

  let ev = mongoEventLean;
  if (!ev.address || typeof ev.address === 'string' || !ev.address.formattedAddress) {
    ev = await Event.findById(mongoEventLean._id)
      .populate({ path: 'address', select: 'formattedAddress line1 city' })
      .lean();
  }
  if (!ev) return null;

  const creatorPgId = await resolveUserPgId(pool, ev.owner_id);
  if (!creatorPgId) return null;

  const leg = String(ev._id);
  const title = ev.name || 'Event';
  const description = ev.description || '';
  const venue = venueFromMongoEvent(ev);
  const startsAt = ev.datetime || new Date();
  const category = ev.category || 'General';
  const maxAttendees = Math.max(1, Number(ev.maxAttendees) || 50);

  const { rows } = await pool.query(
    `INSERT INTO events (creator_id, title, description, venue, starts_at, category, max_attendees, legacy_event_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (legacy_event_id)
     DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       venue = EXCLUDED.venue,
       starts_at = EXCLUDED.starts_at,
       category = EXCLUDED.category,
       max_attendees = EXCLUDED.max_attendees,
       updated_at = NOW()
     RETURNING id`,
    [creatorPgId, title, description, venue, startsAt, category, maxAttendees, leg]
  );
  return rows[0]?.id || null;
}

/**
 * Ensure caller may access community features for this event (Mongo or PG), mirroring into PG when needed.
 * @returns {{ pgEventId: string | null, ok: boolean }}
 */
export async function ensureCommunityEventAccess(pool, rawEventId, reqUser) {
  const userPgId = reqUser.id;
  const legacyUserId = String(reqUser.legacy_user_id || reqUser.id);

  let pgEventId = await resolvePgEventId(pool, rawEventId);

  if (pgEventId && (await canAccessEventPg(pool, pgEventId, userPgId))) {
    return { pgEventId, ok: true };
  }

  const event = await Event.findById(rawEventId)
    .populate({ path: 'address', select: 'formattedAddress line1 city' })
    .lean();
  if (!event) return { pgEventId: pgEventId || null, ok: false };

  const ownerMatch = String(event.owner_id) === legacyUserId;
  const mongoParticipant = ownerMatch
    ? true
    : Boolean(
        await EventParticipant.findOne({
          event_id: event._id,
          participant_id: legacyUserId,
        })
          .select('_id')
          .lean()
      );

  if (!mongoParticipant) {
    return { pgEventId: pgEventId || null, ok: false };
  }

  pgEventId = pgEventId || (await upsertMongoEventToPostgres(pool, event));
  if (!pgEventId) return { pgEventId: null, ok: false };

  if (ownerMatch) {
    const ok = await canAccessEventPg(pool, pgEventId, userPgId);
    return { pgEventId, ok };
  }

  await pool.query(
    `INSERT INTO event_participants (event_id, user_id, role, status)
     VALUES ($1, $2, 'PARTICIPANT', 'JOINED')
     ON CONFLICT (event_id, user_id)
     DO UPDATE SET status = 'JOINED', left_at = NULL, deleted_at = NULL, updated_at = NOW()`,
    [pgEventId, userPgId]
  );

  const ok = await canAccessEventPg(pool, pgEventId, userPgId);
  return { pgEventId, ok };
}

/**
 * Map JWT / socket user id (often Mongo ObjectId) to Postgres users.id for socket handlers.
 */
export async function resolveSocketUserPgId(pool, tokenUserId) {
  return resolveUserPgId(pool, tokenUserId);
}
