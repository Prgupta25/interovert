import mongoose from 'mongoose';
import Event from '../models/Event.js';
import Address from '../models/Address.js';
import EventParticipant from '../models/EventParticipant.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import EventFavorite from '../models/EventFavorite.js';
import EventRating from '../models/EventRating.js';
import { getIO, getUserRoom } from '../services/socketService.js';
import {
  sendEventJoinWhatsapp,
  buildWhatsappGroupPayload,
  triggerWhatsappGroupCreation,
} from '../services/whatsappService.js';
import { geocodeAddress, buildFormattedAddress } from '../services/geocodeService.js';
import { uploadIfBase64, deleteImage as cloudinaryDelete } from '../services/cloudinaryService.js';
import {
  searchEvents as esSearch,
  indexEvent as esIndex,
  removeEvent as esRemove,
  buildEventDoc,
  bulkIndexEvents,
  isElasticConfigured,
} from '../services/elasticService.js';

function isOwner(event, userId) {
  return String(event.owner_id) === String(userId);
}

async function getEventStats(eventId) {
  const [participantCount, favoriteCount, ratingAgg] = await Promise.all([
    EventParticipant.countDocuments({ event_id: eventId }),
    EventFavorite.countDocuments({ event_id: eventId }),
    EventRating.aggregate([
      { $match: { event_id: eventId } },
      {
        $group: {
          _id: '$event_id',
          averageRating: { $avg: '$rating' },
          ratingCount: { $sum: 1 },
        },
      },
    ]),
  ]);

  return {
    participantCount,
    favoriteCount,
    ratingCount: ratingAgg[0]?.ratingCount || 0,
    averageRating: ratingAgg[0]?.averageRating ? Number(ratingAgg[0].averageRating.toFixed(1)) : 0,
  };
}

export async function listEvents(req, res) {
  const { q, category, dateFrom, dateTo, sortBy, page, limit, userLat, userLng, radius } = req.query;

  if (isElasticConfigured()) {
    const esResult = await esSearch({ q, category, dateFrom, dateTo, sortBy, page, limit, userLat, userLng, radius });
    if (esResult) {
      const eventIds = esResult.hits.map((h) => h._id);

      const [mongoEvents, stats] = await Promise.all([
        Event.find({ _id: { $in: eventIds } }).populate('address').lean(),
        enrichStats(eventIds),
      ]);
      const [participantCounts, favoriteCounts, ratingAgg] = stats;
      const mongoMap = new Map(mongoEvents.map((e) => [String(e._id), e]));

      const participantCountMap = new Map(participantCounts.map((c) => [String(c._id), c.count]));
      const favoriteCountMap = new Map(favoriteCounts.map((c) => [String(c._id), c.count]));
      const ratingMap = new Map(ratingAgg.map((r) => [String(r._id), r]));

      const enriched = esResult.hits.map((hit) => {
        const mongo = mongoMap.get(String(hit._id)) || {};
        return {
          ...mongo,
          ...hit,
          photo: mongo.photo || hit.photo,
          address: mongo.address || undefined,
          participantCount: participantCountMap.get(String(hit._id)) || 0,
          favoriteCount: favoriteCountMap.get(String(hit._id)) || 0,
          ratingCount: ratingMap.get(String(hit._id))?.ratingCount || 0,
          averageRating: ratingMap.get(String(hit._id))?.averageRating
            ? Number(ratingMap.get(String(hit._id)).averageRating.toFixed(1))
            : 0,
          eventCreatorLabel: hit.ownerName,
        };
      });

      return res.json({ events: enriched, total: esResult.total, page: esResult.page, limit: esResult.limit });
    }
  }

  // MongoDB fallback
  const events = await Event.find()
    .populate('address')
    .sort({ datetime: 1, createdAt: -1 })
    .lean();
  const eventIds = events.map((e) => e._id);
  const [participantCounts, favoriteCounts, ratingAgg] = await enrichStats(eventIds);

  const participantCountMap = new Map(participantCounts.map((c) => [String(c._id), c.count]));
  const favoriteCountMap = new Map(favoriteCounts.map((c) => [String(c._id), c.count]));
  const ratingMap = new Map(ratingAgg.map((r) => [String(r._id), r]));

  const enriched = events.map((event) => ({
    ...event,
    participantCount: participantCountMap.get(String(event._id)) || 0,
    favoriteCount: favoriteCountMap.get(String(event._id)) || 0,
    ratingCount: ratingMap.get(String(event._id))?.ratingCount || 0,
    averageRating: ratingMap.get(String(event._id))?.averageRating
      ? Number(ratingMap.get(String(event._id)).averageRating.toFixed(1))
      : 0,
    eventCreatorLabel: event.ownerName,
  }));

  return res.json({ events: enriched, total: enriched.length, page: 1, limit: enriched.length });
}

