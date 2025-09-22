"use client"

import React, { createContext, useContext, useMemo, useRef } from "react"

type WorkspaceLite = { id: string; name: string; role: string }

type WorkspaceSnapshot = {
  counts?: { projects: number; archived: number; clients: number; members: number }
  workflow?: { name: string; color: string }[]
  name?: string
  role?: string
  updatedAt?: number
}

type AppCache = {
  // dashboard
  ownerWorkspaces?: WorkspaceLite[]
  memberWorkspaces?: WorkspaceLite[]
  // workspace-scoped data keyed by workspace id
  workspaceById: Record<string, WorkspaceSnapshot>
}

type AppCacheContextValue = {
  cacheRef: React.MutableRefObject<AppCache>
  setDashboardWorkspaces: (owned: WorkspaceLite[], member: WorkspaceLite[]) => void
  setWorkspaceSnapshot: (workspaceId: string, data: Partial<WorkspaceSnapshot>) => void
}

const AppCacheContext = createContext<AppCacheContextValue | null>(null)

export function AppCacheProvider({ children }: { children: React.ReactNode }) {
  const cacheRef = useRef<AppCache>({ workspaceById: {} })

  const value = useMemo<AppCacheContextValue>(() => ({
    cacheRef,
    setDashboardWorkspaces: (owned, member) => {
      cacheRef.current.ownerWorkspaces = owned
      cacheRef.current.memberWorkspaces = member
      // setOwnerWorkspaces and setSharedWorkspaces are not defined; 
      // if you need to update React state, you should define them as useState hooks.
      // For now, just update the cacheRef as before.
    },
    setWorkspaceSnapshot: (workspaceId, data) => {
      const prev = cacheRef.current.workspaceById[workspaceId] ?? {}
      cacheRef.current.workspaceById[workspaceId] = {
        ...prev,
        ...data,
        updatedAt: Date.now(),
      }
    },
  }), [])

  return (
    <AppCacheContext.Provider value={value}>{children}</AppCacheContext.Provider>
  )
}

export function useAppCache() {
  const ctx = useContext(AppCacheContext)
  if (!ctx) throw new Error("useAppCache must be used within AppCacheProvider")
  return ctx
}


