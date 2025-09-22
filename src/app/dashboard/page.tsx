"use client"

import Link from 'next/link'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useDashboard } from './components/DashboardContext'
import { Settings, User, FolderOpen } from 'lucide-react'

export default function DashboardPage() {
  const { ownerWorkspaces, sharedWorkspaces, loading } = useDashboard()
  const [showOwned, setShowOwned] = useState(false)
  const [showOther, setShowOther] = useState(false)

  const ownerCount = ownerWorkspaces.length
  const sharedCount = sharedWorkspaces.length
  
  // Calculate unique workspaces (avoid double counting workspaces that are both owned and shared)
  const allWorkspaceIds = new Set([
    ...ownerWorkspaces.map(w => w.id),
    ...sharedWorkspaces.map(w => w.id)
  ])
  const totalWorkspaces = allWorkspaceIds.size
  
  const canToggleOwned = ownerCount > 0
  const canToggleOther = sharedCount > 0

  return (
    <div className="md:p-6 p-2">
      <h1 className="text-3xl uppercase tracking-wide text-white mb-3 text-white">Dashboard</h1>

      {/* Navigate Workspaces Card - Full Width */}
      <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700 rounded-2xl shadow p-6 md:mb-6 mb-3 md:hover:bg-gray-800/60 md:hover:border-green-600/50 transition-all duration-200">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-blue-600/20 rounded-xl">
            <FolderOpen className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Navigate Workspaces</h3>
            <p className="text-gray-400 text-sm">{totalWorkspaces} workspace{totalWorkspaces !== 1 ? 's' : ''} accessible</p>
          </div>
        </div>
        
        {/* Workspace Navigation - Row layout on larger screens */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {/* Owned Workspaces */}
          <div className="space-y-2">
            <div
              className={`bg-gray-800/60 border border-gray-600 rounded-lg p-3 ${canToggleOwned ? 'cursor-pointer hover:bg-gray-700/60 hover:border-green-500/50' : 'opacity-60'} transition`}
              onClick={() => {
                if (!canToggleOwned) return
                const next = !showOwned
                setShowOwned(next)
                setShowOther(false)
              }}
              role="button"
              aria-pressed={showOwned}
              aria-disabled={!canToggleOwned}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-green-500 font-medium text-sm">Your Workspaces</h4>
                  <p className="text-gray-400 text-xs">{ownerCount} owned</p>
                </div>
                <span
                  aria-hidden
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-600 ${canToggleOwned ? 'text-gray-300 bg-gray-700' : 'text-gray-600 bg-gray-700'} transition-transform ${showOwned ? 'rotate-180' : 'rotate-0'}`}
                >
                  ▾
                </span>
              </div>
            </div>
            
            <AnimatePresence initial={false}>
              {showOwned && (
                <motion.div
                  initial={{ height: 0, opacity: 0, y: -8 }}
                  animate={{ height: 'auto', opacity: 1, y: 0 }}
                  exit={{ height: 0, opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2 max-h-60 overflow-y-auto"
                >
                  {ownerWorkspaces.map(ws => (
                    <Link
                      key={ws.id}
                      href={`/workspace/${ws.id}`}
                      className="block px-3 py-2 rounded-lg bg-gray-700/40 border border-gray-600 hover:bg-gray-600/60 text-gray-100 text-sm"
                    >
                      {ws.name}
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Shared Workspaces */}
          <div className="space-y-2">
            <div
              className={`bg-gray-800/60 border border-gray-600 rounded-lg p-3 ${canToggleOther ? 'cursor-pointer hover:bg-gray-700/60 hover:border-blue-500/50' : 'opacity-60'} transition`}
              onClick={() => {
                if (!canToggleOther) return
                const next = !showOther
                setShowOther(next)
                setShowOwned(false)
              }}
              role="button"
              aria-pressed={showOther}
              aria-disabled={!canToggleOther}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-blue-400 font-medium text-sm">Shared Workspaces</h4>
                  <p className="text-gray-400 text-xs">{sharedCount} shared</p>
                </div>
                <span
                  aria-hidden
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-600 ${canToggleOther ? 'text-gray-300 bg-gray-700' : 'text-gray-600 bg-gray-700'} transition-transform ${showOther ? 'rotate-180' : 'rotate-0'}`}
                >
                  ▾
                </span>
              </div>
            </div>
            
            <AnimatePresence initial={false}>
              {showOther && (
                <motion.div
                  initial={{ height: 0, opacity: 0, y: -8 }}
                  animate={{ height: 'auto', opacity: 1, y: 0 }}
                  exit={{ height: 0, opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2 max-h-60 overflow-y-auto"
                >
                  {sharedWorkspaces.map(ws => (
                    <Link
                      key={ws.id}
                      href={`/workspace/${ws.id}`}
                      className="block px-3 py-2 rounded-lg bg-gray-700/40 border border-gray-600 hover:bg-gray-600/60 text-gray-100 text-sm"
                    >
                      {ws.name}
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row gap-2 mt-4">
          <Link 
            href="/dashboard/workspaces" 
            className="flex-1 md:w-3/4 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition text-center"
          >
            Manage Workspaces
          </Link>
          <Link 
            href="/dashboard/workspaces/new" 
            className="md:w-1/4 px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition text-center"
          >
            + Create Workspace
          </Link>
        </div>
      </div>

      {/* Other Action Cards - Row layout on larger screens */}
      <div className="grid md:gap-6 gap-3 grid-cols-1 md:grid-cols-2">

        {/* Customize Default Workflow Card */}
        <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700 rounded-2xl shadow p-6 md:hover:bg-gray-800/60 md:hover:border-green-600/50 transition-all duration-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-indigo-600/20 rounded-xl">
              <Settings className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Customize Default Workflow</h3>
              <p className="text-gray-400 text-sm">Set your preferred workflow</p>
            </div>
          </div>
          <p className="text-gray-300 text-sm mb-4">
            Configure your default workflow steps and tags that will be used when creating new workspaces. Customize the project management flow to match your needs.
          </p>
          <Link 
            href="/dashboard/workflow" 
            className="block w-full px-4 py-2 bg-purple-800 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition text-center"
          >
            Configure Workflow
          </Link>
        </div>

        {/* Edit Profile Card */}
        <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700 rounded-2xl shadow p-6 md:hover:bg-gray-800/60 md:hover:border-green-600/50 transition-all duration-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-600/20 rounded-xl">
              <User className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Edit Profile</h3>
              <p className="text-gray-400 text-sm">Manage your account</p>
            </div>
          </div>
          <p className="text-gray-300 text-sm mb-4">
            Update your profile information, change your password, and manage your account settings. Keep your personal information up to date.
          </p>
          <Link 
            href="/dashboard/profile" 
            className="block w-full px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition text-center"
          >
            Edit Profile
          </Link>
        </div>
      </div>
    </div>
  )
}
