// src/app/workspace/[id]/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/app/lib/supabase/client";
import { useAppCache } from "@/app/lib/cache/AppCacheProvider";
import { useWorkspace } from "./components/WorkspaceContext";

type Role = "owner" | "admin" | "manager" | "member" | "limited";

export default function WorkspaceOverview() {
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.id as string;
  const supabase = createClient();
  const { cacheRef, setWorkspaceSnapshot } = useAppCache();
  const { projects, clients, members, userRole, loading, workspace } = useWorkspace();

  const [counts, setCounts] = useState({
    projects: 0,
    archived: 0,
    clients: 0,
    members: 0,
  });

  const [showClientModal, setShowClientModal] = useState(false);
const [newName, setNewName] = useState("");
const [newContact, setNewContact] = useState("");
const [newNotes, setNewNotes] = useState("");
  const [showProjectsList, setShowProjectsList] = useState(false);
  const [loadingProjectsList, setLoadingProjectsList] = useState(false);
  const [projectsList, setProjectsList] = useState<{ id: string; name: string }[]>([]);

  // Update counts from real-time data
  useEffect(() => {
    const activeProjects = projects.filter(p => !p.archived);
    const archivedProjects = projects.filter(p => p.archived);
    
    console.log('Overview: Projects updated', { 
      total: projects.length, 
      active: activeProjects.length, 
      archived: archivedProjects.length 
    });
    
    setCounts({
      projects: activeProjects.length,
      archived: archivedProjects.length,
      clients: clients.length,
      members: members.length,
    });
  }, [projects, clients, members]);

  // Update projects list when real-time projects data changes
useEffect(() => {
  if (!showProjectsList) return;

  const activeProjects = projects.filter(p => !p.archived);
  const projectsListData = activeProjects
    .map(p => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  setProjectsList(projectsListData);
  setLoadingProjectsList(false);
}, [projects, showProjectsList]);


  // Update cache when counts change
  useEffect(() => {
    setWorkspaceSnapshot(workspaceId, { counts });
  }, [counts, workspaceId, /*setWorkspaceSnapshot*/]);


  const addClient = async () => {
  const { error } = await supabase.from("clients").insert({
    workspace_id: workspaceId,
    name: newName,
    contact_method: newContact,
    notes: newNotes,
  });

  if (!error) {
    setShowClientModal(false);
    setNewName("");
    setNewContact("");
    setNewNotes("");
  } else {
    console.error("Error adding client:", error);
  }
};

  // Close the projects list if there are no projects
  useEffect(() => {
    if (counts.projects === 0 && showProjectsList) {
      setShowProjectsList(false);
    }
  }, [counts.projects, showProjectsList]);

  function loadProjectsList() {
    if (projectsList.length > 0) return;
    setLoadingProjectsList(true);
    
    // Use real-time projects data instead of making API call
    const activeProjects = projects.filter(p => !p.archived);
    const projectsListData = activeProjects
      .map(p => ({ id: p.id, name: p.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    setProjectsList(projectsListData);
    setLoadingProjectsList(false);
  }

  const canManage = userRole === "owner" || userRole === "admin" || userRole === "manager";
  const canViewClients = canManage || userRole === "member";

  return (
    <div className="space-y-6">
  <h1 className="text-2xl font-semibold text-white">Workspace Overview</h1>

  <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
    {/* Left Column (spans 2/3) */}
    <div className="space-y-4 lg:col-span-2">
      {/* Projects Card */}
    {/* Projects Card */}
    <div
      className={`relative bg-gray-800/40 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-lg p-4 hover:border-green-600/50 hover:shadow-xl transition ${counts.projects > 0 ? "cursor-pointer" : "cursor-default"} ${showProjectsList ? "z-40" : ""}`}
      onClick={() => {
        if (counts.projects === 0) return;
        setShowProjectsList(prev => !prev);
      }}      
      role="button"
      aria-pressed={showProjectsList}
      aria-disabled={counts.projects === 0}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-lg text-green-500">📁 Projects</h3>
          <p className="text-gray-300 text-sm mt-1">
            {counts.projects} active project{counts.projects !== 1 && "s"}
            {counts.projects === 0 && " — Start your first one!"}
          </p>
        </div>
        <span
          aria-hidden
          className={`ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-700 ${counts.projects > 0 ? "text-gray-300" : "text-gray-600"} bg-gray-800 transition-transform ${
            showProjectsList ? "rotate-180" : "rotate-0"
          }`}
        >
          ▾
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/workspace/${workspaceId}/projects`);
          }}
          className="text-sm px-4 py-2 rounded-full bg-green-600 hover:bg-green-500 text-white transition"
        >
          View Projects
        </button>
        {canManage && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/workspace/${workspaceId}/new`);
            }}
            className="text-sm px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white transition shadow-md"
          >
            ➕ Start Project
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {showProjectsList && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: -8 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="mt-4 space-y-2 max-h-[60vh] md:max-h-[70vh] overflow-y-auto pr-1"
          >
            {loadingProjectsList && (
              <p className="text-gray-400 text-sm">Loading…</p>
            )}
            {!loadingProjectsList && projectsList.length === 0 && (
              <p className="text-gray-400 text-sm">No projects yet.</p>
            )}
            {projectsList.map((p) => (
              <button
                key={p.id}
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/workspace/${workspaceId}/projects/${p.id}`);
                }}
                className="w-full text-left px-3 py-2 rounded-lg bg-gray-800/40 border border-gray-700 hover:bg-gray-700 text-gray-100"
              >
                {p.name}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>

    

      {/* Clients Card */}
      {canViewClients && (
        <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-lg p-4 hover:border-green-600/50 hover:shadow-xl transition">
          <h3 className="font-medium text-lg text-green-500">🏢 Clients</h3>
          <p className="text-gray-300 text-sm mt-1">
            {counts.clients} client{counts.clients !== 1 && "s"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => router.push(`/workspace/${workspaceId}/clients`)}
              className="text-sm px-4 py-2 rounded-full bg-green-600 hover:bg-green-500 text-white transition"
            >
              View Clients
            </button>
            {canManage && (
              <button
                onClick={() => setShowClientModal(true)}
                className="text-sm px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white transition"
              >
                ➕ Add Client
              </button>
            )}
          </div>
        </div>
      )}

      {/* Archive Card */}
      {canManage && (
        <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-lg p-4 hover:border-green-600/50 hover:shadow-xl transition">
          <h3 className="font-medium text-lg text-green-500">🗄️ Archive</h3>
          <p className="text-gray-300 text-sm mt-1">
            {counts.archived} archived project{counts.archived !== 1 && "s"}
          </p>
          <button
            onClick={() => router.push(`/workspace/${workspaceId}/archive`)}
            className="mt-3 text-sm px-4 py-2 rounded-full bg-green-600 hover:bg-green-500 text-white transition"
          >
            View Archive
          </button>
        </div>
      )}
    </div>

    {/* Right Column (Settings, sticky on desktop) */}
    {canManage && (
      <div className="lg:col-span-1">
        <div className="sticky top-4 bg-gray-800/40 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-lg p-4 hover:border-green-600/50 hover:shadow-xl transition">
          <h3 className="font-medium text-lg text-green-500">⚙️ Settings</h3>
          <p className="text-gray-300 text-sm mt-1">
            {counts.members} member{counts.members !== 1 && "s"}
          </p>
          {workspace?.visibility === 'private' && (
            <p className="text-yellow-400 text-xs mt-1 flex items-center gap-1">
              🔒 Private workspace
            </p>
          )}
          <button
            onClick={() => router.push(`/workspace/${workspaceId}/settings`)}
            className="mt-3 text-sm px-4 py-2 rounded-full bg-green-600 hover:bg-green-500 text-white transition"
          >
            Manage Settings
          </button>
        </div>
      </div>
    )}
  </div>

  {/* Add Client Modal */}
  {showClientModal && (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-50">
      <div className="bg-gray-900 p-6 rounded-2xl shadow-lg w-full max-w-md border border-gray-700/50">
        <h2 className="text-lg font-semibold mb-4 text-white">➕ Add New Client</h2>
        <div className="space-y-3">
          <input
            className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700"
            placeholder="Client name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700"
            placeholder="Contact method (email, phone, etc.)"
            value={newContact}
            onChange={(e) => setNewContact(e.target.value)}
          />
          <textarea
            className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700"
            placeholder="Notes"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            <button
              className="bg-green-600 px-3 py-1 rounded text-white hover:bg-green-500 transition"
              onClick={addClient}
            >
              Save
            </button>
            <button
              className="px-3 py-1 border rounded text-white hover:bg-gray-700 transition"
              onClick={() => setShowClientModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )}
</div>
  );
}
