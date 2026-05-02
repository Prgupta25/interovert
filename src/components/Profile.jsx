'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Plus,
  Camera,
  Trash2,
  MapPin,
  Save,
  ArrowLeft,
  Pencil,
  Loader2,
  LogOut,
  Mail,
  Phone,
  User,
  CalendarDays,
  Users,
  Sparkles,
  UserCircle2,
  BadgeCheck,
  ShieldAlert,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { clearSession, getAuthToken, getCurrentUser, setSession } from '../utils/session'
import { disconnectSocket } from '../utils/socket'
import apiClient from '../services/apiClient'
import AddressFormModal from './AddressFormModal'
import { ProfilePageSkeleton } from './ui/Skeleton'

/** Open Google Maps for a saved address (coordinates preferred, else text search). */
function buildAddressMapHref(addr) {
  const lat = addr.geocode?.lat
  const lng = addr.geocode?.lng
  if (lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`
  }
  const text =
    String(addr.formattedAddress || '').trim() ||
    [addr.line1, addr.line2, addr.city, addr.state, addr.postalCode, addr.country].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`
}

function normAvatar(v) {
  if (v == null || v === '') return null
  return v
}

function lookingForKey(arr) {
  return [...(arr || [])].map(String).sort().join('|')
}

function normName(v) {
  return String(v ?? '').trim()
}

function normEmail(v) {
  return String(v ?? '').trim().toLowerCase()
}

function normPhone(v) {
  return String(v ?? '').trim()
}

function StatBlock({ value, label, sublabel, icon: Icon }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1 border-l border-zinc-800/80 py-1 pl-3 text-center first:border-l-0 first:pl-0 sm:pl-4">
      <Icon className="mx-auto h-4 w-4 text-indigo-400/90 sm:hidden" aria-hidden />
      <p className="text-lg font-bold tabular-nums text-white sm:text-xl">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 sm:text-[11px]">{label}</p>
      {sublabel ? <p className="hidden text-[10px] text-zinc-600 sm:block">{sublabel}</p> : null}
    </div>
  )
}