async function enrichStats(eventIds) {
  const objectIds = eventIds.map((id) =>
    id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id))
  );
  return Promise.all([
    EventParticipant.aggregate([
      { $match: { event_id: { $in: objectIds } } },
      { $group: { _id: '$event_id', count: { $sum: 1 } } },
    ]),
    EventFavorite.aggregate([
      { $match: { event_id: { $in: objectIds } } },
      { $group: { _id: '$event_id', count: { $sum: 1 } } },
    ]),
    EventRating.aggregate([
      { $match: { event_id: { $in: objectIds } } },
      { $group: { _id: '$event_id', averageRating: { $avg: '$rating' }, ratingCount: { $sum: 1 } } },
    ]),
  ]);
}

export async function getEvent(req, res) {
  const event = await Event.findById(req.params.eventId).populate('address').lean();
  if (!event) return res.status(404).json({ message: 'Event not found' });

  const stats = await getEventStats(event._id);
  return res.json({
    ...event,
    participantCount: stats.participantCount,
    favoriteCount: stats.favoriteCount,
    ratingCount: stats.ratingCount,
    averageRating: stats.averageRating,
    eventCreatorLabel: event.ownerName,
  });
}

export async function getJoinStatus(req, res) {
  const event = await Event.findById(req.params.eventId).select('_id owner_id');
  if (!event) return res.status(404).json({ message: 'Event not found' });

  if (isOwner(event, req.user._id)) {
    return res.json({ joined: true, isOwner: true });
  }

  const participant = await EventParticipant.findOne({
    event_id: event._id,
    participant_id: req.user._id,
  }).select('_id');

  return res.json({ joined: !!participant, isOwner: false });
}

export async function createEvent(req, res) {
  const payload = req.body || {};

  // Resolve address: use existing addressId OR create a new event address from fields
  let addressId = payload.addressId;

  if (!addressId) {
    const { addressLabel, addressLine1, addressLine2, addressCity, addressState, addressCountry, addressPostalCode } = payload;

    if (!addressLine1 || !addressCity) {
      return res.status(400).json({ message: 'Address line1 and city are required' });
    }

    const formatted = buildFormattedAddress({
      line1: addressLine1,
      line2: addressLine2,
      city: addressCity,
      state: addressState,
      postalCode: addressPostalCode,
      country: addressCountry,
    });
    const geocode = await geocodeAddress(formatted);

    const addressDoc = await Address.create({
      owner_id: req.user._id,
      type: 'event',
      label: (addressLabel || 'Event Venue').trim(),
      line1: addressLine1.trim(),
      line2: (addressLine2 || '').trim(),
      city: addressCity.trim(),
      state: (addressState || '').trim(),
      country: (addressCountry || '').trim(),
      postalCode: (addressPostalCode || '').trim(),
      formattedAddress: formatted,
      geocode,
    });
    addressId = addressDoc._id;
  }

  const photo = await uploadIfBase64(payload.photo, 'interovert/events');

  const event = await Event.create({
    photo,
    name: payload.name,
    description: payload.description,
    address: addressId,
    datetime: payload.datetime ? new Date(payload.datetime) : null,
    category: payload.category,
    activities: payload.activities,
    maxAttendees: Number(payload.maxAttendees),
    aboutYou: payload.aboutYou,
    expectations: payload.expectations,
    owner_id: req.user._id,
    ownerName: req.user.name,
  });

  const populated = await event.populate('address');

  const esDoc = buildEventDoc(populated.toObject());
  esIndex(populated._id, esDoc).catch(() => {});

  return res.status(201).json({ message: 'Event created', event: populated });
}

