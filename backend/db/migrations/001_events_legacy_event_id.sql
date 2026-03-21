-- Run once on existing databases (Mongo event _id → Postgres events.legacy_event_id)
ALTER TABLE events ADD COLUMN IF NOT EXISTS legacy_event_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_events_legacy_event_id ON events (legacy_event_id);