/** One horizontal row: label (+ icon) left, content right — not used for Events / Meetups / Friends stats. */
function DetailRow({ icon: Icon, label, iconWrapClass, children }) {
  return (
    <div className="flex flex-col gap-2 border-b border-zinc-800/50 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-6 sm:py-3">
      <div className={`flex shrink-0 items-center gap-2.5 sm:w-36 sm:shrink-0 lg:w-40 ${iconWrapClass || ''}`}>
        {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden /> : null}
        <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{label}</span>
      </div>
      <div className="min-w-0 flex-1 sm:text-left">{children}</div>
    </div>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    avatar: null,
    gender: '',
    lookingFor: [],
  })

  const [stats, setStats] = useState({
    eventsJoined: 0,
    pastMeetups: 0,
    connections: 0,
  })

  const fileInputRef = useRef(null)
  const [isSaving, setIsSaving] = useState(false)
  const [avatarBroken, setAvatarBroken] = useState(false)

  const [addresses, setAddresses] = useState([])
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [editingAddress, setEditingAddress] = useState(null)

  /** Last saved / loaded profile fields that PUT /api/profile persists — used to enable Save only when dirty. */
  const [savedSnapshot, setSavedSnapshot] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [deletingAddressId, setDeletingAddressId] = useState(null)
  const [verifyingAddressId, setVerifyingAddressId] = useState(null)

  useEffect(() => {
    const token = getAuthToken()
    const currentUser = getCurrentUser()

    if (!token) {
      setProfileLoading(false)
      navigate('/login')
      return
    }

    if (currentUser) {
      setProfileData((prev) => ({
        ...prev,
        name: currentUser.name || prev.name,
        email: currentUser.email || prev.email,
        phone: currentUser.phoneNumber || prev.phone,
      }))
    }

    const loadProfile = async () => {
      setProfileLoading(true)
      try {
        const { data } = await apiClient.get('/api/profile')
        setProfileData((prev) => {
          const next = {
            ...prev,
            name: data.name || prev.name,
            email: data.email || prev.email,
            phone: data.phoneNumber || prev.phone,
            avatar: data.profile?.avatar ?? prev.avatar,
            gender: data.profile?.gender ?? prev.gender ?? '',
            lookingFor: data.profile?.lookingFor ?? prev.lookingFor,
          }
          setSavedSnapshot({
            name: normName(next.name),
            email: normEmail(next.email),
            phone: normPhone(next.phone),
            avatar: normAvatar(next.avatar),
            gender: next.gender,
            lookingForStr: lookingForKey(next.lookingFor),
          })
          return next
        })
        if (data.stats) {
          setStats({
            eventsJoined: data.stats.eventsJoined ?? 0,
            pastMeetups: data.stats.pastMeetups ?? 0,
            connections: data.stats.connections ?? 0,
          })
        }
        if (Array.isArray(data.addresses)) {
          setAddresses(data.addresses)
        } else {
          try {
            const { data: list } = await apiClient.get('/api/addresses')
            setAddresses(Array.isArray(list) ? list : [])
          } catch (err) {
            toast.error(err.response?.data?.message || 'Could not load saved addresses')
          }
        }
        setSession({
          token,
          user: {
            _id: data._id,
            name: data.name,
            email: data.email,
            phoneNumber: data.phoneNumber,
            whatsappNumber: data.whatsappNumber,
            dateOfBirth: data.dateOfBirth,
          },
        })
      } catch {
        toast.error('Could not load profile from server')
      } finally {
        setProfileLoading(false)
      }
    }

    loadProfile()
  }, [navigate])

  useEffect(() => {
    setAvatarBroken(false)
  }, [profileData.avatar])

  const handleAddressSaved = (saved) => {
    setAddresses((prev) => {
      const idx = prev.findIndex((a) => a._id === saved._id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = saved
        return next
      }
      return [saved, ...prev]
    })
  }

  const handleVerifyAddress = async (addressId) => {
    setVerifyingAddressId(addressId)
    try {
      const { data } = await apiClient.post(`/api/addresses/${addressId}/verify`)
      if (data?.address) {
        setAddresses((prev) => prev.map((a) => (a._id === addressId ? data.address : a)))
      }
      if (data?.verified) {
        toast.success('Address verified ✓')
      } else {
        toast.error(data?.message || 'Still could not verify this address')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to verify address')
    } finally {
      setVerifyingAddressId(null)
    }
  }

  const handleDeleteAddress = async (addressId) => {
    setDeletingAddressId(addressId)
    try {
      await apiClient.delete(`/api/addresses/${addressId}`)
      setAddresses((prev) => prev.filter((a) => a._id !== addressId))
      toast.success('Address deleted')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete address')
    } finally {
      setDeletingAddressId(null)
    }
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setProfileData((prev) => ({
          ...prev,
          avatar: reader.result,
        }))
      }
      reader.readAsDataURL(file)
    }
  }

  const setGender = (value) => {
    setProfileData((prev) => ({ ...prev, gender: value }))
  }

  const handleSave = async () => {
    const token = getAuthToken()
    if (!token) {
      navigate('/login')
      return
    }

    if (!normName(profileData.name)) {
      toast.error('Please enter your name')
      return
    }
    const emailNorm = normEmail(profileData.email)
    if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      toast.error('Please enter a valid email')
      return
    }

    setIsSaving(true)
    try {
      const { data } = await apiClient.put('/api/profile', {
        name: normName(profileData.name),
        email: emailNorm,
        phoneNumber: normPhone(profileData.phone),
        profile: {
          avatar: profileData.avatar,
          gender: profileData.gender,
          lookingFor: profileData.lookingFor,
        },
      })

      setSession({
        token,
        user: {
          _id: data._id,
          name: data.name,
          email: data.email,
          phoneNumber: data.phoneNumber,
          whatsappNumber: data.whatsappNumber,
          dateOfBirth: data.dateOfBirth,
        },
      })

      const nextAvatar = data.profile?.avatar ?? profileData.avatar
      const nextGender = data.profile?.gender ?? profileData.gender
      const nextLf = data.profile?.lookingFor ?? profileData.lookingFor

      setProfileData((prev) => ({
        ...prev,
        name: data.name || prev.name,
        email: data.email || prev.email,
        phone: data.phoneNumber ?? prev.phone,
        avatar: nextAvatar,
        gender: nextGender,
        lookingFor: nextLf,
      }))
      setSavedSnapshot({
        name: normName(data.name),
        email: normEmail(data.email),
        phone: normPhone(data.phoneNumber),
        avatar: normAvatar(nextAvatar),
        gender: nextGender,
        lookingForStr: lookingForKey(nextLf),
      })

      try {
        const { data: fresh } = await apiClient.get('/api/profile')
        if (fresh.stats) {
          setStats({
            eventsJoined: fresh.stats.eventsJoined ?? 0,
            pastMeetups: fresh.stats.pastMeetups ?? 0,
            connections: fresh.stats.connections ?? 0,
          })
        }
      } catch {
        /* stats refresh optional */
      }

      toast.success('Profile saved')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = () => {
    disconnectSocket()
    clearSession()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  const inputEditable =
    'w-full rounded-xl border border-zinc-700/60 bg-zinc-950/70 px-3 py-2.5 text-left text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30'

  const hasUnsavedChanges =
    savedSnapshot !== null &&
    (normName(profileData.name) !== savedSnapshot.name ||
      normEmail(profileData.email) !== savedSnapshot.email ||
      normPhone(profileData.phone) !== savedSnapshot.phone ||
      normAvatar(profileData.avatar) !== savedSnapshot.avatar ||
      profileData.gender !== savedSnapshot.gender ||
      lookingForKey(profileData.lookingFor) !== savedSnapshot.lookingForStr)

  if (profileLoading) {
    return <ProfilePageSkeleton />
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-zinc-950 pt-20 text-zinc-100 sm:pt-24">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(99,102,241,0.14),transparent_55%)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-4xl px-3 pb-28 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-800/80 bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-400 backdrop-blur transition hover:border-zinc-700 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-900/40 shadow-2xl ring-1 ring-white/[0.06] backdrop-blur-md"
        >
          {/* Cover — social-style header */}
          <div className="relative h-36 overflow-hidden sm:h-44">
            <div
              className="absolute inset-0 bg-gradient-to-br from-indigo-600/90 via-violet-700/70 to-zinc-900"
              aria-hidden
            />
            <div
              className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M0%200h60v60H0z%22%20fill%3D%22none%22%2F%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%221.5%22%20fill%3D%22rgba%28255%2C255%2C255%2C0.06%29%22%2F%3E%3C%2Fsvg%3E')] opacity-60"
              aria-hidden
            />
            <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between sm:left-8 sm:right-8">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">Profile</p>
            </div>
          </div>

          <div className="relative px-4 pb-6 pt-0 sm:px-8">
            {/* Avatar + headline row (Instagram / Facebook style) */}
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-10">
              <div className="-mt-16 flex justify-center sm:justify-start sm:-mt-20">
                <div className="relative shrink-0">
                  <div className="relative flex h-[7.5rem] w-[7.5rem] items-center justify-center overflow-hidden rounded-full border-4 border-zinc-900 bg-zinc-900 shadow-xl ring-1 ring-zinc-700/50 sm:h-[8.5rem] sm:w-[8.5rem]">
                    {profileData.avatar && !avatarBroken ? (
                      <img
                        src={profileData.avatar}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={() => setAvatarBroken(true)}
                      />
                    ) : (
                      <span className="text-4xl font-semibold text-indigo-200 sm:text-5xl">
                        {profileData.name ? profileData.name.charAt(0).toUpperCase() : '?'}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-1 right-1 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg ring-4 ring-zinc-900 transition hover:bg-indigo-500"
                    aria-label="Change profile photo"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    ref={fileInputRef}
                  />
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-4 pt-2 sm:pt-4">
                <div className="text-center sm:text-left">
                  <h1 className="truncate text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    {profileData.name || 'Your name'}
                  </h1>
                </div>

                {/* Stats row — like posts / followers / following */}
                <div className="flex justify-center rounded-2xl border border-zinc-800/80 bg-zinc-950/50 px-2 py-3 sm:justify-start sm:px-4">
                  <StatBlock
                    value={stats.eventsJoined}
                    label="Events"
                    sublabel="Joined"
                    icon={CalendarDays}
                  />
                  <StatBlock
                    value={stats.pastMeetups}
                    label="Meetups"
                    sublabel="Past events"
                    icon={Sparkles}
                  />
                  <StatBlock
                    value={stats.connections}
                    label="Friends"
                    sublabel="People at same events"
                    icon={Users}
                  />
                </div>
              </div>
            </div>

            {/* Row-wise details (horizontal label | value); stats above stay as-is */}
            <div className="mt-8 rounded-2xl border border-zinc-800/70 bg-zinc-950/35 px-4 py-1 sm:px-6">
              <DetailRow icon={User} label="Name" iconWrapClass="text-indigo-300">
                <input
                  type="text"
                  autoComplete="name"
                  value={profileData.name}
                  onChange={(e) => setProfileData((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Your name"
                  className={`${inputEditable} w-full max-w-full sm:max-w-none`}
                />
              </DetailRow>
              <DetailRow icon={Mail} label="Email" iconWrapClass="text-violet-300">
                <input
                  type="email"
                  autoComplete="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData((p) => ({ ...p, email: e.target.value }))}
                  placeholder="you@example.com"
                  className={`${inputEditable} w-full max-w-full break-all sm:max-w-none`}
                />
              </DetailRow>
              <DetailRow icon={Phone} label="Phone" iconWrapClass="text-emerald-300">
                <input
                  type="tel"
                  autoComplete="tel"
                  value={profileData.phone}
                  onChange={(e) => setProfileData((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="Phone number"
                  className={`${inputEditable} w-full max-w-full sm:max-w-none`}
                />
              </DetailRow>
              <DetailRow icon={UserCircle2} label="Identity" iconWrapClass="text-fuchsia-300">
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: '', label: 'Prefer not to say' },
                    { id: 'male', label: 'Male' },
                    { id: 'female', label: 'Female' },
                  ].map((opt) => {
                    const active = profileData.gender === opt.id
                    return (
                      <button
                        key={opt.id || 'unset'}
                        type="button"
                        onClick={() => setGender(opt.id)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${
                          active
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40 ring-1 ring-indigo-400/30'
                            : 'border border-zinc-700/80 bg-zinc-900/80 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </DetailRow>
            </div>

            {/* Address — card list (original style) */}
            <section className="mt-8">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <MapPin className="h-4 w-4 text-indigo-400" />
                  Your addresses
                </h2>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setEditingAddress(null)
                    setShowAddressModal(true)
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add address
                </motion.button>
              </div>

              {addresses.length === 0 ? (
                <div className="mt-4 space-y-2 rounded-xl border border-dashed border-zinc-800/80 bg-zinc-950/30 py-8 px-4 text-center text-sm text-zinc-600">
                  <p>No addresses on your profile yet.</p>
                  <p className="text-xs text-zinc-500">
                    If you signed up before map verification, use &quot;Add address&quot; with a full street and city so we can
                    confirm it on the map. New signups store the address from registration here automatically.
                  </p>
                </div>
              ) : (
                <ul className="mt-4 space-y-3">
                  {addresses.map((addr) => (
                    <li
                      key={addr._id}
                      className="flex items-stretch gap-2 rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-1 sm:gap-3"
                    >
                      <a
                        href={buildAddressMapHref(addr)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 flex-1 rounded-lg px-3 py-3 text-left outline-none ring-indigo-500/0 transition hover:bg-zinc-800/50 hover:ring-1 hover:ring-indigo-500/20 focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-300">
                            {addr.label || 'Address'}
                          </span>
                          {addr.is_verified ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                              <BadgeCheck className="h-3 w-3" aria-hidden />
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                              <ShieldAlert className="h-3 w-3" aria-hidden />
                              Unverified
                            </span>
                          )}
                          <span className="text-[11px] font-medium text-emerald-400/90">Open in Maps →</span>
                        </div>
                        <p className="text-sm font-medium text-white">
                          {addr.line1}
                          {addr.line2 ? `, ${addr.line2}` : ''}
                        </p>
                        <p className="text-sm text-zinc-500">
                          {[addr.city, addr.state, addr.postalCode, addr.country].filter(Boolean).join(', ')}
                        </p>
                      </a>
                      <div className="flex shrink-0 flex-col justify-start gap-1 border-l border-zinc-800/60 pl-1 sm:flex-row sm:items-start sm:border-l-0 sm:pl-0">
                        {!addr.is_verified && (
                          <button
                            type="button"
                            disabled={verifyingAddressId === addr._id}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleVerifyAddress(addr._id)
                            }}
                            className="rounded-xl p-2 text-zinc-500 hover:bg-emerald-500/10 hover:text-emerald-300 disabled:opacity-50"
                            aria-label="Try to verify address"
                            title="Try to verify this address on the map"
                          >
                            {verifyingAddressId === addr._id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-emerald-300" aria-hidden />
                            ) : (
                              <BadgeCheck className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setEditingAddress(addr)
                            setShowAddressModal(true)
                          }}
                          className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-800 hover:text-indigo-300"
                          aria-label="Edit address"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={deletingAddressId === addr._id}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleDeleteAddress(addr._id)
                          }}
                          className="rounded-xl p-2 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-50"
                          aria-label="Delete address"
                        >
                          {deletingAddressId === addr._id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-rose-400" aria-hidden />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="mt-10 flex flex-col-reverse gap-3 border-t border-zinc-800/80 pt-8 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-700/80 bg-zinc-950/50 px-6 py-3 text-sm font-semibold text-zinc-400 transition hover:border-zinc-600 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
              <motion.button
                type="button"
                whileHover={hasUnsavedChanges && !isSaving ? { scale: 1.02 } : undefined}
                whileTap={hasUnsavedChanges && !isSaving ? { scale: 0.98 } : undefined}
                onClick={handleSave}
                disabled={isSaving || !hasUnsavedChanges}
                title={!hasUnsavedChanges && !isSaving ? 'Change your details, then save' : undefined}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-10 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/35 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSaving ? 'Saving…' : 'Save changes'}
              </motion.button>
            </div>
          </div>
        </motion.article>
      </div>

      <AddressFormModal
        isOpen={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        onSaved={handleAddressSaved}
        editAddress={editingAddress}
      />
    </div>
  )
}