export async function updateEvent(req, res) {
  const event = await Event.findById(req.params.eventId);
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (!isOwner(event, req.user._id)) {
    return res.status(403).json({ message: 'Only Event Creator can edit this event' });
  }

  const body = req.body || {};

  // If address fields are provided, update the linked address doc
  const hasAddressFields = body.addressLine1 || body.addressCity;
  if (hasAddressFields) {
    const addressDoc = await Address.findById(event.address);
    if (addressDoc && String(addressDoc.owner_id) === String(req.user._id)) {
      const updated = {
        label: body.addressLabel ?? addressDoc.label,
        line1: (body.addressLine1 ?? addressDoc.line1).trim(),
        line2: ((body.addressLine2 ?? addressDoc.line2) || '').trim(),
        city: (body.addressCity ?? addressDoc.city).trim(),
        state: ((body.addressState ?? addressDoc.state) || '').trim(),
        country: ((body.addressCountry ?? addressDoc.country) || '').trim(),
        postalCode: ((body.addressPostalCode ?? addressDoc.postalCode) || '').trim(),
      };
      updated.formattedAddress = buildFormattedAddress(updated);
      updated.geocode = await geocodeAddress(updated.formattedAddress);
      Object.assign(addressDoc, updated);
      await addressDoc.save();
    }
  }

  let newPhoto = event.photo;
  if (body.photo != null) {
    newPhoto = await uploadIfBase64(body.photo, 'interovert/events');
    if (newPhoto !== event.photo && event.photo?.includes('cloudinary.com')) {
      cloudinaryDelete(event.photo).catch(() => {});
    }
  }

  Object.assign(event, {
    name: body.name ?? event.name,
    description: body.description ?? event.description,
    datetime: body.datetime ? new Date(body.datetime) : event.datetime,
    category: body.category ?? event.category,
    activities: body.activities ?? event.activities,
    maxAttendees: body.maxAttendees ? Number(body.maxAttendees) : event.maxAttendees,
    aboutYou: body.aboutYou ?? event.aboutYou,
    expectations: body.expectations ?? event.expectations,
    photo: newPhoto,
  });
  await event.save();
  const populated = await event.populate('address');

  const esDoc = buildEventDoc(populated.toObject());
  esIndex(populated._id, esDoc).catch(() => {});

  return res.json({ message: 'Event updated', event: populated });
}

export async function deleteEvent(req, res) {
  const event = await Event.findById(req.params.eventId);
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (!isOwner(event, req.user._id)) {
    return res.status(403).json({ message: 'Only Event Creator can delete this event' });
  }

  if (event.photo?.includes('cloudinary.com')) {
    cloudinaryDelete(event.photo).catch(() => {});
  }

  await EventParticipant.deleteMany({ event_id: event._id });
  await EventFavorite.deleteMany({ event_id: event._id });
  await EventRating.deleteMany({ event_id: event._id });
  await Notification.deleteMany({ 'metadata.eventId': String(event._id) });
  await event.deleteOne();

  esRemove(event._id).catch(() => {});

  return res.json({ message: 'Event deleted' });
}

