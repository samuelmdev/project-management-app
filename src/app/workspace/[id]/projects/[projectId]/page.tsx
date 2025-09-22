"use client";

import { useEffect, useState, useRef, useCallback, SetStateAction, JSX } from "react";
import { createClient } from "../../../../lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import MemberManagement from "./MemberManagement";
import { type User } from "@supabase/supabase-js";
import ClientInfo from "./ClientInfo";
import MilestonesComponent from "./MilestonesComponent";
import FilesComponent from "./FilesComponent";
import TodosComponent from "./TodosComponent";
import NotesComponent from "./NotesComponent";
import { X } from "lucide-react";
import { useWorkspace } from "../../components/WorkspaceContext";

type WorkflowStep = { name: string; color: string };

type Status = string; // since workflow is dynamic


type Todo = { id: string; content: string; status: Status; status_index: number; completed: boolean; created_at: string; project_id: string; tag: { name: string; color: string } | null };
type Note = { 
  id: string;
  content: string;
  created_at: string;
  priority: number;
  color: string;};
type FileEntry = { 
  id: string; 
  project_id: string; 
  filename: string; 
  path: string; 
  type: string | null; 
  size: number; 
  created_at: string; 
};
type Milestone = { id: string; title: string; percent: number; created_at: string; project_id: string };

type Role = "read" | "write" | "admin" | "owner";


export default function ProjectPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const supabase = createClient();
  const router = useRouter();
  const workspaceId = params.id as string;
  const { members: workspaceMembers } = useWorkspace();
  const [workflow, setWorkflow] = useState<{ name: string; color: string }[]>([]);
  const [projectExists, setProjectExists] = useState<boolean | null>(null);


  const [user, setUser] = useState<User | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [projectStatus, setProjectStatus] = useState<string | null>(null);
  const [projectClientId, setProjectClientId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [isArchived, setIsArchived] = useState<boolean>(false);
  const [projectMissing, setProjectMissing] = useState(false);

  const [userLoading, setUserLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);

  const [memberCount, setMemberCount] = useState<number>(0)
  const [projectMembers, setProjectMembers] = useState<Array<{
    id: string;
    user_id: string;
    role: string;
    email: string;
    full_name?: string;
  }>>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  const [showMembersModal, setShowMembersModal] = useState(false); const [showClientModal, setShowClientModal] = useState(false);

  const [view, setView] = useState<"Tasks" | "Notes" | "Files" | "Milestones">("Tasks");
  const isAdminLike = userRole === "admin" || userRole === "owner";
  // In archived projects, no one can edit; when not archived, admins/owners and writers can edit
  const canWrite = !isArchived && (isAdminLike || userRole === "write");
  const statusNames = workflow.map((w) => w.name);
  const [projectStatusIndex, setProjectStatusIndex] = useState<number | null>(null);


  // 🔹 define views
  const views: Record<string, JSX.Element> = {
    Tasks: (
      <TodosComponent
        projectId={projectId}
        workspaceId={workspaceId}
        todos={todos}
        workflow={workflow}
        canWrite={canWrite}
        onTodosChange={(next) => {
          setTodos(next as any);
          updateProjectStatus(next as any);
        }}
      />
    ),
    Notes: <NotesComponent projectId={projectId} notes={notes} canWrite={canWrite} />,
    Files: <FilesComponent projectId={projectId} files={files} canWrite={canWrite} />,
    Milestones: <MilestonesComponent projectId={projectId} todos={todos} canWrite={canWrite} workflow={workflow} />,
  };

  const viewKeys = Object.keys(views)
  const prevIndexRef = useRef(0);

  const currentIndex = viewKeys.indexOf(view);
  const prevIndex = prevIndexRef.current;
  const direction = currentIndex > prevIndex ? 1 : -1;

  // update ref after render
  useEffect(() => {
  prevIndexRef.current = currentIndex;
}, [currentIndex]);

  const variants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 100 : -100,   // new view comes in from right if dir>0, else from left
    opacity: 1,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -100 : 100,   // old view exits opposite
    opacity: 1,
  }),
};

  // 🔹 fetch user
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setUserLoading(false)
    };
    fetchUser();
  }, [supabase]);

  // 🔹 fetch initial project data
