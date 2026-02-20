import { Router } from 'express';
import { Buffer } from 'node:buffer';
import env from '../config/env.js';

const router = Router();

function parseBearerToken(headerValue) {
  const header = headerValue || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7);
}

router.post('/whatsapp-group-create', async (req, res) => {
  try {
    const expectedToken = env.whatsappWebhookToken;
    if (expectedToken) {
      const providedToken = parseBearerToken(req.headers.authorization);
      if (providedToken !== expectedToken) {
        return res.status(401).json({ message: 'Invalid webhook token' });
      }
    }

    const payload = req.body || {};
    const {
      eventId,
      eventName,
      ownerId,
      ownerName,
      participants = [],
      numbers = [],
    } = payload;

    if (!eventId || !eventName || !ownerId || !ownerName) {
      return res.status(400).json({
        message: 'Missing required payload fields',
        required: ['eventId', 'eventName', 'ownerId', 'ownerName'],
      });
    }

    if (!Array.isArray(participants) || !Array.isArray(numbers)) {
      return res.status(400).json({
        message: 'Invalid payload format: participants and numbers must be arrays',
      });
    }

    if (!numbers.length) {
      return res.status(400).json({
        message: 'No phone numbers found to create WhatsApp group',
      });
    }

    // Mock group creation response for local testing.
    // Replace this section with actual automation provider integration.
    const groupId = `grp_${eventId}_${Date.now()}`;
    const inviteLink = `https://chat.whatsapp.com/${Buffer.from(groupId).toString('base64url').slice(0, 22)}`;

    console.log('[Webhook] WhatsApp group creation request received:', {
      eventId,
      eventName,
      ownerName,
      participantCount: participants.length,
      numberCount: numbers.length,
    });

    return res.status(200).json({
      message: 'Mock WhatsApp group created successfully',
      mode: 'mock',
      group: {
        id: groupId,
        name: `${eventName} - Community Group`,
        participantCount: numbers.length,
        inviteLink,
      },
      note: 'This is a local mock webhook. Integrate your real WhatsApp automation service here.',
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Webhook processing failed',
    });
  }
});

export default router;
