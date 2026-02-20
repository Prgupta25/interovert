'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, LogIn, User, Lock, Phone } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import d1 from "../assets/images/b3.jpg"
import { toast } from 'react-hot-toast'
import OTPVerification from './OTPVerification'
import apiClient from '../services/apiClient'
import AuthShell from '../features/auth/AuthShell'

export default function Login() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    phoneNumber: '',
    whatsappNumber: '',
  })
  const [showOTP, setShowOTP] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { data } = await apiClient.post('/api/login', {
        email: formData.email,
        password: formData.password,
        phoneNumber: formData.phoneNumber,
        whatsappNumber: formData.whatsappNumber,
      });

      if (data?.devOtp) {
        toast.success(`Dev OTP: ${data.devOtp}`);
      }

        setUserEmail(formData.email)
        setShowOTP(true)
        toast.success(data?.message || 'OTP sent to your email!')
    } catch (error) {
      toast.error(error.message || 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerificationComplete = () => {
    navigate('/')
  }

  return (
    <AuthShell
      imageSrc={d1}
      imageAlt="Introvert Meetup"
      title="Welcome Back"
      footer={(
        <p className="mt-6 text-center text-sm text-gray-400">
          Not a member?{' '}
          <Link to="/signup" className="font-medium text-indigo-400 hover:text-indigo-300">
            Sign up now
          </Link>
        </p>
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="w-full bg-gray-800 text-white rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="w-full bg-gray-800 text-white rounded-lg pl-10 pr-10 py-2 focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleInputChange}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-300 mb-2">
                Phone Number (required for older accounts)
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  className="w-full bg-gray-800 text-white rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  placeholder="+91XXXXXXXXXX"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div>
              <label htmlFor="whatsappNumber" className="block text-sm font-medium text-gray-300 mb-2">
                WhatsApp Number (optional)
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  id="whatsappNumber"
                  name="whatsappNumber"
                  type="tel"
                  className="w-full bg-gray-800 text-white rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  placeholder="If different from phone number"
                  value={formData.whatsappNumber}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-300">
                  Remember me
                </label>
              </div>
              <div className="text-sm">
                <button
                  type="button"
                  onClick={() => toast('Password reset is coming soon.')}
                  className="font-medium text-indigo-400 hover:text-indigo-300"
                >
                  Forgot your password?
                </button>
              </div>
            </div>
            <div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <LogIn className="mr-2" size={20} />
                Sign in
              </motion.button>
            </div>
      </form>

      {showOTP && (
        <OTPVerification 
          email={userEmail} 
          onVerificationComplete={handleVerificationComplete}
        />
      )}
    </AuthShell>
  )
}

