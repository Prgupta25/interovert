'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus, Sparkles, Compass } from 'lucide-react'
import { toast } from 'react-hot-toast'
import apiClient from '../services/apiClient'
import { getSocket } from '../utils/socket'
import { eventCategories } from '../features/events/constants'
import EventFilters from '../features/events/components/EventFilters'
import EventCard from '../features/events/components/EventCard'
import CreateEventModal from '../features/events/components/CreateEventModal'

export default function Events() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('date')
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [events, setEvents] = useState([])

  // Geo / Near Me state
  const [nearMe, setNearMe] = useState(false)
  const [radius, setRadius] = useState(25)
  const [userAddress, setUserAddress] = useState(null)   // first saved address with geocode

  const debounceRef = useRef(null)

  // Fetch the user's saved addresses once on mount to get their geo coords
  useEffect(() => {
    apiClient.get('/api/addresses')
      .then(({ data }) => {
        const addresses = Array.isArray(data) ? data : (data.addresses ?? [])
        const withGeo = addresses.find((a) => a.geocode?.lat && a.geocode?.lng)
        if (withGeo) setUserAddress(withGeo)
      })
      .catch(() => {}) // silent — Near Me button just stays hidden
  }, [])

  const loadEvents = useCallback(async (params = {}) => {
    try {
      const query = new URLSearchParams()
      if (params.q) query.set('q', params.q)
      if (params.category && params.category !== 'all') query.set('category', params.category)
      if (params.dateFrom) query.set('dateFrom', params.dateFrom)
      if (params.dateTo) query.set('dateTo', params.dateTo)
      if (params.sortBy) query.set('sortBy', params.sortBy)

      // Geo params — only when Near Me is active and we have coords
      if (params.userLat != null && params.userLng != null) {
        query.set('userLat', params.userLat)
        query.set('userLng', params.userLng)
        query.set('radius', params.radius ?? 25)
      }

      const qs = query.toString()
      const { data } = await apiClient.get(`/api/events${qs ? `?${qs}` : ''}`)
      setEvents(data.events ?? data)
    } catch {
      toast.error('Failed to load events')
    }
  }, [])

  const debouncedLoad = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      loadEvents({
        q: searchTerm,
        category: selectedCategory,
        sortBy,
        ...(nearMe && userAddress?.geocode && {
          userLat: userAddress.geocode.lat,
          userLng: userAddress.geocode.lng,
          radius,
        }),
      })
    }, 350)
  }, [searchTerm, selectedCategory, sortBy, nearMe, radius, userAddress, loadEvents])

  useEffect(() => {
    debouncedLoad()
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [debouncedLoad])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleNotification = (notification) => {
      const name = notification?.metadata?.fullName || 'A user'
      const eventName = notification?.metadata?.eventName || 'your event'
      toast.success(`${name} joined ${eventName}`)
    }

    socket.on('notification:new', handleNotification)
    return () => socket.off('notification:new', handleNotification)
  }, [])

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 pt-28 text-zinc-100">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(99,102,241,0.18),transparent_50%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_50%,rgba(139,92,246,0.08),transparent_45%)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10 flex flex-col gap-6 border-b border-zinc-800/80 pb-10 sm:flex-row sm:items-end sm:justify-between"
        >
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-400/90">
              <Compass className="h-3.5 w-3.5" aria-hidden />
              Discover
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">Events</h1>
            <p className="mt-3 text-base leading-relaxed text-zinc-400">
              Meet people who share your interests—browse gatherings, filter by vibe, and host your own.
            </p>
          </div>
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsModalOpen(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:from-indigo-500 hover:to-violet-500 sm:self-auto"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
            Create event
          </motion.button>
        </motion.header>

        <EventFilters
          categories={eventCategories}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          sortBy={sortBy}
          setSortBy={setSortBy}
          filterMenuOpen={filterMenuOpen}
          setFilterMenuOpen={setFilterMenuOpen}
          nearMe={nearMe}
          setNearMe={setNearMe}
          radius={radius}
          setRadius={setRadius}
          userAddress={userAddress}
        />

        {events.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/30 py-20 text-center ring-1 ring-white/[0.02]"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/25">
              <Sparkles className="h-7 w-7" />
            </span>
            <h2 className="mt-6 text-lg font-semibold text-white">No events match your filters</h2>
            <p className="mt-2 max-w-sm text-sm text-zinc-500">
              Try another category or search term, or be the first to host something new.
            </p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="mt-8 rounded-xl bg-zinc-800 px-5 py-2.5 text-sm font-medium text-white ring-1 ring-zinc-600 transition hover:bg-zinc-700"
            >
              Create the first event
            </button>
          </motion.div>
        ) : (
          <ul className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event, i) => (
              <li key={event._id}>
                <EventCard event={event} index={i} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <CreateEventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={() => loadEvents({ q: searchTerm, category: selectedCategory, sortBy })}
        categories={eventCategories}
      />
    </div>
  )
}
