import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function EventCard({ event }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className="bg-gray-800 rounded-xl overflow-hidden"
    >
      <img
        src={event.photo || '/placeholder.svg?height=200&width=400'}
        alt={event.name}
        className="w-full h-48 object-cover"
      />
      <div className="p-4">
        <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
          <Calendar size={16} />
          {new Date(event.datetime).toLocaleDateString()}
        </div>
        <h3 className="text-xl font-semibold mb-2">{event.name}</h3>
        <p className="text-sm text-indigo-300 mb-2">Event Creator: {event.eventCreatorLabel}</p>
        <div className="flex items-center gap-2 text-gray-400 text-sm mb-4">
          <MapPin size={16} />
          {event.venue}
        </div>
        <p className="text-xs text-gray-400 mb-3">Participants: {event.participantCount || 0}</p>
        <p className="text-gray-300 mb-4 line-clamp-2">{event.description}</p>
        <Link
          to={`/event/${event._id}`}
          className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Read More
        </Link>
      </div>
    </motion.div>
  );
}
