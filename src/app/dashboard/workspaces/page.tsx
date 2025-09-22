"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/app/lib/supabase/client";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useDashboard } from "../components/DashboardContext";
import { logActions } from "@/app/lib/logging";

type Workspace = {
  id: string;
  name: string;
  role: string;
  membersCount: number;
  projectsCount: number;
};

export default function WorkspacesPage() {
  const { ownerWorkspaces: ownerWorkspacesLite, sharedWorkspaces: sharedWorkspacesLite, invitations, loading, acceptInvitation, declineInvitation } = useDashboard();
  const [ownerWorkspaces, setOwnerWorkspaces] = useState<Workspace[]>([]);
  const [sharedWorkspaces, setSharedWorkspaces] = useState<Workspace[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  const supabase = createClient();
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetWorkspace, setTargetWorkspace] = useState<Workspace | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showOwned, setShowOwned] = useState(false); 
  const [showShared, setShowShared] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [targetLeaveWorkspace, setTargetLeaveWorkspace] = useState<Workspace | null>(null);

  // Update local state when context data changes
  useEffect(() => {
    console.log('🔄 Dashboard workspaces page: Context data changed');
    console.log('🔄 Owner workspaces from context:', ownerWorkspacesLite.length);
    console.log('🔄 Shared workspaces from context:', sharedWorkspacesLite.length);
    
    const fetchWorkspaceDetails = async () => {
      if (ownerWorkspacesLite.length === 0 && sharedWorkspacesLite.length === 0) {
        console.log('🔄 No workspaces in context, clearing local state');
        setOwnerWorkspaces([]);
        setSharedWorkspaces([]);
        setLocalLoading(false);
        return;
      }

      const allWorkspaceIds = [
        ...ownerWorkspacesLite.map(w => w.id),
        ...sharedWorkspacesLite.map(w => w.id)
      ];

      // Fetch project counts for all workspaces
      const { data, error } = await supabase
        .from("workspaces")
        .select(
          `id,
           name,
           projects(count)`
        )
        .in("id", allWorkspaceIds);

      if (!error && data) {
        const workspaceDetails = data.map((ws: any) => ({
          id: ws.id,
          name: ws.name,
          projectsCount: ws.projects?.[0]?.count ?? 0,
        }));

        // Map the context data with project counts
        const ownerWithDetails = ownerWorkspacesLite.map(ws => {
          const details = workspaceDetails.find(d => d.id === ws.id);
          return {
            ...ws,
            projectsCount: details?.projectsCount ?? 0,
          };
        });

        const sharedWithDetails = sharedWorkspacesLite.map(ws => {
          const details = workspaceDetails.find(d => d.id === ws.id);
          return {
            ...ws,
            projectsCount: details?.projectsCount ?? 0,
          };
        });

        console.log('🔄 Setting local state - Owner workspaces:', ownerWithDetails.length);
        console.log('🔄 Setting local state - Shared workspaces:', sharedWithDetails.length);
        setOwnerWorkspaces(ownerWithDetails);
        setSharedWorkspaces(sharedWithDetails);
        setLocalLoading(false);
      }
    };

    fetchWorkspaceDetails();
  }, [ownerWorkspacesLite, sharedWorkspacesLite, supabase]);

  async function handleOpenDelete(ws: Workspace) {
    setTargetWorkspace(ws);
    setConfirmText("");
    setErrorMsg(null);
    setConfirmOpen(true);
  }

  async function handleOpenLeave(ws: Workspace) {
    setTargetLeaveWorkspace(ws);
    setLeaveConfirmOpen(true);
  }

  async function handleLeaveConfirmed() {
    if (!targetLeaveWorkspace) return;
    setLeaving(true);
    setErrorMsg(null);
    
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");

      // First, remove user from all projects in this workspace
      console.log('🚪 Removing user from all projects in workspace...');
      
      // Get all project IDs in this workspace
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("id")
        .eq("workspace_id", targetLeaveWorkspace.id);
      
      if (projectsError) {
        console.error('❌ Dashboard: Error fetching projects:', projectsError);
      } else if (projectsData && projectsData.length > 0) {
        const projectIds = projectsData.map(p => p.id);
        
        // Remove user from all projects
        const { error: projectMembersError } = await supabase
          .from("project_members")
          .delete()
          .in("project_id", projectIds)
          .eq("user_id", user.id);
        
        if (projectMembersError) {
          console.error('❌ Dashboard: Error removing user from projects:', projectMembersError);
        } else {
          console.log('✅ Dashboard: User removed from all projects in workspace');
        }
      } else {
        console.log('ℹ️ Dashboard: No projects found in workspace');
      }

      // Then remove user from workspace
      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .eq("workspace_id", targetLeaveWorkspace.id)
        .eq("user_id", user.id);

      if (error) throw error;
      
      // Log workspace leave action
      await logActions.workspaceLeft(targetLeaveWorkspace.id);
      
      console.log('🚪 User left workspace:', targetLeaveWorkspace.id);
      console.log('🚪 Removing from local state immediately');
      
      // remove from local state immediately
      setSharedWorkspaces(prev => {
        const filtered = prev.filter(ws => ws.id !== targetLeaveWorkspace.id);
        console.log('🚪 Shared workspaces after removal:', filtered.length);
        return filtered;
      });


      // Real-time subscription will handle the UI updates
      setLeaveConfirmOpen(false);
      setTargetLeaveWorkspace(null);
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Failed to leave workspace.");
    } finally {
      setLeaving(false);
    }
  }

  async function handleDeleteConfirmed() {
    if (!targetWorkspace) return;
    setDeleting(true);
    setErrorMsg(null);
    try {
      // Ensure current user is owner
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");
      const { data: membership } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", targetWorkspace.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!membership || membership.role !== "owner") {
        throw new Error("Only owners can delete a workspace.");
      }

      // Gather all project ids in this workspace
      const { data: projectsData, error: projectsErr } = await supabase
        .from("projects")
        .select("id")
        .eq("workspace_id", targetWorkspace.id);
      if (projectsErr) throw projectsErr;
      const projectIds = (projectsData ?? []).map((p: any) => p.id);

      // Delete child rows that only have project_id
      if (projectIds.length > 0) {
        const idList = projectIds as string[];
        const delNotes = await supabase.from("notes").delete().in("project_id", idList);
        if (delNotes.error) throw delNotes.error;
        const delTodos = await supabase.from("todos").delete().in("project_id", idList);
        if (delTodos.error) throw delTodos.error;
        const delProjMembers = await supabase.from("project_members").delete().in("project_id", idList);
        if (delProjMembers.error) throw delProjMembers.error;
      }

      // Delete workspace-scoped rows
      const delClients = await supabase.from("clients").delete().eq("workspace_id", targetWorkspace.id);
      if (delClients.error) throw delClients.error;
      const delWsMembers = await supabase.from("workspace_members").delete().eq("workspace_id", targetWorkspace.id);
      if (delWsMembers.error) throw delWsMembers.error;

      // Delete projects
      if (projectIds.length > 0) {
        const delProjects = await supabase.from("projects").delete().in("id", projectIds);
        if (delProjects.error) throw delProjects.error;
      }

      // Finally delete workspace
      const delWorkspace = await supabase.from("workspaces").delete().eq("id", targetWorkspace.id);
      if (delWorkspace.error) throw delWorkspace.error;

      // Log workspace deletion
      await logActions.workspaceDeleted(targetWorkspace.id, targetWorkspace.name);

      // Real-time subscription will handle UI updates
      setConfirmOpen(false);
      setTargetWorkspace(null);
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Failed to delete workspace.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
    <div>
      {invitations.length > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-yellow-900/20 border border-yellow-700">
          <h3 className="text-lg font-semibold text-yellow-300 mb-2">Invitations</h3>
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-2 bg-gray-800/40 border border-gray-700 rounded-lg p-3">
                <div className="text-gray-200 text-sm">
                  Workspace invitation{inv.project_id ? ' + project access' : ''}
                  <div className="text-xs text-gray-400">Workspace role: {inv.workspace_role}{inv.project_role ? `, Project role: ${inv.project_role}` : ''}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-1 rounded bg-green-600 hover:bg-green-500 text-white text-sm"
                    onClick={() => acceptInvitation(inv.id)}
                  >
                    Accept
                  </button>
                  <button
                    className="px-3 py-1 rounded border border-gray-600 hover:bg-gray-700 text-gray-200 text-sm"
                    onClick={() => declineInvitation(inv.id)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Header with new workspace button */}
      <div className="flex justify-between items-center mb-6 mx-auto">
        <h2 className="text-3xl mb-3 text-white">Manage Your Workspaces</h2>
        <Link
          prefetch
          href="/dashboard/workspaces/new"
          className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-full text-sm transition"
        >
          + Create Workspace
        </Link>
      </div>

      {/* Workspace Toggle Buttons */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 mb-6">
        {/* Your Workspaces Toggle */}
        <div className="flex flex-col gap-2">
          <div
            className={`bg-gray-800/40 backdrop-blur-sm border border-gray-700 rounded-2xl shadow p-4 ${ownerWorkspaces.length > 0 ? 'cursor-pointer hover:bg-gray-800/60 hover:border-green-600/50' : 'opacity-80'} transition`}
            onClick={() => {
              if (ownerWorkspaces.length === 0) return;
              const next = !showOwned;
              setShowOwned(next);
              setShowShared(false);
            }}
            role="button"
            aria-pressed={showOwned}
            aria-disabled={ownerWorkspaces.length === 0}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-green-500 font-semibold">My Workspaces</h3>
                <p className="text-gray-300 mt-2 text-sm">{ownerWorkspaces.length} owned</p>
              </div>
              <span
                aria-hidden
                className={`ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-700 ${ownerWorkspaces.length > 0 ? 'text-gray-300 bg-gray-800' : 'text-gray-600 bg-gray-800'} transition-transform ${showOwned ? 'rotate-180' : 'rotate-0'}`}
              >
                ▾
              </span>
            </div>
          </div>
          <AnimatePresence initial={false}>
            {showOwned && ownerWorkspaces.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0, y: -8 }}
                animate={{ height: 'auto', opacity: 1, y: 0 }}
                exit={{ height: 0, opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-2 max-h-[60vh] overflow-y-auto pr-1"
              >
                {ownerWorkspaces.map((ws) => (
                  <div key={ws.id} className="p-4 rounded-2xl bg-gray-800 border border-gray-700 shadow hover:shadow-lg hover:bg-gray-700 transition">
                    <div className="flex justify-between items-start gap-2">
                      <Link href={`/workspace/${ws.id}`} prefetch className="flex-1">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-white">{ws.name}</span>
                          <span className="text-sm text-gray-400">{ws.role}</span>
                        </div>
                        <div className="mt-2 text-sm text-gray-400">
                          👥 {ws.membersCount} members · 📂 {ws.projectsCount} projects
                        </div>
                      </Link>
                    </div>
                    <button
                      className="text-red-400 hover:text-red-300 text-sm whitespace-nowrap mt-3"
                      onClick={() => handleOpenDelete(ws)}
                      title="Delete workspace"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Shared Workspaces Toggle */}
        <div className="flex flex-col gap-2">
          <div
            className={`bg-gray-800/40 backdrop-blur-sm border border-gray-700 rounded-2xl shadow p-4 ${sharedWorkspaces.length > 0 ? 'cursor-pointer hover:bg-gray-800/60 hover:border-blue-600/50' : 'opacity-80'} transition`}
            onClick={() => {
              if (sharedWorkspaces.length === 0) return;
              const next = !showShared;
              setShowShared(next);
              setShowOwned(false);
            }}
            role="button"
            aria-pressed={showShared}
            aria-disabled={sharedWorkspaces.length === 0}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-blue-400 font-semibold">Shared Workspaces</h3>
                <p className="text-gray-300 mt-2 text-sm">{sharedWorkspaces.length} shared</p>
              </div>
              <span
                aria-hidden
                className={`ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-700 ${sharedWorkspaces.length > 0 ? 'text-gray-300 bg-gray-800' : 'text-gray-600 bg-gray-800'} transition-transform ${showShared ? 'rotate-180' : 'rotate-0'}`}
              >
                ▾
              </span>
            </div>
          </div>
          <AnimatePresence initial={false}>
            {showShared && sharedWorkspaces.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0, y: -8 }}
                animate={{ height: 'auto', opacity: 1, y: 0 }}
                exit={{ height: 0, opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-2 max-h-[60vh] overflow-y-auto pr-1"
              >
                {sharedWorkspaces.map((ws) => (
                  <div key={ws.id} className="p-4 rounded-2xl bg-gray-800 border border-gray-700 shadow hover:shadow-lg hover:bg-gray-700 transition">
                    <div className="flex justify-between items-start gap-2">
                      <Link href={`/workspace/${ws.id}`} prefetch className="flex-1">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-white">{ws.name}</span>
                          <span className="text-sm text-gray-400">{ws.role}</span>
                        </div>
                        <div className="mt-2 text-sm text-gray-400">
                          👥 {ws.membersCount} members · 📂 {ws.projectsCount} projects
                        </div>
                      </Link>
                    </div>
                    {ws.role !== 'owner' && (
                      <button
                        className="text-orange-400 hover:text-orange-300 text-sm whitespace-nowrap mt-3"
                        onClick={() => handleOpenLeave(ws)}
                        title="Leave workspace"
                      >
                        Leave
                      </button>
                    )}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
    {confirmOpen && targetWorkspace && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-lg w-full">
          <h3 className="text-lg font-semibold text-white mb-2">Delete workspace</h3>
          <p className="text-gray-300 mb-3">
            You are about to permanently delete <span className="font-semibold">{targetWorkspace.name}</span>.
          </p>
          {targetWorkspace.projectsCount > 0 && (
            <p className="text-yellow-400 mb-2">Warning: This workspace has {targetWorkspace.projectsCount} active project(s).</p>
          )}
          {targetWorkspace.membersCount > 1 && (
            <p className="text-yellow-400 mb-2">Warning: There are {targetWorkspace.membersCount - 1} other member(s) in this workspace.</p>
          )}
          {(targetWorkspace.projectsCount > 0 || targetWorkspace.membersCount > 1) && (
            <div className="mb-3">
              <label className="block text-sm text-gray-400 mb-1">Type "Delete" to confirm</label>
              <input
                className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-gray-100"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Delete"
                autoFocus
              />
            </div>
          )}
          {errorMsg && <p className="text-red-400 mb-2">{errorMsg}</p>}
          <div className="flex gap-2 justify-end mt-4">
            <button
              className="px-4 py-2 rounded border border-gray-700 text-gray-200 hover:bg-gray-800"
              onClick={() => setConfirmOpen(false)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              className={`px-4 py-2 rounded ${deleting ? 'bg-red-900' : 'bg-red-600 hover:bg-red-500'} text-white`}
              onClick={handleDeleteConfirmed}
              disabled={deleting || ((targetWorkspace.projectsCount > 0 || targetWorkspace.membersCount > 1) && confirmText !== "Delete")}
            >
              {deleting ? 'Deleting…' : 'Delete workspace'}
            </button>
          </div>
        </div>
      </div>
    )}

      {/* Loading state */}
      {(loading || localLoading) && <p className="text-gray-400">Loading workspaces...</p>}

      {/* Empty state (only show if NOT loading) */}
      {!loading && !localLoading &&
        ownerWorkspaces.length === 0 &&
        sharedWorkspaces.length === 0 && (
          <p className="text-gray-400">
            You don't have any workspaces yet. Start one now!
          </p>
        )}
    
    {/* Leave Confirmation Modal */}
    {leaveConfirmOpen && targetLeaveWorkspace && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-lg w-full">
          <h3 className="text-lg font-semibold text-white mb-2">Leave workspace</h3>
          <p className="text-gray-300 mb-3">
            Are you sure you want to leave <span className="font-semibold">{targetLeaveWorkspace.name}</span>?
          </p>
          <p className="text-yellow-400 mb-4">
            You will lose access to all projects and data in this workspace. This action cannot be undone.
          </p>
          {errorMsg && <p className="text-red-400 mb-2">{errorMsg}</p>}
          <div className="flex gap-2 justify-end mt-4">
            <button
              className="px-4 py-2 rounded border border-gray-700 text-gray-200 hover:bg-gray-800"
              onClick={() => setLeaveConfirmOpen(false)}
              disabled={leaving}
            >
              Cancel
            </button>
            <button
              className={`px-4 py-2 rounded ${leaving ? 'bg-orange-900' : 'bg-orange-600 hover:bg-orange-500'} text-white`}
              onClick={handleLeaveConfirmed}
              disabled={leaving}
            >
              {leaving ? 'Leaving…' : 'Leave workspace'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
