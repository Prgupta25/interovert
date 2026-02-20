import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '../../../services/apiClient';
import { getAuthToken } from '../../../utils/session';

export default function CreateEventModal({ isOpen, onClose, onCreated, categories }) {
  const [eventData, setEventData] = useState({
    photo: '',
    name: '',
    description: '',
    venue: '',
    datetime: '',
    category: '',
    activities: '',
    maxAttendees: '',
    aboutYou: '',
    expectations: '',
  });
  const [otherCategory, setOtherCategory] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = getAuthToken();
    if (!token) {
      toast.error('Please login first to create an event.');
      return;
    }

    try {
      await apiClient.post('/api/events', {
        ...eventData,
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
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Event Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="w-full bg-gray-800 rounded-lg p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Event Name</label>
                <input
                  type="text"
                  required
                  onChange={(e) => setEventData({ ...eventData, name: e.target.value })}
                  className="w-full bg-gray-800 rounded-lg p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Description</label>
                <textarea
                  required
                  onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
                  className="w-full bg-gray-800 rounded-lg p-2 text-white h-24"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Venue</label>
                  <input
                    type="text"
                    required
                    onChange={(e) => setEventData({ ...eventData, venue: e.target.value })}
                    className="w-full bg-gray-800 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    onChange={(e) => setEventData({ ...eventData, datetime: e.target.value })}
                    className="w-full bg-gray-800 rounded-lg p-2 text-white"
                  />
                </div>
              </div>
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
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">What will we do?</label>
                <textarea
                  required
                  onChange={(e) => setEventData({ ...eventData, activities: e.target.value })}
                  className="w-full bg-gray-800 rounded-lg p-2 text-white h-24"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Maximum Attendees</label>
                <input
                  type="number"
                  required
                  onChange={(e) => setEventData({ ...eventData, maxAttendees: e.target.value })}
                  className="w-full bg-gray-800 rounded-lg p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Something crazy about you</label>
                <textarea
                  required
                  onChange={(e) => setEventData({ ...eventData, aboutYou: e.target.value })}
                  className="w-full bg-gray-800 rounded-lg p-2 text-white"
                />
              </div>
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
