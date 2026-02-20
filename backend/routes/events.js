import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import {
  validateCreateEvent,
  validateEventIdParam,
} from '../validators/eventsValidators.js';
import {
  createEvent,
  createWhatsappGroup,
  deleteEvent,
  exportParticipants,
  getEvent,
  getEventInteractionStatus,
  getEventRatings,
  getJoinStatus,
  getParticipants,
  getWhatsappGroupPayload,
  joinEvent,
  listEvents,
  submitEventRating,
  toggleFavorite,
  updateEvent,
} from '../controllers/events.controller.js';

const router = Router();

router.get('/', asyncHandler(listEvents));
router.get('/:eventId', validateEventIdParam, asyncHandler(getEvent));
router.get('/:eventId/ratings', validateEventIdParam, asyncHandler(getEventRatings));
router.get('/:eventId/join-status', requireAuth, validateEventIdParam, asyncHandler(getJoinStatus));
router.get('/:eventId/interaction-status', requireAuth, validateEventIdParam, asyncHandler(getEventInteractionStatus));
router.post('/', requireAuth, validateCreateEvent, asyncHandler(createEvent));
router.put('/:eventId', requireAuth, validateEventIdParam, asyncHandler(updateEvent));
router.delete('/:eventId', requireAuth, validateEventIdParam, asyncHandler(deleteEvent));
router.post('/:eventId/join', requireAuth, validateEventIdParam, asyncHandler(joinEvent));
router.post('/:eventId/favorite', requireAuth, validateEventIdParam, asyncHandler(toggleFavorite));
router.post('/:eventId/rate', requireAuth, validateEventIdParam, asyncHandler(submitEventRating));
router.get('/:eventId/participants', requireAuth, validateEventIdParam, asyncHandler(getParticipants));
router.get('/:eventId/participants/export', requireAuth, validateEventIdParam, asyncHandler(exportParticipants));
router.get('/:eventId/whatsapp-group-payload', requireAuth, validateEventIdParam, asyncHandler(getWhatsappGroupPayload));
router.post('/:eventId/whatsapp-group/create', requireAuth, validateEventIdParam, asyncHandler(createWhatsappGroup));

export default router;
