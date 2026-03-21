import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, MapPin, Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import apiClient from '../services/apiClient'
import AddressAutocomplete from './AddressAutocomplete'

const EMPTY_FORM = {
  label: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
}

/**
 * AddressFormModal
 * Props:
 *   isOpen       – boolean
 *   onClose      – () => void
 *   onSaved      – (address) => void   called after successful save
 *   editAddress  – address object to pre-fill when editing (null = create mode)
 */
export default function AddressFormModal({ isOpen, onClose, onSaved, editAddress = null }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)

  // Pre-fill form when editing
  useEffect(() => {
    if (editAddress) {
      setForm({
        label: editAddress.label || '',
        line1: editAddress.line1 || '',
        line2: editAddress.line2 || '',
        city: editAddress.city || '',
        state: editAddress.state || '',
        country: editAddress.country || '',
        postalCode: editAddress.postalCode || '',
      })
    } else {
      setForm(EMPTY_FORM)
    }
  }, [editAddress, isOpen])

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.line1.trim() || !form.city.trim()) {
      toast.error('Street address and city are required')
      return
    }
    setIsSaving(true)
    try {
      let data
      if (editAddress?._id) {
        const res = await apiClient.put(`/api/addresses/${editAddress._id}`, form)
        data = res.data.address
        toast.success('Address updated')
      } else {
        const res = await apiClient.post('/api/addresses', form)
        data = res.data.address
        toast.success('Address saved')
      }
      onSaved(data)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save address')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-gray-900 rounded-xl p-6 w-full max-w-lg shadow-2xl"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2">
                <MapPin size={20} className="text-indigo-400" />
                <h2 className="text-xl font-bold text-white">
                  {editAddress ? 'Edit Address' : 'Add New Address'}
                </h2>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Autocomplete search — fills fields below on selection */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Search &amp; autofill
                </label>
                <AddressAutocomplete
                  onSelect={(fields) =>
                    setForm((prev) => ({
                      ...prev,
                      line1:      fields.line1      || prev.line1,
                      city:       fields.city       || prev.city,
                      state:      fields.state      || prev.state,
                      country:    fields.country    || prev.country,
                      postalCode: fields.postalCode || prev.postalCode,
                    }))
                  }
                  inputClassName="bg-gray-800 border-gray-700 focus:border-indigo-500 text-white placeholder-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Pick a suggestion to fill the fields below, then edit as needed.
                </p>
              </div>

              {/* Label */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Label <span className="text-gray-500">(e.g. Home, Work, Venue)</span>
                </label>
                <input
                  type="text"
                  value={form.label}
                  onChange={set('label')}
                  placeholder="Home"
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white border border-gray-700 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Line 1 */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Street Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.line1}
                  onChange={set('line1')}
                  placeholder="123 Main Street"
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white border border-gray-700 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Line 2 */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Apartment / Floor <span className="text-gray-500">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.line2}
                  onChange={set('line2')}
                  placeholder="Apt 4B"
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white border border-gray-700 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* City */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    City <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.city}
                    onChange={set('city')}
                    placeholder="Mumbai"
                    className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white border border-gray-700 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {/* State */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">State</label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={set('state')}
                    placeholder="Maharashtra"
                    className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white border border-gray-700 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Country */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Country</label>
                  <input
                    type="text"
                    value={form.country}
                    onChange={set('country')}
                    placeholder="India"
                    className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white border border-gray-700 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Postal Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Postal Code</label>
                  <input
                    type="text"
                    value={form.postalCode}
                    onChange={set('postalCode')}
                    placeholder="400001"
                    className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white border border-gray-700 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500 flex items-center gap-1">
                <MapPin size={12} />
                Coordinates will be auto-detected from your address
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg py-2 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg py-2 flex items-center justify-center gap-2 transition-colors"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Saving…
                    </>
                  ) : (
                    editAddress ? 'Update Address' : 'Save Address'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
