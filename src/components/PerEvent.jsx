'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Calendar,
  MapPin,
  Users,
  Share2,
  Heart,
  ArrowLeft,
  Download,
  MessageCircle,
  Star,
  Clock,
  Sparkles,
  Shield,
  Loader2,
  Repeat2,
  Search,
  Phone,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { getAuthToken, getCurrentUser } from '../utils/session'
import apiClient from '../services/apiClient'

const CATEGORY_STYLES = {
  Adventure: 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/30',
  Social: 'bg-sky-500/20 text-sky-300 ring-sky-500/30',
  Learning: 'bg-amber-500/20 text-amber-200 ring-amber-500/30',
  Wellness: 'bg-violet-500/20 text-violet-300 ring-violet-500/30',
  Gaming: 'bg-rose-500/20 text-rose-300 ring-rose-500/30',
  Movies: 'bg-fuchsia-500/20 text-fuchsia-300 ring-fuchsia-500/30',
  Other: 'bg-zinc-500/20 text-zinc-300 ring-zinc-500/30',
}

function CategoryBadge({ category }) {
  const cls = CATEGORY_STYLES[category] || CATEGORY_STYLES.Other
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide ring-1 ring-inset ${cls}`}
    >
      {category}
    </span>
  )
}

function MetaRow({ icon: Icon, children, className = '' }) {
  return (
    <div className={`flex gap-3 text-sm text-zinc-300 ${className}`}>
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-800/80 text-indigo-400 ring-1 ring-zinc-700/80">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
    </div>
  )
}

function SectionCard({ title, subtitle, children, delay = 0 }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl shadow-black/20"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-zinc-800/60 pb-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
        </div>
      </div>
      <div className="text-sm leading-relaxed text-zinc-300">{children}</div>
    </motion.section>
  )
}

function PageSkeleton() {
  return (
    <div className="min-h-screen animate-pulse bg-zinc-950">
      <div className="mb-10 mt-16 h-[min(55vh,420px)] bg-zinc-800 pt-24 sm:mb-14 sm:mt-20 sm:pt-28" />
      <div className="mx-auto max-w-6xl space-y-6 px-4 pb-16 sm:px-6 lg:px-8">
        <div className="h-48 rounded-2xl bg-zinc-900 ring-1 ring-zinc-800" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="h-64 rounded-2xl bg-zinc-900 ring-1 ring-zinc-800 lg:col-span-2" />
          <div className="h-64 rounded-2xl bg-zinc-900 ring-1 ring-zinc-800" />
        </div>
      </div>
    </div>
  )
}

function formatEventRange(iso) {
  const d = new Date(iso)
  return {
    dateLine: d.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    timeLine: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
  }
}

// ─── Participants Table ───────────────────────────────────────────────────────

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-violet-500', 'bg-fuchsia-500',
  'bg-rose-500',   'bg-amber-500',  'bg-emerald-500',
  'bg-sky-500',    'bg-teal-500',
]

function avatarColor(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function ParticipantsTable({ participants, onExport }) {
  const [search, setSearch] = React.useState('')

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return participants
    return participants.filter(
      (p) =>
        p.fullName?.toLowerCase().includes(q) ||
        p.phoneNumber?.includes(q) ||
        p.whatsappNumber?.includes(q),
    )
  }, [participants, search])

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="mt-12 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-xl shadow-black/30"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/25">
            <Users className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-white">Registered Participants</h2>
            <p className="text-xs text-zinc-500">
              {participants.length} registered
              {search && filtered.length !== participants.length && ` · ${filtered.length} shown`}
            </p>
          </div>
          {/* count badge */}
          <span className="ml-1 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-indigo-600/80 px-2 text-xs font-bold text-white">
            {participants.length}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Search within table */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              type="search"
              placeholder="Search participants…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 rounded-lg border border-zinc-700/60 bg-zinc-800/60 py-2 pl-8 pr-3 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500/60 focus:outline-none focus:ring-1 focus:ring-indigo-500/25"
            />
          </div>

          {/* Export */}
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-white ring-1 ring-zinc-700 transition hover:bg-zinc-700"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      {participants.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 ring-1 ring-zinc-700">
            <Users className="h-5 w-5 text-zinc-500" />
          </span>
          <p className="text-sm font-medium text-zinc-400">No participants yet</p>
          <p className="text-xs text-zinc-600">People who join this event will appear here.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-zinc-500">
          No results for &ldquo;{search}&rdquo;
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800/80 bg-zinc-950/60 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                <th className="px-6 py-3 w-10">#</th>
                <th className="px-6 py-3">Participant</th>
                <th className="px-6 py-3">Phone</th>
                <th className="px-6 py-3">WhatsApp</th>
                <th className="px-6 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filtered.map((p, idx) => {
                const initials = getInitials(p.fullName)
                const color    = avatarColor(p.fullName)
                const joinedAt = p.joinedAt
                  ? new Date(p.joinedAt).toLocaleDateString(undefined, {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })
                  : '—'
                const samePhone = p.whatsappNumber && p.whatsappNumber === p.phoneNumber

                return (
                  <tr key={p._id} className="group transition-colors hover:bg-zinc-800/30">
                    {/* Serial */}
                    <td className="px-6 py-4 text-xs text-zinc-600">{idx + 1}</td>

                    {/* Avatar + Name */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${color}`}
                        >
                          {initials}
                        </span>
                        <span className="font-medium text-white">{p.fullName}</span>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="px-6 py-4">
                      <a
                        href={`tel:${p.phoneNumber}`}
                        className="inline-flex items-center gap-1.5 text-zinc-300 transition hover:text-indigo-300"
                      >
                        <Phone className="h-3 w-3 text-zinc-500" />
                        {p.phoneNumber}
                      </a>
                    </td>

                    {/* WhatsApp */}
                    <td className="px-6 py-4">
                      {samePhone ? (
                        <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          Same as phone
                        </span>
                      ) : (
                        <a
                          href={`https://wa.me/${(p.whatsappNumber || p.phoneNumber).replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-zinc-300 transition hover:text-emerald-300"
                        >
                          <Phone className="h-3 w-3 text-zinc-500" />
                          {p.whatsappNumber || p.phoneNumber}
                        </a>
                      )}
                    </td>

                    {/* Joined date */}
                    <td className="px-6 py-4 text-xs text-zinc-500">{joinedAt}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer summary */}
      {participants.length > 0 && (
        <div className="border-t border-zinc-800/60 px-6 py-3 flex items-center justify-between">
          <p className="text-xs text-zinc-600">
            Showing {filtered.length} of {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </p>
          {filtered.length > 0 && (
            <p className="text-xs text-zinc-600">
              Latest joined:{' '}
              <span className="text-zinc-400">
                {filtered[filtered.length - 1]?.fullName}
              </span>
            </p>
          )}
        </div>
      )}
    </motion.section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function PerEvent() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [event, setEvent] = useState(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [isAttending, setIsAttending] = useState(false)
  const [participants, setParticipants] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpeningChat, setIsOpeningChat] = useState(false)
  const [chatPreview, setChatPreview] = useState({ totalUnread: 0, fromNames: [] })
  const [isFavorited, setIsFavorited] = useState(false)
  const [favoriteCount, setFavoriteCount] = useState(0)
  const [ratingSummary, setRatingSummary] = useState({
    averageRating: 0,
    ratingCount: 0,
    ratings: [],
  })
  const [myRating, setMyRating] = useState(null)
  const [ratingValue, setRatingValue] = useState(5)
  const [ratingReview, setRatingReview] = useState('')
  const [eventEnded, setEventEnded] = useState(false)
  const [isSubmittingRating, setIsSubmittingRating] = useState(false)

  const currentUser = getCurrentUser()
  const token = getAuthToken()
  const isOwner = event && currentUser && String(event.owner_id) === String(currentUser._id)

  const { dateLine, timeLine } = useMemo(
    () => (event ? formatEventRange(event.datetime) : { dateLine: '', timeLine: '' }),
    [event],
  )

  const avgRating = Number(ratingSummary.averageRating || event?.averageRating || 0)
  const ratingCount = ratingSummary.ratingCount ?? event?.ratingCount ?? 0
  const spotsLeft = Math.max(0, (event?.maxAttendees ?? 0) - (event?.participantCount ?? 0))
  const isFull = event && spotsLeft === 0

  /** Joined attendees (not the host) may rate anytime */
  const mayLeaveReview = Boolean(!isOwner && isAttending)

  const loadParticipants = useCallback(async () => {
    if (!token || !isOwner) return
    try {
      const { data } = await apiClient.get(`/api/events/${id}/participants`)
      setParticipants(data.participants || [])
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to fetch participants')
    }
  }, [id, isOwner, token])

  const refreshChatPreview = useCallback(async () => {
    if (!token || !id || (!isOwner && !isAttending)) return
    try {
      const { data } = await apiClient.get(`/api/community/events/${id}/chats`)
      const chats = data?.chats || []
      const totalUnread = Number(data?.totalUnread) || 0
      const nameSet = new Set()
      chats.forEach((c) => {
        if (!(Number(c.unreadCount) > 0)) return
        if (c.type === 'DIRECT' && c.otherUserName) nameSet.add(c.otherUserName)
        ;(c.pendingSenderNames || []).forEach((n) => {
          if (n) nameSet.add(n)
        })
        if (nameSet.size === 0 && c.lastSenderName) nameSet.add(c.lastSenderName)
      })
      setChatPreview({ totalUnread, fromNames: [...nameSet].slice(0, 4) })
    } catch {
      /* optional */
    }
  }, [token, id, isOwner, isAttending])

  useEffect(() => {
    let cancelled = false

    async function loadPage() {
      setPageLoading(true)
      setLoadError(false)
      try {
        const [eventRes, ratingsRes] = await Promise.all([
          apiClient.get(`/api/events/${id}`),
          apiClient.get(`/api/events/${id}/ratings`),
        ])
        if (cancelled) return

        const ev = eventRes.data
        const r = ratingsRes.data
        setEvent(ev)
        setFavoriteCount(ev.favoriteCount || 0)
        setRatingSummary({
          averageRating: r.averageRating ?? ev.averageRating ?? 0,
          ratingCount: r.ratingCount ?? ev.ratingCount ?? 0,
          ratings: r.ratings || [],
        })
        setEventEnded(new Date(ev.datetime).getTime() < Date.now())

        if (token) {
          try {
            const { data: int } = await apiClient.get(`/api/events/${id}/interaction-status`)
            if (cancelled) return
            setIsAttending(!!int.joined)
            setIsFavorited(!!int.isFavorited)
            setEventEnded(!!int.eventEnded)
            setMyRating(int.myRating || null)
            if (int.myRating) {
              setRatingValue(int.myRating.rating)
              setRatingReview(int.myRating.review || '')
            }
          } catch {
            try {
              const { data: join } = await apiClient.get(`/api/events/${id}/join-status`)
              if (!cancelled) setIsAttending(!!join.joined)
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        if (!cancelled) {
          setLoadError(true)
          toast.error('Unable to load event details')
        }
      } finally {
        if (!cancelled) setPageLoading(false)
      }
    }

    loadPage()
    return () => {
      cancelled = true
    }
  }, [id, token])

  useEffect(() => {
    loadParticipants()
  }, [loadParticipants])

  useEffect(() => {
    if (pageLoading) return
    refreshChatPreview()
  }, [pageLoading, refreshChatPreview])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') refreshChatPreview()
    }
    document.addEventListener('visibilitychange', onVis)
    const t = setInterval(refreshChatPreview, 45000)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      clearInterval(t)
    }
  }, [refreshChatPreview])

  const handleJoin = async () => {
    if (!token) {
      toast.error('Please login first')
      return
    }

    setIsLoading(true)
    try {
      await apiClient.post(`/api/events/${id}/join`, {})
      toast.success('You joined this event')
      setIsAttending(true)
      const { data } = await apiClient.get(`/api/events/${id}`)
      setEvent(data)
      setFavoriteCount(data.favoriteCount || 0)
      setTimeout(() => refreshChatPreview(), 400)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Join failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteEvent = async () => {
    if (!token) return
    try {
      await apiClient.delete(`/api/events/${id}`)
      toast.success('Event deleted')
      navigate('/events')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delete failed')
    }
  }

  const handleExportParticipants = async () => {
    if (!token) return
    try {
      const response = await fetch(`${apiClient.defaults.baseURL}/api/events/${id}/participants/export`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Export failed')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `event-${id}-participants.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('Could not export participants')
    }
  }

  const handleCreateWhatsappGroup = async () => {
    if (!token) return
    try {
      const { data } = await apiClient.post(`/api/events/${id}/whatsapp-group/create`, {})
      toast.success(data?.message || 'WhatsApp group creation triggered')

      const inviteLink = data?.webhookResult?.response?.group?.inviteLink
      if (inviteLink) {
        window.open(inviteLink, '_blank', 'noopener,noreferrer')
      } else {
        toast('Group created, but no invite link was returned by webhook.')
      }
    } catch (error) {
      const apiMessage = error.response?.data?.message
      if (apiMessage?.includes('WHATSAPP_GROUP_WEBHOOK_URL')) {
        toast.error('Webhook not configured in backend .env')
      } else {
        toast.error(apiMessage || 'Could not create WhatsApp group')
      }
    }
  }

  const handleOpenChat = async () => {
    if (!token) {
      toast.error('Please login first')
      return
    }

    if (!isOwner && !isAttending) {
      toast.error('Join this event to access chat')
      return
    }

    setIsOpeningChat(true)
    try {
      const { data } = await apiClient.get(`/api/community/events/${id}/chats`)
      const groupChat = (data?.chats || []).find((chat) => chat.type === 'EVENT_GROUP')
      const selectedChat = groupChat || (data?.chats || [])[0]

      if (!selectedChat?.id) {
        toast.error('No chat available for this event yet')
        return
      }

      navigate(`/chat?eventId=${id}&chatId=${selectedChat.id}`)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not open event chat')
    } finally {
      setIsOpeningChat(false)
    }
  }

  const handleToggleFavorite = async () => {
    if (!token) {
      toast.error('Please login first')
      return
    }
    try {
      const { data } = await apiClient.post(`/api/events/${id}/favorite`, {})
      setIsFavorited(!!data.isFavorited)
      setFavoriteCount(data.favoriteCount || 0)
      toast.success(data.message || 'Updated favorites')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not update favorite')
    }
  }

  const handleShareEvent = async () => {
    const shareUrl = `${window.location.origin}/event/${id}`
    const shareTitle = event?.name || 'Community Event'
    const shareText = `Join me at "${shareTitle}" on Find My Buddy!`

    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl })
        return
      }
    } catch {
      /* user cancelled or share failed */
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
      toast.success('Event link copied. WhatsApp share opened.')
    } catch {
      toast.error('Could not share this event right now')
    }
  }

  const handleSubmitRating = async (e) => {
    e.preventDefault()
    if (!token) {
      toast.error('Please login first')
      return
    }
    if (isOwner) {
      toast.error('Hosts cannot rate their own event')
      return
    }
    if (!isAttending) {
      toast.error('Join this event to leave a review')
      return
    }

    setIsSubmittingRating(true)
    try {
      const { data } = await apiClient.post(`/api/events/${id}/rate`, {
        rating: ratingValue,
        review: ratingReview,
      })
      setMyRating(data.myRating || null)
      setRatingSummary((prev) => ({
        ...prev,
        averageRating: data.averageRating ?? prev.averageRating,
        ratingCount: data.ratingCount ?? prev.ratingCount,
      }))
      const { data: r } = await apiClient.get(`/api/events/${id}/ratings`)
      setRatingSummary({
        averageRating: r.averageRating || 0,
        ratingCount: r.ratingCount || 0,
        ratings: r.ratings || [],
      })
      toast.success(data.message || 'Rating submitted')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not submit rating')
    } finally {
      setIsSubmittingRating(false)
    }
  }

  if (pageLoading) return <PageSkeleton />

  if (loadError || !event) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center bg-zinc-950 px-4 pt-28 text-center">
        <p className="text-lg font-medium text-white">We couldn&apos;t load this event</p>
        <p className="mt-2 max-w-md text-sm text-zinc-400">
          Check your connection or try again. The event may have been removed.
        </p>
        <Link
          to="/events"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to events
        </Link>
      </div>
    )
  }

  const addressLine = event.address?.formattedAddress || event.address?.line1
  const hasGeo = event.address?.geocode?.lat && event.address?.geocode?.lng
  const mapHref = hasGeo
    ? `https://www.openstreetmap.org/?mlat=${event.address.geocode.lat}&mlon=${event.address.geocode.lng}#map=16/${event.address.geocode.lat}/${event.address.geocode.lng}`
    : null

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 isolation-isolate">
      {/* mt: breathing room below fixed navbar; pt: keeps controls clear of nav; image fills hero incl. padding */}
      <header className="relative bg-zinc-950">
        <div className="relative isolate mt-16 mb-10 min-h-[min(58vh,480px)] w-full overflow-hidden bg-zinc-900 pt-24 sm:mt-20 sm:pt-28 sm:mb-14">
          <img
            src={event.photo || '/placeholder.svg?height=600&width=1200'}
            alt=""
            className="absolute inset-0 z-0 h-full w-full object-cover object-center"
          />
          {/* Darken bottom for title contrast; keep top lighter so the photo stays visible */}
          <div
            className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-zinc-950/30"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_90%_60%_at_50%_100%,rgba(24,24,27,0.5),transparent_55%)]"
            aria-hidden
          />

          <div className="absolute left-0 right-0 top-0 z-10 flex justify-between gap-4 px-4 pt-5 sm:px-6 lg:px-8 sm:pt-6">
            <Link
              to="/events"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-600/80 bg-zinc-950/95 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-black/30 transition hover:border-zinc-500 hover:bg-zinc-900"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Events
            </Link>
          </div>

          <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-10 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryBadge category={event.category} />
                  {eventEnded ? (
                    <span className="rounded-full bg-zinc-800/90 px-3 py-1 text-xs font-medium text-zinc-400 ring-1 ring-zinc-700">
                      Past event
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/25">
                      <Clock className="h-3 w-3" aria-hidden />
                      Upcoming
                    </span>
                  )}
                  {event.recurrence?.enabled && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-3 py-1 text-xs font-semibold text-violet-300 ring-1 ring-violet-500/25">
                      <Repeat2 className="h-3 w-3" aria-hidden />
                      Repeats {event.recurrence.frequency === 'monthly' ? 'monthly' : 'every week'}
                      {event.recurrence.occurrenceIndex > 0 && (
                        <span className="ml-1 opacity-60">#{event.recurrence.occurrenceIndex + 1}</span>
                      )}
                    </span>
                  )}
                </div>
                <h1 className="max-w-4xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                  {event.name}
                </h1>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-300">
                  <span className="inline-flex items-center gap-1.5 text-indigo-300">
                    <Sparkles className="h-4 w-4 shrink-0 text-indigo-400" aria-hidden />
                    Hosted by <span className="font-medium text-white">{event.ownerName}</span>
                  </span>
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 w-full transform-gpu bg-zinc-950 pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="space-y-8 lg:col-span-7 xl:col-span-8">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black/40 sm:p-8"
            >
              <h2 className="sr-only">Event details</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <MetaRow icon={Calendar}>
                  <p className="font-medium text-white">{dateLine}</p>
                  <p className="text-zinc-500">{timeLine}</p>
                </MetaRow>
                <MetaRow icon={MapPin}>
                  {addressLine ? (
                    <>
                      <p className="font-medium text-white">{addressLine}</p>
                      {mapHref ? (
                        <a
                          href={mapHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                        >
                          Open in map
                        </a>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-zinc-500">Address not specified</p>
                  )}
                </MetaRow>
                <MetaRow icon={Users}>
                  <p className="font-medium text-white">
                    {event.participantCount || 0}
                    <span className="font-normal text-zinc-500">
                      {' '}
                      / {event.maxAttendees} attending
                    </span>
                  </p>
                  <p className="text-zinc-500">
                    {isFull ? 'This event is at capacity' : `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`}
                  </p>
                </MetaRow>
                <MetaRow icon={Star}>
                  <p className="font-medium text-white">
                    {avgRating.toFixed(1)}
                    <span className="font-normal text-zinc-500"> / 5</span>
                  </p>
                  <p className="text-zinc-500">{ratingCount} rating{ratingCount === 1 ? '' : 's'}</p>
                </MetaRow>
              </div>
            </motion.div>

            {event.description?.trim() ? (
              <SectionCard title="About this event" delay={0.05}>
                <p className="whitespace-pre-wrap">{event.description}</p>
              </SectionCard>
            ) : null}
            {event.activities?.trim() ? (
              <SectionCard title="What we'll do" delay={0.08}>
                <p className="whitespace-pre-wrap">{event.activities}</p>
              </SectionCard>
            ) : null}
            {event.expectations?.trim() ? (
              <SectionCard title="What to expect" delay={0.1}>
                <p className="whitespace-pre-wrap">{event.expectations}</p>
              </SectionCard>
            ) : null}
            {event.aboutYou?.trim() ? (
              <SectionCard title="About the host" subtitle="From the organizer" delay={0.12}>
                <p className="whitespace-pre-wrap">{event.aboutYou}</p>
              </SectionCard>
            ) : null}
          </div>

          <aside className="lg:col-span-5 xl:col-span-4">
            <div className="sticky top-28 space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black/40"
              >
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={handleJoin}
                    disabled={isLoading || isOwner || isFull}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Joining…
                      </>
                    ) : isOwner ? (
                      <>
                        <Shield className="h-4 w-4" aria-hidden />
                        You&apos;re the host
                      </>
                    ) : isAttending ? (
                      "You're in"
                    ) : isFull ? (
                      'Event full'
                    ) : (
                      'Join event'
                    )}
                  </button>

                  {(isOwner || isAttending) && (
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={handleOpenChat}
                        disabled={isOpeningChat}
                        className="relative flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/15 disabled:opacity-50"
                      >
                        <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
                        <span>{isOpeningChat ? 'Opening…' : 'Event chat'}</span>
                        {chatPreview.totalUnread > 0 ? (
                          <span className="absolute right-3 top-1/2 min-w-[1.35rem] -translate-y-1/2 rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white">
                            {chatPreview.totalUnread > 99 ? '99+' : chatPreview.totalUnread}
                          </span>
                        ) : null}
                      </button>
                      {chatPreview.totalUnread > 0 ? (
                        <p className="text-center text-xs leading-snug text-amber-200/90">
                          {chatPreview.totalUnread}{' '}
                          {chatPreview.totalUnread === 1 ? 'new message' : 'new messages'}
                          {chatPreview.fromNames.length > 0
                            ? ` · From ${chatPreview.fromNames.join(', ')}${
                                chatPreview.fromNames.length >= 4 ? '…' : ''
                              }`
                            : ''}
                        </p>
                      ) : null}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleShareEvent}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/50 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
                      title="Share"
                    >
                      <Share2 className="h-4 w-4" aria-hidden />
                      Share
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleFavorite}
                      className={`inline-flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition ${
                        isFavorited
                          ? 'border-rose-500/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/20'
                          : 'border-zinc-700 bg-zinc-800/50 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800'
                      }`}
                      title={isFavorited ? 'Remove from favorites' : 'Save'}
                    >
                      <Heart className="h-4 w-4" fill={isFavorited ? 'currentColor' : 'none'} aria-hidden />
                      {isFavorited ? 'Saved' : 'Save'}
                    </button>
                  </div>

                  <p className="text-center text-xs text-zinc-500">
                    Saved by {favoriteCount} {favoriteCount === 1 ? 'person' : 'people'}
                  </p>
                </div>
              </motion.div>

              {isOwner && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 }}
                  className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 ring-1 ring-amber-500/10"
                >
                  <h3 className="text-sm font-semibold text-amber-100">Host tools</h3>
                  <p className="mt-1 text-xs text-zinc-500">Manage this event and attendees.</p>
                  <div className="mt-4 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleCreateWhatsappGroup}
                      className="rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
                    >
                      WhatsApp group
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteEvent}
                      className="rounded-lg border border-red-500/40 bg-red-500/10 py-2.5 text-sm font-semibold text-red-200 transition hover:bg-red-500/15"
                    >
                      Delete event
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </aside>
          </div>

        {isOwner && (
          <ParticipantsTable
            participants={participants}
            onExport={handleExportParticipants}
          />
        )}

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-12 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl shadow-black/30 sm:p-8"
        >
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800/60 pb-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white">Ratings & reviews</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {avgRating.toFixed(1)} average · {ratingCount} review{ratingCount === 1 ? '' : 's'}
              </p>
              {isOwner ? (
                <p className="mt-2 max-w-xl text-sm text-zinc-400">
                  Reviews below are from people who joined your event. You can see their name
                  {token ? ' and email' : ''} to follow up.
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-0.5 text-amber-400" aria-hidden>
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className="h-5 w-5"
                  fill={s <= Math.round(avgRating) ? 'currentColor' : 'none'}
                />
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-6">
            {mayLeaveReview && (
              <form
                onSubmit={handleSubmitRating}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-5"
              >
                <p className="font-semibold text-white">Rate this event</p>
                <p className="mt-1 text-xs text-zinc-500">You joined this event — share a star rating and optional note.</p>
                <div className="mt-3 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingValue(star)}
                      className={`rounded-md p-1 transition ${star <= ratingValue ? 'text-amber-400' : 'text-zinc-600 hover:text-zinc-500'}`}
                      aria-label={`${star} stars`}
                    >
                      <Star size={26} fill={star <= ratingValue ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
                <textarea
                  value={ratingReview}
                  onChange={(e) => setRatingReview(e.target.value)}
                  className="mt-4 w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Share what stood out (optional)"
                  maxLength={500}
                  rows={3}
                />
                <button
                  type="submit"
                  disabled={isSubmittingRating || !mayLeaveReview}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-45"
                >
                  {isSubmittingRating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting…
                    </>
                  ) : myRating ? (
                    'Update rating'
                  ) : (
                    'Submit rating'
                  )}
                </button>
              </form>
            )}

            {!isOwner && !isAttending && token ? (
              <p className="text-sm text-zinc-500">Join this event to rate it and leave a review.</p>
            ) : null}

            <ul className="space-y-3">
              {(ratingSummary.ratings || []).map((row) => {
                const reviewedAt = row.createdAt ? new Date(row.createdAt) : null
                return (
                <li
                  key={row.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-4 transition hover:border-zinc-600"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">{row.user?.name || 'Attendee'}</p>
                      {isOwner && row.user?.email ? (
                        <p className="mt-0.5 text-xs text-zinc-500">{row.user.email}</p>
                      ) : null}
                      {reviewedAt ? (
                        <p className="mt-1 text-xs text-zinc-600">{reviewedAt.toLocaleString()}</p>
                      ) : null}
                    </div>
                    <p className="text-amber-400 text-sm shrink-0" aria-label={`${row.rating} of 5 stars`}>
                      {'★'.repeat(row.rating)}
                      <span className="text-zinc-600">{'☆'.repeat(5 - row.rating)}</span>
                    </p>
                  </div>
                  {row.review ? <p className="mt-2 text-sm leading-relaxed text-zinc-400">{row.review}</p> : null}
                </li>
                )
              })}
            </ul>
            {(!ratingSummary.ratings || ratingSummary.ratings.length === 0) && (
              <p className="py-6 text-center text-sm text-zinc-500">
                {isOwner
                  ? 'No reviews yet. When attendees join and submit a rating, it will show up here.'
                  : 'No ratings yet — join the event to leave the first one.'}
              </p>
            )}
          </div>
        </motion.section>
        </div>
      </main>
    </div>
  )
}
