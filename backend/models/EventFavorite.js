import mongoose from 'mongoose';

const eventFavoriteSchema = new mongoose.Schema(
  {
    event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

eventFavoriteSchema.index({ event_id: 1, user_id: 1 }, { unique: true });

export default mongoose.model('EventFavorite', eventFavoriteSchema);
