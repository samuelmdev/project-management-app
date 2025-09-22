"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { createClient } from "@/app/lib/supabase/client";
import { User } from "@supabase/supabase-js";

interface WorkspaceLite {
  id: string;
  name: string;
  role: string;
  membersCount: number;
}

interface Workspace {
  id: string;
  name: string;
  role: string;
  membersCount: number;
  projectsCount: number;
}

interface Invitation {
  id: string;
  workspace_id: string;
  project_id?: string;
  email: string;
  workspace_role: string;
  project_role?: string;
  accepted: boolean;
  created_at: string;
}

interface DashboardContextType {
  ownerWorkspaces: WorkspaceLite[];
  sharedWorkspaces: WorkspaceLite[]; // Workspaces with more than 1 member
  invitations: Invitation[];
  currentUser: User | null;
  loading: boolean;
  acceptInvitation: (invitationId: string) => Promise<void>;
  declineInvitation: (invitationId: string) => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}

interface DashboardProviderProps {
  children: ReactNode;
}

export function DashboardProvider({ children }: DashboardProviderProps) {
  const supabase = createClient();
  const [ownerWorkspaces, setOwnerWorkspaces] = useState<WorkspaceLite[]>([]);
  const [sharedWorkspaces, setSharedWorkspaces] = useState<WorkspaceLite[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getUser();
  }, [supabase]);

  // Initial data fetch and real-time subscriptions
  useEffect(() => {
    if (!currentUser) return;

    const fetchInitialData = async () => {
      console.log('🔄 Dashboard: fetchInitialData called');
      // Fetch user's workspace memberships with member counts
      const { data: userMemberships, error: membershipError } = await supabase
        .from("workspace_members")
        .select(`
          role,
          workspace_id,
          workspaces ( 
            id, 
            name,
            workspace_members(count)
          )
        `)
        .eq("user_id", currentUser.id);

      if (!membershipError && userMemberships) {
        const mapped: WorkspaceLite[] = userMemberships
          .filter((wm: any) => wm.workspaces)
          .map((wm: any) => ({
            id: wm.workspaces.id as string,
            name: wm.workspaces.name as string,
            role: wm.role as string,
            membersCount: wm.workspaces.workspace_members?.[0]?.count ?? 0,
          }));

        // Your Workspaces = workspaces where user has owner role
        const owned = mapped.filter(w => w.role === 'owner');
        console.log('🔄 Dashboard: Setting owner workspaces:', owned.length);
        setOwnerWorkspaces(owned);

        // Shared Workspaces = workspaces with more than 1 member (regardless of user's role)
        const shared = mapped.filter(w => w.membersCount > 1);
        console.log('🔄 Dashboard: Setting shared workspaces:', shared.length);
        setSharedWorkspaces(shared);
      }

      // Fetch invitations
      const { data: invitesData, error: invitesError } = await supabase
        .from("invitations")
        .select("*")
        .eq("email", currentUser.email)
        .eq("accepted", false);

      if (!invitesError && invitesData) {
        setInvitations(invitesData as Invitation[]);
      }

      console.log('✅ Dashboard: fetchInitialData completed successfully');
      setLoading(false);
    };

    fetchInitialData();

    // Set up real-time subscriptions
    console.log('🔧 Dashboard: Setting up real-time subscription for user:', currentUser.id);
    const channel = supabase
      .channel(`dashboard-${currentUser.id}`)
      
      // --- Workspace Members ---
.on(
  'postgres_changes',
  { event: 'DELETE', schema: 'public', table: 'workspace_members' },
  async (payload) => {
    const oldRow = payload.old as any;
    const workspaceId = oldRow?.workspace_id;

    console.log("🗑️ Dashboard: DELETE event", payload);

    // If *any* member was removed, we can’t trust local counts → refetch
    await fetchInitialData();
  }
)

.on(
  'postgres_changes',
  { event: 'INSERT', schema: 'public', table: 'workspace_members' },
  async (payload) => {
    const newRow = payload.new as any;
    const workspaceId = newRow?.workspace_id;

    console.log("➕ Dashboard: INSERT event", payload);

    // If this is the current user, refetch fully
    if (newRow?.user_id === currentUser.id) {
      console.log("Current user joined a workspace, refreshing...");
      await fetchInitialData();
      return;
    }

    // Otherwise, just bump member counts
    const { count } = await supabase
      .from("workspace_members")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    if (count !== null) {
      setOwnerWorkspaces(prev =>
        prev.map(w => w.id === workspaceId ? { ...w, membersCount: count } : w)
      );
      setSharedWorkspaces(prev => {
        const updated = prev.map(w => w.id === workspaceId ? { ...w, membersCount: count } : w);
        return count > 1 ? updated : updated.filter(w => w.id !== workspaceId);
      });
    }
  }
)

.on(
  'postgres_changes',
  { event: 'UPDATE', schema: 'public', table: 'workspace_members' },
  async (payload) => {
    const newRow = payload.new as any;
    const workspaceId = newRow?.workspace_id;

    console.log("🔄 Dashboard: UPDATE event", payload);

    // If this is the current user’s role change → refetch fully
    if (newRow?.user_id === currentUser.id) {
      console.log("Current user role changed, refreshing...");
      await fetchInitialData();
      return;
    }

    // Otherwise just bump counts
    const { count } = await supabase
      .from("workspace_members")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    if (count !== null) {
      setOwnerWorkspaces(prev =>
        prev.map(w => w.id === workspaceId ? { ...w, membersCount: count } : w)
      );
      setSharedWorkspaces(prev => {
        const updated = prev.map(w => w.id === workspaceId ? { ...w, membersCount: count } : w);
        return count > 1 ? updated : updated.filter(w => w.id !== workspaceId);
      });
    }
  }
)
      
      // Listen to invitations changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invitations',
          filter: `email=eq.${currentUser.email}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setInvitations(prev => [payload.new as Invitation, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedInvitation = payload.new as Invitation;
            setInvitations(prev =>
              prev.map(inv => inv.id === updatedInvitation.id ? updatedInvitation : inv)
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedInvitation = payload.old as { id: string };
            setInvitations(prev => prev.filter(inv => inv.id !== deletedInvitation.id));
          }
        }
      )
      
      // Test broadcast listener
      .on('broadcast', { event: 'test' }, (payload) => {
        console.log('🧪 Dashboard: Received test broadcast:', payload);
      })
      
      .subscribe((status) => {
        console.log('📡 Dashboard subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Dashboard real-time subscription is active');
          console.log('🧪 Dashboard: Testing subscription with a broadcast message...');
          // Test if subscription is working by sending a test message
          channel.send({
            type: 'broadcast',
            event: 'test',
            payload: { message: 'Dashboard subscription test' }
          });
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Dashboard subscription error');
        }
      });

    return () => {
      console.log('🧹 Dashboard: Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [currentUser, supabase]);

  // Helper functions for invitation actions
  const acceptInvitation = async (invitationId: string) => {
    if (!currentUser) return;
    
    const invitation = invitations.find(inv => inv.id === invitationId);
    if (!invitation) return;

    try {
      // Add to workspace_members
      await supabase.from('workspace_members').insert({ 
        workspace_id: invitation.workspace_id, 
        user_id: currentUser.id, 
        role: invitation.workspace_role 
      });
      
      // Add to project_members if applicable
      if (invitation.project_id && invitation.project_role) {
        await supabase.from('project_members').insert({ 
          project_id: invitation.project_id, 
          user_id: currentUser.id, 
          role: invitation.project_role 
        });
      }
      
      // Mark invitation as accepted
      await supabase.from('invitations').update({ accepted: true }).eq('id', invitationId);
      
      // Real-time subscription will handle the UI updates
    } catch (error) {
      console.error('Error accepting invitation:', error);
    }
  };

  const declineInvitation = async (invitationId: string) => {
    try {
      await supabase.from('invitations').update({ accepted: false }).eq('id', invitationId);
      // Real-time subscription will handle the UI updates
    } catch (error) {
      console.error('Error declining invitation:', error);
    }
  };

  const value: DashboardContextType = {
    ownerWorkspaces,
    sharedWorkspaces,
    invitations,
    currentUser,
    loading,
    acceptInvitation,
    declineInvitation,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}
