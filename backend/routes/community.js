import { Router } from 'express';
import asyncHandler from '../middlewares/asyncHandler.js';
import { isAuthenticated } from '../middlewares/communityAuth.js';
import { isEventCreator, isEventParticipant } from '../middlewares/eventAccess.js';
import { chatMessageRateLimiter } from '../middlewares/chatRateLimit.js';
import {
  blockUserInChat,
  createDirectChat,
  getChatMessages,
  getPublicProfile,
  getUserTrustSummary,
  joinCommunityEvent,
  leaveCommunityEvent,
  listEventChats,
  listMyNotifications,
  markEmailVerified,
  markGovIdVerified,
  markNotificationRead,
  postChatMessage,
  reportUser,
  sendPhoneOtp,
  updateProfilePrivacy,
  verifyPhoneOtp,
} from '../controllers/community.controller.js';

const router = Router();

router.use(isAuthenticated);

router.get('/users/:userId/profile', asyncHandler(getPublicProfile));
router.patch('/users/me/privacy', asyncHandler(updateProfilePrivacy));
router.get('/users/:userId/trust-summary', asyncHandler(getUserTrustSummary));

router.post('/verification/email/verify', asyncHandler(markEmailVerified));
router.post('/verification/phone/send-otp', asyncHandler(sendPhoneOtp));
router.post('/verification/phone/verify-otp', asyncHandler(verifyPhoneOtp));
router.post('/verification/gov-id/verify', asyncHandler(markGovIdVerified));

router.post('/events/:eventId/join', asyncHandler(joinCommunityEvent));
router.post('/events/:eventId/leave', asyncHandler(leaveCommunityEvent));
router.get('/events/:eventId/chats', asyncHandler(listEventChats));
router.post('/events/:eventId/chats/direct/:participantId', isEventCreator, asyncHandler(createDirectChat));
router.get('/events/:eventId/participant-check', isEventParticipant, (req, res) => res.json({ ok: true }));

router.get('/chats/:chatId/messages', asyncHandler(getChatMessages));
router.post('/chats/:chatId/messages', chatMessageRateLimiter, asyncHandler(postChatMessage));
router.post('/chats/:chatId/block/:targetUserId', asyncHandler(blockUserInChat));
router.post('/chats/:chatId/report/:targetUserId', asyncHandler(reportUser));

router.get('/notifications', asyncHandler(listMyNotifications));
router.patch('/notifications/:notificationId/read', asyncHandler(markNotificationRead));

export default router;
