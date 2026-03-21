'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
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
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
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
        dateFrom,
        dateTo,
        sortBy,
        ...(nearMe && userAddress?.geocode && {
          userLat: userAddress.geocode.lat,
          userLng: userAddress.geocode.lng,
          radius,
        }),
      })
    }, 350)
  }, [searchTerm, selectedCategory, dateFrom, dateTo, sortBy, nearMe, radius, userAddress, loadEvents])

  useEffect(() => {
    debouncedLoad()
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
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
    <div className="min-h-screen pt-28 bg-gray-900 text-white p-4">

      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Events</h1>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={20} />
            Add Event
          </motion.button>
        </div>

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
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          nearMe={nearMe}
          setNearMe={setNearMe}
          radius={radius}
          setRadius={setRadius}
          userAddress={userAddress}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => <EventCard key={event._id} event={event} />)}
        </div>
      </div>

      <CreateEventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={() => loadEvents({ q: searchTerm, category: selectedCategory, dateFrom, dateTo, sortBy })}
        categories={eventCategories}
      />
    </div>
  )
}