export async function joinEvent(req, res) {
  const event = await Event.findById(req.params.eventId);
  if (!event) return res.status(404).json({ message: 'Event not found' });

  if (isOwner(event, req.user._id)) {
    return res.status(400).json({ message: 'Event creator is already part of the event' });
  }

  if (!req.user.phoneNumber) {
    return res.status(400).json({
      message: 'Please update your profile with phone number before joining events',
    });
  }

  const currentCount = await EventParticipant.countDocuments({ event_id: event._id });
  if (currentCount >= event.maxAttendees) {
    return res.status(400).json({ message: 'Event is full' });
  }

  let participant;
  try {
    participant = await EventParticipant.create({
      event_id: event._id,
      participant_id: req.user._id,
      fullName: req.user.name,
      phoneNumber: req.user.phoneNumber,
      whatsappNumber: req.user.whatsappNumber || req.user.phoneNumber,
      profileId: String(req.user._id),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'You have already joined this event' });
    }
    throw error;
  }

  const message = `${req.user.name} joined '${event.name}'`;
  const notification = await Notification.create({
    user_id: event.owner_id,
    type: 'EVENT_JOIN',
    title: 'New Participant Joined',
    message,
    metadata: {
      eventId: String(event._id),
      eventName: event.name,
      participantId: String(req.user._id),
      fullName: req.user.name,
      phoneNumber: req.user.phoneNumber,
      whatsappNumber: req.user.whatsappNumber || req.user.phoneNumber,
      profileId: String(req.user._id),
    },
  });

  const io = getIO();
  if (io) {
    io.to(getUserRoom(event.owner_id)).emit('notification:new', notification);
  }

  const owner = await User.findById(event.owner_id).select('name whatsappNumber phoneNumber');
  const whatsappResult = await sendEventJoinWhatsapp({
    creatorName: event.ownerName,
    creatorWhatsappNumber: owner?.whatsappNumber || owner?.phoneNumber || null,
    userName: req.user.name,
    eventTitle: event.name,
    phoneNumber: req.user.phoneNumber,
  });

  return res.status(201).json({
    message: 'Joined event successfully',
    participant,
    whatsapp: whatsappResult,
  });
}

export async function getParticipants(req, res) {
  const event = await Event.findById(req.params.eventId);
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (!isOwner(event, req.user._id)) {
    return res.status(403).json({ message: 'Only Event Creator can view full participant details' });
  }

  const participants = await EventParticipant.find({ event_id: event._id })
    .sort({ joinedAt: 1 })
    .lean();
  return res.json({ eventId: event._id, eventName: event.name, participants });
}

