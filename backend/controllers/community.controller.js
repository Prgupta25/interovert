import validator from 'validator';
import { getPgPool } from '../config/pg.js';
import { sanitizeText, toSafeInt } from '../utils/sanitize.js';
import Event from '../models/Event.js';
import EventParticipant from '../models/EventParticipant.js';
import CommunityMessage from '../models/CommunityMessage.js';

const PRIVACY_OPTIONS = new Set(['PUBLIC', 'EVENT_PARTICIPANTS_ONLY', 'PRIVATE']);

function makeOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function requirePg(res) {
  const pool = getPgPool();
  if (!pool) {
    res.status(503).json({ message: 'PostgreSQL is not configured' });
    return null;
  }
  return pool;
}

async function resolveUserId(pool, idOrLegacy) {
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

async function canAccessEvent(eventId, userId, pool) {
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
    [eventId, userId]
  );
  return rows.length > 0;
}

async function canAccessEventMongo(eventId, userId) {
  const event = await Event.findById(eventId).select('_id owner_id createdAt').lean();
  if (!event) return { allowed: false, event: null };

  if (String(event.owner_id) === String(userId)) {
    return { allowed: true, event };
  }

  const participant = await EventParticipant.findOne({
    event_id: event._id,
    participant_id: userId,
  }).select('_id').lean();

  return { allowed: Boolean(participant), event };
}

async function canAccessChat(chatId, userId, pool) {
  const { rows } = await pool.query(
    `SELECT 1
       FROM chats c
       JOIN events e ON e.id = c.event_id
      WHERE c.id = $1
        AND c.deleted_at IS NULL
        AND (
          e.creator_id = $2 OR EXISTS (
            SELECT 1
              FROM event_participants ep
             WHERE ep.event_id = c.event_id
               AND ep.user_id = $2
               AND ep.status = 'JOINED'
               AND ep.deleted_at IS NULL
          )
        )`,
    [chatId, userId]
  );
  return rows.length > 0;
}

