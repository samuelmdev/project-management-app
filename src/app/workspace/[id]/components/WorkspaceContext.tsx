'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useRef } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { User } from '@supabase/supabase-js';

interface WorkspaceMember {
  user_id: string;
  role: string;
  profiles?: {
    full_name: string;
    email: string;
  } | null;
}

interface Project {
  id: string;
  name: string;
  description?: string | null;
  status_index: number;
  client_id: string | null;
  archived: boolean;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
  contact_method: string | null;
  notes: string | null;
  created_at: string;
}

interface Workspace {
  id: string;
  name: string;
  visibility: 'private' | 'shared';
}

interface WorkspaceContextType {
  workspace: Workspace | null;
  members: WorkspaceMember[];
  projects: Project[];
  clients: Client[];
  userRole: string | null;
  currentUser: User | null;
  loading: boolean;
  realtimeWorking: boolean;
  refreshData: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}

interface WorkspaceProviderProps {
  children: ReactNode;
  workspaceId: string;
}

export function WorkspaceProvider({ children, workspaceId }: WorkspaceProviderProps) {
  // Memoize supabase client to prevent recreation on each render
  const supabase = useMemo(() => createClient(), []);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [realtimeWorking, setRealtimeWorking] = useState(true);
  

  const refreshData = async () => {
    if (!currentUser) return;

    try {
      // Fetch workspace data
      const { data: workspaceData } = await supabase
        .from('workspaces')
        .select('id, name, visibility')
        .eq('id', workspaceId)
        .single();

      if (workspaceData) {
        setWorkspace(workspaceData);
      }

      // Fetch user role
      const { data: roleData } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', currentUser.id)
        .maybeSingle();

      setUserRole(roleData?.role || null);

      // Fetch members (always fetch, regardless of visibility)
      const { data: membersData } = await supabase
        .from('workspace_members')
        .select('user_id, role, profiles(full_name, email)')
        .eq('workspace_id', workspaceId);

      // Map the data to match our interface
      const mappedMembers = (membersData || []).map((member: any) => ({
        user_id: member.user_id,
        role: member.role,
        profiles: member.profiles
      }));
      
      setMembers(mappedMembers);

      // Fetch projects
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name, description, status_index, client_id, archived, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      setProjects(projectsData || []);

      // Fetch clients
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, name, contact_method, notes, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      setClients(clientsData || []);
    } catch (error) {
      // Error refreshing workspace data
    }
  };

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    fetchUser();
  }, [supabase]);

  // Initial data load
  useEffect(() => {
    if (currentUser) {
      refreshData().finally(() => setLoading(false));
      
      // Set a timeout to ensure loading state doesn't get stuck
      const timeout = setTimeout(() => {
        setLoading(false);
      }, 10000); // 10 second timeout
      
      return () => clearTimeout(timeout);
    }
  }, [currentUser, workspaceId]);

  // Real-time subscriptions
  useEffect(() => {
    if (!currentUser || !workspaceId) return;
  
  
    const channel = supabase
      .channel(`workspace-${workspaceId}-realtime`)
      // Workspace updates
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workspaces', filter: `id=eq.${workspaceId}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setWorkspace(payload.new as Workspace);
          }
        }
      )
      // Members updates (filtered only to this workspace)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          refreshData(); // simplest: re-fetch members & roles
        }
      )
      // Projects
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          refreshData(); // or do granular update
        }
      )
      // Clients
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clients', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          refreshData();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeWorking(true);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeWorking(false);
        }
      });
  
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, workspaceId, supabase]);
  


  const value: WorkspaceContextType = {
    workspace,
    members,
    projects,
    clients,
    userRole,
    currentUser,
    loading,
    realtimeWorking,
    refreshData,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
