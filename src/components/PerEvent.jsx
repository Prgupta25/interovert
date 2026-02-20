'use client'

import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Calendar, MapPin, Users, Share2, Heart, ArrowLeft, Download, MessageCircle, Star } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { getAuthToken, getCurrentUser } from '../utils/session'
import apiClient from '../services/apiClient'

const CategoryBadge = ({ category }) => {
  const categoryColors = {
    Adventure: 'bg-green-500',
    Social: 'bg-blue-500',
    Learning: 'bg-yellow-500',
    Wellness: 'bg-purple-500',
    Gaming: 'bg-red-500',
    Movies: 'bg-pink-500',
    Other: 'bg-gray-500'
  }

  return (
    <span className={`${categoryColors[category] || 'bg-gray-500'} text-white text-xs font-bold px-2 py-1 rounded-full`}>
      {category}
    </span>
  )
}

export default function PerEvent() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [event, setEvent] = useState(null)
  const [isAttending, setIsAttending] = useState(false)
  const [participants, setParticipants] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpeningChat, setIsOpeningChat] = useState(false)
  const [isFavorited, setIsFavorited] = useState(false)
  const [favoriteCount, setFavoriteCount] = useState(0)
  const [ratingSummary, setRatingSummary] = useState({ averageRating: 0, ratingCount: 0, ratings: [] })
  const [myRating, setMyRating] = useState(null)
  const [ratingValue, setRatingValue] = useState(5)
  const [ratingReview, setRatingReview] = useState('')
  const [canRate, setCanRate] = useState(false)
  const [eventEnded, setEventEnded] = useState(false)
  const [isSubmittingRating, setIsSubmittingRating] = useState(false)
  const currentUser = getCurrentUser()
  const token = getAuthToken()
  const isOwner = event && currentUser && String(event.owner_id) === String(currentUser._id)

  const loadEvent = async () => {
    try {
      const { data } = await apiClient.get(`/api/events/${id}`)
      setEvent(data)
      setFavoriteCount(data.favoriteCount || 0)
      setRatingSummary((prev) => ({
        ...prev,
        averageRating: data.averageRating || 0,
        ratingCount: data.ratingCount || 0,
      }))
      setEventEnded(new Date(data.datetime).getTime() < Date.now())
    } catch (_) {
      toast.error('Unable to load event details')
    }
  }

  const loadParticipants = async () => {
    if (!token || !isOwner) return
    try {
      const { data } = await apiClient.get(`/api/events/${id}/participants`)
      setParticipants(data.participants || [])
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to fetch participants')
    }
  }

  const loadJoinStatus = async () => {
    if (!token) return
    try {
      const { data } = await apiClient.get(`/api/events/${id}/join-status`)
      setIsAttending(!!data.joined)
    } catch (_) {}
  }

  const loadInteractionStatus = async () => {
    if (!token) return
    try {
      const { data } = await apiClient.get(`/api/events/${id}/interaction-status`)
      setIsAttending(!!data.joined)
      setIsFavorited(!!data.isFavorited)
      setCanRate(!!data.canRate)
      setEventEnded(!!data.eventEnded)
      setMyRating(data.myRating || null)
      if (data.myRating) {
        setRatingValue(data.myRating.rating)
        setRatingReview(data.myRating.review || '')
      }
    } catch (_) {}
  }

  const loadRatings = async () => {
    try {
      const { data } = await apiClient.get(`/api/events/${id}/ratings`)
      setRatingSummary({
        averageRating: data.averageRating || 0,
        ratingCount: data.ratingCount || 0,
        ratings: data.ratings || [],
      })
    } catch (_) {}
  }

  useEffect(() => {
    loadEvent()
    loadJoinStatus()
    loadInteractionStatus()
    loadRatings()
  }, [id])

  useEffect(() => {
    loadParticipants()
  }, [id, isOwner])

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
      loadEvent()
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
    } catch (_) {
      toast.error('Could not export participants')
    }
  }

  const handleCreateWhatsappGroup = async () => {
    if (!token) return
    try {
      const { data } = await apiClient.post(`/api/events/${id}/whatsapp-group/create`, {})
      toast.success(data?.message || 'WhatsApp group creation triggered')

      const inviteLink = data?.webhookResult?.response?.group?.inviteLink;
      if (inviteLink) {
        window.open(inviteLink, '_blank', 'noopener,noreferrer');
      } else {
        toast('Group created, but no invite link was returned by webhook.');
      }
    } catch (error) {
      const apiMessage = error.response?.data?.message;
      if (apiMessage?.includes('WHATSAPP_GROUP_WEBHOOK_URL')) {
        toast.error('Webhook not configured in backend .env');
      } else {
        toast.error(apiMessage || 'Could not create WhatsApp group');
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
    } catch (_) {
      // User may cancel native share; fallback below
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
      toast.success('Event link copied. WhatsApp share opened.')
    } catch (_) {
      toast.error('Could not share this event right now')
    }
  }

  const handleSubmitRating = async (e) => {
    e.preventDefault()
    if (!token) {
      toast.error('Please login first')
      return
    }
    if (!canRate) {
      toast.error('You can rate this event only after attending it')
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
        averageRating: data.averageRating || prev.averageRating,
        ratingCount: data.ratingCount || prev.ratingCount,
      }))
      loadRatings()
      toast.success(data.message || 'Rating submitted')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not submit rating')
    } finally {
      setIsSubmittingRating(false)
    }
  }

  if (!event) return null

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      
      <div className="relative h-[60vh]">
        <img
          src={event.photo || '/placeholder.svg?height=600&width=1200'}
          alt={event.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent" />
        <Link
          to="/events"
          className="absolute top-4 left-4 flex items-center gap-2 text-white hover:text-gray-200 transition-colors"
        >
          <ArrowLeft />
          Back to Events
        </Link>
      </div>

      
      <div className="max-w-4xl mx-auto px-4 -mt-32 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800 rounded-xl p-6 shadow-xl">
          <div className="flex justify-between items-start mb-6">
            <h1 className="text-3xl font-bold">{event.name}</h1>
            <CategoryBadge category={event.category} />
          </div>
          <p className="text-indigo-300 mb-4">Event Creator: {event.ownerName}</p>
          
          <div className="flex flex-wrap gap-6 text-gray-300 mb-8">
            <div className="flex items-center gap-2">
              <Calendar size={20} />
              {new Date(event.datetime).toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={20} />
              {event.venue}
            </div>
            <div className="flex items-center gap-2">
              <Users size={20} />
              {event.participantCount || 0}/{event.maxAttendees} spots
            </div>
            <div className="flex items-center gap-2">
              <Star size={18} className="text-amber-400" />
              {(ratingSummary.averageRating || event.averageRating || 0).toFixed(1)} ({ratingSummary.ratingCount || event.ratingCount || 0})
            </div>
          </div>

          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-semibold mb-3">About This Event</h2>
              <p className="text-gray-300">{event.description}</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">What We'll Do</h2>
              <p className="text-gray-300">{event.activities}</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">What to Expect</h2>
              <p className="text-gray-300">{event.expectations}</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">About the Host</h2>
              <p className="text-gray-300">{event.aboutYou}</p>
            </section>

            <div className="flex gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleJoin}
                disabled={isLoading || isOwner}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg transition-colors"
              >
                {isOwner ? 'You are Event Creator' : (isAttending ? 'Joined' : 'Join Event')}
              </motion.button>
              {(isOwner || isAttending) && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleOpenChat}
                  disabled={isOpeningChat}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  <MessageCircle size={18} />
                  {isOpeningChat ? 'Opening...' : 'Chat'}
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleShareEvent}
                className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                title="Share event with friends"
              >
                <Share2 size={20} />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleToggleFavorite}
                className={`p-3 rounded-lg transition-colors ${
                  isFavorited ? 'bg-rose-600 hover:bg-rose-700' : 'bg-gray-700 hover:bg-gray-600'
                }`}
                title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart size={20} fill={isFavorited ? 'currentColor' : 'none'} />
              </motion.button>
            </div>
            <p className="text-sm text-gray-400">Saved by {favoriteCount} people</p>

            {isOwner && (
              <div className="flex gap-4">
                <button
                  onClick={handleDeleteEvent}
                  className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg"
                >
                  Delete Event
                </button>
                <button
                  onClick={handleExportParticipants}
                  className="bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg inline-flex items-center gap-2"
                >
                  <Download size={16} />
                  Export Participants
                </button>
                <button
                  onClick={handleCreateWhatsappGroup}
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg"
                >
                  Create WhatsApp Group
                </button>
              </div>
            )}
          </div>
        </motion.div>

        {isOwner && (
          <div className="mt-12 bg-gray-800 rounded-xl p-6">
            <h2 className="text-2xl font-bold mb-4">Participants</h2>
            <div className="space-y-3">
              {participants.map((p) => (
                <div key={p._id} className="bg-gray-700 rounded-lg p-4">
                  <p><strong>Name:</strong> {p.fullName}</p>
                  <p><strong>Phone:</strong> {p.phoneNumber}</p>
                  <p><strong>WhatsApp:</strong> {p.whatsappNumber || p.phoneNumber}</p>
                  <p><strong>Profile ID:</strong> {p.profileId}</p>
                </div>
              ))}
              {participants.length === 0 && (
                <p className="text-gray-400">No participants joined yet.</p>
              )}
            </div>
          </div>
        )}

        <div className="mt-12 bg-gray-800 rounded-xl p-6 space-y-5">
          <div>
            <h2 className="text-2xl font-bold">Ratings & Reviews</h2>
            <p className="text-gray-400 mt-1">
              Average {(ratingSummary.averageRating || 0).toFixed(1)} / 5 from {ratingSummary.ratingCount || 0} ratings
            </p>
          </div>

          {!isOwner && isAttending && eventEnded && (
            <form onSubmit={handleSubmitRating} className="bg-gray-700 rounded-lg p-4 space-y-3">
              <p className="font-semibold">Rate this event</p>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRatingValue(star)}
                    className={`p-1 ${star <= ratingValue ? 'text-amber-400' : 'text-gray-500'}`}
                  >
                    <Star size={22} fill={star <= ratingValue ? 'currentColor' : 'none'} />
                  </button>
                ))}
              </div>
              <textarea
                value={ratingReview}
                onChange={(e) => setRatingReview(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-600 p-3"
                placeholder="Write your review (optional)"
                maxLength={500}
              />
              <button
                type="submit"
                disabled={isSubmittingRating || !canRate}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 rounded-lg"
              >
                {isSubmittingRating ? 'Submitting...' : (myRating ? 'Update Rating' : 'Submit Rating')}
              </button>
            </form>
          )}

          {!eventEnded && isAttending && !isOwner && (
            <p className="text-sm text-gray-400">You can rate this event after it ends.</p>
          )}

          <div className="space-y-3">
            {(ratingSummary.ratings || []).slice(0, 6).map((row) => (
              <div key={row.id} className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{row.user?.name || 'User'}</p>
                  <p className="text-amber-400">{'★'.repeat(row.rating)}{'☆'.repeat(5 - row.rating)}</p>
                </div>
                {row.review ? <p className="text-gray-300 mt-2">{row.review}</p> : null}
              </div>
            ))}
            {(!ratingSummary.ratings || ratingSummary.ratings.length === 0) && (
              <p className="text-gray-400">No ratings yet.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

