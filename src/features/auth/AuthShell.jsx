import React from 'react';
import { motion } from 'framer-motion';

export default function AuthShell({ imageSrc, imageAlt, title, children, footer }) {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col md:flex-row">
      <div className="md:w-1/2 bg-indigo-600">
        <img
          src={imageSrc}
          alt={imageAlt}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="md:w-1/2 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <h2 className="text-3xl font-bold text-white mb-6 text-center">{title}</h2>
          {children}
          {footer}
        </motion.div>
      </div>
    </div>
  );
}
