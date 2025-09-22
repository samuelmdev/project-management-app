'use client'

import Link from 'next/link'
import { useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from './lib/supabase/client'
import { LocaleContext } from './lib/i18n/locale-provider'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, User, LogOut, Menu, X } from 'lucide-react'

export default function Home() {
  const t = useContext(LocaleContext)
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  
  const phrases = [
    'Manage projects',
    'Collaborate',
    'Complete tasks',
    'Write notes',
    'Store files',
    'Track milestones',
  ]
  const [currentIndex, setCurrentIndex] = useState(0)

  //bg-gradient-to-r from-gray-300 to-green-500 bg-clip-text text-transparent

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % phrases.length)
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  // Add glow animation styles
  useEffect(() => {
    const glowStyles = `
      @keyframes glow {
        0% { opacity: 0.3; filter: blur(12px) brightness(1.1); box-shadow: 0 0 0 0 #10b98155; }
        50% { opacity: 0.6; filter: blur(18px) brightness(1.3); box-shadow: 0 0 32px 8px #10b98188; }
        100% { opacity: 0.3; filter: blur(12px) brightness(1.1); box-shadow: 0 0 0 0 #10b98155; }
      }

      .glow {
        animation: glow 2.5s ease-in-out infinite alternate;
      }

      .group:hover .glow {
        animation-play-state: paused;
      }
    `

    const styleElement = document.createElement('style')
    styleElement.textContent = glowStyles
    document.head.appendChild(styleElement)

    return () => {
      document.head.removeChild(styleElement)
    }
  }, [])

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      } catch (error) {
        console.error('Error checking auth:', error)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      router.push('/')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <main
  className="min-h-screen flex flex-col justify-center items-center p-8 text-center relative"
  style={{
    background: `
      radial-gradient(circle at top right, #10b981 -45%, rgba(16,185,129,0) 45%),
      radial-gradient(circle at bottom left, #6b7280 -45%, rgba(107,114,128,0) 45%),
      #0f172a
    `,
  }}
>
      {/* Header - Login or User Menu */}
      <div className="absolute top-6 right-6">
        {loading ? (
          <div className="bg-gray-600 animate-pulse text-white px-5 py-2 rounded-lg text-sm md:text-base">
            Loading...
          </div>
        ) : user ? (
          // Authenticated user header
          <div className="flex items-center gap-4">
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-4">
              <Link
                href="/dashboard"
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-md text-sm font-medium transition"
              >
                Dashboard
              </Link>
              <button
                onClick={handleSignOut}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-md text-sm font-medium transition flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-lg shadow-md transition"
              >
                {showMobileMenu ? <X className="w-5 h-5" /> : <User className="w-5 h-5" />}
              </button>
            </div>
          </div>
        ) : (
          // Not authenticated - show login button
          <Link
            href="/login"
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg shadow-md shadow-gray/60 text-shadow-xs text-shadow-black text-sm md:text-base"
          >
            {t.login}
          </Link>
        )}
      </div>

      {/* Mobile Menu Dropdown */}
      {user && showMobileMenu && (
        <div className="absolute top-16 right-6 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-50 min-w-[200px]">
          <div className="p-4 space-y-3">
            <Link
              href="/dashboard"
              className="block w-full text-left bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
              onClick={() => setShowMobileMenu(false)}
            >
              Dashboard
            </Link>
            <button
              onClick={() => {
                handleSignOut()
                setShowMobileMenu(false)
              }}
              className="block w-full text-left bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="h-[70vh] flex flex-col justify-center items-center text-center">
        {/* Title */}
        <h1 className="md:text-7xl text-4xl font-extrabold mb-4">
          <span className="text-gray-300 text-shadow-md text-shadow-gray">
            Project
          </span>
          <span className="text-green-500 text-shadow-md text-shadow-gray">Manager</span>
        </h1>

        {/* Tagline */}
        <p className="md:text-lg text-sm mb-6 max-w-2xl text-gray-400 text-shadow-md">
          Stay on top of your projects with a modern, collaborative, and
          easy-to-use tool. Manage tasks, organize workflows, and keep your team
          aligned.
        </p>

        {/* Animated text */}
        <div className="h-20 w-full flex items-center justify-center mb-8">
          <h2 className="text-3xl md:text-6xl font-bold text-white text-shadow-sm text-shadow-gray">
            <AnimatePresence mode="wait">
              <motion.span
                key={phrases[currentIndex]}
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -50, opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-block text-green-500 whitespace-nowrap text-shadow-sm text-shadow-gray"
              >
                {phrases[currentIndex]}
              </motion.span>
            </AnimatePresence>
          </h2>
        </div>

        {/* Get Started Button - Only show if not logged in */}
        {!user && (
          <div className="relative inline-block group">
            {/* Animated glow behind button (pauses on hover) */}
            <div className="pointer-events-none absolute -inset-1 rounded-xl bg-green-600 opacity-60 blur-lg z-0 glow" />

            <Link
              href="/signup"
              className="relative inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-gray/60 text-shadow-xs text-shadow-black text-lg font-semibold transition-transform duration-300 group-hover:scale-105 z-10"
            >
              Get Started
              <span className="transition-transform duration-300 group-hover:translate-x-1">
                <ArrowRight className="w-5 h-5" />
              </span>
            </Link>
          </div>
        )}

        {/* Welcome message for logged in users */}
        {user && (
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Welcome back!
            </h2>
            <p className="text-gray-300 mb-6">
              Ready to continue managing your projects?
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl shadow-lg text-lg font-semibold transition-transform duration-300 hover:scale-105"
            >
              Go to Dashboard
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        )}
      </div>


      {/* Features Section */}
      <section className="grid md:grid-cols-3 gap-6 max-w-6xl w-full md:mt-16">
  {/* Card 1 */}
  <div className="group relative p-[1px] rounded-2xl bg-gradient-to-r from-[#10b981]/40 to-gray-500/40 hover:from-[#10b981] hover:to-gray-500 transition">
    <div className="p-6 bg-gray-800/60 backdrop-blur-xl rounded-2xl h-full flex flex-col items-start shadow-lg group-hover:shadow-2xl transition">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#10b981]/20 text-[#10b981] text-2xl mb-4">
        📋
      </div>
      <h3 className="text-xl font-semibold mb-2 text-white">Organize Workflows</h3>
      <p className="text-gray-300 leading-relaxed">
        Use flexible workflows to plan, track, and complete tasks with ease.
      </p>
    </div>
  </div>

  {/* Card 2 */}
  <div className="group relative p-[1px] rounded-2xl bg-gradient-to-r from-[#10b981]/40 to-gray-500/40 hover:from-[#10b981] hover:to-gray-500 transition">
    <div className="p-6 bg-gray-800/60 backdrop-blur-xl rounded-2xl h-full flex flex-col items-start shadow-lg group-hover:shadow-2xl transition">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#10b981]/20 text-[#10b981] text-2xl mb-4">
        🤝
      </div>
      <h3 className="text-xl font-semibold mb-2 text-white">Collaborate in Real-Time</h3>
      <p className="text-gray-300 leading-relaxed">
        Share workspaces with your team and stay aligned with instant updates.
      </p>
    </div>
  </div>

  {/* Card 3 */}
  <div className="group relative p-[1px] rounded-2xl bg-gradient-to-r from-[#10b981]/40 to-gray-500/40 hover:from-[#10b981] hover:to-gray-500 transition">
    <div className="p-6 bg-gray-800/60 backdrop-blur-xl rounded-2xl h-full flex flex-col items-start shadow-lg group-hover:shadow-2xl transition">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#10b981]/20 text-[#10b981] text-2xl mb-4">
        📊
      </div>
      <h3 className="text-xl font-semibold mb-2 text-white">Track Progress</h3>
      <p className="text-gray-300 leading-relaxed">
        Visualize project status, deadlines, and milestones all in one place.
      </p>
    </div>
  </div>
</section>


      {/* How It Works Section */}
      <section className="mt-16 mb-16 max-w-3xl text-gray-300 leading-relaxed">
        <h2 className="md:text-2xl text-xl font-bold mb-4">How it works</h2>
        <ol className="list-decimal list-inside space-y-3 text-left">
          <li>Sign up and create your first workspace.</li>
          <li>
            Add projects and break them down into tasks using the kanban board.
          </li>
          <li>Invite your team to collaborate and assign roles.</li>
          <li>
            Track progress in real time and keep everyone on the same page.
          </li>
        </ol>
      </section>
    </main>
  )
}

