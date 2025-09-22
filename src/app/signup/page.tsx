/*'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
//import { useSupabase } from '../lib/supabase/client'
import { createClient } from '../lib/supabase/client'
import { useContext } from 'react'
import { LocaleContext } from '../lib/i18n/locale-provider'

export default async function SignupPage() {
  const t = useContext(LocaleContext)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const supabase = await createClient()
  //const { supabase } = useSupabase()
  const router = useRouter()

  const handleSignup = async () => {
    const { error } = await supabase.auth.signUp({ email, password })
    if (!error) {
       router.push('/dashboard')}
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">{t.signup}</h1>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t.email} className="mb-2 w-full p-2 border rounded" />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t.password} className="mb-4 w-full p-2 border rounded" />
      <button onClick={handleSignup} className="w-full bg-green-600 text-white p-2 rounded">{t.signup}</button>
    </div>
  )
} 

  'use server'

  import { createClient } from '../lib/supabase/server'
  import { redirect } from 'next/navigation'
  import { revalidatePath } from 'next/cache'

  export async function signup(formData: FormData) {  
    const supabase = await createClient() 
    const data = {    email: formData.get('email') as string,    password: formData.get('password') as string,  }  
    const { error } = await supabase.auth.signUp(data) 
     if (error) {    
      return { error: error.message }   }  
     revalidatePath('/', 'layout')  
     redirect('/dashboard')
    }*/

    "use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/app/lib/supabase/client'
import { signup } from "./actions"

const initialState = { error: null as string | null }

export default function SignupPage() {
  const [state, formAction] = useActionState(signup, initialState)
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
            className="flex-1 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 transition text-white font-medium shadow"
          >
            Sign up
          </button>
          {/* <Link
            href="/login"
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition text-white font-medium shadow text-center"
          >
            Log in
          </Link>
          */}
        </div>

        {/* Already have account link */}
        <div className="text-center mt-2">
          <span className="text-gray-400 text-sm">Already have an account? </span>
          <Link href="/login" className="text-blue-400 hover:text-blue-300 text-sm underline">
            Log in here
          </Link>
        </div>
      </form>
    </div>
  )
}
