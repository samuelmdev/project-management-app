"use client"

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/client'
import { login } from './actions'

const initialState = { error: null as string | null }

export default function LoginPage() {
  const [state, formAction] = useActionState(login, initialState)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // User is already logged in, redirect to dashboard
          router.push('/dashboard')
        }
      } catch (error) {
        console.error('Error checking auth:', error)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [router, supabase.auth])

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center text-center min-h-screen bg-gray-950 px-4">
        <h1 className="md:text-5xl text-3xl font-extrabold mb-4">
          <span className="text-gray-300">Project{' '}</span>
          <span className="text-green-500">Manager</span>
        </h1>
        <div className="text-gray-400">Checking authentication...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col justify-center items-center text-center min-h-screen bg-gray-950 px-4">
      <h1 className="md:text-5xl text-3xl font-extrabold mb-4">
        <span className="text-gray-300">Project{' '}</span>
        <span className="text-green-500">Manager</span>
      </h1>

      <form action={formAction} className="flex flex-col gap-4 w-full max-w-sm bg-gray-900 p-6 rounded-2xl shadow-lg border border-gray-700">
        {/* Email */}
        <div className="flex flex-col text-left">
          <label htmlFor="email" className="text-sm font-medium text-gray-300 mb-1">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:ring-2 focus:ring-[#10b981] focus:outline-none text-gray-100"
          />
        </div>

        {/* Password */}
        <div className="flex flex-col text-left">
          <label htmlFor="password" className="text-sm font-medium text-gray-300 mb-1">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:ring-2 focus:ring-[#10b981] focus:outline-none text-gray-100"
          />
        </div>

        {/* Error */}
        {state.error && (
          <div className="text-red-500 text-sm text-left">{state.error}</div>
        )}

        {/* Actions */}
        <div className="flex flex-col md:flex-row gap-3 mt-2">
          <button
            type="submit"
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition text-white font-medium shadow"
          >
            Log in
          </button>
        {/*  <Link
            href="/signup"
            className="flex-1 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 transition text-white font-medium shadow text-center"
          >
            Sign up
          </Link>
        */}
        </div>

        {/* Don't have account link */}
        <div className="text-center mt-2">
          <span className="text-gray-400 text-sm">Don't have an account? </span>
          <Link href="/signup" className="text-green-400 hover:text-green-300 text-sm underline">
            Sign up here
          </Link>
        </div>
      </form>
    </div>
  )
}
