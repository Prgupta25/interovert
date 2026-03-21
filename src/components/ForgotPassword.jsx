'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft } from 'lucide-react'
import { toast } from 'react-hot-toast'
import apiClient from '../services/apiClient'
import AuthShell from '../features/auth/AuthShell'
import d1 from '../assets/images/b3.jpg'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [devLink, setDevLink] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setDevLink('')
    try {
      const { data } = await apiClient.post('/api/forgot-password', { email: email.trim() })
      toast.success(data?.message || 'Check your email')
      if (data?.devResetUrl) {
        setDevLink(data.devResetUrl)
        toast.success('Dev mode: use the link below if email is not configured')
      }
    } catch (error) {
      toast.error(error.message || 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell
      imageSrc={d1}
      imageAlt="Introvert"
      title="Reset password"
      footer={(
        <p className="mt-6 text-center text-sm text-gray-400">
          <Link to="/login" className="inline-flex items-center gap-1 font-medium text-indigo-400 hover:text-indigo-300">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to sign in
          </Link>
        </p>
      )}
    >
      <p className="mb-6 text-center text-sm text-gray-400">
        Enter the email you used to register. We&apos;ll send you a link to choose a new password.
      </p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="forgot-email" className="mb-2 block text-sm font-medium text-gray-300">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              id="forgot-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-transparent bg-gray-800 py-2 pl-10 pr-4 text-white focus:border-transparent focus:ring-2 focus:ring-indigo-600"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={isLoading}
          className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50"
        >
          {isLoading ? 'Sending…' : 'Send reset link'}
        </motion.button>
      </form>
      {devLink ? (
        <div className="mt-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-left">
          <p className="text-xs font-medium text-amber-200">Development — reset link (email not sent):</p>
          <a href={devLink} className="mt-2 block break-all text-sm text-indigo-300 underline">
            {devLink}
          </a>
        </div>
      ) : null}
    </AuthShell>
  )
}
