import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronUp,
  X,
  Clock,
} from 'lucide-react';
import apiClient from '../../../services/apiClient';

const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000; // assume 2h if event has no endDatetime

function eventStartEnd(ev) {
  const start = ev?.datetime ? new Date(ev.datetime).getTime() : null;
  if (!Number.isFinite(start)) return null;
  const end = ev?.endDatetime ? new Date(ev.endDatetime).getTime() : start + DEFAULT_DURATION_MS;
  return { start, end };
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

function formatRange(startMs, endMs) {
  const opts = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
  const startStr = new Date(startMs).toLocaleString(undefined, opts);
  if (!endMs) return startStr;
  const sameDay = new Date(startMs).toDateString() === new Date(endMs).toDateString();
  const endStr = sameDay
    ? new Date(endMs).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : new Date(endMs).toLocaleString(undefined, opts);
  return `${startStr} – ${endStr}`;
}

/**
 * SimilarEventsAtVenue
 *
 * Calls /api/events/by-venue using the resolved (lat,lng) of the picked venue,
 * lists other events at the venue, and — if a candidate start/end time is given —
 * raises a conflict popup whenever any existing event overlaps that window.
 *
 * Props:
 *   lat, lng           – resolved venue coords
 *   startDatetime      – optional ISO/`datetime-local` string for the event being created
 *   endDatetime        – optional ISO/`datetime-local` string for the event being created
 *   excludeEventId     – optional, when used in an edit flow
 *   radiusMeters       – default 75
 */
export default function SimilarEventsAtVenue({
  lat,
  lng,
  startDatetime,
  endDatetime,
  excludeEventId,
  radiusMeters = 75,
}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [conflictPopupOpen, setConflictPopupOpen] = useState(false);
  const [dismissedConflictKey, setDismissedConflictKey] = useState(null);

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      radiusMeters: String(radiusMeters),
      limit: '20',
    });
    if (excludeEventId) params.set('excludeEventId', String(excludeEventId));
    apiClient
      .get(`/api/events/by-venue?${params.toString()}`)
      .then(({ data }) => {
        if (!active) return;
        setEvents(data.events || []);
        setOpen((data.events || []).length > 0);
      })
      .catch(() => {
        if (active) setEvents([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [lat, lng, excludeEventId, radiusMeters]);

  const candidate = useMemo(() => {
    if (!startDatetime) return null;
    const s = new Date(startDatetime).getTime();
    if (!Number.isFinite(s)) return null;
    const e = endDatetime ? new Date(endDatetime).getTime() : s + DEFAULT_DURATION_MS;
    if (!Number.isFinite(e) || e <= s) return null;
    return { start: s, end: e };
  }, [startDatetime, endDatetime]);

  const conflicts = useMemo(() => {
    if (!candidate || events.length === 0) return [];
    return events.filter((ev) => {
      const range = eventStartEnd(ev);
      if (!range) return false;
      return rangesOverlap(candidate.start, candidate.end, range.start, range.end);
    });
  }, [candidate, events]);

  const conflictKey = useMemo(() => {
    if (!candidate || conflicts.length === 0) return null;
    return [
      candidate.start,
      candidate.end,
      ...conflicts.map((c) => c._id),
    ].join('|');
  }, [candidate, conflicts]);

  // Open the popup whenever a fresh set of conflicts appears (and hasn't been dismissed yet)
  useEffect(() => {
    if (conflictKey && conflictKey !== dismissedConflictKey) {
      setConflictPopupOpen(true);
    } else {
      setConflictPopupOpen(false);
    }
  }, [conflictKey, dismissedConflictKey]);

  if (loading) return null;
  if (events.length === 0) return null;

  const conflictIds = new Set(conflicts.map((c) => String(c._id)));

  return (
    <>
      <div
        className={`rounded-lg border p-3 ${
          conflicts.length > 0
            ? 'border-rose-500/50 bg-rose-500/10'
            : 'border-amber-500/40 bg-amber-500/10'
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex w-full items-center justify-between gap-2 text-left text-xs font-semibold ${
            conflicts.length > 0 ? 'text-rose-200' : 'text-amber-200'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            {conflicts.length > 0
              ? `${conflicts.length} time conflict${conflicts.length === 1 ? '' : 's'} at this venue`
              : events.length === 1
                ? '1 other event at this venue'
                : `${events.length} other events at this venue`}
          </span>
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {open && (
          <ul className="mt-2 space-y-1.5">
            {events.map((ev) => {
              const range = eventStartEnd(ev);
              const isConflict = conflictIds.has(String(ev._id));
              return (
                <li key={ev._id}>
                  <a
                    href={`/event/${ev._id}`}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex items-start gap-2 rounded-md px-2.5 py-2 text-xs ring-1 transition-colors ${
                      isConflict
                        ? 'bg-rose-950/40 text-rose-100 ring-rose-500/40 hover:bg-rose-950/60'
                        : 'bg-zinc-900/60 text-zinc-200 ring-zinc-800/80 hover:bg-zinc-900 hover:ring-amber-500/40'
                    }`}
                  >
                    <Calendar
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                        isConflict ? 'text-rose-300' : 'text-amber-300/80'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium">{ev.name}</span>
                        {isConflict && (
                          <span className="shrink-0 rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-200">
                            Overlaps
                          </span>
                        )}
                      </div>
                      {range && (
                        <div className={`text-[11px] ${isConflict ? 'text-rose-300/80' : 'text-zinc-500'}`}>
                          {formatRange(range.start, ev.endDatetime ? range.end : null)}
                          {ev.distanceKm != null && (
                            <> · {(ev.distanceKm * 1000).toFixed(0)} m away</>
                          )}
                        </div>
                      )}
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {conflictPopupOpen && conflicts.length > 0 && candidate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="venue-conflict-title"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        >
          <button
            type="button"
            aria-label="Dismiss"
            className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md"
            onClick={() => {
              setDismissedConflictKey(conflictKey);
              setConflictPopupOpen(false);
            }}
          />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-rose-500/40 bg-gradient-to-b from-zinc-900 to-zinc-950 shadow-2xl">
            <header className="flex items-start justify-between gap-3 border-b border-rose-500/30 bg-rose-500/10 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 id="venue-conflict-title" className="text-sm font-semibold text-rose-100">
                    Time conflict at this venue
                  </h3>
                  <p className="mt-1 text-xs text-rose-200/80">
                    {conflicts.length === 1
                      ? 'Another event is already scheduled at this location during your selected time.'
                      : `${conflicts.length} other events are already scheduled at this location during your selected time.`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDismissedConflictKey(conflictKey);
                  setConflictPopupOpen(false);
                }}
                className="rounded-lg border border-zinc-700/70 bg-zinc-800/50 p-1.5 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="px-5 py-4">
              <div className="mb-3 rounded-lg border border-zinc-700/70 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-300">
                <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  <Clock className="h-3 w-3" />
                  Your slot
                </div>
                {formatRange(candidate.start, candidate.end)}
              </div>

              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Conflicts with
              </div>
              <ul className="mt-1.5 max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {conflicts.map((ev) => {
                  const range = eventStartEnd(ev);
                  return (
                    <li key={ev._id}>
                      <a
                        href={`/event/${ev._id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-start gap-2 rounded-md bg-rose-950/40 px-2.5 py-2 text-xs text-rose-100 ring-1 ring-rose-500/30 transition-colors hover:bg-rose-950/60"
                      >
                        <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{ev.name}</div>
                          {range && (
                            <div className="text-[11px] text-rose-300/80">
                              {formatRange(range.start, ev.endDatetime ? range.end : null)}
                            </div>
                          )}
                        </div>
                      </a>
                    </li>
                  );
                })}
              </ul>

              <p className="mt-3 text-[11px] text-zinc-500">
                You can still publish this event, but consider picking a different time so attendees aren&apos;t double-booked.
              </p>
            </div>

            <footer className="flex justify-end gap-2 border-t border-zinc-800/80 bg-zinc-950/70 px-5 py-3">
              <button
                type="button"
                onClick={() => {
                  setDismissedConflictKey(conflictKey);
                  setConflictPopupOpen(false);
                }}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-700"
              >
                Got it
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