async function ensureEventGroupChat(eventId, userId, pool) {
  const { rows } = await pool.query(
    `INSERT INTO chats (event_id, type, created_by)
     VALUES ($1, 'EVENT_GROUP', $2)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [eventId, userId]
  );

  const chatId = rows[0]?.id || (await pool.query(
    `SELECT id FROM chats WHERE event_id = $1 AND type = 'EVENT_GROUP' AND deleted_at IS NULL LIMIT 1`,
    [eventId]
  )).rows[0]?.id;

  if (chatId) {
    await pool.query(
      `INSERT INTO chat_members (chat_id, user_id, left_at, deleted_at)
       VALUES ($1, $2, NULL, NULL)
       ON CONFLICT (chat_id, user_id)
       DO UPDATE SET left_at = NULL, deleted_at = NULL, updated_at = NOW()`,
      [chatId, userId]
    );
  }

  return chatId;
}

export async function getPublicProfile(req, res) {
  const pool = await requirePg(res);
  if (!pool) return;

  const targetUserId = await resolveUserId(pool, req.params.userId);
  if (!targetUserId) return res.status(404).json({ message: 'User not found' });
  const viewerId = req.user.id;
  const eventId = req.query.eventId || null;
  const includeViewNotification = req.query.notify === 'true';

  const userResult = await pool.query(
    `SELECT id, full_name, profile_photo_url, bio, profile_visibility, verified_badge, created_at,
            email_verified, phone_verified, gov_id_verified, rating_avg, rating_count
       FROM users
      WHERE id = $1 AND deleted_at IS NULL`,
    [targetUserId]
  );
  if (!userResult.rows.length) return res.status(404).json({ message: 'User not found' });

  const targetUser = userResult.rows[0];
  let canView = String(targetUser.id) === String(viewerId);

  if (!canView) {
    if (targetUser.profile_visibility === 'PUBLIC') {
      canView = true;
    } else if (targetUser.profile_visibility === 'EVENT_PARTICIPANTS_ONLY') {
      const { rows } = await pool.query(
        `SELECT 1
           FROM event_participants ep1
           JOIN event_participants ep2 ON ep2.event_id = ep1.event_id
          WHERE ep1.user_id = $1
            AND ep2.user_id = $2
            AND ep1.status = 'JOINED'
            AND ep2.status = 'JOINED'
            AND ep1.deleted_at IS NULL
            AND ep2.deleted_at IS NULL
            ${eventId ? 'AND ep1.event_id = $3' : ''}
          LIMIT 1`,
        eventId ? [viewerId, targetUserId, eventId] : [viewerId, targetUserId]
      );
      canView = rows.length > 0;
    }
  }

  if (!canView) {
    return res.status(403).json({ message: 'This profile is private' });
  }

  const hosted = await pool.query(
    `SELECT COUNT(*)::int AS count FROM events WHERE creator_id = $1 AND deleted_at IS NULL`,
    [targetUserId]
  );
  const attended = await pool.query(
    `SELECT COUNT(*)::int AS count
       FROM event_participants
      WHERE user_id = $1 AND status = 'JOINED' AND deleted_at IS NULL`,
    [targetUserId]
  );

  if (includeViewNotification && String(targetUserId) !== String(viewerId)) {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, payload)
       VALUES ($1, 'PROFILE_VIEWED', 'Profile viewed', $2, $3::jsonb)`,
      [targetUserId, 'Someone viewed your profile', JSON.stringify({ viewerId, eventId })]
    );
  }

  return res.json({
    id: targetUser.id,
    fullName: targetUser.full_name,
    profilePhoto: targetUser.profile_photo_url,
    bio: targetUser.bio,
    verifiedBadge: targetUser.verified_badge,
    verification: {
      emailVerified: targetUser.email_verified,
      phoneVerified: targetUser.phone_verified,
      govIdVerified: targetUser.gov_id_verified,
    },
    eventsHosted: hosted.rows[0].count,
    eventsAttended: attended.rows[0].count,
    rating: {
      average: Number(targetUser.rating_avg || 0),
      count: targetUser.rating_count || 0,
    },
    profileVisibility: targetUser.profile_visibility,
    accountCreatedAt: targetUser.created_at,
  });
}

export async function updateProfilePrivacy(req, res) {
  const pool = await requirePg(res);
  if (!pool) return;

  const requested = String(req.body?.profileVisibility || '').trim().toUpperCase();
  if (!PRIVACY_OPTIONS.has(requested)) {
    return res.status(400).json({ message: 'Invalid profile visibility value' });
  }

  const { rows } = await pool.query(
    `UPDATE users
        SET profile_visibility = $1,
            updated_at = NOW()
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING id, profile_visibility`,
    [requested, req.user.id]
  );

  return res.json({
    message: 'Profile visibility updated',
    profileVisibility: rows[0]?.profile_visibility,
  });
}

