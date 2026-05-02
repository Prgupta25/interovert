import mongoose from 'mongoose';

const recurrenceOverrideSchema = new mongoose.Schema(
  {
    occurrenceIndex: { type: Number, required: true },
    addressId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Address', required: true },
  },
  { _id: false }
);

const recurrenceSchema = new mongoose.Schema(
  {
    enabled:              { type: Boolean,  default: false },
    frequency:            { type: String,   enum: ['weekly', 'monthly'], default: null },
    // Shared identifier across every occurrence in a series
    seriesId:             { type: String,   default: null, index: true },
    // Always points to occurrence #0 (the original event). null on the original itself.
    parentEventId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },
    // 0 = original, 1 = first auto-spawn, 2 = second, …
    occurrenceIndex:      { type: Number,   default: 0 },
    // null = repeat forever; N = stop after N total occurrences (including the original)
    endAfterOccurrences:  { type: Number,   default: null },
    // Guards against double-spawning when the cron runs multiple times
    spawnedNext:          { type: Boolean,  default: false },
    // Per-occurrence venue overrides — only meaningful on occurrence #0 (the parent).
    // When the cron spawns occurrence N, it consults the parent's overrides[N].
    overrides:            { type: [recurrenceOverrideSchema], default: [] },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    photo:          { type: String },
    name:           { type: String, required: true, trim: true },
    description:    { type: String, required: true, trim: true },
    address:        { type: mongoose.Schema.Types.ObjectId, ref: 'Address', required: true },
    datetime:       { type: Date,   required: true },
    endDatetime:    { type: Date,   default: null },
    category:       { type: String, required: true, trim: true },
    activities:     { type: String, required: true, trim: true },
    maxAttendees:   { type: Number, required: true, min: 1 },
    aboutYou:       { type: String, default: '', trim: true },
    expectations:   { type: String, default: '', trim: true },
    owner_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ownerName:      { type: String, required: true, trim: true },
    // Ticketing — 0 means free
    ticketPrice:    { type: Number, default: 0, min: 0 },
    // Recurring events
    recurrence:     { type: recurrenceSchema, default: () => ({}) },
  },
  { timestamps: true }
);

eventSchema.index({ datetime: 1 });
eventSchema.index({ address: 1, datetime: 1 });
eventSchema.index({ category: 1 });
// Efficient cron query: find recurring events past their datetime that haven't spawned yet
eventSchema.index({ 'recurrence.enabled': 1, 'recurrence.spawnedNext': 1, datetime: 1 });

export default mongoose.model('Event', eventSchema);