// inside your ProjectPage.tsx (or wherever you manage project state)
useEffect(() => {
  if (!user) return;
  if (!workspaceId) return;
  if (projectId === "new") return; // Don't fetch data for "new" route

  const loadData = async () => {
    const { data, error } = await supabase
      .from("workspaces")
      .select("workflow")
      .eq("id", workspaceId)
      .maybeSingle();

    if (error) {
      console.error("Error loading workflow:", error);
      return;
    }
    console.log(data)
    const workflowArray: WorkflowStep[] = data?.workflow ?? [];
setWorkflow(workflowArray);

    // 🔹 Project - Check if project exists
    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("name, status_index, client_id, archived")
      .eq("id", projectId)
      .maybeSingle();
    
    console.log("Project data:", projectData);
    console.log("Project error:", projectError);

    // Check if project exists
    if (!projectData && !projectError) {
      console.log("❌ Project not found, setting projectMissing to true");
      setProjectMissing(true);
      setProjectExists(false);
      setDataLoading(false); // Clear loading state
      
      // Show "Project deleted" message briefly, then redirect
      setTimeout(() => {
        router.replace(`/workspace/${workspaceId}/projects`);
        // Replace current history entry to prevent back navigation
        window.history.replaceState(null, '', `/workspace/${workspaceId}/projects`);
      }, 2000);
      
      return; // Exit early if project doesn't exist
    }

    if (projectError) {
      console.error("Error loading project:", projectError);
      setProjectMissing(true);
      setProjectExists(false);
      setDataLoading(false); // Clear loading state
      return;
    }

    setProjectExists(true);
    setProjectMissing(false);
    setProjectName(projectData?.name ?? "Untitled Project");
    setProjectClientId(projectData?.client_id ?? null);
    setIsArchived(!!projectData?.archived);
    setProjectStatusIndex(projectData?.status_index ?? 0);
   /* const projectStatusName =
      workflowArray[projectData?.status_index ?? 0]?.name ?? null;
    setProjectStatus(projectStatusName); */

    // 🔹 Project Members (count + role + full list)
    const { count, error: countError } = await supabase
      .from("project_members")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);

    if (countError) {
      console.error("Member count fetch error:", countError);
    } else {
      setMemberCount(count ?? 0);
    }

    // Fetch full project members list with profiles
    const { data: membersData, error: membersError } = await supabase
      .from("project_members")
      .select("id, user_id, role")
      .eq("project_id", projectId);

    if (membersError) {
      console.error("Project members fetch error:", membersError);
    } else if (membersData && membersData.length > 0) {
      // Fetch profiles separately
      const userIds = membersData.map(m => m.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      if (profilesError) {
        console.error("Profiles fetch error:", profilesError);
      } else {
        const membersWithProfiles = membersData.map(member => {
          const profile = profilesData?.find(p => p.id === member.user_id);
          return {
            id: member.id,
            user_id: member.user_id,
            role: member.role,
            email: profile?.email || '',
            full_name: profile?.full_name || ''
          };
        });
        setProjectMembers(membersWithProfiles);
      }
    } else {
      setProjectMembers([]);
    }

    const { data: roleData } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    // Fallback: if user is a workspace owner, grant owner privileges at project level
    let effectiveRole = roleData?.role as Role | null
    if (!effectiveRole) {
      const { data: wsRole } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (wsRole?.role === 'owner') {
        effectiveRole = 'owner'
      }
    }

    setUserRole(effectiveRole as Role);

    // 🔹 Other project data
    const [
      { data: todosData },
      { data: notesData },
      { data: filesData },
      { data: milestonesData },
    ] = await Promise.all([
      supabase.from("todos").select("*").eq("project_id", projectId),
      supabase.from("notes").select("*").eq("project_id", projectId),
      supabase.from("project_files").select("*").eq("project_id", projectId),
      supabase.from("milestones").select("*").eq("project_id", projectId),
    ]);

    setTodos(todosData ?? []);
    setNotes(notesData ?? []);
    setFiles(filesData ?? []);
    setMilestones(milestonesData ?? []);
    setDataLoading(false);
  };

  loadData();
}, [projectId, user, supabase]);

