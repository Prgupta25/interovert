import { getPgPool } from '../config/pg.js';
import { sanitizeText } from '../utils/sanitize.js';
import Event from '../models/Event.js';
import EventParticipant from '../models/EventParticipant.js';
import CommunityMessage from '../models/CommunityMessage.js';

const socketMessageCounter = new Map();

function allowMessageForSocket(userId) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxPerMinute = 40;
  const key = String(userId);
  const entry = socketMessageCounter.get(key) || { startedAt: now, count: 0 };

  if (now - entry.startedAt > windowMs) {
    socketMessageCounter.set(key, { startedAt: now, count: 1 });
    return true;
  }

  if (entry.count >= maxPerMinute) {
    return false;
  }

  entry.count += 1;
  socketMessageCounter.set(key, entry);
  return true;
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

export function registerCommunitySocketHandlers(io, socket) {
  const pool = getPgPool();
  if (!pool) {
    const formatMongoMessage = (doc) => ({
      id: String(doc._id),
      chat_id: doc.chatId,
      sender_id: String(doc.senderId),
      content: doc.content,
      status: doc.status,
      sent_at: doc.sentAt,
      delivered_at: doc.deliveredAt,
      seen_at: doc.seenAt,
    });

    const canAccessEventMongo = async (eventId) => {
      const event = await Event.findById(eventId).select('_id owner_id').lean();
      if (!event) return false;
      if (String(event.owner_id) === String(socket.userId)) return true;
      const participant = await EventParticipant.findOne({
        event_id: eventId,
        participant_id: socket.userId,
      }).select('_id').lean();
      return Boolean(participant);
    };

    socket.on('chat:join', async ({ eventId, chatId }, ack) => {
      try {
        if (!eventId || chatId !== `event:${eventId}`) {
          console.warn('[community-socket][mongo] join rejected invalid room', { eventId, chatId });
          return ack?.({ ok: false, error: 'Invalid chat room' });
        }
        const allowed = await canAccessEventMongo(eventId);
        if (!allowed) {
          console.warn('[community-socket][mongo] join rejected forbidden', { userId: String(socket.userId), eventId, chatId });
          return ack?.({ ok: false, error: 'Forbidden' });
        }
        console.log('[community-socket][mongo] join ok', { userId: String(socket.userId), eventId, chatId });
        socket.join(`chat:${chatId}`);
        return ack?.({ ok: true });
      } catch (error) {
        console.warn('[community-socket][mongo] join failed', error?.message || error);
        return ack?.({ ok: false, error: 'Join failed' });
      }
    });

    socket.on('message:send', async ({ chatId, content, clientTempId }, ack) => {
      try {
        if (!allowMessageForSocket(socket.userId)) {
          return ack?.({ ok: false, error: 'Rate limit exceeded' });
        }
        const eventId = String(chatId || '').startsWith('event:') ? String(chatId).slice(6) : '';
        if (!eventId) {
          console.warn('[community-socket][mongo] send rejected invalid room', { chatId });
          return ack?.({ ok: false, error: 'Invalid chat room' });
        }

        const allowed = await canAccessEventMongo(eventId);
        if (!allowed) {
          console.warn('[community-socket][mongo] send rejected forbidden', { userId: String(socket.userId), eventId, chatId });
          return ack?.({ ok: false, error: 'Forbidden' });
        }

        const safeContent = sanitizeText(content, 2000);
        if (!safeContent) return ack?.({ ok: false, error: 'Message cannot be empty' });

        const created = await CommunityMessage.create({
          chatId,
          eventId,
          senderId: socket.userId,
          content: safeContent,
          status: 'SENT',
          sentAt: new Date(),
        });

        const message = formatMongoMessage(created);
        io.to(`chat:${chatId}`).emit('message:new', message);

        created.status = 'DELIVERED';
        created.deliveredAt = new Date();
        await created.save();
        io.to(`chat:${chatId}`).emit('message:status', { messageId: String(created._id), status: 'DELIVERED' });

        return ack?.({ ok: true, message, clientTempId });
      } catch (error) {
        console.warn('[community-socket][mongo] send failed', error?.message || error);
        return ack?.({ ok: false, error: 'Send failed' });
      }
    });

    socket.on('message:seen', async ({ chatId, messageId }) => {
      try {
        const eventId = String(chatId || '').startsWith('event:') ? String(chatId).slice(6) : '';
        if (!eventId) return;
        const allowed = await canAccessEventMongo(eventId);
        if (!allowed) return;

        await CommunityMessage.findByIdAndUpdate(messageId, {
          status: 'SEEN',
          seenAt: new Date(),
        });
        io.to(`chat:${chatId}`).emit('message:status', { messageId, status: 'SEEN' });
      } catch (error) {
        console.warn('[community-socket][mongo] seen failed', error?.message || error);
        // ignore seen update failures
      }
    });

    return;
  }

  socket.on('chat:join', async ({ eventId, chatId }, ack) => {
    try {
      const eventAllowed = await canAccessEvent(eventId, socket.userId, pool);
      if (!eventAllowed) {
        console.warn('[community-socket][pg] join rejected forbidden event', { userId: String(socket.userId), eventId, chatId });
        return ack?.({ ok: false, error: 'Forbidden' });
      }

      const chatAllowed = await canAccessChat(chatId, socket.userId, pool);
      if (!chatAllowed) {
        console.warn('[community-socket][pg] join rejected forbidden chat', { userId: String(socket.userId), eventId, chatId });
        return ack?.({ ok: false, error: 'Forbidden' });
      }

      await pool.query(
        `INSERT INTO chat_members (chat_id, user_id, left_at, deleted_at)
         VALUES ($1, $2, NULL, NULL)
         ON CONFLICT (chat_id, user_id)
         DO UPDATE SET left_at = NULL, deleted_at = NULL, updated_at = NOW()`,
        [chatId, socket.userId]
      );

      console.log('[community-socket][pg] join ok', { userId: String(socket.userId), eventId, chatId });
      socket.join(`chat:${chatId}`);
      return ack?.({ ok: true });
    } catch (error) {
      console.warn('[community-socket][pg] join failed', error?.message || error);
      return ack?.({ ok: false, error: 'Join failed' });
    }
  });

  socket.on('message:send', async ({ chatId, content, clientTempId }, ack) => {
    try {
      if (!allowMessageForSocket(socket.userId)) {
        return ack?.({ ok: false, error: 'Rate limit exceeded' });
      }

      const safeContent = sanitizeText(content, 2000);
      if (!safeContent) return ack?.({ ok: false, error: 'Message cannot be empty' });

      const memberCheck = await pool.query(
        `SELECT is_blocked
           FROM chat_members
          WHERE chat_id = $1
            AND user_id = $2
            AND left_at IS NULL
            AND deleted_at IS NULL`,
        [chatId, socket.userId]
      );
      if (!memberCheck.rows.length) return ack?.({ ok: false, error: 'Not a chat member' });
      if (memberCheck.rows[0].is_blocked) return ack?.({ ok: false, error: 'Blocked in this chat' });

      const inserted = await pool.query(
        `INSERT INTO messages (chat_id, sender_id, content, status)
         VALUES ($1, $2, $3, 'SENT')
         RETURNING id, chat_id, sender_id, content, status, sent_at`,
        [chatId, socket.userId, safeContent]
      );
      const message = inserted.rows[0];

      io.to(`chat:${chatId}`).emit('message:new', message);

      await pool.query(
        `UPDATE messages
            SET status = 'DELIVERED',
                delivered_at = NOW()
          WHERE id = $1`,
        [message.id]
      );
      io.to(`chat:${chatId}`).emit('message:status', { messageId: message.id, status: 'DELIVERED' });

      await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, payload)
         SELECT cm.user_id, 'NEW_MESSAGE', 'New message', $2, $3::jsonb
           FROM chat_members cm
          WHERE cm.chat_id = $1
            AND cm.user_id <> $4
            AND cm.left_at IS NULL
            AND cm.deleted_at IS NULL`,
        [chatId, 'New chat message', JSON.stringify({ chatId, messageId: message.id }), socket.userId]
      );

      return ack?.({ ok: true, message, clientTempId });
    } catch (error) {
      console.warn('[community-socket][pg] send failed', error?.message || error);
      return ack?.({ ok: false, error: 'Send failed' });
    }
  });

  socket.on('message:seen', async ({ chatId, messageId }) => {
    try {
      const allowed = await canAccessChat(chatId, socket.userId, pool);
      if (!allowed) return;

      await pool.query(
        `UPDATE messages
            SET status = 'SEEN',
                seen_at = NOW(),
                updated_at = NOW()
          WHERE id = $1
            AND chat_id = $2`,
        [messageId, chatId]
      );
      io.to(`chat:${chatId}`).emit('message:status', { messageId, status: 'SEEN' });
    } catch (error) {
      console.warn('[community-socket][pg] seen failed', error?.message || error);
      // ignore socket acknowledgement errors for seen status
    }
  });
}
