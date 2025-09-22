'use client'

import { ReactNode, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

export default function DashboardShell({
  children,
  userEmail,
}: {
  children: ReactNode
  userEmail: string
}) {
  const supabase = createClientComponentClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href

  // Close sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  return (
    <div className="h-[100vh] flex flex-col">
      {/* Desktop Header */}
      <header className="hidden md:flex w-full bg-gray-900 text-white px-6 py-3 z-10 justify-between items-center shadow-black shadow-md">
        <h1 className="text-lg font-bold text-shadow-lg text-shadow-black">Project Manager</h1>
        <UserMenu userEmail={userEmail} signOut={signOut} />
      </header>

      <div className="flex flex-1 relative">
        {/* Mobile Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              {/* Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/50 z-10 md:hidden"
                onClick={() => setSidebarOpen(false)}
              />

              {/* Sidebar Panel */}
              <motion.aside
                initial={{ x: -250, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -250, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed top-0 left-0 z-20 h-full w-64 bg-gradient-to-b from-gray-800 to-black/60 backdrop-blur-sm p-4 flex flex-col border-r border-green-600/60 shadow-green-500/50 shadow-xl md:hidden"
              >
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="self-end mb-4 text-gray-300 hover:text-white"
                >
                  ✕
                </button>

                <SidebarContent userEmail={userEmail} signOut={signOut} hideTopHeader />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Desktop Sidebar */}
        <aside
            className="hidden md:flex md:flex-col md:w-64 md:bg-gradient-to-b from-gray-800 to-gray-900 hover:from-gray-800 hover:to-gray-850 md:p-4 md:border-r border-gray-500/70 bg-clip-padding [background:padding-box_var(--tw-bg-opacity)] from-gray-900 via-gray-950 to-gray-950 hover:border-green-500/70 hover:shadow-xl hover:shadow-green-600/50 hover:inset-shadow-xl hover:inset-shadow-gray/50 hover:bg-gray-900 md:min-h-screen fixed transition-all duration-100 ease-in-out">
          <SidebarContent userEmail={userEmail} signOut={signOut} />
        </aside>

        {/* Mobile Arrow Button */}
        {!sidebarOpen && (
          <button
            className="fixed md:hidden top-1/2 -translate-y-1/2 z-50 bg-gray-800 text-white p-2 rounded-r shadow-md"
            onClick={() => setSidebarOpen(true)}
          >
            ▶
          </button>
        )}

        {/* Main content with scale on mobile sidebar open */}
        <motion.main
          className="flex-1 p-6 md:ml-64 origin-left"
          animate={{ scale: sidebarOpen ? 0.95 : 1 }}
          transition={{ duration: 0.25 }}
        >
          {children}
        </motion.main>
      </div>
    </div>
  )
}

// Desktop-only user menu
function UserMenu({ userEmail, signOut }: { userEmail: string; signOut: () => void }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={menuRef}>
      <span className="text-sm text-gray-300">Signed in as </span>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="text-sm font-semibold text-gray-300 hover:underline ml-2"
      >
        {userEmail}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-40 bg-white text-gray-800 shadow-md"
          >
            <Link href="/dashboard/profile" className="block px-4 py-2 hover:bg-gray-200">
              Profile
            </Link>
            <button
              onClick={signOut}
              className="w-full text-left px-4 py-2 hover:bg-gray-200"
            >
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Sidebar Content
function SidebarContent({
  userEmail,
  signOut,
  hideTopHeader = false,
}: {
  userEmail: string
  signOut: () => void
  hideTopHeader?: boolean
}) {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href

  return (
    <div className="flex flex-col justify-between h-[80svh]">
      <div>
        {hideTopHeader && (
          <h1 className="text-lg font-bold text-gray-300 mb-6">Project Manager</h1>
        )}
        <Link href={`/dashboard`} className="block mb-2 text-gray-300 hover:text-white">
        <h2 className="text-sm uppercase tracking-wide mb-4">Dashboard</h2>
        </Link>
        <nav className="flex flex-col gap-2 text-white">
          <NavLink href="/dashboard" isActive={isActive}>Home</NavLink>
          <NavLink href="/dashboard/workspaces" isActive={isActive}>Workspaces</NavLink>
          <NavLink href="/dashboard/workflow" isActive={isActive}>Workflow</NavLink>
          <NavLink href="/dashboard/profile" isActive={isActive}>Profile</NavLink>
        </nav>

        {/* Mobile user info */}
        {hideTopHeader && (
          <div className="mt-6 border-t border-gray-600 pt-4 text-gray-300">
            <p className="text-sm mb-2">Signed in as:</p>
            <p className="font-semibold">{userEmail}</p>
        {/*    <Link href="/dashboard/profile" className="block mt-2 hover:underline">
              Profile
            </Link> */}
            <button className="mt-1 text-left hover:underline w-full" onClick={signOut}>
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Individual nav link with hover & active styles
function NavLink({ href, children, isActive }: { href: string; children: React.ReactNode; isActive: (href: string) => boolean }) {
  return (
    <Link
      href={href}
      className={`px-2 py-1 rounded transition-colors duration-200 ${
        isActive(href)
          ? "border-l-4 border-green-500 font-semibold text-white text-shadow-sm text-shadow-black"
        : "text-gray-300 hover:text-white hover:bg-gray-700 hover:text-shadow-xs hover:text-shadow-black hover:shadow-sm"
      }`}
    >
      {children}
    </Link>
  )
}
