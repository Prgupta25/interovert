'use client'

import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { toast } from 'react-hot-toast'
import apiClient from '../services/apiClient'
import AuthShell from '../features/auth/AuthShell'
import d1 from '../assets/images/b3.jpg'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useMemo(() => searchParams.get('token') || '', [searchParams])
  const emailParam = useMemo(() => searchParams.get('email') || '', [searchParams])

  const [email, setEmail] = useState(emailParam)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    if (!token) {
      toast.error('Invalid reset link. Open the link from your email again.')
      return
    }

    setIsLoading(true)
    try {
      const { data } = await apiClient.post('/api/reset-password', {
        email: email.trim().toLowerCase(),
        token,
        password,
      })
      toast.success(data?.message || 'Password updated')
      navigate('/login', { replace: true })
    } catch (error) {
      toast.error(error.message || 'Could not reset password')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell
      imageSrc={d1}
      imageAlt="Introvert"
      title="Choose new password"
      footer={(
        <p className="mt-6 text-center text-sm text-gray-400">
          <Link to="/login" className="inline-flex items-center gap-1 font-medium text-indigo-400 hover:text-indigo-300">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to sign in
          </Link>
        </p>
      )}
    >
      {!token ? (
        <p className="text-center text-sm text-amber-200">
          This page needs a valid link from your reset email.{' '}
          <Link to="/forgot-password" className="text-indigo-400 underline">
            Request a new link
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="reset-email" className="mb-2 block text-sm font-medium text-gray-300">
              Email
            </label>
            <input
              id="reset-email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-transparent bg-gray-800 px-4 py-2 text-white focus:ring-2 focus:ring-indigo-600"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="reset-password" className="mb-2 block text-sm font-medium text-gray-300">
              New password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden />
              <input
                id="reset-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-lg border border-transparent bg-gray-800 py-2 pl-10 pr-10 text-white focus:ring-2 focus:ring-indigo-600"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">At least 8 characters</p>
          </div>
          <div>
            <label htmlFor="reset-confirm" className="mb-2 block text-sm font-medium text-gray-300">
              Confirm password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden />
              <input
                id="reset-confirm"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-lg border border-transparent bg-gray-800 py-2 pl-10 pr-4 text-white focus:ring-2 focus:ring-indigo-600"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isLoading}
            className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isLoading ? 'Saving…' : 'Update password'}
          </motion.button>
        </form>
      )}
    </AuthShell>
  )
}