// 🔹 Realtime subscriptions
useEffect(() => {
  if (!projectId) return;
  if (projectId === "new") return; // Don't set up subscriptions for "new" route

  
  const channel = supabase
  .channel(`project-${projectId}-all`)

    // Todos
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "todos", filter: `project_id=eq.${projectId}` },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as any)?.id ?? (payload.new as any)?.id
          if (deletedId) {
            setTodos((prev) => prev.filter((t) => t.id !== deletedId))
          } else {
            // Fallback: refetch to reconcile
            const { data } = await supabase.from('todos').select('*').eq('project_id', projectId)
            setTodos(data ?? [])
          }
          return
        }
        if (payload.eventType === 'INSERT') {
          const rec = payload.new as any
          setTodos((prev) => {
            if (!prev.some((t) => t.id === rec.id)) return [...prev, rec]
            return prev
          })
          return
        }
        if (payload.eventType === 'UPDATE') {
          const rec = payload.new as any
          setTodos((prev) => prev.map((t) => (t.id === rec.id ? rec : t)))
          return
        }
      }
    )

    // Notes
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notes", filter: `project_id=eq.${projectId}` },
      async (payload) => {
        setNotes((prev) => {
          // return the updated array so state updates correctly
          return handleChange(supabase, "notes", projectId, prev, payload, setNotes);
        });
      }
    )    

    // Files
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "project_files" },
      (payload) => {
        // Only process if it's for our project
        const eventProjectId = (payload.new as any)?.project_id || (payload.old as any)?.project_id;
        
        // For DELETE events, the old record might not have project_id, so we need to check differently
        if (payload.eventType === 'DELETE') {
          // For DELETE events, we'll process it and let handleChange filter by ID
          setFiles((prev) => {
            const updated = handleChange(supabase, "files", projectId, prev, payload, setFiles);
            return updated;
          });
        } else if (eventProjectId === projectId) {
          setFiles((prev) => {
            const updated = handleChange(supabase, "files", projectId, prev, payload, setFiles);
            return updated;
          });
        }
      }
    )    

    // Milestones
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "milestones", filter: `project_id=eq.${projectId}` },
      (payload) => {
        setMilestones((prev) => handleChange(supabase, "milestones", projectId, prev, payload, setMilestones));
      }
    )    

    // Project Members (update count and full list on changes)
    .on(
  "postgres_changes",
  { event: "*", schema: "public", table: "project_members", filter: `project_id=eq.${projectId}` },
  async (payload) => {
    console.log('🔄 Project members real-time update:', payload.eventType);
    
    // update member count
    const { count } = await supabase
      .from("project_members")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);
    setMemberCount(count ?? 0);

    // refresh full project members list
    const { data: membersData, error: membersError } = await supabase
      .from("project_members")
      .select("id, user_id, role")
      .eq("project_id", projectId);

    if (!membersError && membersData) {
      if (membersData.length > 0) {
        // Fetch profiles separately
        const userIds = membersData.map(m => m.user_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", userIds);

        if (!profilesError && profilesData) {
          const membersWithProfiles = membersData.map(member => {
            const profile = profilesData.find(p => p.id === member.user_id);
            return {
              id: member.id,
              user_id: member.user_id,
              role: member.role,
              email: profile?.email || '',
              full_name: profile?.full_name || ''
            };
          });
          setProjectMembers(membersWithProfiles);
        }
      } else {
        setProjectMembers([]);
      }
    }

    // make sure user is loaded
    if (!user) return;

    // cast payload so we can access user_id safely
    const newRow = payload.new as { user_id?: string; role?: string };
    const oldRow = payload.old as { user_id?: string; role?: string };

    // update current user's role if their membership row changed
    if (newRow?.user_id === user.id || oldRow?.user_id === user.id) {
      const { data: roleData } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      setUserRole(roleData?.role as Role);
    }
  }
)

    // Listen to projects
