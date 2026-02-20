import mongoose from 'mongoose';

const eventRatingSchema = new mongoose.Schema(
  {
    event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

eventRatingSchema.index({ event_id: 1, user_id: 1 }, { unique: true });
eventRatingSchema.index({ event_id: 1, createdAt: -1 });

export default mongoose.model('EventRating', eventRatingSchema);
