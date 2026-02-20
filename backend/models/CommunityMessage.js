import mongoose from 'mongoose';

const communityMessageSchema = new mongoose.Schema(
  {
    chatId: { type: String, required: true, index: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: { type: String, required: true, trim: true },
    status: { type: String, enum: ['SENT', 'DELIVERED', 'SEEN'], default: 'SENT' },
    sentAt: { type: Date, default: Date.now },
    deliveredAt: { type: Date },
    seenAt: { type: Date },
  },
  { timestamps: true }
);

communityMessageSchema.index({ chatId: 1, sentAt: -1 });

export default mongoose.model('CommunityMessage', communityMessageSchema);
