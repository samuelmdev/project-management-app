"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";
import { useWorkspace } from "../components/WorkspaceContext";
import { logActions } from "@/app/lib/logging";

type Project = {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  archived: boolean;
};

export default function ArchivePage() {
  const { id: workspaceId } = useParams();
  const supabase = createClient();
  const { projects: allProjects, userRole, loading } = useWorkspace();

  // Filter to only archived projects
  const projects = allProjects.filter(p => p.archived);

  const [confirmAction, setConfirmAction] = useState<{
    type: "restore" | "delete";
    project: typeof allProjects[0] | null;
  }>({ type: "restore", project: null });

  // Check access permissions
  const canAccess = userRole === "owner" || userRole === "admin" || userRole === "manager";

  // ✅ Perform action after confirm
  async function handleConfirm() {
    if (!confirmAction.project) return;

    if (confirmAction.type === "restore") {
      const { error } = await supabase
        .from("projects")
        .update({ archived: false })
        .eq("id", confirmAction.project.id);

      if (!error) {
        // Log project restoration
        await logActions.projectRestored(workspaceId as string, confirmAction.project.id, confirmAction.project.name);
        // Projects will be updated automatically via real-time subscription
      }
    }

    if (confirmAction.type === "delete") {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", confirmAction.project.id);

      if (!error) {
        // Log project deletion from archive
        await logActions.projectDeleted(workspaceId as string, confirmAction.project.name);
        // Projects will be updated automatically via real-time subscription
      }
    }

    setConfirmAction({ type: "restore", project: null });
  }

  if (loading) {
    return <p className="text-gray-500">Loading archived projects...</p>;
  }

  if (!canAccess) {
    return <p className="text-red-500">No access to this page.</p>;
  }

  return (
    <div className="space-y-6">
  <h1 className="text-2xl font-semibold text-white my-2">Archived Projects</h1>
  <p className="text-gray-400 mb-6">
    See all completed or archived projects here.
  </p>

  {projects.length === 0 ? (
    <p className="text-gray-500">No archived projects.</p>
  ) : (
    <div className="h-[80svh] md:h-[80vh] overflow-y-auto">
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <div
          key={project.id}
          className="bg-gray-800/40 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-lg p-4 hover:border-green-600/50 hover:shadow-xl transition"
        >
          <h2 className="text-lg font-semibold text-green-500">{project.name}</h2>
          {project.description && (
            <p className="text-gray-300 text-sm mt-1">{project.description}</p>
          )}
        {/*  <p className="text-sm mt-1">
            Status:{" "}
            <span
              className="inline-block w-3 h-3 rounded-full mr-1"
              style={{ backgroundColor: workflow[project.status_index]?.color ?? "gray" }}
            ></span>
            {workflow[project.status_index]?.name ?? project.status}
          </p> */}
          <p className="text-gray-400 text-xs mt-1">
            Created: {new Date(project.created_at).toLocaleDateString()}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {(userRole === "admin" || userRole === "owner") && (
              <a
                href={`/workspace/${workspaceId}/projects/${project.id}`}
                className="px-3 py-1 rounded-full border border-gray-600 text-gray-200 hover:bg-gray-700 transition"
              >
                View
              </a>
            )}
            <button
              className="bg-green-600 px-3 py-1 rounded-full text-white hover:bg-green-500 transition"
              onClick={() => setConfirmAction({ type: "restore", project })}
            >
              Restore
            </button>
            {(userRole === "admin" || userRole === "owner") && (
              <button
                className="bg-red-600 px-3 py-1 rounded-full text-white hover:bg-red-500 transition"
                onClick={() => setConfirmAction({ type: "delete", project })}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
    </div>
  )}

  {/* ✅ Confirmation Modal */}
  {confirmAction.project && (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
      <div className="bg-gray-900 p-6 rounded-2xl shadow-lg max-w-sm w-full border border-gray-700/50">
        <h2 className="text-lg font-semibold text-white mb-2">Confirm Action</h2>
        <p className="text-gray-300 mb-4">
          Are you sure you want to{" "}
          <span className="font-bold">
            {confirmAction.type === "restore" ? "restore" : "delete"}
          </span>{" "}
          project{" "}
          <span className="text-yellow-400">{confirmAction.project.name}</span>?
        </p>
        <div className="flex justify-end gap-3">
          <button
            className="px-3 py-1 border rounded hover:bg-gray-700 text-white transition"
            onClick={() => setConfirmAction({ type: "restore", project: null })}
          >
            Cancel
          </button>
          <button
            className={`px-3 py-1 rounded text-white ${
              confirmAction.type === "restore"
                ? "bg-green-600 hover:bg-green-500"
                : "bg-red-600 hover:bg-red-500"
            } transition`}
            onClick={handleConfirm}
          >
            {confirmAction.type === "restore" ? "Restore" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  )}
</div>

  );
}
