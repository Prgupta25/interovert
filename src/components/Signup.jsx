'use client'

import React, { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Eye,
  EyeOff,
  UserPlus,
  User,
  Lock,
  Mail,
  Calendar,
  MapPin,
  Loader2,
  Map,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import d1 from '../assets/images/b3.jpg'
import { toast } from 'react-hot-toast'
import apiClient from '../services/apiClient'
import AuthShell from '../features/auth/AuthShell'
import AddressAutocomplete from './AddressAutocomplete'
import SignupMapModal from './SignupMapModal'
import OTPVerification from './OTPVerification'
import { lookupPostalCode } from '../services/pinLookup'
import { COUNTRIES, getStatesForCountry } from '../data/countriesAndStates'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const inputBase =
  'w-full rounded-lg border border-transparent bg-gray-800 py-2 text-white focus:border-transparent focus:ring-2 focus:ring-indigo-600'
const inputError = 'ring-1 ring-rose-500 border-rose-500/50'

function validateSignupForm(formData, termsAccepted) {
  const errors = {}
  if (!formData.name.trim()) errors.name = 'Name is required'
  if (!formData.email.trim()) errors.email = 'Email is required'
  else if (!EMAIL_RE.test(formData.email.trim())) errors.email = 'Invalid email format'
  if (!formData.password) errors.password = 'Password is required'
  else if (formData.password.length < 8) errors.password = 'Password must be at least 8 characters'

  const { address } = formData
  if (!address.line1.trim()) errors.line1 = 'Address line 1 is required'
  if (!address.city.trim()) errors.city = 'City is required'
  if (!address.country.trim()) errors.country = 'Country is required'

  const stateList = getStatesForCountry(address.country)
  if (stateList && !address.state.trim()) {
    errors.state = 'State / region is required'
  }

  if (!termsAccepted) errors.terms = 'You must accept the terms and conditions'

  return errors
}

export default function Signup() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [errors, setErrors] = useState({})
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    birthdate: '',
    address: {
      label: 'Home',
      line1: '',
      line2: '',
      city: '',
      state: '',
      country: '',
      postalCode: '',
    },
  })
  const [isLoading, setIsLoading] = useState(false)
  const [pinLookupLoading, setPinLookupLoading] = useState(false)
  const [showOTP, setShowOTP] = useState(false)
  const [signupEmail, setSignupEmail] = useState('')
  const [mapOpen, setMapOpen] = useState(false)

  const clearFieldError = useCallback((key) => {
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    clearFieldError(name)
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleAddressChange = (e) => {
    const { name, value } = e.target
    clearFieldError(name)
    setFormData((prev) => ({
      ...prev,
      address: { ...prev.address, [name]: value },
    }))
  }

  const handleCountryChange = (e) => {
    const country = e.target.value
    clearFieldError('country')
    clearFieldError('state')
    setFormData((prev) => ({
      ...prev,
      address: { ...prev.address, country, state: '' },
    }))
  }

  const applyAddressFields = useCallback((fields) => {
    setFormData((prev) => ({
      ...prev,
      address: {
        ...prev.address,
        ...(fields.line1 !== undefined && fields.line1 !== ''
          ? { line1: fields.line1 }
          : {}),
        ...(fields.city !== undefined && fields.city !== '' ? { city: fields.city } : {}),
        ...(fields.state !== undefined && fields.state !== '' ? { state: fields.state } : {}),
        ...(fields.country !== undefined && fields.country !== ''
          ? { country: fields.country }
          : {}),
        ...(fields.postalCode !== undefined && fields.postalCode !== ''
          ? { postalCode: fields.postalCode }
          : {}),
      },
    }))
    ;['line1', 'city', 'state', 'country', 'postalCode'].forEach(clearFieldError)
  }, [clearFieldError])

  const handleAutocompleteSelect = useCallback(
    (fields) => {
      applyAddressFields(fields)
      toast.success('Address filled from search')
    },
    [applyAddressFields],
  )

  const handleMapSelect = useCallback(
    (fields) => {
      applyAddressFields(fields)
      toast.success('Address filled from map')
      setMapOpen(false)
    },
    [applyAddressFields],
  )

  const handlePostalBlur = async () => {
    const pin = formData.address.postalCode.trim()
    const country = formData.address.country.trim()
    const minLen = /^india$/i.test(country) || !country ? 6 : 4
    if (pin.length < minLen) return

    setPinLookupLoading(true)
    try {
      const data = await lookupPostalCode(pin, country)
      if (!data) {
        toast.error('Could not look up that postal or PIN code.')
        return
      }
      setFormData((prev) => ({
        ...prev,
        address: {
          ...prev.address,
          ...(data.country ? { country: data.country } : {}),
          ...(data.state ? { state: data.state } : {}),
          ...(!prev.address.city.trim() && data.city ? { city: data.city } : {}),
          ...(!prev.address.line1.trim() && data.line1 ? { line1: data.line1 } : {}),
        },
      }))
      clearFieldError('state')
      clearFieldError('country')
      clearFieldError('city')
      toast.success('Filled details from postal code')
    } finally {
      setPinLookupLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const nextErrors = validateSignupForm(formData, termsAccepted)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      toast.error('Please fix the highlighted fields.')
      return
    }
    setErrors({})
    setIsLoading(true)

    try {
      const { data } = await apiClient.post('/api/signup', {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        birthdate: formData.birthdate || undefined,
        address: {
          label: formData.address.label.trim() || 'Home',
          line1: formData.address.line1.trim(),
          line2: formData.address.line2.trim(),
          city: formData.address.city.trim(),
          state: formData.address.state.trim(),
          country: formData.address.country.trim(),
          postalCode: formData.address.postalCode.trim(),
        },
      })

      if (data?.devOtp) {
        toast.success(`Dev OTP: ${data.devOtp}`)
      } else {
        toast.success(data?.message || 'Check your email for the verification code.')
      }

      setSignupEmail(formData.email.trim())
      setShowOTP(true)
    } catch (error) {
      console.error('Signup error:', error)
      const msg = error.message || 'Network error. Please check your connection and try again.'
      toast.error(msg)

      if (/already exists/i.test(msg)) {
        setErrors((prev) => ({ ...prev, email: 'An account with this email already exists' }))
      } else if (/address is required/i.test(msg)) {
        setErrors((prev) => ({
          ...prev,
          line1: 'Address line 1 is required',
          city: 'City is required',
        }))
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerificationComplete = () => {
    navigate('/events', { replace: true })
  }

  const stateOptions = getStatesForCountry(formData.address.country)
  const selectClass = `${inputBase} pl-3 pr-3 text-sm appearance-none bg-[length:1rem] bg-[right_0.5rem_center] bg-no-repeat`

  return (
    <AuthShell
      imageSrc={d1}
      imageAlt="Introvert Meetup"
      title="Create an Account"
      footer={(
        <p className="mt-6 text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-indigo-400 hover:text-indigo-300">
            Sign in
          </Link>
        </p>
      )}
    >
      {!showOTP ? (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="name" className="mb-2 block text-sm font-medium text-gray-300">
              Full name <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400" aria-hidden />
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                className={`${inputBase} pl-10 pr-4 py-2 ${errors.name ? inputError : ''}`}
                placeholder="Enter your full name"
                value={formData.name}
                onChange={handleInputChange}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
              />
            </div>
            {errors.name && (
              <p id="name-error" className="mt-1 text-xs text-rose-400">{errors.name}</p>
            )}
          </div>
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-300">
              Email <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400" aria-hidden />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                className={`${inputBase} pl-10 pr-4 py-2 ${errors.email ? inputError : ''}`}
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleInputChange}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
            </div>
            {errors.email && (
              <p id="email-error" className="mt-1 text-xs text-rose-400">{errors.email}</p>
            )}
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-300">
              Password <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400" aria-hidden />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className={`${inputBase} pl-10 pr-10 py-2 ${errors.password ? inputError : ''}`}
                placeholder="At least 8 characters"
                value={formData.password}
                onChange={handleInputChange}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 transform text-gray-400"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" className="mt-1 text-xs text-rose-400">{errors.password}</p>
            )}
          </div>
          <div>
            <label htmlFor="birthdate" className="mb-2 block text-sm font-medium text-gray-300">
              Date of birth <span className="text-zinc-500">(optional)</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400" aria-hidden />
              <input
                id="birthdate"
                name="birthdate"
                type="date"
                autoComplete="bday"
                className={`${inputBase} pl-10 pr-4 py-2`}
                value={formData.birthdate}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="rounded-lg border border-gray-700/80 bg-gray-800/40 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-200">
              <MapPin className="h-4 w-4 text-indigo-400" aria-hidden />
              Address <span className="text-rose-400">*</span>
            </div>
            <p className="mb-3 text-xs text-gray-500">
              Street and city are required. We verify your address on the map at signup — search, pick on the map, or type a real location (postal / PIN helps).
            </p>

            <div className="mb-3 space-y-2">
              <label className="block text-xs font-medium text-gray-400">Search to autofill</label>
              <AddressAutocomplete
                onSelect={handleAutocompleteSelect}
                placeholder="Search address or place…"
                inputClassName="border-gray-600 bg-gray-800 py-2 pl-9 pr-8 text-white placeholder-gray-500 focus:ring-indigo-600"
              />
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-600 bg-gray-800/80 py-2 text-sm font-medium text-indigo-300 hover:bg-gray-800"
              >
                <Map className="h-4 w-4 shrink-0" aria-hidden />
                Select from map
              </button>
            </div>

            <div className="space-y-3">
              <input
                name="label"
                type="text"
                className={`${inputBase} px-3 py-2 text-sm`}
                placeholder="Label (e.g. Home)"
                value={formData.address.label}
                onChange={handleAddressChange}
              />
              <div>
                <input
                  name="line1"
                  type="text"
                  autoComplete="address-line1"
                  className={`${inputBase} px-3 py-2 text-sm ${errors.line1 ? inputError : ''}`}
                  placeholder="Address line 1 *"
                  value={formData.address.line1}
                  onChange={handleAddressChange}
                  aria-invalid={!!errors.line1}
                />
                {errors.line1 && <p className="mt-1 text-xs text-rose-400">{errors.line1}</p>}
              </div>
              <input
                name="line2"
                type="text"
                autoComplete="address-line2"
                className={`${inputBase} px-3 py-2 text-sm`}
                placeholder="Address line 2 (optional)"
                value={formData.address.line2}
                onChange={handleAddressChange}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <input
                    name="city"
                    type="text"
                    autoComplete="address-level2"
                    className={`${inputBase} px-3 py-2 text-sm ${errors.city ? inputError : ''}`}
                    placeholder="City *"
                    value={formData.address.city}
                    onChange={handleAddressChange}
                    aria-invalid={!!errors.city}
                  />
                  {errors.city && <p className="mt-1 text-xs text-rose-400">{errors.city}</p>}
                </div>
                <div>
                  {stateOptions ? (
                    <>
                      <select
                        name="state"
                        value={formData.address.state}
                        onChange={handleAddressChange}
                        className={`${selectClass} ${errors.state ? inputError : ''}`}
                        aria-invalid={!!errors.state}
                      >
                        <option value="">State / region *</option>
                        {stateOptions.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      {errors.state && <p className="mt-1 text-xs text-rose-400">{errors.state}</p>}
                    </>
                  ) : (
                    <>
                      <input
                        name="state"
                        type="text"
                        autoComplete="address-level1"
                        className={`${inputBase} px-3 py-2 text-sm ${errors.state ? inputError : ''}`}
                        placeholder="State / region (optional)"
                        value={formData.address.state}
                        onChange={handleAddressChange}
                      />
                      {errors.state && <p className="mt-1 text-xs text-rose-400">{errors.state}</p>}
                    </>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="relative">
                  <input
                    name="postalCode"
                    type="text"
                    autoComplete="postal-code"
                    className={`${inputBase} px-3 py-2 text-sm pr-10`}
                    placeholder="Postal / PIN code"
                    value={formData.address.postalCode}
                    onChange={handleAddressChange}
                    onBlur={handlePostalBlur}
                  />
                  {pinLookupLoading && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" aria-hidden />
                  )}
                  <p className="mt-1 text-[11px] text-gray-500">Blur the field to autofill state / country (India PIN 6 digits).</p>
                </div>
                <div>
                  <select
                    value={formData.address.country}
                    onChange={handleCountryChange}
                    className={`${selectClass} ${errors.country ? inputError : ''}`}
                    aria-invalid={!!errors.country}
                  >
                    <option value="">Country *</option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {errors.country && <p className="mt-1 text-xs text-rose-400">{errors.country}</p>}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start">
            <input
              id="terms"
              name="terms"
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => {
                setTermsAccepted(e.target.checked)
                clearFieldError('terms')
              }}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="terms" className="ml-2 block text-sm text-gray-300">
              I agree to the{' '}
              <a href="/#blog" className="font-medium text-indigo-400 hover:text-indigo-300">
                Terms and Conditions
              </a>
            </label>
          </div>
          {errors.terms && <p className="text-xs text-rose-400">{errors.terms}</p>}

          <div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-transparent bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin shrink-0" aria-hidden />
                  Processing…
                </>
              ) : (
                <>
                  <UserPlus className="h-5 w-5 shrink-0" aria-hidden />
                  Sign up
                </>
              )}
            </motion.button>
          </div>
        </form>
      ) : null}

      <SignupMapModal open={mapOpen} onClose={() => setMapOpen(false)} onSelect={handleMapSelect} />

      {showOTP && (
        <OTPVerification
          email={signupEmail}
          onVerificationComplete={handleVerificationComplete}
          title="Verify your email"
          subtitle={`We sent a sign-up code to ${signupEmail}`}
        />
      )}
    </AuthShell>
  )
}