export async function exportParticipants(req, res) {
  const event = await Event.findById(req.params.eventId);
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (!isOwner(event, req.user._id)) {
    return res.status(403).json({ message: 'Only Event Creator can export participants' });
  }

  const participants = await EventParticipant.find({ event_id: event._id }).lean();
  const header = 'Full Name,Phone Number,WhatsApp Number,Profile ID,Joined At\n';
  const rows = participants
    .map((p) => [p.fullName, p.phoneNumber, p.whatsappNumber || '', p.profileId, p.joinedAt?.toISOString() || '']
      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const csv = `${header}${rows}`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="event-${event._id}-participants.csv"`);
  return res.status(200).send(csv);
}

export async function getWhatsappGroupPayload(req, res) {
  const event = await Event.findById(req.params.eventId).lean();
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (!isOwner(event, req.user._id)) {
    return res.status(403).json({ message: 'Only Event Creator can create WhatsApp group payload' });
  }

  const participants = await EventParticipant.find({ event_id: event._id }).lean();
  const payload = buildWhatsappGroupPayload({ event, participants });

  return res.json({
    message: 'Integration-ready WhatsApp group payload generated',
    createWhatsappGroupOption: '[Create WhatsApp Group]',
    payload,
  });
}

export async function createWhatsappGroup(req, res) {
  const event = await Event.findById(req.params.eventId).lean();
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (!isOwner(event, req.user._id)) {
    return res.status(403).json({ message: 'Only Event Creator can create WhatsApp group' });
  }

  const participants = await EventParticipant.find({ event_id: event._id }).lean();
  if (!participants.length) {
    return res.status(400).json({ message: 'No participants available for group creation' });
  }

  const payload = buildWhatsappGroupPayload({ event, participants });
  const webhookResult = await triggerWhatsappGroupCreation(payload);

  if (!webhookResult.triggered) {
    return res.status(400).json({
      message: webhookResult.reason || 'WhatsApp group creation trigger failed',
      payload,
      webhookResult,
    });
  }

  return res.json({
    message: 'WhatsApp group creation triggered successfully',
    webhookResult,
  });
}

export async function getEventInteractionStatus(req, res) {
  const event = await Event.findById(req.params.eventId).select('_id owner_id datetime');
  if (!event) return res.status(404).json({ message: 'Event not found' });

  const owner = isOwner(event, req.user._id);
  const participant = owner
    ? true
    : await EventParticipant.exists({ event_id: event._id, participant_id: req.user._id });
  const favorite = await EventFavorite.exists({ event_id: event._id, user_id: req.user._id });
  const myRating = await EventRating.findOne({ event_id: event._id, user_id: req.user._id })
    .select('rating review updatedAt')
    .lean();

  const eventEnded = new Date(event.datetime).getTime() < Date.now();
  const canRate = Boolean(participant) && !owner && eventEnded;

  return res.json({
    joined: Boolean(participant),
    isOwner: owner,
    isFavorited: Boolean(favorite),
    canRate,
    eventEnded,
    myRating: myRating
      ? { rating: myRating.rating, review: myRating.review || '', updatedAt: myRating.updatedAt }
      : null,
  });
}

export async function toggleFavorite(req, res) {
  const event = await Event.findById(req.params.eventId).select('_id');
  if (!event) return res.status(404).json({ message: 'Event not found' });

  const existing = await EventFavorite.findOne({ event_id: event._id, user_id: req.user._id });
  let isFavorited = false;

  if (existing) {
    await existing.deleteOne();
    isFavorited = false;
  } else {
    await EventFavorite.create({ event_id: event._id, user_id: req.user._id });
    isFavorited = true;
  }

  const favoriteCount = await EventFavorite.countDocuments({ event_id: event._id });
  return res.json({
    message: isFavorited ? 'Event added to favorites' : 'Event removed from favorites',
    isFavorited,
    favoriteCount,
  });
}

export async function submitEventRating(req, res) {
  const event = await Event.findById(req.params.eventId).select('_id owner_id datetime');
  if (!event) return res.status(404).json({ message: 'Event not found' });

  if (isOwner(event, req.user._id)) {
    return res.status(400).json({ message: 'Event creator cannot rate their own event' });
  }

  const joined = await EventParticipant.exists({ event_id: event._id, participant_id: req.user._id });
  if (!joined) {
    return res.status(403).json({ message: 'Only participants can rate this event' });
  }

  if (new Date(event.datetime).getTime() > Date.now()) {
    return res.status(400).json({ message: 'You can rate this event after it ends' });
  }

  const rating = Number(req.body?.rating);
  const review = String(req.body?.review || '').trim().slice(0, 500);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5' });
  }

  const saved = await EventRating.findOneAndUpdate(
    { event_id: event._id, user_id: req.user._id },
    { rating, review },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  const stats = await getEventStats(event._id);

  return res.status(201).json({
    message: 'Rating submitted successfully',
    myRating: {
      rating: saved.rating,
      review: saved.review || '',
      updatedAt: saved.updatedAt,
    },
    averageRating: stats.averageRating,
    ratingCount: stats.ratingCount,
  });
}

export async function getEventRatings(req, res) {
  const event = await Event.findById(req.params.eventId).select('_id');
  if (!event) return res.status(404).json({ message: 'Event not found' });

  const ratings = await EventRating.find({ event_id: event._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('user_id', 'name profile.avatar')
    .lean();

  const stats = await getEventStats(event._id);
  return res.json({
    averageRating: stats.averageRating,
    ratingCount: stats.ratingCount,
    ratings: ratings.map((row) => ({
      id: row._id,
      user: {
        id: row.user_id?._id,
        name: row.user_id?.name || 'User',
        avatar: row.user_id?.profile?.avatar || null,
      },
      rating: row.rating,
      review: row.review || '',
      createdAt: row.createdAt,
    })),
  });
}

export async function reindexEvents(req, res) {
  if (!isElasticConfigured()) {
    return res.status(400).json({ message: 'Elasticsearch is not configured' });
  }

  const events = await Event.find().populate('address').lean();

  const participantCounts = await EventParticipant.aggregate([
    { $group: { _id: '$event_id', count: { $sum: 1 } } },
  ]);
  const pcMap = new Map(participantCounts.map((c) => [String(c._id), c.count]));

  const docs = events.map((e) => ({
    id: String(e._id),
    doc: buildEventDoc({ ...e, participantCount: pcMap.get(String(e._id)) || 0 }),
  }));

  await bulkIndexEvents(docs);
  return res.json({ message: `Reindexed ${docs.length} events` });
}
