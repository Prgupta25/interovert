import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, ChevronDown } from 'lucide-react';
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

export default function CreateEventModal({ isOpen, onClose, onCreated, categories }) {
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

  // Address state
  const [addressMode, setAddressMode] = useState('new'); // 'saved' | 'new'
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [newAddress, setNewAddress] = useState(EMPTY_ADDRESS);

  // Load user's saved addresses when modal opens
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

    // Build address payload
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
      setEventData({ ...eventData, photo: reader.result });
    };
    if (file) {
      reader.readAsDataURL(file);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            className="bg-gray-900 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Create New Event</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-white">
                <X />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Photo */}
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Event Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="w-full bg-gray-800 rounded-lg p-2 text-white"
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Event Name</label>
                <input
                  type="text"
                  required
                  onChange={(e) => setEventData({ ...eventData, name: e.target.value })}
                  className="w-full bg-gray-800 rounded-lg p-2 text-white"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Description</label>
                <textarea
                  required
                  onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
                  className="w-full bg-gray-800 rounded-lg p-2 text-white h-24"
                />
              </div>

              {/* ── Address Section ── */}
              <div className="bg-gray-800 rounded-xl p-4 space-y-4 border border-gray-700">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin size={18} className="text-indigo-400" />
                  <h3 className="text-white font-semibold">Event Address</h3>
                </div>

                {/* Toggle: saved vs new */}
                <div className="flex gap-2">
                  {savedAddresses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setAddressMode('saved')}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                        addressMode === 'saved'
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      Use Saved Address
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setAddressMode('new')}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                      addressMode === 'new'
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    Enter New Address
                  </button>
                </div>

                {/* Saved address dropdown */}
                {addressMode === 'saved' && savedAddresses.length > 0 && (
                  <div className="relative">
                    <select
                      value={selectedAddressId}
                      onChange={(e) => setSelectedAddressId(e.target.value)}
                      className="w-full bg-gray-700 rounded-lg p-2 text-white appearance-none pr-8 border border-gray-600"
                    >
                      {savedAddresses.map((addr) => (
                        <option key={addr._id} value={addr._id}>
                          {addr.label ? `${addr.label} — ` : ''}{addr.formattedAddress || addr.line1}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-2 top-3 text-gray-400 pointer-events-none" />
                    {/* Preview selected address */}
                    {selectedAddressId && (() => {
                      const sel = savedAddresses.find((a) => a._id === selectedAddressId);
                      return sel?.geocode?.lat ? (
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <MapPin size={11} />
                          {sel.geocode.lat.toFixed(5)}, {sel.geocode.lng.toFixed(5)}
                        </p>
                      ) : null;
                    })()}
                  </div>
                )}

                {/* New address fields */}
                {addressMode === 'new' && (
                  <div className="space-y-3">
                    {/* Autocomplete search — fills fields below on pick */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Search &amp; autofill</label>
                      <AddressAutocomplete
                        placeholder="Type a venue or address to autofill…"
                        onSelect={(fields) =>
                          setNewAddress((prev) => ({
                            ...prev,
                            addressLine1:    fields.line1      || prev.addressLine1,
                            addressCity:     fields.city       || prev.addressCity,
                            addressState:    fields.state      || prev.addressState,
                            addressCountry:  fields.country    || prev.addressCountry,
                            addressPostalCode: fields.postalCode || prev.addressPostalCode,
                          }))
                        }
                        inputClassName="bg-gray-600 border-gray-500 focus:border-indigo-500 text-white placeholder-gray-400"
                      />
                      <p className="text-xs text-gray-500 mt-1">Pick a result to autofill, then edit below if needed.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">
                          Label <span className="text-gray-500">(e.g. Venue)</span>
                        </label>
                        <input
                          type="text"
                          value={newAddress.addressLabel}
                          onChange={setAddr('addressLabel')}
                          placeholder="Event Venue"
                          className="w-full bg-gray-700 rounded-lg p-2 text-white text-sm border border-gray-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">
                          Postal Code
                        </label>
                        <input
                          type="text"
                          value={newAddress.addressPostalCode}
                          onChange={setAddr('addressPostalCode')}
                          placeholder="400001"
                          className="w-full bg-gray-700 rounded-lg p-2 text-white text-sm border border-gray-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Street Address <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required={addressMode === 'new'}
                        value={newAddress.addressLine1}
                        onChange={setAddr('addressLine1')}
                        placeholder="123 MG Road"
                        className="w-full bg-gray-700 rounded-lg p-2 text-white text-sm border border-gray-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Floor / Landmark <span className="text-gray-500">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={newAddress.addressLine2}
                        onChange={setAddr('addressLine2')}
                        placeholder="Near City Mall"
                        className="w-full bg-gray-700 rounded-lg p-2 text-white text-sm border border-gray-600"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">
                          City <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          required={addressMode === 'new'}
                          value={newAddress.addressCity}
                          onChange={setAddr('addressCity')}
                          placeholder="Mumbai"
                          className="w-full bg-gray-700 rounded-lg p-2 text-white text-sm border border-gray-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">State</label>
                        <input
                          type="text"
                          value={newAddress.addressState}
                          onChange={setAddr('addressState')}
                          placeholder="Maharashtra"
                          className="w-full bg-gray-700 rounded-lg p-2 text-white text-sm border border-gray-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Country</label>
                        <input
                          type="text"
                          value={newAddress.addressCountry}
                          onChange={setAddr('addressCountry')}
                          placeholder="India"
                          className="w-full bg-gray-700 rounded-lg p-2 text-white text-sm border border-gray-600"
                        />
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPin size={11} />
                      Geocoordinates will be auto-detected from the address
                    </p>
                  </div>
                )}
              </div>

              {/* Date & Time */}
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  onChange={(e) => setEventData({ ...eventData, datetime: e.target.value })}
                  className="w-full bg-gray-800 rounded-lg p-2 text-white"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Category</label>
                <select
                  required
                  onChange={(e) => setEventData({ ...eventData, category: e.target.value })}
                  className="w-full bg-gray-800 rounded-lg p-2 text-white"
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              {eventData.category === 'Other' && (
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Specify Other Category</label>
                  <input
                    type="text"
                    required
                    onChange={(e) => setOtherCategory(e.target.value)}
                    className="w-full bg-gray-800 rounded-lg p-2 text-white"
                  />
                </div>
              )}

              {/* Activities */}
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">What will we do?</label>
                <textarea
                  required
                  onChange={(e) => setEventData({ ...eventData, activities: e.target.value })}
                  className="w-full bg-gray-800 rounded-lg p-2 text-white h-24"
                />
              </div>

              {/* Max Attendees */}
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Maximum Attendees</label>
                <input
                  type="number"
                  required
                  onChange={(e) => setEventData({ ...eventData, maxAttendees: e.target.value })}
                  className="w-full bg-gray-800 rounded-lg p-2 text-white"
                />
              </div>

              {/* About You */}
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Something crazy about you</label>
                <textarea
                  required
                  onChange={(e) => setEventData({ ...eventData, aboutYou: e.target.value })}
                  className="w-full bg-gray-800 rounded-lg p-2 text-white"
                />
              </div>

              {/* Expectations */}
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">What to expect?</label>
                <textarea
                  required
                  onChange={(e) => setEventData({ ...eventData, expectations: e.target.value })}
                  className="w-full bg-gray-800 rounded-lg p-2 text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 text-white rounded-lg py-2 px-4 hover:bg-indigo-700 transition-colors"
              >
                Create Event
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
