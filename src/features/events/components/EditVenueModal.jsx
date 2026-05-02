import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, X, Loader2, Repeat2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '../../../services/apiClient';
import AddressAutocomplete from '../../../components/AddressAutocomplete';
import AddressValidator from './AddressValidator';
import SimilarEventsAtVenue from './SimilarEventsAtVenue';

const EMPTY = {
  addressLabel: '',
  addressLine1: '',
  addressLine2: '',
  addressCity: '',
  addressState: '',
  addressCountry: '',
  addressPostalCode: '',
};

const inputBase =
  'w-full rounded-xl border border-zinc-700/80 bg-zinc-900/70 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500/60 focus:outline-none focus:ring-2 focus:ring-violet-500/25';
const labelBase =
  'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500';

/**
 * EditVenueModal — lets the host swap the venue of a single event (typically
 * one occurrence of a recurring series). The backend automatically forks the
 * Address doc when this event shares its address with sibling occurrences,
 * so changing one occurrence does not affect the rest of the series.
 *
 * Props:
 *   isOpen       boolean
 *   onClose      () => void
 *   event        full event object (must include _id, address, recurrence)
 *   onUpdated    (updatedEvent) => void
 */
export default function EditVenueModal({ isOpen, onClose, event, onUpdated }) {
  const [form, setForm] = useState(EMPTY);
  const [validatedGeocode, setValidatedGeocode] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const isRecurring = Boolean(event?.recurrence?.enabled || event?.recurrenceEnabled);
  const occurrenceIndex = event?.recurrence?.occurrenceIndex ?? 0;

  useEffect(() => {
    if (!isOpen || !event) return;
    const a = event.address || {};
    setForm({
      addressLabel: a.label || '',
      addressLine1: a.line1 || '',
      addressLine2: a.line2 || '',
      addressCity: a.city || '',
      addressState: a.state || '',
      addressCountry: a.country || '',
      addressPostalCode: a.postalCode || '',
    });
    setValidatedGeocode(null);
  }, [isOpen, event]);

  const setField = (key) => (e) => {
    setForm((p) => ({ ...p, [key]: e.target.value }));
    setValidatedGeocode(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!event?._id) return;
    if (!form.addressLine1.trim() || !form.addressCity.trim()) {
      toast.error('Street address and city are required');
      return;
    }
    if (!validatedGeocode) {
      toast.error('Please validate the new address before saving.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await apiClient.put(`/api/events/${event._id}`, {
        ...form,
        geocodeOverride: { lat: validatedGeocode.lat, lng: validatedGeocode.lng },
      });
      toast.success(
        isRecurring
          ? 'Venue updated for this occurrence'
          : 'Venue updated'
      );
      onUpdated?.(data.event || null);
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not update venue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-zinc-950/75 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-venue-title"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="relative z-10 flex max-h-[min(92vh,860px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-zinc-700/70 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black shadow-2xl [color-scheme:dark]"
          >
            <header className="shrink-0 border-b border-zinc-800/90 bg-zinc-900/40 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                    <MapPin className="h-3 w-3" />
                    Change venue
                  </div>
                  <h2 id="edit-venue-title" className="text-xl font-bold tracking-tight text-white">
                    Update event location
                  </h2>
                  {isRecurring && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-violet-200/80">
                      <Repeat2 className="h-3.5 w-3.5" />
                      Recurring series · only occurrence #{occurrenceIndex + 1} will move.
                      Other occurrences keep their current venue.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-zinc-700/80 bg-zinc-800/50 p-2 text-zinc-400 transition-colors hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 [scrollbar-width:thin]">
                <div className="space-y-4">
                  <div>
                    <label className={labelBase}>Search & autofill</label>
                    <AddressAutocomplete
                      placeholder="Type a venue or address…"
                      onSelect={(fields) => {
                        setForm((p) => ({
                          ...p,
                          addressLine1: fields.line1 || p.addressLine1,
                          addressCity: fields.city || p.addressCity,
                          addressState: fields.state || p.addressState,
                          addressCountry: fields.country || p.addressCountry,
                          addressPostalCode: fields.postalCode || p.addressPostalCode,
                        }));
                        setValidatedGeocode(null);
                      }}
                      inputClassName="border-zinc-600/90 bg-zinc-900/80 text-zinc-100 placeholder-zinc-500 focus:border-violet-500/70"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelBase}>Label</label>
                      <input
                        type="text"
                        value={form.addressLabel}
                        onChange={setField('addressLabel')}
                        placeholder="Venue name"
                        className={inputBase}
                      />
                    </div>
                    <div>
                      <label className={labelBase}>Postal code</label>
                      <input
                        type="text"
                        value={form.addressPostalCode}
                        onChange={setField('addressPostalCode')}
                        placeholder="400001"
                        className={inputBase}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelBase}>Street address *</label>
                    <input
                      type="text"
                      required
                      value={form.addressLine1}
                      onChange={setField('addressLine1')}
                      placeholder="123 MG Road"
                      className={inputBase}
                    />
                  </div>

                  <div>
                    <label className={labelBase}>Floor / landmark</label>
                    <input
                      type="text"
                      value={form.addressLine2}
                      onChange={setField('addressLine2')}
                      placeholder="Near City Mall"
                      className={inputBase}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className={labelBase}>City *</label>
                      <input
                        type="text"
                        required
                        value={form.addressCity}
                        onChange={setField('addressCity')}
                        placeholder="Mumbai"
                        className={inputBase}
                      />
                    </div>
                    <div>
                      <label className={labelBase}>State</label>
                      <input
                        type="text"
                        value={form.addressState}
                        onChange={setField('addressState')}
                        placeholder="Maharashtra"
                        className={inputBase}
                      />
                    </div>
                    <div>
                      <label className={labelBase}>Country</label>
                      <input
                        type="text"
                        value={form.addressCountry}
                        onChange={setField('addressCountry')}
                        placeholder="India"
                        className={inputBase}
                      />
                    </div>
                  </div>

                  <AddressValidator
                    addressFields={{
                      line1: form.addressLine1,
                      line2: form.addressLine2,
                      city: form.addressCity,
                      state: form.addressState,
                      postalCode: form.addressPostalCode,
                      country: form.addressCountry,
                    }}
                    onResolved={(g) => setValidatedGeocode(g)}
                    onCleared={() => setValidatedGeocode(null)}
                  />

                  {validatedGeocode && (
                    <SimilarEventsAtVenue
                      lat={validatedGeocode.lat}
                      lng={validatedGeocode.lng}
                      startDatetime={event?.datetime}
                      endDatetime={event?.endDatetime}
                      excludeEventId={event?._id}
                    />
                  )}
                </div>
              </div>

              <footer className="shrink-0 border-t border-zinc-800/90 bg-zinc-950/90 px-6 py-4">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-200 transition-colors hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !validatedGeocode}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-950/40 transition hover:from-violet-500 hover:to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                    {submitting ? 'Saving…' : 'Save venue'}
                  </button>
                </div>
              </footer>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