.on(
  "postgres_changes",
  { event: "*", schema: "public", table: "projects", filter: `id=eq.${projectId}` },
  async (payload) => {
    if (payload.eventType === "DELETE") {
      // Project deleted by someone else
      console.log("🗑️ Project deleted via real-time, redirecting...");
      setProjectMissing(true);
      
      // Auto-redirect after showing the message
      setTimeout(() => {
        router.replace(`/workspace/${workspaceId}/projects`);
        window.history.replaceState(null, '', `/workspace/${workspaceId}/projects`);
      }, 3000);
      
      return;
    }

    if (payload.eventType === "UPDATE") {
      const updated = payload.new as {
        name?: string;
        status_index?: number;
        client_id?: string;
        archived?: boolean;
      };

      setProjectName(updated?.name ?? "Untitled Project");
      setProjectStatusIndex(updated?.status_index ?? 0);
      setProjectClientId(updated?.client_id ?? null);
      setIsArchived(!!updated?.archived);
    }
  }
)

    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [projectId, user?.id, supabase]);

  const updateProjectStatus = useCallback(async (todos: { id: string; status_index: number }[]) => {
    if (!todos || todos.length === 0 || !workflow.length) return;
    
    const lastStepIndex = workflow.length - 1;
    let newStatusIndex: number;
    
    // Check if all tasks are completed
    const allCompleted = todos.every(todo => todo.status_index === lastStepIndex);
    if (allCompleted) {
      newStatusIndex = lastStepIndex;
    } else {
      // Find the highest status_index among all tasks
      newStatusIndex = Math.max(...todos.map(todo => todo.status_index));
    }
    
    // Update project status in database
    const { error } = await supabase
      .from("projects")
      .update({ status_index: newStatusIndex })
      .eq("id", projectId);
    
    if (!error) {
      setProjectStatusIndex(newStatusIndex);
      setProjectStatus(workflow[newStatusIndex]?.name || null);
    }
  }, [workflow, projectId, supabase]);

useEffect(() => {
  if (projectStatusIndex === null || !workflow.length) return;
  setProjectStatus(workflow[projectStatusIndex]?.name ?? null);
}, [workflow, projectStatusIndex]);

// Update project status when todos change
useEffect(() => {
  if (todos.length > 0 && workflow.length > 0) {
    updateProjectStatus(todos);
  }
}, [todos, workflow, updateProjectStatus]);



  // 🔹 helper for handling INSERT, UPDATE, DELETE
  function handleChange<T>(
    supabase: any,
    table: string,
    projectId: string,
    prev: T[],
    payload: any,
    setState: (items: T[]) => void
  ): T[] {
    switch (payload.eventType) {
      case "INSERT":
        return [...prev, payload.new as T];
  
      case "UPDATE":
        return prev.map((item: any) =>
          item.id === payload.new.id ? (payload.new as T) : item
        );
  
      case "DELETE":
        return prev.filter((item: any) => item.id !== payload.old.id);
  
      default:
        return prev;
    }
  }  

  function calculateProjectCompletion(todos: { id: string; status_index: number }[]) {
  if (!todos || todos.length === 0 || !workflow.length) return 0;
  const lastStepIndex = workflow.length - 1;
  const completed = todos.filter((t) => t.status_index === lastStepIndex);
  return Math.round((completed.length / todos.length) * 100);
}

  function calculateProjectStatus(todos: { id: string; status_index: number }[]) {
    if (!todos || todos.length === 0 || !workflow.length) return null;
    
    const lastStepIndex = workflow.length - 1;
    
    // Check if all tasks are completed
    const allCompleted = todos.every(todo => todo.status_index === lastStepIndex);
    if (allCompleted) {
      return workflow[lastStepIndex]?.name || null;
    }
    
    // Find the highest status_index among all tasks
    const highestStatusIndex = Math.max(...todos.map(todo => todo.status_index));
    
    // Return the workflow step name for the highest status_index
    return workflow[highestStatusIndex]?.name || null;
  }

