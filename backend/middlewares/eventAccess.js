import { getPgPool } from '../config/pg.js';
import Event from '../models/Event.js';
import {
  resolvePgEventId,
  upsertMongoEventToPostgres,
  ensureCommunityEventAccess,
} from '../services/pgEventBridge.js';

export async function isEventCreator(req, res, next) {
  const pool = getPgPool();
  if (!pool) return res.status(503).json({ message: 'PostgreSQL is not configured' });

  const raw = req.params.eventId;
  const userId = req.user.id;
  const legacyUserId = String(req.user.legacy_user_id || req.user.id);

  let pgId = await resolvePgEventId(pool, raw);
  if (!pgId) {
    const ev = await Event.findById(raw).select('owner_id').lean();
    if (ev && String(ev.owner_id) === legacyUserId) {
      const full = await Event.findById(raw)
        .populate({ path: 'address', select: 'formattedAddress line1 city' })
        .lean();
      pgId = await upsertMongoEventToPostgres(pool, full);
    }
  }

  if (!pgId) {
    return res.status(403).json({ message: 'Only the event creator can access this resource' });
  }

  const { rows } = await pool.query(
    `SELECT id
       FROM events
      WHERE id = $1
        AND creator_id = $2
        AND deleted_at IS NULL`,
    [pgId, userId]
  );

  if (!rows.length) {
    return res.status(403).json({ message: 'Only the event creator can access this resource' });
  }

  req.pgEventId = pgId;
  return next();
}

export async function isEventParticipant(req, res, next) {
  const pool = getPgPool();
  if (!pool) return res.status(503).json({ message: 'PostgreSQL is not configured' });

  const { pgEventId, ok } = await ensureCommunityEventAccess(pool, req.params.eventId, req.user);
  if (!ok) {
    return res.status(403).json({ message: 'Only event participants can access this resource' });
  }

  req.pgEventId = pgEventId;
  return next();
}
