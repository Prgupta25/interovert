import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    photo: { type: String },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    venue: { type: String, required: true, trim: true },
    datetime: { type: Date, required: true },
    category: { type: String, required: true, trim: true },
    activities: { type: String, required: true, trim: true },
    maxAttendees: { type: Number, required: true, min: 1 },
    aboutYou: { type: String, required: true, trim: true },
    expectations: { type: String, required: true, trim: true },
    owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ownerName: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

eventSchema.index({ datetime: 1 });
eventSchema.index({ category: 1 });

export default mongoose.model('Event', eventSchema);
