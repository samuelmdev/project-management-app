'use client';

import { useState, useEffect } from 'react';
import { createClient } from '../../../lib/supabase/client';
import { useParams } from "next/navigation";
import WorkflowSettings from '../components/WorkflowSettings';
import { useWorkspace } from '../components/WorkspaceContext';

export default function SettingsPage() {
  const { id: workspaceId } = useParams<{ id: string }>();
  const supabase = createClient();
  const { workspace, members, userRole, currentUser } = useWorkspace();

  const [workspaceName, setWorkspaceName] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'shared'>('private');
  const [currentUserId, setCurrentUserId] = useState<string>('');

  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'admin' | 'manager' | 'member' | 'limited'>('member');
  const [showModal, setShowModal] = useState(false);

  // Logs state
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [memberFilter, setMemberFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [projects, setProjects] = useState<any[]>([]);

  // ---- Role logic helpers ----
  const canEditGeneral = ["admin", "owner"].includes(userRole ?? "");
  const canEditVisibility = userRole === "owner";
  const canInviteMembers = ["manager", "admin", "owner"].includes(userRole ?? "");
  const canViewLogs = ["admin", "owner"].includes(userRole ?? "");
  const canAssignRoles: string[] =
    {
      manager: ["member", "limited"],
      admin: ["manager", "member", "limited"],
      owner: ["admin", "manager", "member", "limited"],
    }[userRole ?? ""] || [];

  const canRemoveRolesBelow: string[] =
    {
      manager: ["member", "limited"],
      admin: ["manager", "member", "limited"],
      owner: ["admin", "manager", "member", "limited"],
    }[userRole ?? ""] || [];

  // ---- Sync with context data ----
  useEffect(() => {
    if (workspace) {
      setWorkspaceName(workspace.name);
      setVisibility(workspace.visibility);
    }
    if (currentUser) {
      setCurrentUserId(currentUser.id);
    }
  }, [workspace, currentUser]);

  // ---- Fetch projects when logs are shown ----
  useEffect(() => {
    if (canViewLogs && workspaceId && showLogs && projects.length === 0) {
      fetchProjects();
    }
  }, [canViewLogs, workspaceId, showLogs]);

  // ---- Fetch logs when showLogs becomes true ----
  useEffect(() => {
    if (canViewLogs && workspaceId && showLogs && rawLogs.length === 0) {
      fetchLogs();
    }
  }, [canViewLogs, workspaceId, showLogs]);

  // ---- Apply local filtering when filters change ----
  useEffect(() => {
    applyFilters();
  }, [rawLogs, dateFilter, memberFilter, projectFilter]);

  // ---- Actions ----
  async function saveWorkspace() {
    await supabase
      .from('workspaces')
      .update({ name: workspaceName, visibility })
      .eq('id', workspaceId);
  }

  async function fetchLogs() {
    setLogsLoading(true);
    try {
      // Fetch all logs for the workspace
      const { data: logsData, error: logsError } = await supabase
        .from('user_logs')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (logsError) {
        console.error('Error fetching logs:', logsError);
        return;
      }

      if (!logsData || logsData.length === 0) {
        setRawLogs([]);
        return;
      }

      // Get unique user IDs from logs
      const userIds = [...new Set(logsData.map(log => log.user_id))];
      
      // Fetch user profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        // Continue without profiles
      }

      // Create a map of user profiles
      const profilesMap = new Map();
      if (profilesData) {
        profilesData.forEach(profile => {
          profilesMap.set(profile.id, profile);
        });
      }

      // Combine logs with profiles
      const logsWithProfiles = logsData.map(log => ({
        ...log,
        profiles: profilesMap.get(log.user_id) || null
      }));

      setRawLogs(logsWithProfiles);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLogsLoading(false);
    }
  }

  async function fetchProjects() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('workspace_id', workspaceId)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching projects:', error);
        return;
      }

      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  }

  function applyFilters() {
    let filtered = [...rawLogs];

    // Apply date filter
    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      const startOfDay = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      filtered = filtered.filter(log => {
        const logDate = new Date(log.created_at);
        return logDate >= startOfDay && logDate < endOfDay;
      });
    }

    // Apply member filter
    if (memberFilter) {
      filtered = filtered.filter(log => log.user_id === memberFilter);
    }

    // Apply project filter
    if (projectFilter) {
      filtered = filtered.filter(log => log.project_id === projectFilter);
    }

    setFilteredLogs(filtered);
  }

  function toggleLogs() {
    setShowLogs(!showLogs);
    if (!showLogs) {
      // Reset filters when opening logs
      setDateFilter('');
      setMemberFilter('');
      setProjectFilter('');
    }
  }

  function getProjectName(projectId: string) {
    const project = projects.find(p => p.id === projectId);
    return project ? project.name : 'Unknown Project';
  }

  async function inviteMember() {
    const { data: userData } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', newMemberEmail)
      .maybeSingle();
    if (!userData) {
      alert('User not found');
      return;
    }
    await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspaceId,
        user_id: userData.id,
        role: newMemberRole,
      });
    setNewMemberEmail('');
    setNewMemberRole('member');
  }

  async function updateMemberRole(userId: string, role: string) {
    if (!canAssignRoles.includes(role)) return;
    await supabase
      .from('workspace_members')
      .update({ role })
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);
    // Members will be updated automatically via real-time subscription
  }

  async function removeMember(userId: string, role: string) {
    if (!canRemoveRolesBelow.includes(role)) return;
    
    // First, remove user from all projects in this workspace
    // Get all project IDs in this workspace
    const { data: projectsData, error: projectsError } = await supabase
      .from('projects')
      .select('id')
      .eq('workspace_id', workspaceId);
    
    if (!projectsError && projectsData && projectsData.length > 0) {
      const projectIds = projectsData.map(p => p.id);
      
      // Remove user from all projects
      await supabase
        .from('project_members')
        .delete()
        .in('project_id', projectIds)
        .eq('user_id', userId);
    }

    // Then remove user from workspace
    await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);
    
    // Members will be updated automatically via real-time subscription
  }

  function Modal({
    title,
    onClose,
    children,
  }: {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
  }) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <div className="relative z-10 w-full h-full sm:h-auto sm:max-w-lg sm:rounded-2xl bg-gray-900 border border-gray-700 shadow-lg p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              ✕
            </button>
          </div>
          {children}
        </div>
      </div>
    );
  }

  function canEditRole(currentRole: string, targetRole: string, userId: string, currentUserId: string) {
    if (userId === currentUserId) return false; // cannot edit yourself
  
    switch (currentRole) {
      case "owner":
        return true; // can edit all others
      case "admin":
        return targetRole !== "owner" && targetRole !== "admin"; // can edit manager/member/limited
      case "manager":
        return targetRole === "member" || targetRole === "limited"; // only those two
      default:
        return false;
    }
  }
  
  function canRemove(currentRole: string, targetRole: string, userId: string, currentUserId: string) {
    if (userId === currentUserId) return false; // cannot remove yourself
  
    switch (currentRole) {
      case "owner":
        return true;
      case "admin":
        return targetRole !== "owner" && targetRole !== "admin";
      case "manager":
        return targetRole === "member" || targetRole === "limited";
      default:
        return false;
    }
  }

  function formatLogAction(action: string, metadata: any) {
    const meta = metadata || {};
    
    switch (action) {
      // Workspace actions
      case "workspace_created":
        return `Created workspace "${meta.workspace_name || 'Unknown'}"`;
      case "workspace_updated":
        return `Updated workspace "${meta.workspace_name || 'Unknown'}" (${meta.changes || 'changes'})`;
      case "workspace_deleted":
        return `Deleted workspace "${meta.workspace_name || 'Unknown'}"`;
      
      // Project actions
      case "project_created":
        return `Created project "${meta.project_name || 'Unknown'}"`;
      case "project_updated":
        return `Updated project "${meta.project_name || 'Unknown'}" (${meta.changes || 'changes'})`;
      case "project_deleted":
        return `Deleted project "${meta.project_name || 'Unknown'}"`;
      case "project_archived":
        return `Archived project "${meta.project_name || 'Unknown'}"`;
      case "project_restored":
        return `Restored project "${meta.project_name || 'Unknown'}"`;
      
      // Client actions
      case "client_created":
        return `Created client "${meta.client_name || 'Unknown'}"`;
      case "client_updated":
        return `Updated client "${meta.client_name || 'Unknown'}" (${meta.changes || 'changes'})`;
      case "client_deleted":
        return `Deleted client "${meta.client_name || 'Unknown'}"`;
      
      // Task actions
      case "task_created":
        return `Created task "${meta.task_title || 'Unknown'}"`;
      case "task_updated":
        return `Updated task "${meta.task_title || 'Unknown'}" (${meta.changes || 'changes'})`;
      case "task_deleted":
        return `Deleted task "${meta.task_title || 'Unknown'}"`;
      case "task_completed":
        return `Completed task "${meta.task_title || 'Unknown'}"`;
      case "task_reopened":
        return `Reopened task "${meta.task_title || 'Unknown'}"`;
      
      // Notes actions
      case "note_created":
        return `Created note "${meta.name || 'Untitled'}"`;
      case "note_updated":
        return `Updated note "${meta.name || 'Untitled'}" (${meta.changes || 'changes'})`;
      case "note_deleted":
        return `Deleted note "${meta.name || 'Untitled'}"`;
      
      // Files actions
      case "file_uploaded":
        return `Uploaded file "${meta.filename || 'Unknown'}"`;
      case "file_updated":
        return `Updated file "${meta.filename || 'Unknown'}" (${meta.changes || 'changes'})`;
      case "file_deleted":
        return `Deleted file "${meta.filename || 'Unknown'}"`;
      
      // Milestones actions
      case "milestone_created":
        return `Created milestone "${meta.name || 'Unknown'}"`;
      case "milestone_updated":
        return `Updated milestone "${meta.name || 'Unknown'}" (${meta.changes || 'changes'})`;
      case "milestone_deleted":
        return `Deleted milestone "${meta.name || 'Unknown'}"`;
      case "milestone_completed":
        return `Completed milestone "${meta.name || 'Unknown'}"`;
      
      // Member management actions
      case "workspace_member_added":
        return `Added member "${meta.member_email || 'Unknown'}" as ${meta.member_role || 'member'}`;
      case "workspace_member_removed":
        return `Removed member "${meta.member_email || 'Unknown'}"`;
      case "workspace_member_role_changed":
        return `Changed role of "${meta.member_email || 'Unknown'}" from ${meta.previous_role || 'unknown'} to ${meta.member_role || 'unknown'}`;
      case "workspace_left":
        return `Left workspace`;
      case "project_member_added":
        return `Added project member "${meta.member_email || 'Unknown'}" as ${meta.member_role || 'member'}`;
      case "project_member_removed":
        return `Removed project member "${meta.member_email || 'Unknown'}"`;
      case "project_member_role_changed":
        return `Changed project member role of "${meta.member_email || 'Unknown'}" from ${meta.previous_role || 'unknown'} to ${meta.member_role || 'unknown'}`;
      
      default:
        return `Performed action: ${action.replace(/_/g, ' ')}`;
    }
  }  

  // ---- Access Gate ----
  if (userRole === "member" || userRole === "limited") {
    return (
      <div className="p-6 text-center text-red-500 font-semibold">
        No access to this page.
      </div>
    );
  }

  return (
    <div className="md:space-y-6 space-y-3 max-w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-semibold text-white">Workspace Settings</h1>
        {["admin", "owner"].includes(userRole ?? "") && (
          <WorkflowSettings workspaceId={workspaceId} />
        )}
      </div>

      {/* General Settings */}
      {canEditGeneral ? (
        <div className="max-w-[calc(100vw-3rem)] mx-auto bg-gray-800/40 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-lg p-4 space-y-3 overflow-hidden">
<div className="min-w-0">
            <label className="block font-medium text-gray-300 mb-1">Workspace Name</label>
            
            <input
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              className="max-w-md p-2 rounded bg-gray-700 text-white border border-gray-600"
            />
          </div>
            <div>
          <div>
            <label className="block font-medium text-gray-300 mb-1">Visibility</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'private' | 'shared')}
              disabled={!canEditVisibility || (members.length > 1 && visibility === 'shared')}
              className={`p-2 rounded border ${
                !canEditVisibility || (members.length > 1 && visibility === 'shared')
                  ? "bg-gray-600 text-gray-400 border-gray-500 cursor-not-allowed"
                  : "bg-gray-700 text-white border-gray-600"
              }`}
            >
              <option value="private">Private</option>
              <option value="shared">Shared with Team</option>
            </select>
            {!canEditVisibility && (
              <p className="text-xs text-gray-400 mt-1">
                Only workspace owners can change visibility settings
              </p>
            )}
            {canEditVisibility && members.length > 1 && visibility === 'shared' && (
              <p className="text-xs text-yellow-400 mt-1">
                Remove workspace members to change back to private
              </p>
            )}
          </div>

          <button
            onClick={saveWorkspace}
            className="px-4 py-2 mt-6 bg-green-600 text-white rounded hover:bg-green-500 transition"
          >
            Save Workspace
          </button>
          </div>
        </div> ) : (
          <div className="max-w-[calc(100vw-3rem)] mx-auto bg-gray-800/40 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-lg p-4 space-y-3 overflow-hidden">
<h2 className="text-xl font-semibold text-white mb-3">Workspace Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
              <div className="min-w-0">
                <label className="block font-medium text-gray-300 mb-1">Workspace Name</label>
                <div className="p-2 rounded bg-gray-700/50 text-white border border-gray-600 truncate break-words">
  {workspaceName}
</div>
              </div>
              <div className="min-w-0">
                <label className="block font-medium text-gray-300 mb-1">Visibility</label>
                <div className="p-2 rounded bg-gray-700/50 text-white border border-gray-600 capitalize">
                  {visibility}
                </div>
              </div>
              <div className="min-w-0">
                <label className="block font-medium text-gray-300 mb-1">Your Role</label>
                <div className="p-2 rounded bg-gray-700/50 text-white border border-gray-600 capitalize">
                  {userRole}
                </div>
              </div>
              <div className="min-w-0">
                <label className="block font-medium text-gray-300 mb-1">Member Count</label>
                <div className="p-2 rounded bg-gray-700/50 text-white border border-gray-600">
                  {members.length} {members.length === 1 ? 'member' : 'members'}
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
              <p className="text-sm text-blue-200">
                <strong>Manager Access:</strong> You can invite and manage members, but cannot modify workspace settings. 
                Contact an admin or owner to change workspace name or visibility.
              </p>
            </div>
          </div>
          )}

        {/* Members Section (only if shared) */}
        {visibility === 'shared' && canInviteMembers && (
        <div className="max-w-[calc(100vw-3rem)] lg:w-[70vw] mx-auto bg-gray-800/40 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-lg p-4 space-y-3 overflow-hidden">
          {/* Section Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Workspace Members</h2>
            <button
              onClick={() => setShowModal(true)}
              className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-500 text-gray-300 hover:bg-gray-700"
              title="Workspace roles explained"
            >
              ?
            </button>
          </div>

          {/* Invite Member */}
          <div className="flex flex-col md:flex-row gap-2 md:items-end">
            <input
              type="email"
              placeholder="Email"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              className="flex-1 p-2 rounded bg-gray-700 text-white border border-gray-600"
            />
            <select
              value={newMemberRole}
              onChange={(e) => setNewMemberRole(e.target.value as any)}
              className="p-2 rounded bg-gray-700 text-white border border-gray-600"
            >
              {canAssignRoles.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            <button
              onClick={inviteMember}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition"
            >
              Invite
            </button>
          </div>

          {/* Member List */}
          <div className="overflow-x-auto -mx-2 sm:mx-0">
  <table className="min-w-[500px] lg:w-[70vw] text-left border-collapse">
              <thead>
                <tr className="bg-gray-700 text-white">
                  <th className="p-2 border border-gray-600">Name</th>
                  <th className="p-2 border border-gray-600">Email</th>
                  <th className="p-2 border border-gray-600">Role</th>
                  <th className="p-2 border border-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
              {members.map((m) => (
                
  <tr key={m.user_id} className="border-b border-gray-600">
    <td className="p-2">{m.profiles?.full_name || '—'}</td>
    <td className="p-2">{m.profiles?.email}</td>
    <td className="p-2">
      {canEditRole(userRole ?? "", m.role, m.user_id, currentUserId) ? (
        <select
          value={m.role}
          onChange={(e) => updateMemberRole(m.user_id, e.target.value)}
          className="border px-1 py-0.5 rounded bg-gray-700 text-white border-gray-600"
        >
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="member">Member</option>
          <option value="limited">Limited</option>
        </select>
      ) : (
        <span className="text-gray-400">{m.role}</span>
      )}
    </td>
    <td className="p-2">
      {canRemove(userRole ?? "", m.role, m.user_id, currentUserId) && (
        <button
          onClick={() => removeMember(m.user_id, m.role)}
          className="text-red-500 hover:text-red-600 transition"
        >
          Remove
        </button>
      )}
    </td>
  </tr>
))}

              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Logs Section (only for owners and admins, and only if more than 1 member) */}
      {canViewLogs && members.length > 1 && (
        <div className="max-w-[calc(100vw-3rem)] mx-auto bg-gray-800/40 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-lg p-4 space-y-3 overflow-hidden">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Activity Logs</h2>
            {!showLogs && (
              <button
                onClick={toggleLogs}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition"
              >
                View Logs
              </button>
            )}
            {showLogs && (
              <button
                onClick={toggleLogs}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition"
              >
                Hide Logs
              </button>
            )}
          </div>
          
          {/* Filters and Logs List - only show when logs are visible */}
          {showLogs && (
            <>
              {/* Filters */}
              <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-1">Filter by Date</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-1">Filter by Member</label>
              <select
                value={memberFilter}
                onChange={(e) => setMemberFilter(e.target.value)}
                className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600"
              >
                <option value="">All Members</option>
                {members.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.profiles?.full_name || member.profiles?.email || 'Unknown'}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-1">Filter by Project</label>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600"
              >
                <option value="">All Projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setDateFilter('');
                  setMemberFilter('');
                  setProjectFilter('');
                }}
                className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Logs List */}
          <div className="max-h-96 overflow-y-auto">
            {logsLoading ? (
              <div className="text-center py-4 text-gray-400">Loading logs...</div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-4 text-gray-400">No logs found</div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="bg-gray-700/50 rounded-lg p-3 border border-gray-600">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-white">
                            {log.profiles?.full_name || log.profiles?.email || 'Unknown User'}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-sm text-gray-300">
                          {formatLogAction(log.action, log.metadata)}
                        </div>
                        {log.project_id && (
                          <div className="text-xs text-gray-400 mt-1">
                            Project: {getProjectName(log.project_id)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
            </>
          )}
        </div>
      )}

      {/* Roles Modal */}
      {showModal && (
        <Modal title="Workspace Roles" onClose={() => setShowModal(false)}>
          <div className="max-w-full">
            <table className="table-auto border-collapse border border-gray-500 max-w-[85vw] md:w-full text-sm">
              <thead>
                <tr className="bg-gray-600 text-white">
                  <th className="border border-gray-500 px-4 py-2">Role</th>
                  <th className="border border-gray-500 px-4 py-2">Access Level</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-500 px-4 py-2 font-bold">Owner</td>
                  <td className="border border-gray-500 px-4 py-2 text-gray-200">
                    Superadmin: full control of workspace and members, can assign/remove any role.
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-500 px-4 py-2 font-bold">Admin</td>
                  <td className="border border-gray-500 px-4 py-2 text-gray-200">
                    Full control except over Owner, can manage Manager/Member/Limited roles.
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-500 px-4 py-2 font-bold">Manager</td>
                  <td className="border border-gray-500 px-4 py-2 text-gray-200">
                    Can invite/manage Members and Limited, handle projects, limited settings.
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-500 px-4 py-2 font-bold">Member</td>
                  <td className="border border-gray-500 px-4 py-2 text-gray-200">
                    Work on projects, no access to workspace settings.
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-500 px-4 py-2 font-bold">Limited</td>
                  <td className="border border-gray-500 px-4 py-2 text-gray-200">
                    Read-only access to projects, no workspace settings access.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}
