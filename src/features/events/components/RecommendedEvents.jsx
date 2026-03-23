import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronLeft, ChevronRight, Calendar, MapPin, Users, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import apiClient from '../../../services/apiClient';
import { getAuthToken } from '../../../utils/session';
import { getDisplayEventPhotoUrl } from '../../../utils/eventImage';

/**
 * RecommendedEvents
 *
 * Shown above the main event grid when the logged-in user has a signal
 * history (joins + favourites). Calls GET /api/events/recommendations
 * and renders a horizontally-scrollable card strip.
 */
export default function RecommendedEvents() {
  const [events, setEvents]           = useState([]);
  const [topCategory, setTopCategory] = useState(null);
  const [loading, setLoading]         = useState(true);
  const scrollRef                     = useRef(null);

  useEffect(() => {
    // Only fetch if user is logged in
    if (!getAuthToken()) {
      setLoading(false);
      return;
    }

    apiClient
      .get('/api/events/recommendations?limit=8')
      .then(({ data }) => {
        setEvents(data.events ?? []);
        setTopCategory(data.topCategory ?? null);
      })
      .catch(() => {
        // Silent — recommendations are non-critical
      })
      .finally(() => setLoading(false));
  }, []);

  // Don't render the section at all when there's nothing to show
  if (loading || events.length === 0) return null;

  const scroll = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * 320, behavior: 'smooth' });
  };

  return (
    <AnimatePresence>
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.4 }}
        className="mb-12"
        aria-label="Recommended events"
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15 ring-1 ring-indigo-500/25">
              <Sparkles className="h-4 w-4 text-indigo-400" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-white">For You</h2>
              {topCategory && (
                <p className="text-xs text-zinc-500">
                  Because you like{' '}
                  <span className="capitalize text-indigo-400">{topCategory}</span> events
                </p>
              )}
            </div>
          </div>

          {/* Scroll arrows */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scroll(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700 transition hover:bg-zinc-700 hover:text-white"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700 transition hover:bg-zinc-700 hover:text-white"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Horizontal scroll strip */}
        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {events.map((event, i) => (
            <RecommendCard key={event._id} event={event} index={i} />
          ))}
        </div>

        {/* Subtle divider */}
        <div className="mt-8 border-t border-zinc-800/60" />
      </motion.section>
    </AnimatePresence>
  );
}

// ─── Individual recommendation card ──────────────────────────────────────────

function RecommendCard({ event, index }) {
  const photoSrc = getDisplayEventPhotoUrl(event.photo, 600) || '/placeholder.svg?height=140&width=280';
  const dateStr  = new Date(event.datetime).toLocaleDateString(undefined, {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
  });

  return (
    <motion.article
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.06, 0.36) }}
      className="group w-72 shrink-0 overflow-hidden rounded-2xl border border-zinc-700/50 bg-gradient-to-b from-zinc-800/50 to-zinc-900/90 shadow-lg shadow-black/30 ring-1 ring-white/[0.03] transition-shadow hover:border-zinc-600/60 hover:shadow-indigo-950/20 hover:ring-indigo-500/10"
    >
      {/* Thumbnail */}
      <Link
        to={`/event/${event._id}`}
        className="relative block aspect-[16/9] overflow-hidden bg-zinc-950"
      >
        <img
          src={photoSrc}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-center transition duration-300 group-hover:brightness-105 [transform:translateZ(0)]"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-zinc-950/10 to-transparent"
          aria-hidden
        />

        {/* Category badge */}
        <span className="absolute left-2.5 top-2.5 rounded-full bg-indigo-600/85 px-2.5 py-0.5 text-[11px] font-semibold capitalize text-white backdrop-blur-sm">
          {event.category}
        </span>

        {/* Date pill */}
        <time className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[11px] text-zinc-200 backdrop-blur-sm ring-1 ring-white/10">
          <Calendar className="h-3 w-3 text-indigo-300" />
          {dateStr}
        </time>

        {/* Participant count */}
        <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-indigo-600/80 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
          <Users className="h-3 w-3 opacity-90" />
          {event.participantCount ?? 0}
        </span>
      </Link>

      {/* Body */}
      <div className="flex flex-col gap-1.5 p-4">
        <h3 className="line-clamp-1 text-sm font-semibold text-white">{event.name}</h3>

        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <MapPin className="h-3 w-3 shrink-0 text-zinc-600" />
          <span className="line-clamp-1">{event.venue || event.city || 'Venue TBD'}</span>
        </div>

        <Link
          to={`/event/${event._id}`}
          className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600/20 py-1.5 text-xs font-semibold text-indigo-300 ring-1 ring-indigo-500/25 transition hover:bg-indigo-600/35 hover:text-indigo-200"
        >
          View event
          <ArrowUpRight className="h-3.5 w-3.5 opacity-80" />
        </Link>
      </div>
    </motion.article>
  );
}
