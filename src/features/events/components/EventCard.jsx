import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Users, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDisplayEventPhotoUrl } from '../../../utils/eventImage';

export default function EventCard({ event, index = 0 }) {
  const photoSrc = getDisplayEventPhotoUrl(event.photo, 900) || '/placeholder.svg?height=200&width=400';
  const dateStr = new Date(event.datetime).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.35) }}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-700/50 bg-gradient-to-b from-zinc-800/40 to-zinc-900/90 shadow-lg shadow-black/30 ring-1 ring-white/[0.04] transition-shadow duration-300 hover:border-zinc-600/60 hover:shadow-xl hover:shadow-indigo-950/20 hover:ring-indigo-500/10"
    >
      <Link
        to={`/event/${event._id}`}
        className="relative block aspect-[16/10] shrink-0 overflow-hidden bg-zinc-950"
      >
        <img
          src={photoSrc}
          alt=""
          decoding="async"
          loading="lazy"
          className="h-full w-full object-cover object-center transition duration-300 group-hover:brightness-105 [transform:translateZ(0)]"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/20 to-transparent"
          aria-hidden
        />
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          <time className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium text-zinc-200 backdrop-blur-sm ring-1 ring-white/10">
            <Calendar className="h-3.5 w-3.5 text-indigo-300" />
            {dateStr}
          </time>
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600/90 px-2.5 py-1 text-xs font-semibold text-white shadow-md backdrop-blur-sm">
            <Users className="h-3.5 w-3.5 opacity-90" />
            {event.participantCount ?? 0}
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-5 pt-4">
        <h3 className="mb-2 text-xl font-semibold text-white">{event.name}</h3>
        <p className="mb-2 text-sm text-indigo-300">Event Creator: {event.eventCreatorLabel}</p>
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <MapPin size={16} />
            {event.venue}
          </div>
          {event.distanceKm != null && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-indigo-900/60 px-2 py-1 text-xs text-indigo-300">
              <MapPin size={10} />
              {event.distanceKm} km
            </span>
          )}
        </div>
        <p className="line-clamp-2 flex-1 text-sm leading-relaxed text-zinc-500">{event.description}</p>
        <Link
          to={`/event/${event._id}`}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-900/30 transition hover:from-indigo-500 hover:to-violet-500"
        >
          View event
          <ArrowUpRight className="h-4 w-4 opacity-90" />
        </Link>
      </div>
    </motion.article>
  );
}
