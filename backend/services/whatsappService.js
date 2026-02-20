import env from '../config/env.js';

function normalizeWhatsappNumber(number) {
  if (!number) return null;
  return String(number).replace(/\s+/g, '');
}

export async function sendEventJoinWhatsapp({
  creatorName,
  creatorWhatsappNumber,
  userName,
  eventTitle,
  phoneNumber,
}) {
  const accountSid = env.twilioAccountSid;
  const authToken = env.twilioAuthToken;
  const fromWhatsapp = env.twilioWhatsappFrom;
  const isEnabled = env.enableWhatsappNotifications;

  if (!isEnabled || !accountSid || !authToken || !fromWhatsapp) {
    return { sent: false, reason: 'WhatsApp notifications disabled or Twilio config missing' };
  }

  const toNumber = normalizeWhatsappNumber(creatorWhatsappNumber);
  if (!toNumber) {
    return { sent: false, reason: 'Creator WhatsApp number not available' };
  }

  try {
    const twilioModule = await import('twilio');
    const twilio = twilioModule.default;
    const client = twilio(accountSid, authToken);

    const body = `Hi ${creatorName}, ${userName} has joined your event '${eventTitle}'. Contact: ${phoneNumber}`;

    const message = await client.messages.create({
      from: fromWhatsapp,
      to: `whatsapp:${toNumber}`,
      body,
    });

    return { sent: true, sid: message.sid };
  } catch (error) {
    return { sent: false, reason: error.message || 'Twilio send failed' };
  }
}

export function buildWhatsappGroupPayload({ event, participants }) {
  const uniqueNumbers = [...new Set(
    participants
      .map((p) => p.whatsappNumber || p.phoneNumber)
      .filter(Boolean)
  )];

  return {
    eventId: String(event._id),
    eventName: event.name,
    ownerId: String(event.owner_id),
    ownerName: event.ownerName,
    participants: participants.map((p) => ({
      participantId: String(p.participant_id),
      fullName: p.fullName,
      phoneNumber: p.phoneNumber,
      whatsappNumber: p.whatsappNumber || p.phoneNumber,
      profileId: p.profileId,
    })),
    numbers: uniqueNumbers,
    webhookHint: 'POST this payload to your WhatsApp automation webhook for group creation.',
  };
}

export async function triggerWhatsappGroupCreation(payload) {
  const webhookUrl = env.whatsappWebhookUrl;
  const webhookToken = env.whatsappWebhookToken;

  if (!webhookUrl) {
    return {
      triggered: false,
      reason: 'WHATSAPP_GROUP_WEBHOOK_URL is not configured',
    };
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (webhookToken) {
      headers.Authorization = `Bearer ${webhookToken}`;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const raw = await response.text();
    let body;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      body = { raw };
    }

    if (!response.ok) {
      return {
        triggered: false,
        reason: body?.message || `Webhook failed with ${response.status}`,
        status: response.status,
        response: body,
      };
    }

    return {
      triggered: true,
      status: response.status,
      response: body,
    };
  } catch (error) {
    return {
      triggered: false,
      reason: error.message || 'Webhook request failed',
    };
  }
}
