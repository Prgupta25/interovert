import mongoose from 'mongoose';

const eventParticipantSchema = new mongoose.Schema(
  {
    event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    participant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fullName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    whatsappNumber: { type: String, trim: true },
    profileId: { type: String, required: true, trim: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

eventParticipantSchema.index({ event_id: 1, participant_id: 1 }, { unique: true });

export default mongoose.model('EventParticipant', eventParticipantSchema);