export async function getUserTrustSummary(req, res) {
  const pool = await requirePg(res);
  if (!pool) return;

  const userId = await resolveUserId(pool, req.params.userId);
  if (!userId) return res.status(404).json({ message: 'User not found' });
  const userResult = await pool.query(
    `SELECT id, created_at, email_verified, phone_verified, gov_id_verified, verified_badge
       FROM users
      WHERE id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  if (!userResult.rows.length) return res.status(404).json({ message: 'User not found' });

  const hosted = await pool.query(
    `SELECT COUNT(*)::int AS count FROM events WHERE creator_id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  const attended = await pool.query(
    `SELECT COUNT(*)::int AS count
       FROM event_participants
      WHERE user_id = $1 AND status = 'JOINED' AND deleted_at IS NULL`,
    [userId]
  );

  return res.json({
    userId,
    accountCreatedAt: userResult.rows[0].created_at,
    verification: {
      emailVerified: userResult.rows[0].email_verified,
      phoneVerified: userResult.rows[0].phone_verified,
      govIdVerified: userResult.rows[0].gov_id_verified,
      verifiedBadge: userResult.rows[0].verified_badge,
    },
    events: {
      hosted: hosted.rows[0].count,
      attended: attended.rows[0].count,
    },
  });
}

export async function markEmailVerified(req, res) {
  const pool = await requirePg(res);
  if (!pool) return;

  const { rows } = await pool.query(
    `UPDATE users
        SET email_verified = TRUE,
            verified_badge = TRUE,
            updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING email_verified, verified_badge`,
    [req.user.id]
  );
  return res.json({ message: 'Email marked as verified', verification: rows[0] });
}

export async function sendPhoneOtp(req, res) {
  const pool = await requirePg(res);
  if (!pool) return;

  const phoneNumber = String(req.body?.phoneNumber || '').trim();
  if (!phoneNumber || !validator.isMobilePhone(phoneNumber, 'any')) {
    return res.status(400).json({ message: 'Valid phone number is required' });
  }

  const otp = makeOtpCode();
  await pool.query(
    `INSERT INTO phone_otp_verifications (user_id, phone_number, otp_code, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')`,
    [req.user.id, phoneNumber, otp]
  );

  return res.json({
    message: 'Phone OTP generated',
    ...(process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {}),
  });
}

export async function verifyPhoneOtp(req, res) {
  const pool = await requirePg(res);
  if (!pool) return;

  const phoneNumber = String(req.body?.phoneNumber || '').trim();
  const otpCode = String(req.body?.otp || '').trim();
  if (!phoneNumber || !otpCode) {
    return res.status(400).json({ message: 'phoneNumber and otp are required' });
  }

  const otpResult = await pool.query(
    `SELECT id
       FROM phone_otp_verifications
      WHERE user_id = $1
        AND phone_number = $2
        AND otp_code = $3
        AND consumed_at IS NULL
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1`,
    [req.user.id, phoneNumber, otpCode]
  );

  if (!otpResult.rows.length) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }

  await pool.query(
    `UPDATE phone_otp_verifications SET consumed_at = NOW() WHERE id = $1`,
    [otpResult.rows[0].id]
  );
  const { rows } = await pool.query(
    `UPDATE users
        SET phone_number = $1,
            phone_verified = TRUE,
            verified_badge = TRUE,
            updated_at = NOW()
      WHERE id = $2
      RETURNING phone_number, phone_verified, verified_badge`,
    [phoneNumber, req.user.id]
  );

  return res.json({ message: 'Phone verified', verification: rows[0] });
}

export async function markGovIdVerified(req, res) {
  const pool = await requirePg(res);
  if (!pool) return;

  const { rows } = await pool.query(
    `UPDATE users
        SET gov_id_verified = TRUE,
            verified_badge = TRUE,
            updated_at = NOW()
      WHERE id = $1
      RETURNING gov_id_verified, verified_badge`,
    [req.user.id]
  );

  return res.json({
    message: 'Government ID marked as verified',
    verification: rows[0],
  });
}