const projectCompletion = calculateProjectCompletion(todos);

  function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="relative bg-gray-900 md:p-6 p-4 rounded-2xl shadow-2xl md:max-w-lg w-full max-w-full border border-gray-700/60 backdrop-blur-xl"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-gray-400 hover:text-white transition"
          >
            <X size={20} />
          </button>

          {/* Title */}
          <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

  if (userLoading) { return <p className="p-6 text-gray-500">Verifying user...</p> } 
  if (!user) { return <p className="p-6 text-red-600">Unauthorized. Please login.</p> } 
  if (dataLoading) { return <p className="p-6 text-gray-500">Loading project...</p> }

  if (projectMissing) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center">
        <div className="bg-red-900/20 border border-red-700 rounded-xl p-8 max-w-md">
          <h2 className="text-xl font-semibold text-red-400 mb-4">
            ❌ Project Deleted
          </h2>
          <p className="text-gray-300 mb-6">
            This project has been deleted and no longer exists.
          </p>
          <div className="space-y-3">
            <button 
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              onClick={() => {
                router.replace(`/workspace/${workspaceId}/projects`);
                window.history.replaceState(null, '', `/workspace/${workspaceId}/projects`);
              }}
            >
              Go to Projects
            </button>
            <button 
              className="w-full px-4 py-2 border border-gray-600 text-gray-300 hover:bg-gray-700 rounded-lg transition"
              onClick={() => window.history.back()}
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }  

  // If archived, only admins can view the project page
  const isArchivedAndNotAdmin = isArchived && !(userRole === 'admin' || userRole === 'owner')
  if (isArchivedAndNotAdmin) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold text-white">Project is archived</h1>
        <p className="text-gray-300">Only project administrators can view archived projects.</p>
        <button
          className="px-3 py-1 rounded border border-gray-600 text-gray-200 hover:bg-gray-700"
          onClick={() => window.history.back()}
        >
          Go back
        </button>
      </div>
    )
  }

