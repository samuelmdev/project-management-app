'use client'

import { useEffect, useState } from "react";
import { SupabaseClient } from "@supabase/supabase-js";

type Member = {
  id: string;
  user_id: string;
  role: string;
  email: string;
  full_name?: string;
};

type MemberManagementProps = {
  supabase: SupabaseClient;
  projectId: string;
  currentUserRole?: 'read' | 'write' | 'admin' | 'owner';
  projectMembers: Member[];
  workspaceId: string;
};

export default function MemberManagement({ 
  supabase, 
  projectId, 
  currentUserRole = 'read', 
  projectMembers, 
  workspaceId 
}: MemberManagementProps) {
  const [members, setMembers] = useState<Member[]>(projectMembers);
  const [loading, setLoading] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('read');
  const [adding, setAdding] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<Array<{
    user_id: string;
    email: string;
    full_name?: string;
    role: string;
  }>>([]);
  const [loadingWorkspaceMembers, setLoadingWorkspaceMembers] = useState(false);
  
  const isOwner = currentUserRole === 'owner';
  const isAdmin = currentUserRole === 'admin' || isOwner;

  // Sync members state when projectMembers prop changes
  useEffect(() => {
    setMembers(projectMembers);
  }, [projectMembers]);

  // Fetch workspace members for adding to project
  const fetchWorkspaceMembers = async () => {
    setLoadingWorkspaceMembers(true);
    try {
      const { data: workspaceMembersData, error } = await supabase
        .from("workspace_members")
        .select("user_id, role")
        .eq("workspace_id", workspaceId);

      if (error) {
        console.error("Error fetching workspace members:", error);
        return;
      }

      if (workspaceMembersData && workspaceMembersData.length > 0) {
        // Fetch profiles separately
        const userIds = workspaceMembersData.map(m => m.user_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", userIds);

        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
          return;
        }

        const membersWithProfiles = workspaceMembersData.map(member => {
          const profile = profilesData?.find(p => p.id === member.user_id);
          return {
            user_id: member.user_id,
            email: profile?.email || '',
            full_name: profile?.full_name || '',
            role: member.role
          };
        });

        // Filter out members who are already in the project
        const currentProjectUserIds = members.map(m => m.user_id);
        const availableMembers = membersWithProfiles.filter(
          member => !currentProjectUserIds.includes(member.user_id)
        );

        setWorkspaceMembers(availableMembers);
      } else {
        setWorkspaceMembers([]);
      }
    } catch (error) {
      console.error("Error fetching workspace members:", error);
    } finally {
      setLoadingWorkspaceMembers(false);
    }
  };

  const addMember = async (userId: string, email: string, fullName?: string) => {
    if (!isAdmin) return;

    setAdding(true);
    try {
      // Insert project_member
      const { data: newMember, error } = await supabase
        .from("project_members")
        .insert({
          project_id: projectId,
          user_id: userId,
          role: newRole
        })
        .select()
        .single();

      if (error) {
        alert(error.message);
        return;
      }

      // The real-time subscription will handle updating the members list
      setNewRole('read');
      setShowAddMember(false);
    } catch (error) {
      console.error("Error adding member:", error);
      alert("Failed to add member");
    } finally {
      setAdding(false);
    }
  };

  const changeRole = async (memberId: string, role: string) => {
    if (!isAdmin) return;
    const { error } = await supabase
      .from("project_members")
      .update({ role })
      .eq("id", memberId);

    if (error) return alert(error.message);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m));
  };

  const removeMember = async (memberId: string, memberEmail: string) => {
    if (!confirm(`Are you sure you want to remove ${memberEmail} from this project?`)) return;
    
    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("id", memberId);

    if (error) return alert(error.message);
    setMembers(prev => prev.filter(m => m.id !== memberId));
  };

  // Helper function to check if current user can remove a member
  const canRemoveMember = (memberRole: string) => {
    // Nobody can remove owners (including themselves)
    if (memberRole === 'owner') {
      return false;
    }
    
    if (isOwner) {
      // Owner can remove all project members except other owners
      return true;
    } else if (isAdmin) {
      // Admin can remove read and write role members (but not other admins or owners)
      return memberRole === 'read' || memberRole === 'write';
    }
    return false;
  };

  return (
    <div className="space-y-4 max-w-md w-[90vw]">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Project Members</h3>
        {isAdmin && (
          <button
            onClick={() => {
              setShowAddMember(!showAddMember);
              if (!showAddMember) {
                fetchWorkspaceMembers();
              }
            }}
            className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-sm transition"
          >
            {showAddMember ? 'Cancel' : 'Add Member'}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-gray-400">Loading members...</p>
      ) : members.length === 0 ? (
        <p className="text-gray-400">No members yet</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {members.map(m => (
            <div key={m.id} className="flex justify-between items-center p-2 bg-gray-700 rounded shadow-sm">
              <span className="text-sm text-gray-200 overflow-x-auto flex-1">{m.email}</span>
              <div className="flex items-center gap-2">
                {
                  // Owners: show both Owner and Admin tags visually per requirement
                }
                {m.role === 'owner' ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs px-2 py-0.5 rounded-full border border-gray-500 text-gray-200">owner</span>
                    <span className="text-xs px-2 py-0.5 rounded-full border border-gray-500 text-gray-200">admin</span>
                  </div>
                ) : m.role === 'admin' ? (
                  // Only owners can change roles of admins
                  isOwner ? (
                    <select
                      value={m.role}
                      onChange={(e) => changeRole(m.id, e.target.value)}
                      className="text-sm bg-gray-600 border border-gray-500 text-white rounded px-2 py-1"
                    >
                      {['read', 'write', 'admin'].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full border border-gray-500 text-gray-200">admin</span>
                  )
                ) : (
                  // read/write: admins and owners can edit; others see tag
                  isAdmin ? (
                    <select
                      value={m.role}
                      onChange={(e) => changeRole(m.id, e.target.value)}
                      className="text-sm bg-gray-600 border border-gray-500 text-white rounded px-2 py-1"
                    >
                      {['read', 'write', 'admin'].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full border border-gray-500 text-gray-200">{m.role}</span>
                  )
                )}
                
                {/* Remove button */}
                {canRemoveMember(m.role) && (
                  <button
                    onClick={() => removeMember(m.id, m.email)}
                    className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded border border-red-500 hover:border-red-400 transition-colors"
                    title={`Remove ${m.email} from project`}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Member Section */}
      {showAddMember && isAdmin && (
        <div className="space-y-3 p-3 border border-gray-600 rounded bg-gray-800">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-200">Add Workspace Member</h4>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="text-sm bg-gray-600 border border-gray-500 text-white rounded px-2 py-1"
            >
              <option value="read">Read</option>
              <option value="write">Write</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          
          {loadingWorkspaceMembers ? (
            <p className="text-gray-400 text-sm">Loading workspace members...</p>
          ) : workspaceMembers.length === 0 ? (
            <p className="text-gray-400 text-sm">All workspace members are already in this project</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {workspaceMembers.map(member => (
                <div key={member.user_id} className="flex justify-between items-center p-2 bg-gray-700 rounded">
                  <div className="flex-1">
                    <div className="text-sm text-gray-200">{member.email}</div>
                    {member.full_name && (
                      <div className="text-xs text-gray-400">{member.full_name}</div>
                    )}
                    <div className="text-xs text-gray-500">Workspace: {member.role}</div>
                  </div>
                  <button
                    onClick={() => addMember(member.user_id, member.email, member.full_name)}
                    disabled={adding}
                    className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white px-3 py-1 rounded text-sm transition"
                  >
                    {adding ? 'Adding...' : 'Add'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