export async function joinCommunityEvent(req, res) {
  const pool = await requirePg(res);
  if (!pool) return;

  const eventId = req.params.eventId;
  const userId = req.user.id;

  const eventResult = await pool.query(
    `SELECT id, creator_id, title FROM events WHERE id = $1 AND deleted_at IS NULL`,
    [eventId]
  );
  if (!eventResult.rows.length) return res.status(404).json({ message: 'Event not found' });

  await pool.query(
    `INSERT INTO event_participants (event_id, user_id, role, status)
     VALUES ($1, $2, CASE WHEN $2 = $3 THEN 'CREATOR' ELSE 'PARTICIPANT' END, 'JOINED')
     ON CONFLICT (event_id, user_id)
     DO UPDATE SET status = 'JOINED', left_at = NULL, deleted_at = NULL, updated_at = NOW()`,
    [eventId, userId, eventResult.rows[0].creator_id]
  );

  const groupChatId = await ensureEventGroupChat(eventId, userId, pool);

  if (String(eventResult.rows[0].creator_id) !== String(userId)) {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, payload)
       VALUES ($1, 'EVENT_JOINED', 'New event participant', $2, $3::jsonb)`,
      [
        eventResult.rows[0].creator_id,
        `${req.user.full_name} joined ${eventResult.rows[0].title}`,
        JSON.stringify({ eventId, participantId: userId }),
      ]
    );
  }

  return res.status(201).json({
    message: 'Joined event',
    eventId,
    groupChatId,
  });
}

export async function leaveCommunityEvent(req, res) {
  const pool = await requirePg(res);
  if (!pool) return;

  const eventId = req.params.eventId;
  const userId = req.user.id;
  const eventResult = await pool.query(
    `SELECT creator_id FROM events WHERE id = $1 AND deleted_at IS NULL`,
    [eventId]
  );
  if (!eventResult.rows.length) return res.status(404).json({ message: 'Event not found' });
  if (String(eventResult.rows[0].creator_id) === String(userId)) {
    return res.status(400).json({ message: 'Event creator cannot leave their own event' });
  }

  await pool.query(
    `UPDATE event_participants
        SET status = 'LEFT',
            left_at = NOW(),
            updated_at = NOW()
      WHERE event_id = $1
        AND user_id = $2
        AND deleted_at IS NULL`,
    [eventId, userId]
  );

  await pool.query(
    `UPDATE chat_members cm
        SET left_at = NOW(),
            updated_at = NOW()
       FROM chats c
      WHERE c.id = cm.chat_id
        AND c.event_id = $1
        AND cm.user_id = $2
        AND cm.deleted_at IS NULL`,
    [eventId, userId]
  );

  return res.json({ message: 'Left event and removed from event chats' });
}

export async function listEventChats(req, res) {
  const pool = getPgPool();
  if (!pool) {
    const eventId = req.params.eventId;
    const { allowed, event } = await canAccessEventMongo(eventId, req.user.legacy_user_id || req.user.id);
    if (!allowed) return res.status(403).json({ message: 'Not allowed to access event chats' });

    return res.json({
      chats: [
        {
          id: `event:${String(event._id)}`,
          type: 'EVENT_GROUP',
          event_id: String(event._id),
          created_at: event.createdAt || new Date().toISOString(),
        },
      ],
    });
  }

  const eventId = req.params.eventId;
  const allowed = await canAccessEvent(eventId, req.user.id, pool);
  if (!allowed) return res.status(403).json({ message: 'Not allowed to access event chats' });

  await ensureEventGroupChat(eventId, req.user.id, pool);

  const { rows } = await pool.query(
    `SELECT c.id, c.type, c.event_id, c.created_at
       FROM chats c
      WHERE c.event_id = $1
        AND c.deleted_at IS NULL
      ORDER BY c.created_at ASC`,
    [eventId]
  );

  return res.json({ chats: rows });
}

export async function createDirectChat(req, res) {
  const pool = await requirePg(res);
  if (!pool) return;

  const eventId = req.params.eventId;
  const participantId = await resolveUserId(pool, req.params.participantId);
  if (!participantId) return res.status(404).json({ message: 'Participant user not found' });
  const creatorId = req.user.id;

  const creatorCheck = await pool.query(
    `SELECT id FROM events WHERE id = $1 AND creator_id = $2 AND deleted_at IS NULL`,
    [eventId, creatorId]
  );
  if (!creatorCheck.rows.length) {
    return res.status(403).json({ message: 'Only event creator can create direct chats' });
  }

  const participantCheck = await pool.query(
    `SELECT id
       FROM event_participants
      WHERE event_id = $1
        AND user_id = $2
        AND status = 'JOINED'
        AND deleted_at IS NULL`,
    [eventId, participantId]
  );
  if (!participantCheck.rows.length) {
    return res.status(404).json({ message: 'Participant not found in this event' });
  }

  const created = await pool.query(
    `INSERT INTO chats (event_id, type, created_by)
     VALUES ($1, 'DIRECT', $2)
     RETURNING id`,
    [eventId, creatorId]
  );
  const chatId = created.rows[0].id;

  await pool.query(
    `INSERT INTO chat_members (chat_id, user_id)
     VALUES ($1, $2), ($1, $3)
     ON CONFLICT (chat_id, user_id) DO NOTHING`,
    [chatId, creatorId, participantId]
  );

  return res.status(201).json({ chatId, message: 'Direct chat created' });
}

export async function getChatMessages(req, res) {
  const pool = getPgPool();
  if (!pool) {
    const chatId = req.params.chatId;
    const userId = req.user.legacy_user_id || req.user.id;
    const eventId = chatId.startsWith('event:') ? chatId.slice(6) : null;
    if (!eventId) return res.status(400).json({ message: 'Invalid chat id' });

    const { allowed } = await canAccessEventMongo(eventId, userId);
    if (!allowed) return res.status(403).json({ message: 'Unauthorized chat access' });

    const limit = Math.max(1, Math.min(100, toSafeInt(req.query.limit, 30)));
    const offset = Math.max(0, toSafeInt(req.query.offset, 0));
    const docs = await CommunityMessage.find({ chatId })
      .sort({ sentAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const messages = docs.reverse().map((doc) => ({
      id: String(doc._id),
      chat_id: doc.chatId,
      sender_id: String(doc.senderId),
      content: doc.content,
      status: doc.status,
      sent_at: doc.sentAt,
      delivered_at: doc.deliveredAt,
      seen_at: doc.seenAt,
    }));

    return res.json({ messages });
  }

  const chatId = req.params.chatId;
  const userId = req.user.id;
  const allowed = await canAccessChat(chatId, userId, pool);
  if (!allowed) return res.status(403).json({ message: 'Unauthorized chat access' });

  const limit = Math.max(1, Math.min(100, toSafeInt(req.query.limit, 30)));
  const offset = Math.max(0, toSafeInt(req.query.offset, 0));

  const { rows } = await pool.query(
    `SELECT id, chat_id, sender_id, content, status, sent_at, delivered_at, seen_at
       FROM messages
      WHERE chat_id = $1
        AND deleted_at IS NULL
      ORDER BY sent_at DESC
      LIMIT $2 OFFSET $3`,
    [chatId, limit, offset]
  );

  return res.json({ messages: rows.reverse() });
}

export async function postChatMessage(req, res) {
  const pool = getPgPool();
  if (!pool) {
    const chatId = req.params.chatId;
    const userId = req.user.legacy_user_id || req.user.id;
    const eventId = chatId.startsWith('event:') ? chatId.slice(6) : null;
    if (!eventId) return res.status(400).json({ message: 'Invalid chat id' });

    const { allowed, event } = await canAccessEventMongo(eventId, userId);
    if (!allowed) return res.status(403).json({ message: 'Unauthorized chat access' });

    const content = sanitizeText(req.body?.content, 2000);
    if (!content) return res.status(400).json({ message: 'Message content is required' });

    const doc = await CommunityMessage.create({
      chatId,
      eventId: event._id,
      senderId: userId,
      content,
      status: 'SENT',
      sentAt: new Date(),
    });

    return res.status(201).json({
      message: {
        id: String(doc._id),
        chat_id: doc.chatId,
        sender_id: String(doc.senderId),
        content: doc.content,
        status: doc.status,
        sent_at: doc.sentAt,
      },
    });
  }

  const chatId = req.params.chatId;
  const userId = req.user.id;
  const content = sanitizeText(req.body?.content, 2000);
  if (!content) return res.status(400).json({ message: 'Message content is required' });

  const allowed = await canAccessChat(chatId, userId, pool);
  if (!allowed) return res.status(403).json({ message: 'Unauthorized chat access' });

  await pool.query(
    `INSERT INTO chat_members (chat_id, user_id, left_at, deleted_at)
     VALUES ($1, $2, NULL, NULL)
     ON CONFLICT (chat_id, user_id)
     DO UPDATE SET left_at = NULL, deleted_at = NULL, updated_at = NOW()`,
    [chatId, userId]
  );

  const memberCheck = await pool.query(
    `SELECT is_blocked
       FROM chat_members
      WHERE chat_id = $1
        AND user_id = $2
        AND left_at IS NULL
        AND deleted_at IS NULL`,
    [chatId, userId]
  );
  if (!memberCheck.rows.length) return res.status(403).json({ message: 'Not a chat member' });
  if (memberCheck.rows[0].is_blocked) {
    return res.status(403).json({ message: 'You are blocked in this chat' });
  }

  const { rows } = await pool.query(
    `INSERT INTO messages (chat_id, sender_id, content, status)
     VALUES ($1, $2, $3, 'SENT')
     RETURNING id, chat_id, sender_id, content, status, sent_at`,
    [chatId, userId, content]
  );

  await pool.query(
    `INSERT INTO notifications (user_id, type, title, body, payload)
     SELECT cm.user_id, 'NEW_MESSAGE', 'New message', $2, $3::jsonb
       FROM chat_members cm
      WHERE cm.chat_id = $1
        AND cm.user_id <> $4
        AND cm.left_at IS NULL
        AND cm.deleted_at IS NULL`,
    [chatId, 'New message in your chat', JSON.stringify({ chatId, senderId: userId }), userId]
  );

  return res.status(201).json({ message: rows[0] });
}

export async function blockUserInChat(req, res) {
  const pool = await requirePg(res);
  if (!pool) return;

  const chatId = req.params.chatId;
  const targetUserId = await resolveUserId(pool, req.params.targetUserId);
  if (!targetUserId) return res.status(404).json({ message: 'Target user not found' });
  const blockerId = req.user.id;
  const reason = sanitizeText(req.body?.reason || 'Blocked by user', 300);

  const membershipCheck = await pool.query(
    `SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [chatId, blockerId]
  );
  if (!membershipCheck.rows.length) return res.status(403).json({ message: 'Not a chat member' });

  await pool.query(
    `INSERT INTO chat_members (chat_id, user_id, is_blocked, blocked_by, blocked_reason)
     VALUES ($1, $2, TRUE, $3, $4)
     ON CONFLICT (chat_id, user_id)
     DO UPDATE SET is_blocked = TRUE, blocked_by = $3, blocked_reason = $4, updated_at = NOW()`,
    [chatId, targetUserId, blockerId, reason]
  );

  return res.json({ message: 'User blocked in chat' });
}

