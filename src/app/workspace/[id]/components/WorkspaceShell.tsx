'use client'

import { ReactNode, useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/app/lib/supabase/client"
import { useWorkspace } from "./WorkspaceContext"

export default function WorkspaceShell({
  children,
  id,
  workspaceName: initialWorkspaceName,
  userEmail,
}: {
  children: React.ReactNode
  id: string
  workspaceName: string
  userEmail: string
}) {
  const supabase = createClient()
  const { workspace, userRole, loading, realtimeWorking } = useWorkspace()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router = useRouter()
  
  // Use real-time workspace name if available, fallback to initial
  const workspaceName = workspace?.name || initialWorkspaceName

  // Check if user has access to this workspace
  useEffect(() => {
    if (!loading && userRole === null && workspace) {
      // User has no role in this workspace, redirect to dashboard
      console.log('User has no access to workspace, redirecting to dashboard');
      router.push('/dashboard');
    }
  }, [userRole, loading, workspace, router]);

  const isActive = (href: string) => pathname === href;
  // Close sidebar on route change (mobile only)
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])


  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = "/" // redirect to home/login
  }

  // Show loading state while checking access
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Loading workspace...</div>
      </div>
    );
  }

  // Show access denied if user has no role
  if (!loading && userRole === null && workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="mb-4">You don't have access to this workspace.</p>
          <Link href="/dashboard" className="text-blue-400 hover:text-blue-300">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Header (desktop only) */}
      <header className="hidden md:flex w-full bg-gray-900 text-white px-6 py-3 shadow-md z-10 justify-between items-center text-shadow-lg shadow-black shadow-lg text-shadow-black">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-lg font-bold text-gray-300 hover:text-white">
            Project Manager
          </Link>
          
          {/* Real-time Status Indicator */}
          {!realtimeWorking && (
            <div className="flex items-center gap-2 px-2 py-1 bg-yellow-600/20 border border-yellow-500/30 rounded text-xs">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <span className="text-yellow-300">Offline Mode</span>
            </div>
          )}
        </div>

        {/* User Menu */}
        <UserMenu userEmail={userEmail} />
      </header>

      <div className="flex flex-1 relative">
        {/* Sidebar Mobile */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                className="fixed inset-0 bg-black/50 z-40 md:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
              />              
                <motion.aside
                  ref={sidebarRef}
                  initial={{ x: -250, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -250, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="fixed top-0 left-0 z-50 h-full w-64 bg-gradient-to-b from-gray-800 to-black/60 backdrop-blur-sm p-4 flex flex-col border-r border-green-600/60 shadow-green-500/50 shadow-xl"
                >
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="self-end text-gray-300 hover:text-white"
                >
                  ✕
                </button>
                <SidebarContent
                  id={id}
                  workspaceName={workspaceName}
                  userEmail={userEmail}
                  isActive={isActive}
                  workspaceRole={userRole}
                  hideTopHeader
                />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Sidebar Desktop */}
        <aside
            className="hidden md:flex md:flex-col md:w-64 md:bg-gradient-to-b from-gray-800 to-gray-900 hover:from-gray-800 hover:to-gray-850 md:p-4 md:border-r border-gray-500/70 bg-clip-padding [background:padding-box_var(--tw-bg-opacity)] from-gray-900 via-gray-950 to-gray-950 hover:border-green-500/70 hover:shadow-xl hover:shadow-green-600/50 hover:inset-shadow-xl hover:inset-shadow-gray/50 hover:bg-gray-900 md:min-h-screen fixed transition-all duration-100 ease-in-out">
  <SidebarContent
    id={id}
    workspaceName={workspaceName}
    userEmail={userEmail}
    isActive={isActive}
    workspaceRole={userRole}
  />
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

        {/* Main Content with scale on mobile sidebar open */}
        <motion.main
          className="flex-1 p-6 md:ml-64 origin-left"
          animate={{ scale: sidebarOpen ? 0.95 : 1 }}
          transition={{ duration: 0.25 }}
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}

// User menu component
function UserMenu({ userEmail }: { userEmail: string }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <span className="text-sm text-gray-300">Signed in as </span>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="text-sm font-semibold text-gray-300 hover:underline ml-2"
      >
        {userEmail ?? "—"}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-48 bg-white text-gray-900 shadow-md z-50"
          >
            <Link
              href="/dashboard/profile"
              className="block px-4 py-2 hover:bg-gray-200"
            >
              Profile
            </Link>
            <button
              onClick={() => console.log("Sign out")}
              className="w-full text-left px-4 py-2 hover:bg-gray-200"
            >
              Sign Out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sidebar content extracted to avoid duplication
function SidebarContent({
  id,
  workspaceName,
  userEmail,
  isActive,
  workspaceRole,
  hideTopHeader = false,
}: {
  id: string;
  workspaceName: string;
  userEmail: string | null;
  isActive: (href: string) => boolean;
  workspaceRole?: string | null;
  hideTopHeader?: boolean;
}) {
  const supabase = createClient()
  const pathname = usePathname()
  const [currentProject, setCurrentProject] = useState<{ id: string; name: string; archived: boolean } | null>(null)

  useEffect(() => {
    // Parse current project from URL if on a project page
    const parts = pathname.split('/').filter(Boolean)
    const projectsIndex = parts.findIndex((p) => p === 'projects')
    const workspaceIndex = parts.findIndex((p) => p === 'workspace')
    if (workspaceIndex !== -1 && projectsIndex !== -1 && parts[workspaceIndex + 1] === id) {
      const maybeProjectId = parts[projectsIndex + 1]
      if (maybeProjectId) {
        ;(async () => {
          const { data } = await supabase
            .from('projects')
            .select('id,name,archived')
            .eq('id', maybeProjectId)
            .maybeSingle()
          if (data) setCurrentProject({ id: data.id, name: data.name, archived: !!data.archived })
          else setCurrentProject(null)
        })()
        return
      }
    }
    setCurrentProject(null)
  }, [pathname, id, supabase])

  const canSeeArchive = ["manager", "admin", "owner"].includes(workspaceRole ?? "")
const canSeeClients = ["member", "manager", "admin", "owner"].includes(workspaceRole ?? "")
const canSeeSettings = ["manager", "admin", "owner"].includes(workspaceRole ?? "")

  return (
    <div className="flex flex-col justify-between min-h-0">
      <div>
        {hideTopHeader && (
          <Link href="/dashboard" className="block mb-6">
            <h1 className="text-lg font-bold text-gray-300 hover:text-white">Project Manager</h1>
          </Link>
        )}

        <Link href={`/workspace/${id}`} className="block mb-2 text-gray-300 hover:text-white">
          <h2 className="text-sm uppercase tracking-wide">Workspace</h2>
          <h2 className="text-2xl font-bold ml-1">{workspaceName}</h2>
        </Link>

        <nav className="flex flex-col gap-2 mt-4">
          <NavLink href={`/workspace/${id}`} isActive={isActive}>
            Overview
          </NavLink>
          <NavLink href={`/workspace/${id}/projects`} isActive={isActive}>
            Projects
          </NavLink>
          {currentProject && !currentProject.archived && (
            <div className="ml-4">
              <NavLink href={`/workspace/${id}/projects/${currentProject.id}`} isActive={isActive}>
                {currentProject.name}
              </NavLink>
            </div>
          )}
          {canSeeArchive && (
            <NavLink href={`/workspace/${id}/archive`} isActive={isActive}>
              Archive
            </NavLink>
          )}
          {currentProject && currentProject.archived && (
            <div className="ml-4">
              <NavLink href={`/workspace/${id}/projects/${currentProject.id}`} isActive={isActive}>
                {currentProject.name}
              </NavLink>
            </div>
          )}
          {canSeeClients && (
            <NavLink href={`/workspace/${id}/clients`} isActive={isActive}>
              Clients
            </NavLink>
          )}
          {canSeeSettings && (
            <NavLink href={`/workspace/${id}/settings`} isActive={isActive}>
              Settings
            </NavLink>
          )}
        </nav>

        {/* Mobile user info inside sidebar */}
        {hideTopHeader && (
          <div className="mt-6 border-t border-gray-600 pt-4 text-gray-300">
            <p className="text-sm mb-2">Signed in as:</p>
            <p className="font-semibold">{userEmail ?? "—"}</p>
            <Link href="/dashboard/profile" className="block mt-2 hover:underline">
              Profile
            </Link>
            <button className="mt-1 text-left hover:underline w-full" onClick={() => console.log("Sign out")}>
              Sign Out
            </button>
          </div>
        )}
      </div>

      <Link href="/dashboard" className="text-sm font-bold hover:underline text-gray-300 mt-4">
        Back to Dashboard
      </Link>
    </div>
  );
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