console.log("direction:", direction, "prevIndex:", prevIndex, "currentIndex:", currentIndex);

  return (
    <div className="min-h-[400px] space-y-5 max-w-full">
      {isArchived && userRole !== 'admin' ? (
        <div className="p-4 bg-yellow-900/30 border border-yellow-700 rounded-xl text-yellow-200">
          <p className="font-semibold">Project is archived</p>
          <p className="text-sm">Only admins and owners can view archived projects.</p>
          <button className="mt-3 px-3 py-1 rounded border border-gray-600 text-gray-200 hover:bg-gray-700" onClick={() => window.history.back()}>Go back</button>
        </div>
      ) : null}
      {/* Header */}
<div className="flex flex-row md:items-center justify-between border-b border-gray-700/50 pb-2 mb-2">
  <div>
    <h2 className="text-sm uppercase tracking-wide text-gray-400">Project</h2>
    <h1 className="md:text-2xl text-xl font-bold text-white">
      {projectName}{" "}
      {projectStatus && (
        <span className="text-gray-400 text-lg">({projectStatus})</span>
      )}
    </h1>
    {isArchived && (
      <p className="text-xs text-yellow-400">Archived</p>
    )}
  </div>
  <p className="text-sm text-gray-500 md:mt-0 mt-1">Role: {userRole}</p>
</div>

{/* Completion Bar */}
<div className="mb-4">
  <div className="w-full h-3 bg-gray-700 rounded-full">
    <div
      className="h-3 bg-green-500 rounded-full transition-all duration-300"
      style={{ width: `${projectCompletion}%` }}
    ></div>
  </div>
  <p className="text-xs text-gray-400 mt-1">{projectCompletion}% Completed</p>
</div>

{/* Details Cards */}
<section className={`grid gap-2 md:gap-6 ${workspaceMembers.length <= 1 ? 'md:grid-cols-1' : 'md:grid-cols-2'}`}>
  {/* Members Card - only show if workspace has more than 1 member */}
  {workspaceMembers.length > 1 && (
    <div className="p-2 bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700 hover:border-green-600/50 hover:shadow-lg transition">
      <div className="flex flex-row justify-between items-start md:items-center gap-2">
        <div className="flex flex-col">
          <h3 className="md:text-lg text-md font-semibold text-green-500 mb-1 md:mb-0">
            👥 Members
          </h3>
          <p className="text-gray-300 hidden md:block">
            Manage and assign project members.
          </p>
        </div>
        <button
          className={`px-4 py-2 rounded-full md:text-sm text-xs font-medium transition ${
            !canWrite
              ? "bg-gray-700 text-gray-400 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-500 text-white"
          }`}
          onClick={() => setShowMembersModal(true)}
          disabled={!canWrite}
        >
          Open Members ({memberCount})
        </button>
      </div>
    </div>
  )}

  {/* Client Info Card */}
  <div className="p-2 bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700 hover:border-green-600/50 hover:shadow-lg transition">
    <div className="flex flex-row justify-between items-start md:items-center gap-2">
      <div className="flex flex-col">
        <h3 className="md:text-lg text-md font-semibold text-green-500 mb-1 md:mb-0">
          🏢 Client Info
        </h3>
        <p className="text-gray-300 hidden md:block">View and edit client details.</p>
      </div>
      <button
        className={`px-4 py-2 rounded-full md:text-sm text-xs font-medium transition ${
          !canWrite
            ? "bg-gray-700 text-gray-400 cursor-not-allowed"
            : "bg-green-600 hover:bg-green-500 text-white"
        }`}
        onClick={() => setShowClientModal(true)}
        disabled={!canWrite}
      >
        Open Client Info
      </button>
    </div>
  </div>
</section>


      {/* Tabs */}
      <div className="flex md:gap-2 gap-1 md:items-start md:justify-start items-center justify-center border-b border-gray-700/50 pb-2">
        {Object.keys(views).map((key) => (
          <button
            key={key}
            onClick={() => setView(key as any)}
            disabled={!canWrite && key === "Files"}
            className={`relative px-4 py-1.5 rounded-full md:text-sm text-xs transition ${
              view === key
                ? "bg-green-600 text-white shadow-md"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      {/* Animated view content */}
      <div className="lg:max-w-[90vw] sm:max-w-[60vw] md:max-w-[70vw] mx-auto min-h-[65vh] md:min-h-[60vh] h-auto overflow-x-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={view}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            {views[view]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Modals (rendered outside) */}
      {showMembersModal && (
        <Modal title="Project Members" onClose={() => setShowMembersModal(false)}>
          <MemberManagement 
            supabase={supabase} 
            projectId={projectId} 
            currentUserRole={(userRole as any)}
            projectMembers={projectMembers}
            workspaceId={workspaceId}
          />
        </Modal>
      )}
      {showClientModal && (
        <Modal title="Client Info" onClose={() => setShowClientModal(false)}>
          <ClientInfo
            workspaceId={workspaceId}
            projectId={projectId}
            clientId={projectClientId}
            canWrite={userRole === "admin" || userRole === "owner"}
          />
        </Modal>
      )}
    </div>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="relative bg-gray-900 p-6 rounded-2xl shadow-2xl max-w-lg w-full border border-gray-700/60 backdrop-blur-xl"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-gray-400 hover:text-white transition"
          >
            <X size={20} />
          </button>

          {/* Title */}
          <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