export async function reportUser(req, res) {
  const pool = await requirePg(res);
  if (!pool) return;

  const chatId = req.params.chatId;
  const targetUserId = await resolveUserId(pool, req.params.targetUserId);
  if (!targetUserId) return res.status(404).json({ message: 'Target user not found' });
  const reason = sanitizeText(req.body?.reason, 1000);
  if (!reason) return res.status(400).json({ message: 'Report reason is required' });

  const chatResult = await pool.query(
    `SELECT event_id FROM chats WHERE id = $1 AND deleted_at IS NULL`,
    [chatId]
  );
  if (!chatResult.rows.length) return res.status(404).json({ message: 'Chat not found' });

  await pool.query(
    `INSERT INTO user_reports (reporter_id, reported_user_id, event_id, chat_id, reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [req.user.id, targetUserId, chatResult.rows[0].event_id, chatId, reason]
  );

  return res.status(201).json({ message: 'User reported successfully' });
}

export async function listMyNotifications(req, res) {
  const pool = await requirePg(res);
  if (!pool) return;

  const limit = Math.max(1, Math.min(100, toSafeInt(req.query.limit, 30)));
  const { rows } = await pool.query(
    `SELECT id, type, title, body, payload, is_read, created_at, read_at
       FROM notifications
      WHERE user_id = $1
        AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT $2`,
    [req.user.id, limit]
  );

  return res.json({ notifications: rows });
}

export async function markNotificationRead(req, res) {
  const pool = await requirePg(res);
  if (!pool) return;

  const notificationId = req.params.notificationId;
  const { rows } = await pool.query(
    `UPDATE notifications
        SET is_read = TRUE,
            read_at = NOW()
      WHERE id = $1
        AND user_id = $2
      RETURNING id, is_read, read_at`,
    [notificationId, req.user.id]
  );

  if (!rows.length) return res.status(404).json({ message: 'Notification not found' });
  return res.json({ notification: rows[0] });
}
