import { getPgPool } from '../config/pg.js';

export async function isEventCreator(req, res, next) {
  const pool = getPgPool();
  if (!pool) return res.status(503).json({ message: 'PostgreSQL is not configured' });

  const { eventId } = req.params;
  const userId = req.user.id;

  const { rows } = await pool.query(
    `SELECT id
       FROM events
      WHERE id = $1
        AND creator_id = $2
        AND deleted_at IS NULL`,
    [eventId, userId]
  );

  if (!rows.length) {
    return res.status(403).json({ message: 'Only the event creator can access this resource' });
  }

  return next();
}

export async function isEventParticipant(req, res, next) {
  const pool = getPgPool();
  if (!pool) return res.status(503).json({ message: 'PostgreSQL is not configured' });

  const { eventId } = req.params;
  const userId = req.user.id;

  const { rows } = await pool.query(
    `SELECT ep.id
       FROM event_participants ep
      WHERE ep.event_id = $1
        AND ep.user_id = $2
        AND ep.status = 'JOINED'
        AND ep.deleted_at IS NULL`,
    [eventId, userId]
  );

  if (!rows.length) {
    return res.status(403).json({ message: 'Only event participants can access this resource' });
  }

  return next();
}
