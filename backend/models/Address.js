import mongoose from 'mongoose';

const geocodeSchema = new mongoose.Schema(
  {
    lat: { type: Number },
    lng: { type: Number },
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // 'user' = saved in profile, 'event' = linked to an event
    type: { type: String, enum: ['user', 'event'], default: 'user' },
    label: { type: String, trim: true, default: 'Home' }, // e.g. Home, Work, Venue
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true, default: '' },
    city: { type: String, required: true, trim: true },
    state: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: '' },
    postalCode: { type: String, trim: true, default: '' },
    formattedAddress: { type: String, trim: true },
    geocode: { type: geocodeSchema, default: null },
  },
  { timestamps: true }
);

addressSchema.index({ owner_id: 1, type: 1 });

export default mongoose.model('Address', addressSchema);
