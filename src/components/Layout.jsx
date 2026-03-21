import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle } from 'lucide-react'
import Navbar from './Navbar'
import { Outlet, useLocation } from 'react-router-dom'
import Footer from './Footer'
import ChatBot from './Chatbot'

function Layout() {
  const [aiOpen, setAiOpen] = useState(false)
  const { pathname } = useLocation()
  const showAiFab = pathname !== '/chatbot'

  useEffect(() => {
    if (pathname === '/chatbot') setAiOpen(false)
  }, [pathname])

  return (
    <>
      <Navbar />
      <Outlet />
      <Footer />

      {showAiFab && (
      <motion.button
        type="button"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-900/50 ring-2 ring-white/10"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        aria-label={aiOpen ? 'Close AI assistant' : 'Open AI assistant'}
        aria-expanded={aiOpen}
        onClick={() => setAiOpen((o) => !o)}
      >
        <MessageCircle className="h-6 w-6" />
      </motion.button>
      )}

      <AnimatePresence>
        {showAiFab && aiOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="fixed bottom-24 right-6 z-50 w-[min(100vw-2rem,400px)]"
          >
            <ChatBot onClose={() => setAiOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default Layout
