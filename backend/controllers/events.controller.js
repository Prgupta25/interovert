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
import {
  recordSignal,
  getRecommendations,
  isRecommendationConfigured,
} from '../services/recommendationService.js';
import { generateSeriesId } from '../services/recurringService.js';
import {
  isRazorpayConfigured,
  createOrder as razorpayCreateOrder,
  verifySignature as razorpayVerifySignature,
} from '../services/razorpayService.js';
import { sendBookingConfirmationEmails } from '../services/bookingEmailService.js';

function isOwner(event, userId) {
  return String(event.owner_id) === String(userId);
}

const EVENTS_LIST_DEFAULT_LIMIT = 12;
const EVENTS_LIST_MAX_LIMIT = 100;

function parseEventsListPagination(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const rawLimit = parseInt(req.query.limit, 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(EVENTS_LIST_MAX_LIMIT, rawLimit)
    : EVENTS_LIST_DEFAULT_LIMIT;
  return { page, limit, skip: (page - 1) * limit };
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
  const { q, category, city, dateFrom, dateTo, sortBy, userLat, userLng, radius, myEvents } = req.query;
  const { page, limit, skip } = parseEventsListPagination(req);

  if (myEvents === 'true' && !req.user?._id) {
    return res.json({ events: [], total: 0, page, limit });
  }

  let joinedEventIdsRaw = [];
  if (myEvents === 'true' && req.user?._id) {
    joinedEventIdsRaw = await EventParticipant.distinct('event_id', {
      participant_id: req.user._id,
      paymentStatus: { $ne: 'failed' },
    });
  }
  const joinedEventIdsForEs = joinedEventIdsRaw.map((id) => String(id));

  if (isElasticConfigured()) {
    // myEvents=true → events you host OR joined (non-failed booking)
    const ownerId = myEvents === 'true' && req.user?._id ? req.user._id : undefined;
    const joinedEventIds = myEvents === 'true' && req.user?._id ? joinedEventIdsForEs : undefined;
    const esResult = await esSearch({
      q,
      category,
      city,
      dateFrom,
      dateTo,
      sortBy,
      page,
      limit,
      userLat,
      userLng,
      radius,
      ownerId,
      joinedEventIds,
    });
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
  const filter = {};
  if (myEvents === 'true' && req.user?._id) {
    filter.$or = [{ owner_id: req.user._id }, { _id: { $in: joinedEventIdsRaw } }];
  }
  if (category && category !== 'all') {
    filter.category = category;
  }
  if (q && String(q).trim()) {
    const re = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$and = [
      ...(filter.$and || []),
      { $or: [{ name: re }, { description: re }, { activities: re }] },
    ];
  }
  if (city && String(city).trim()) {
    const cityAddresses = await Address.find({
      city: new RegExp(`^${String(city).trim()}$`, 'i'),
    }).select('_id').lean();
    filter.address = { $in: cityAddresses.map((a) => a._id) };
  }
  const total = await Event.countDocuments(filter);
  const events = await Event.find(filter)
    .populate('address')
    .sort({ datetime: 1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  const eventIds = events.map((e) => e._id);
  const [participantCounts, favoriteCounts, ratingAgg] = await enrichStats(eventIds);

  const participantCountMap = new Map(participantCounts.map((c) => [String(c._id), c.count]));
  const favoriteCountMap = new Map(favoriteCounts.map((c) => [String(c._id), c.count]));
  const ratingMap = new Map(ratingAgg.map((r) => [String(r._id), r]));

  const enriched = events.map((event) => ({
    ...event,
    recurrenceEnabled: event.recurrence?.enabled || false,
    recurrenceFreq: event.recurrence?.frequency || null,
    participantCount: participantCountMap.get(String(event._id)) || 0,
    favoriteCount: favoriteCountMap.get(String(event._id)) || 0,
    ratingCount: ratingMap.get(String(event._id))?.ratingCount || 0,
    averageRating: ratingMap.get(String(event._id))?.averageRating
      ? Number(ratingMap.get(String(event._id)).averageRating.toFixed(1))
      : 0,
    eventCreatorLabel: event.ownerName,
  }));

  return res.json({ events: enriched, total, page, limit });
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

/** Lean events with populated address — same card shape as listEvents Mongo fallback */
async function enrichEventsForList(events) {
  if (!events.length) return [];
  const eventIds = events.map((e) => e._id);
  const [participantCounts, favoriteCounts, ratingAgg] = await enrichStats(eventIds);
  const participantCountMap = new Map(participantCounts.map((c) => [String(c._id), c.count]));
  const favoriteCountMap = new Map(favoriteCounts.map((c) => [String(c._id), c.count]));
  const ratingMap = new Map(ratingAgg.map((r) => [String(r._id), r]));

  return events.map((event) => ({
    ...event,
    recurrenceEnabled: event.recurrence?.enabled || false,
    recurrenceFreq: event.recurrence?.frequency || null,
    participantCount: participantCountMap.get(String(event._id)) || 0,
    favoriteCount: favoriteCountMap.get(String(event._id)) || 0,
    ratingCount: ratingMap.get(String(event._id))?.ratingCount || 0,
    averageRating: ratingMap.get(String(event._id))?.averageRating
      ? Number(ratingMap.get(String(event._id)).averageRating.toFixed(1))
      : 0,
    eventCreatorLabel: event.ownerName,
  }));
}

export async function listMyFavoriteEvents(req, res) {
  const { page, limit, skip } = parseEventsListPagination(req);
  const userId = req.user._id;
  const favFilter = { user_id: userId };
  const total = await EventFavorite.countDocuments(favFilter);
  const favs = await EventFavorite.find(favFilter)
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate({ path: 'event_id', populate: { path: 'address' } })
    .lean();

  const events = favs.map((f) => f.event_id).filter((e) => e && e._id);
  const enriched = await enrichEventsForList(events);
  return res.json({ events: enriched, total, page, limit });
}

export async function listMyBookedEvents(req, res) {
  const { page, limit, skip } = parseEventsListPagination(req);
  const bookingFilter = {
    participant_id: req.user._id,
    paymentStatus: { $in: ['free', 'paid'] },
  };
  const total = await EventParticipant.countDocuments(bookingFilter);
  const rows = await EventParticipant.find(bookingFilter)
    .sort({ joinedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate({ path: 'event_id', populate: { path: 'address' } })
    .lean();

  const validRows = rows.filter((r) => r.event_id && r.event_id._id);
  const events = validRows.map((r) => r.event_id);
  const enrichedList = await enrichEventsForList(events);
  const enrichedById = new Map(enrichedList.map((e) => [String(e._id), e]));

  const items = validRows.map((r) => ({
    joinedAt: r.joinedAt,
    paymentStatus: r.paymentStatus,
    amountPaid: r.amountPaid,
    event: enrichedById.get(String(r.event_id._id)),
  }));

  return res.json({ items, total, page, limit });
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
    // Prefer the explicit override picked from the validation UI; only geocode otherwise
    const override = payload.geocodeOverride;
    const hasOverride =
      override &&
      Number.isFinite(Number(override.lat)) &&
      Number.isFinite(Number(override.lng));
    const geocode = hasOverride
      ? { lat: Number(override.lat), lng: Number(override.lng) }
      : await geocodeAddress(formatted);

    if (!geocode && payload.allowMissingGeocode !== true) {
      return res.status(400).json({
        message:
          'Could not validate this address. Please refine it or pick a suggestion before publishing.',
        code: 'ADDRESS_NOT_FOUND',
      });
    }

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

  // ── Recurrence ─────────────────────────────────────────────────────────────
  const recurringEnabled = payload.recurrenceEnabled === true || payload.recurrenceEnabled === 'true';

  // Build per-occurrence venue overrides if provided.
  // Each entry: { occurrenceIndex: N, address: { line1,city,...,geocodeOverride? } }
  const overrideEntries = [];
  if (recurringEnabled && Array.isArray(payload.recurrenceOverrides)) {
    for (const ov of payload.recurrenceOverrides) {
      const idx = Number(ov?.occurrenceIndex);
      const addr = ov?.address;
      if (!Number.isFinite(idx) || idx <= 0) continue;
      if (!addr || !addr.addressLine1 || !addr.addressCity) continue;
      const formatted = buildFormattedAddress({
        line1: addr.addressLine1,
        line2: addr.addressLine2,
        city: addr.addressCity,
        state: addr.addressState,
        postalCode: addr.addressPostalCode,
        country: addr.addressCountry,
      });
      const ovOverride = addr.geocodeOverride;
      const hasOv =
        ovOverride &&
        Number.isFinite(Number(ovOverride.lat)) &&
        Number.isFinite(Number(ovOverride.lng));
      const ovGeocode = hasOv
        ? { lat: Number(ovOverride.lat), lng: Number(ovOverride.lng) }
        : await geocodeAddress(formatted);
      const ovDoc = await Address.create({
        owner_id: req.user._id,
        type: 'event',
        label: (addr.addressLabel || 'Event Venue').trim(),
        line1: addr.addressLine1.trim(),
        line2: (addr.addressLine2 || '').trim(),
        city: addr.addressCity.trim(),
        state: (addr.addressState || '').trim(),
        country: (addr.addressCountry || '').trim(),
        postalCode: (addr.addressPostalCode || '').trim(),
        formattedAddress: formatted,
        geocode: ovGeocode,
      });
      overrideEntries.push({ occurrenceIndex: idx, addressId: ovDoc._id });
    }
  }

  const recurrence = recurringEnabled
    ? {
        enabled:             true,
        frequency:           ['weekly', 'monthly'].includes(payload.recurrenceFrequency)
                               ? payload.recurrenceFrequency
                               : 'weekly',
        seriesId:            generateSeriesId(),
        parentEventId:       null,  // this IS the original (occurrence #0)
        occurrenceIndex:     0,
        endAfterOccurrences: payload.recurrenceEndAfter
                               ? Number(payload.recurrenceEndAfter)
                               : null,
        spawnedNext:         false,
        overrides:           overrideEntries,
      }
    : { enabled: false };

  const startAt = payload.datetime ? new Date(payload.datetime) : null;
  const endAt   = payload.endDatetime ? new Date(payload.endDatetime) : null;
  if (endAt && startAt && endAt.getTime() <= startAt.getTime()) {
    return res.status(400).json({ message: 'End time must be after the start time' });
  }

  const event = await Event.create({
    photo,
    name: payload.name,
    description: payload.description,
    address: addressId,
    datetime: startAt,
    endDatetime: endAt,
    category: payload.category,
    activities: payload.activities,
    maxAttendees: Number(payload.maxAttendees),
    ticketPrice:  payload.ticketPrice ? Number(payload.ticketPrice) : 0,
    aboutYou: (payload.aboutYou ?? '').trim(),
    expectations: (payload.expectations ?? '').trim(),
    owner_id: req.user._id,
    ownerName: req.user.name,
    recurrence,
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
      const override = body.geocodeOverride;
      const hasOverride =
        override &&
        Number.isFinite(Number(override.lat)) &&
        Number.isFinite(Number(override.lng));
      updated.geocode = hasOverride
        ? { lat: Number(override.lat), lng: Number(override.lng) }
        : await geocodeAddress(updated.formattedAddress);

      // If this event is part of a recurring series AND the address is shared
      // with siblings/parent, fork — create a new Address so we don't change
      // the venue for the whole series.
      const seriesId = event.recurrence?.seriesId;
      let mustFork = false;
      if (seriesId) {
        const sharedCount = await Event.countDocuments({
          address: addressDoc._id,
          _id: { $ne: event._id },
        });
        if (sharedCount > 0) mustFork = true;
      }

      if (mustFork) {
        const newAddr = await Address.create({
          owner_id: req.user._id,
          type: 'event',
          label: updated.label || 'Event Venue',
          line1: updated.line1,
          line2: updated.line2,
          city: updated.city,
          state: updated.state,
          country: updated.country,
          postalCode: updated.postalCode,
          formattedAddress: updated.formattedAddress,
          geocode: updated.geocode,
        });
        event.address = newAddr._id;
      } else {
        Object.assign(addressDoc, updated);
        await addressDoc.save();
      }
    }
  }

  let newPhoto = event.photo;
  if (body.photo != null) {
    newPhoto = await uploadIfBase64(body.photo, 'interovert/events');
    if (newPhoto !== event.photo && event.photo?.includes('cloudinary.com')) {
      cloudinaryDelete(event.photo).catch(() => {});
    }
  }

  const nextStart = body.datetime ? new Date(body.datetime) : event.datetime;
  let nextEnd = event.endDatetime;
  if (Object.prototype.hasOwnProperty.call(body, 'endDatetime')) {
    nextEnd = body.endDatetime ? new Date(body.endDatetime) : null;
  }
  if (nextEnd && nextStart && nextEnd.getTime() <= new Date(nextStart).getTime()) {
    return res.status(400).json({ message: 'End time must be after the start time' });
  }

  Object.assign(event, {
    name: body.name ?? event.name,
    description: body.description ?? event.description,
    datetime: nextStart,
    endDatetime: nextEnd,
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

  // Paid events must go through the payment flow
  if ((event.ticketPrice || 0) > 0) {
    return res.status(400).json({
      message: 'This is a paid event. Please use the payment flow to book your spot.',
      isPaidEvent: true,
      ticketPrice: event.ticketPrice,
    });
  }

  const currentCount = await EventParticipant.countDocuments({ event_id: event._id });
  if (currentCount >= event.maxAttendees) {
    return res.status(400).json({ message: 'Event is full' });
  }

  let participant;
  try {
    participant = await EventParticipant.create({
      event_id:       event._id,
      participant_id: req.user._id,
      fullName:       req.user.name,
      phoneNumber:    req.user.phoneNumber,
      whatsappNumber: req.user.whatsappNumber || req.user.phoneNumber,
      profileId:      String(req.user._id),
      paymentStatus:  'free',
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

  const owner = await User.findById(event.owner_id).select('name whatsappNumber phoneNumber email');
  const whatsappResult = await sendEventJoinWhatsapp({
    creatorName: event.ownerName,
    creatorWhatsappNumber: owner?.whatsappNumber || owner?.phoneNumber || null,
    userName: req.user.name,
    eventTitle: event.name,
    phoneNumber: req.user.phoneNumber,
  });

  sendBookingConfirmationEmails({
    event,
    ownerEmail: owner?.email,
    bookerEmail: req.user.email,
    bookerName: req.user.name,
    paidAmount: null,
  }).catch((e) => console.error('[booking email]', e.message));

  // Record recommendation signal (fire-and-forget — never blocks the response)
  const populatedForSignal = await event.populate('address');
  recordSignal({
    userId:     String(req.user._id),
    eventId:    String(event._id),
    category:   event.category,
    city:       populatedForSignal?.address?.city || '',
    signalType: 'join',
  }).catch(() => {});

  return res.status(201).json({
    message: 'Joined event successfully',
    participant,
    whatsapp: whatsappResult,
  });
}

// ─── Razorpay: create order ───────────────────────────────────────────────────

export async function createPaymentOrder(req, res) {
  if (!isRazorpayConfigured()) {
    return res.status(503).json({ message: 'Payment service not configured' });
  }

  const event = await Event.findById(req.params.eventId);
  if (!event) return res.status(404).json({ message: 'Event not found' });

  if (isOwner(event, req.user._id)) {
    return res.status(400).json({ message: 'You cannot book your own event' });
  }

  if (!req.user.phoneNumber) {
    return res.status(400).json({
      message: 'Please update your profile with a phone number before booking',
    });
  }

  if ((event.ticketPrice || 0) <= 0) {
    return res.status(400).json({ message: 'This event is free — use the join endpoint instead' });
  }

  // Already joined (paid or pending)
  const existing = await EventParticipant.findOne({
    event_id:       event._id,
    participant_id: req.user._id,
  });
  if (existing && existing.paymentStatus === 'paid') {
    return res.status(400).json({ message: 'You have already booked this event' });
  }

  const currentCount = await EventParticipant.countDocuments({ event_id: event._id });
  if (currentCount >= event.maxAttendees) {
    return res.status(400).json({ message: 'Event is full' });
  }

  const receipt = `ev_${String(event._id).slice(-8)}_u${String(req.user._id).slice(-6)}`;
  const order   = await razorpayCreateOrder({
    amount:  event.ticketPrice,
    receipt,
    notes:   { eventId: String(event._id), userId: String(req.user._id) },
  });

  // Upsert a pending participant slot so the seat is reserved
  await EventParticipant.findOneAndUpdate(
    { event_id: event._id, participant_id: req.user._id },
    {
      $setOnInsert: {
        event_id:       event._id,
        participant_id: req.user._id,
        fullName:       req.user.name,
        phoneNumber:    req.user.phoneNumber,
        whatsappNumber: req.user.whatsappNumber || req.user.phoneNumber,
        profileId:      String(req.user._id),
      },
      $set: { paymentStatus: 'pending', orderId: order.id },
    },
    { upsert: true, new: true },
  );

  return res.json({
    orderId:   order.id,
    amount:    order.amount,    // in paise
    currency:  order.currency,
    keyId:     process.env.RAZORPAY_KEY_ID,
    eventName: event.name,
    userName:  req.user.name,
    userEmail: req.user.email || '',
    userPhone: req.user.phoneNumber || '',
  });
}

// ─── Razorpay: verify & confirm booking ──────────────────────────────────────

export async function verifyPayment(req, res) {
  if (!isRazorpayConfigured()) {
    return res.status(503).json({ message: 'Payment service not configured' });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ message: 'Missing payment verification fields' });
  }

  const isValid = razorpayVerifySignature({
    orderId:   razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });

  if (!isValid) {
    // Mark as failed
    await EventParticipant.findOneAndUpdate(
      { orderId: razorpay_order_id },
      { $set: { paymentStatus: 'failed' } },
    );
    return res.status(400).json({ message: 'Payment verification failed. Please contact support.' });
  }

  const event = await Event.findById(req.params.eventId);
  if (!event) return res.status(404).json({ message: 'Event not found' });

  // Confirm the participant
  const participant = await EventParticipant.findOneAndUpdate(
    { event_id: event._id, participant_id: req.user._id, orderId: razorpay_order_id },
    {
      $set: {
        paymentStatus: 'paid',
        paymentId:     razorpay_payment_id,
        amountPaid:    event.ticketPrice,
        joinedAt:      new Date(),
      },
    },
    { new: true },
  );

  if (!participant) {
    return res.status(404).json({ message: 'Booking record not found' });
  }

  // Notify the event owner
  const notification = await Notification.create({
    user_id: event.owner_id,
    type:    'EVENT_JOIN',
    title:   'New Paid Booking',
    message: `${req.user.name} paid ₹${event.ticketPrice} and booked '${event.name}'`,
    metadata: {
      eventId:    String(event._id),
      eventName:  event.name,
      participantId: String(req.user._id),
      fullName:   req.user.name,
      phoneNumber: req.user.phoneNumber,
      amountPaid: event.ticketPrice,
    },
  });

  const io = getIO();
  if (io) io.to(getUserRoom(event.owner_id)).emit('notification:new', notification);

  // WhatsApp notification to owner
  const owner = await User.findById(event.owner_id).select('name whatsappNumber phoneNumber email');
  sendEventJoinWhatsapp({
    creatorName:           event.ownerName,
    creatorWhatsappNumber: owner?.whatsappNumber || owner?.phoneNumber || null,
    userName:    req.user.name,
    eventTitle:  event.name,
    phoneNumber: req.user.phoneNumber,
  }).catch(() => {});

  sendBookingConfirmationEmails({
    event,
    ownerEmail: owner?.email,
    bookerEmail: req.user.email,
    bookerName: req.user.name,
    paidAmount: event.ticketPrice,
  }).catch((e) => console.error('[booking email]', e.message));

  // Record recommendation signal
  const populated = await event.populate('address');
  recordSignal({
    userId:     String(req.user._id),
    eventId:    String(event._id),
    category:   event.category,
    city:       populated?.address?.city || '',
    signalType: 'join',
  }).catch(() => {});

  return res.json({ message: 'Payment verified. Booking confirmed!', participant });
}

// ─────────────────────────────────────────────────────────────────────────────

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
  const event = await Event.findById(req.params.eventId).select('_id category address');
  if (!event) return res.status(404).json({ message: 'Event not found' });

  const existing = await EventFavorite.findOne({ event_id: event._id, user_id: req.user._id });
  let isFavorited = false;

  if (existing) {
    await existing.deleteOne();
    isFavorited = false;
  } else {
    await EventFavorite.create({ event_id: event._id, user_id: req.user._id });
    isFavorited = true;

    // Record recommendation signal only when adding (not removing) a favorite
    const populatedForSignal = await event.populate('address');
    recordSignal({
      userId:     String(req.user._id),
      eventId:    String(event._id),
      category:   event.category,
      city:       populatedForSignal?.address?.city || '',
      signalType: 'favorite',
    }).catch(() => {});
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

  if (new Date(event.datetime).getTime() >= Date.now()) {
    return res.status(403).json({ message: 'You can rate this event only after it has ended' });
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
  const event = await Event.findById(req.params.eventId).select('_id owner_id');
  if (!event) return res.status(404).json({ message: 'Event not found' });

  const viewerIsOwner = req.user && isOwner(event, req.user._id);

  const ratings = await EventRating.find({ event_id: event._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('user_id', 'name email profile.avatar')
    .lean();

  const stats = await getEventStats(event._id);
  return res.json({
    averageRating: stats.averageRating,
    ratingCount: stats.ratingCount,
    ratings: ratings.map((row) => {
      const u = row.user_id;
      const baseUser = {
        id: u?._id,
        name: u?.name || 'Attendee',
        avatar: u?.profile?.avatar || null,
      };
      if (viewerIsOwner && u?.email) {
        baseUser.email = u.email;
      }
      return {
        id: row._id,
        user: baseUser,
        rating: row.rating,
        review: row.review || '',
        createdAt: row.createdAt,
      };
    }),
  });
}

/**
 * GET /api/events/recommendations
 * Returns personalised event suggestions for the logged-in user
 * based on their join + favourite history stored in the signals index.
 */
export async function getRecommendedEvents(req, res) {
  if (!isRecommendationConfigured()) {
    return res.json({ events: [], total: 0, topCategory: null, reason: 'not_configured' });
  }

  const limit   = Math.min(Number(req.query.limit) || 8, 20);
  const userLat = req.query.userLat != null ? Number(req.query.userLat) : null;
  const userLng = req.query.userLng != null ? Number(req.query.userLng) : null;
  const result  = await getRecommendations(String(req.user._id), limit, userLat, userLng);

  if (!result.hits.length) {
    return res.json({ events: [], total: 0, topCategory: null, reason: 'no_history' });
  }

  // Hydrate with real-time stats from MongoDB
  const eventIds = result.hits.map((h) => h._id);
  const [mongoEvents, participantCounts, favoriteCounts] = await Promise.all([
    Event.find({ _id: { $in: eventIds } }).populate('address').lean(),
    EventParticipant.aggregate([
      { $match: { event_id: { $in: eventIds.map((id) => new mongoose.Types.ObjectId(String(id))) } } },
      { $group: { _id: '$event_id', count: { $sum: 1 } } },
    ]),
    EventFavorite.aggregate([
      { $match: { event_id: { $in: eventIds.map((id) => new mongoose.Types.ObjectId(String(id))) } } },
      { $group: { _id: '$event_id', count: { $sum: 1 } } },
    ]),
  ]);

  const mongoMap        = new Map(mongoEvents.map((e) => [String(e._id), e]));
  const participantMap  = new Map(participantCounts.map((c) => [String(c._id), c.count]));
  const favoriteMap     = new Map(favoriteCounts.map((c) => [String(c._id), c.count]));

  const enriched = result.hits.map((hit) => {
    const mongo = mongoMap.get(String(hit._id)) || {};
    return {
      ...mongo,
      ...hit,
      photo:            mongo.photo || hit.photo,
      address:          mongo.address || undefined,
      participantCount: participantMap.get(String(hit._id)) || 0,
      favoriteCount:    favoriteMap.get(String(hit._id)) || 0,
      eventCreatorLabel: hit.ownerName,
    };
  });

  return res.json({
    events:      enriched,
    total:       result.total,
    topCategory: result.topCategory,
  });
}

/**
 * GET /api/events/by-venue
 * Query: lat, lng, radiusMeters (default 75), excludeEventId, limit (default 10)
 * Returns upcoming events near the given point.
 *
 * Falls back to MongoDB-only address-doc dedupe if Elasticsearch isn't configured.
 */
export async function listEventsByVenue(req, res) {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radiusMeters = Math.max(10, Math.min(1000, Number(req.query.radiusMeters) || 75));
  const limit = Math.max(1, Math.min(20, Number(req.query.limit) || 10));
  const excludeEventId = (req.query.excludeEventId || '').toString().trim();

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ message: 'lat and lng are required' });
  }

  if (isElasticConfigured()) {
    const radiusKm = radiusMeters / 1000;
    const esResult = await esSearch({
      userLat: lat,
      userLng: lng,
      radius: radiusKm,
      dateFrom: new Date().toISOString(),
      page: 1,
      limit,
    });
    if (esResult) {
      const filtered = excludeEventId
        ? esResult.hits.filter((h) => String(h._id) !== excludeEventId)
        : esResult.hits;
      const eventIds = filtered.map((h) => h._id);
      const mongoEvents = await Event.find({ _id: { $in: eventIds } })
        .populate('address')
        .lean();
      const mongoMap = new Map(mongoEvents.map((e) => [String(e._id), e]));
      const enriched = filtered.map((hit) => {
        const mongo = mongoMap.get(String(hit._id)) || {};
        return {
          ...mongo,
          ...hit,
          photo: mongo.photo || hit.photo,
          address: mongo.address || undefined,
          eventCreatorLabel: hit.ownerName,
        };
      });
      return res.json({ events: enriched, total: enriched.length });
    }
  }

  // MongoDB fallback: find Address docs whose lat/lng are within a tight bounding box
  const degDelta = radiusMeters / 111000; // ≈ 1 deg latitude
  const addresses = await Address.find({
    'geocode.lat': { $gte: lat - degDelta, $lte: lat + degDelta },
    'geocode.lng': { $gte: lng - degDelta, $lte: lng + degDelta },
  }).select('_id').lean();
  const addressIds = addresses.map((a) => a._id);
  const filter = {
    address: { $in: addressIds },
    datetime: { $gte: new Date() },
  };
  if (excludeEventId) filter._id = { $ne: excludeEventId };
  const events = await Event.find(filter)
    .populate('address')
    .sort({ datetime: 1 })
    .limit(limit)
    .lean();
  return res.json({ events, total: events.length });
}

/**
 * GET /api/events/cities
 * Returns top distinct cities for upcoming events with their event counts.
 */
export async function listEventCities(req, res) {
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
  const now = new Date();

  // Aggregate via Mongo for accuracy (ES "city" field is lowercased; we want display case)
  const rows = await Event.aggregate([
    { $match: { datetime: { $gte: now } } },
    {
      $lookup: {
        from: 'addresses',
        localField: 'address',
        foreignField: '_id',
        as: 'addr',
      },
    },
    { $unwind: '$addr' },
    { $match: { 'addr.city': { $ne: '' } } },
    {
      $group: {
        _id: { $toLower: '$addr.city' },
        city: { $first: '$addr.city' },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1, city: 1 } },
    { $limit: limit },
  ]);

  return res.json({
    cities: rows.map((r) => ({ city: r.city, count: r.count })),
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
