import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  MapPin,
  ChevronDown,
  Sparkles,
  ImagePlus,
  Calendar,
  Tag,
  Users,
  AlignLeft,
  PartyPopper,
  Repeat2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '../../../services/apiClient';
import { getAuthToken } from '../../../utils/session';
import AddressAutocomplete from '../../../components/AddressAutocomplete';

const EMPTY_ADDRESS = {
  addressLabel: '',
  addressLine1: '',
  addressLine2: '',
  addressCity: '',
  addressState: '',
  addressCountry: '',
  addressPostalCode: '',
};

const inputBase =
  'w-full rounded-xl border border-zinc-700/80 bg-zinc-900/70 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 shadow-inner shadow-black/20 transition-[border-color,box-shadow] focus:border-violet-500/60 focus:outline-none focus:ring-2 focus:ring-violet-500/25';

const labelBase =
  'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500';

const sectionTitle =
  'flex items-center gap-2 text-sm font-semibold text-zinc-100';

function FormSection({ icon: Icon, title, hint, children }) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className={sectionTitle}>
          {Icon && <Icon className="h-4 w-4 text-violet-400" strokeWidth={2} />}
          {title}
        </h3>
        {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function CreateEventModal({ isOpen, onClose, onCreated, categories }) {
  const fileInputRef = useRef(null);
  const [eventData, setEventData] = useState({
    photo: '',
    name: '',
    description: '',
    datetime: '',
    category: '',
    activities: '',
    maxAttendees: '',
    aboutYou: '',
    expectations: '',
  });
  const [otherCategory, setOtherCategory] = useState('');

  // Recurrence state
  const [recurrenceEnabled, setRecurrenceEnabled]   = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState('weekly');
  const [recurrenceEndAfter, setRecurrenceEndAfter]   = useState('');

  const [addressMode, setAddressMode] = useState('new');
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [newAddress, setNewAddress] = useState(EMPTY_ADDRESS);

  useEffect(() => {
    if (!isOpen) return;
    const token = getAuthToken();
    if (!token) return;
    apiClient
      .get('/api/addresses')
      .then(({ data }) => {
        setSavedAddresses(data || []);
        if (data && data.length > 0) {
          setAddressMode('saved');
          setSelectedAddressId(data[0]._id);
        } else {
          setAddressMode('new');
        }
      })
      .catch(() => {
        setAddressMode('new');
      });
  }, [isOpen]);

  const setAddr = (field) => (e) =>
    setNewAddress((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = getAuthToken();
    if (!token) {
      toast.error('Please login first to create an event.');
      return;
    }

    let addressPayload = {};
    if (addressMode === 'saved' && selectedAddressId) {
      addressPayload = { addressId: selectedAddressId };
    } else {
      if (!newAddress.addressLine1.trim() || !newAddress.addressCity.trim()) {
        toast.error('Street address and city are required');
        return;
      }
      addressPayload = { ...newAddress };
    }

    try {
      await apiClient.post('/api/events', {
        ...eventData,
        ...addressPayload,
        category: eventData.category === 'Other' ? otherCategory : eventData.category,
        recurrenceEnabled,
        recurrenceFrequency,
        recurrenceEndAfter: recurrenceEndAfter ? Number(recurrenceEndAfter) : null,
      });
      toast.success('Event created successfully');
      onCreated();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error in creating event');
    }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      setEventData((prev) => ({ ...prev, photo: reader.result }));
    };
    if (file) {
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const scrollAreaClass =
    'flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-6 [scrollbar-width:thin] [scrollbar-color:rgba(139,92,246,0.35)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-violet-500/30 [&::-webkit-scrollbar-track]:bg-transparent';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        >
          <button
            type="button"
            aria-label="Close modal"
            className="absolute inset-0 bg-zinc-950/75 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-event-title"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="relative z-10 flex max-h-[min(92vh,880px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-700/70 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black shadow-2xl shadow-violet-950/30 [color-scheme:dark]"
          >
            {/* Header */}
            <header className="shrink-0 border-b border-zinc-800/90 bg-zinc-900/40 px-6 py-5 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                    <Sparkles className="h-3 w-3" />
                    New event
                  </div>
                  <h2
                    id="create-event-title"
                    className="text-xl font-bold tracking-tight text-white sm:text-2xl"
                  >
                    Create New Event
                  </h2>
                  <p className="mt-1 max-w-md text-sm text-zinc-400">
                    Share the essentials—photo, time, and place—so people know what they&apos;re joining.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-zinc-700/80 bg-zinc-800/50 p-2 text-zinc-400 transition-colors hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
                >
                  <X className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>
            </header>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className={scrollAreaClass}>
                <div className="space-y-10 pb-2">
                  {/* Cover image */}
                  <FormSection
                    icon={ImagePlus}
                    title="Cover image"
                    hint="A strong visual helps your event stand out in the feed."
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handlePhotoUpload}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="group relative flex w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-violet-500/35 bg-gradient-to-br from-violet-950/40 via-zinc-900/60 to-zinc-950 px-6 py-10 text-center transition-all hover:border-violet-400/50 hover:from-violet-900/30 hover:shadow-[0_0_40px_-12px_rgba(139,92,246,0.45)]"
                    >
                      {eventData.photo ? (
                        <>
                          <img
                            src={eventData.photo}
                            alt="Event preview"
                            className="absolute inset-0 h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-70"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                          <span className="relative z-10 flex items-center gap-2 rounded-full border border-white/20 bg-black/50 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
                            <ImagePlus className="h-4 w-4" />
                            Change image
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 ring-1 ring-violet-400/30">
                            <ImagePlus className="h-7 w-7 text-violet-300" />
                          </div>
                          <p className="text-sm font-medium text-zinc-200">
                            Click to upload or drag isn&apos;t available—tap to choose
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            PNG, JPG or WebP · recommended 16:9
                          </p>
                        </>
                      )}
                    </button>
                  </FormSection>

                  {/* Basics */}
                  <FormSection
                    icon={AlignLeft}
                    title="Basics"
                    hint="Name and description appear on the event card and detail page."
                  >
                    <div>
                      <label className={labelBase} htmlFor="ce-name">
                        Event name
                      </label>
                      <input
                        id="ce-name"
                        type="text"
                        required
                        placeholder="e.g. Weekend board game night"
                        onChange={(e) =>
                          setEventData((prev) => ({ ...prev, name: e.target.value }))
                        }
                        className={inputBase}
                      />
                    </div>
                    <div>
                      <label className={labelBase} htmlFor="ce-desc">
                        Description
                      </label>
                      <textarea
                        id="ce-desc"
                        required
                        rows={4}
                        placeholder="What is this about? Who should come?"
                        onChange={(e) =>
                          setEventData((prev) => ({ ...prev, description: e.target.value }))
                        }
                        className={`${inputBase} min-h-[6.5rem] resize-y`}
                      />
                    </div>
                  </FormSection>

                  {/* Address */}
                  <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/35 p-5 ring-1 ring-white/[0.04] backdrop-blur-sm">
                    <div className="mb-4 flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/25">
                        <MapPin className="h-4 w-4" strokeWidth={2} />
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-white">Location</h3>
                        <p className="text-xs text-zinc-500">Where will people meet?</p>
                      </div>
                    </div>

                    <div className="mb-4 flex gap-2 rounded-xl bg-zinc-950/60 p-1 ring-1 ring-zinc-800/80">
                      {savedAddresses.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setAddressMode('saved')}
                          className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all sm:text-sm ${
                            addressMode === 'saved'
                              ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-900/40'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          Saved address
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setAddressMode('new')}
                        className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all sm:text-sm ${
                          addressMode === 'new'
                            ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-900/40'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        New address
                      </button>
                    </div>

                    {addressMode === 'saved' && savedAddresses.length > 0 && (
                      <div className="relative">
                        <label className={labelBase}>Pick address</label>
                        <select
                          value={selectedAddressId}
                          onChange={(e) => setSelectedAddressId(e.target.value)}
                          className={`${inputBase} cursor-pointer appearance-none pr-10`}
                        >
                          {savedAddresses.map((addr) => (
                            <option key={addr._id} value={addr._id}>
                              {addr.label ? `${addr.label} — ` : ''}
                              {addr.formattedAddress || addr.line1}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={18}
                          className="pointer-events-none absolute right-3 top-[2.125rem] text-zinc-500"
                        />
                        {selectedAddressId &&
                          (() => {
                            const sel = savedAddresses.find((a) => a._id === selectedAddressId);
                            return sel?.geocode?.lat ? (
                              <p className="mt-1.5 flex items-center gap-1 text-xs text-zinc-500">
                                <MapPin size={11} className="text-violet-400/80" />
                                {sel.geocode.lat.toFixed(5)}, {sel.geocode.lng.toFixed(5)}
                              </p>
                            ) : null;
                          })()}
                      </div>
                    )}

                    {addressMode === 'new' && (
                      <div className="space-y-4">
                        <div>
                          <label className={labelBase}>Search &amp; autofill</label>
                          <AddressAutocomplete
                            placeholder="Type a venue or address…"
                            onSelect={(fields) =>
                              setNewAddress((prev) => ({
                                ...prev,
                                addressLine1: fields.line1 || prev.addressLine1,
                                addressCity: fields.city || prev.addressCity,
                                addressState: fields.state || prev.addressState,
                                addressCountry: fields.country || prev.addressCountry,
                                addressPostalCode: fields.postalCode || prev.addressPostalCode,
                              }))
                            }
                            inputClassName="border-zinc-600/90 bg-zinc-900/80 text-zinc-100 placeholder-zinc-500 focus:border-violet-500/70"
                          />
                          <p className="mt-1.5 text-xs text-zinc-500">
                            Choose a suggestion to fill fields—you can still edit everything below.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label className={labelBase}>
                              Label <span className="font-normal normal-case text-zinc-600">(e.g. venue)</span>
                            </label>
                            <input
                              type="text"
                              value={newAddress.addressLabel}
                              onChange={setAddr('addressLabel')}
                              placeholder="Event venue"
                              className={inputBase}
                            />
                          </div>
                          <div>
                            <label className={labelBase}>Postal code</label>
                            <input
                              type="text"
                              value={newAddress.addressPostalCode}
                              onChange={setAddr('addressPostalCode')}
                              placeholder="400001"
                              className={inputBase}
                            />
                          </div>
                        </div>

                        <div>
                          <label className={labelBase}>
                            Street address <span className="text-rose-400/90">*</span>
                          </label>
                          <input
                            type="text"
                            required={addressMode === 'new'}
                            value={newAddress.addressLine1}
                            onChange={setAddr('addressLine1')}
                            placeholder="123 MG Road"
                            className={inputBase}
                          />
                        </div>

                        <div>
                          <label className={labelBase}>
                            Floor / landmark{' '}
                            <span className="font-normal normal-case text-zinc-600">(optional)</span>
                          </label>
                          <input
                            type="text"
                            value={newAddress.addressLine2}
                            onChange={setAddr('addressLine2')}
                            placeholder="Near City Mall"
                            className={inputBase}
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <div className="sm:col-span-1">
                            <label className={labelBase}>
                              City <span className="text-rose-400/90">*</span>
                            </label>
                            <input
                              type="text"
                              required={addressMode === 'new'}
                              value={newAddress.addressCity}
                              onChange={setAddr('addressCity')}
                              placeholder="Mumbai"
                              className={inputBase}
                            />
                          </div>
                          <div>
                            <label className={labelBase}>State</label>
                            <input
                              type="text"
                              value={newAddress.addressState}
                              onChange={setAddr('addressState')}
                              placeholder="Maharashtra"
                              className={inputBase}
                            />
                          </div>
                          <div>
                            <label className={labelBase}>Country</label>
                            <input
                              type="text"
                              value={newAddress.addressCountry}
                              onChange={setAddr('addressCountry')}
                              placeholder="India"
                              className={inputBase}
                            />
                          </div>
                        </div>

                        <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                          <MapPin size={12} className="shrink-0 text-violet-400/70" />
                          Coordinates are detected automatically from this address.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Schedule & category */}
                  <FormSection
                    icon={Calendar}
                    title="When & category"
                    hint="Attendees use this to plan their calendar."
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className={labelBase} htmlFor="ce-dt">
                          Date & time
                        </label>
                        <input
                          id="ce-dt"
                          type="datetime-local"
                          required
                          onChange={(e) =>
                            setEventData((prev) => ({ ...prev, datetime: e.target.value }))
                          }
                          className={inputBase}
                        />
                      </div>
                      <div>
                        <label className={labelBase} htmlFor="ce-cat">
                          Category
                        </label>
                        <div className="relative">
                          <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-400/80" />
                          <select
                            id="ce-cat"
                            required
                            onChange={(e) =>
                              setEventData((prev) => ({ ...prev, category: e.target.value }))
                            }
                            className={`${inputBase} cursor-pointer appearance-none pl-10 pr-10`}
                          >
                            <option value="">Select category</option>
                            {categories.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={18}
                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
                          />
                        </div>
                      </div>
                    </div>
                    {eventData.category === 'Other' && (
                      <div>
                        <label className={labelBase} htmlFor="ce-other">
                          Specify category
                        </label>
                        <input
                          id="ce-other"
                          type="text"
                          required
                          placeholder="Your custom category"
                          onChange={(e) => setOtherCategory(e.target.value)}
                          className={inputBase}
                        />
                      </div>
                    )}
                  </FormSection>

                  {/* Recurring */}
                  <FormSection
                    icon={Repeat2}
                    title="Recurring event"
                    hint="Auto-create the next occurrence once this one passes."
                  >
                    {/* Toggle */}
                    <button
                      type="button"
                      onClick={() => setRecurrenceEnabled((v) => !v)}
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 transition-all ${
                        recurrenceEnabled
                          ? 'border-violet-500/50 bg-violet-500/10 ring-1 ring-violet-500/25'
                          : 'border-zinc-700/80 bg-zinc-900/50'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                        <Repeat2 className={`h-4 w-4 ${recurrenceEnabled ? 'text-violet-400' : 'text-zinc-500'}`} />
                        Make this a recurring event
                      </span>
                      {/* pill toggle */}
                      <span
                        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                          recurrenceEnabled ? 'bg-violet-600' : 'bg-zinc-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            recurrenceEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </span>
                    </button>

                    {/* Options — only visible when enabled */}
                    {recurrenceEnabled && (
                      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* Frequency */}
                        <div>
                          <label className={labelBase}>Repeat every</label>
                          <div className="flex gap-2">
                            {['weekly', 'monthly'].map((freq) => (
                              <button
                                key={freq}
                                type="button"
                                onClick={() => setRecurrenceFrequency(freq)}
                                className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize transition-all ${
                                  recurrenceFrequency === freq
                                    ? 'bg-violet-600 text-white shadow-md shadow-violet-900/40'
                                    : 'bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700 hover:text-zinc-200'
                                }`}
                              >
                                {freq === 'weekly' ? '📅 Week' : '🗓️ Month'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* End after N occurrences */}
                        <div>
                          <label className={labelBase}>
                            End after{' '}
                            <span className="font-normal normal-case text-zinc-600">(optional)</span>
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min={2}
                              max={52}
                              placeholder="e.g. 8"
                              value={recurrenceEndAfter}
                              onChange={(e) => setRecurrenceEndAfter(e.target.value)}
                              className={inputBase}
                            />
                            {recurrenceEndAfter && (
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                                occurrences
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-zinc-600">
                            Leave blank to repeat indefinitely
                          </p>
                        </div>
                      </div>
                    )}
                  </FormSection>

                  {/* Experience */}
                  <FormSection
                    icon={PartyPopper}
                    title="The experience"
                    hint="Help people imagine the vibe and what they'll do together."
                  >
                    <div>
                      <label className={labelBase} htmlFor="ce-act">
                        What will we do?
                      </label>
                      <textarea
                        id="ce-act"
                        required
                        rows={3}
                        placeholder="Games, walk, workshop…"
                        onChange={(e) =>
                          setEventData((prev) => ({ ...prev, activities: e.target.value }))
                        }
                        className={`${inputBase} resize-y`}
                      />
                    </div>
                    <div>
                      <label className={labelBase} htmlFor="ce-max">
                        Maximum attendees
                      </label>
                      <div className="relative">
                        <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-400/80" />
                        <input
                          id="ce-max"
                          type="number"
                          required
                          min={1}
                          placeholder="20"
                          onChange={(e) =>
                            setEventData((prev) => ({ ...prev, maxAttendees: e.target.value }))
                          }
                          className={`${inputBase} pl-10`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelBase} htmlFor="ce-about">
                        Something fun about you
                      </label>
                      <textarea
                        id="ce-about"
                        required
                        rows={3}
                        placeholder="Host intro—keeps things human"
                        onChange={(e) =>
                          setEventData((prev) => ({ ...prev, aboutYou: e.target.value }))
                        }
                        className={`${inputBase} resize-y`}
                      />
                    </div>
                    <div>
                      <label className={labelBase} htmlFor="ce-exp">
                        What to expect?
                      </label>
                      <textarea
                        id="ce-exp"
                        required
                        rows={3}
                        placeholder="Duration, cost, accessibility, what to bring…"
                        onChange={(e) =>
                          setEventData((prev) => ({ ...prev, expectations: e.target.value }))
                        }
                        className={`${inputBase} resize-y`}
                      />
                    </div>
                  </FormSection>
                </div>
              </div>

              {/* Footer CTA */}
              <footer className="shrink-0 border-t border-zinc-800/90 bg-zinc-950/90 px-6 py-4 backdrop-blur-md">
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-violet-500 to-fuchsia-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/40 transition-[transform,box-shadow] hover:from-violet-500 hover:via-violet-500 hover:to-fuchsia-500 hover:shadow-violet-900/50 active:scale-[0.99]"
                >
                  <Sparkles className="h-4 w-4" />
                  Publish event
                </button>
              </footer>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
