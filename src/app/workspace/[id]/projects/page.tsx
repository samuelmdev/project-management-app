"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";
import { useWorkspace } from "../components/WorkspaceContext";
import { logActions } from "@/app/lib/logging";

type Project = {
  id: string;
  name: string;
  description?: string | null;
  status_index: number;
  created_at: string;
  archived: boolean;
  role: string; // user’s role in this project
};

type Todo = {
  id: string;
  project_id: string;
  // add other fields as needed
  [key: string]: any;
};

export default function ProjectsPage() {
  const { id: workspaceId } = useParams();
  const supabase = createClient();
  const { projects: allProjects, userRole, loading } = useWorkspace();

  // Filter to only show active (non-archived) projects
  const projects = allProjects.filter(p => !p.archived);

  const [todos, setTodos] = useState<Todo[]>([]);
  const [workflow, setWorkflow] = useState<{ name: string; color: string }[]>([]);

  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  useEffect(() => {
    const fetchWorkflowAndTodos = async () => {
      // Fetch workspace workflow
      const { data: workspaceData, error: wfError } = await supabase
        .from("workspaces")
        .select("workflow")
        .eq("id", workspaceId)
        .maybeSingle();

      if (!wfError && workspaceData?.workflow) {
        setWorkflow(workspaceData.workflow);
      }

      // Fetch todos for projects
      if (projects.length > 0) {
        const projectIds = projects.map((p) => p.id);
        const { data: todosData, error: todosError } = await supabase
          .from("todos")
          .select("*")
          .in("project_id", projectIds);

        if (!todosError && todosData) {
          setTodos(todosData);
        } else {
          setTodos([]);
        }
      } else {
        setTodos([]);
      }
    };

    fetchWorkflowAndTodos();
  }, [workspaceId, projects, supabase]);

  // ✅ Edit project
  async function saveEdit(id: string) {
    const { error } = await supabase
      .from("projects")
      .update({ name: editName, description: editDescription })
      .eq("id", id);

    if (!error) {
      setEditingProject(null);
    }
  }

  // ✅ Archive project
  async function archiveProject(id: string) {
    const { error } = await supabase
      .from("projects")
      .update({ archived: true })
      .eq("id", id);
      
      if (!error) {
        // Find project name for logging
        const project = projects.find(p => p.id === id);
        if (project) {
          await logActions.projectArchived(workspaceId as string, id, project.name);
        }
        setEditingProject(null);
      }
  }

  async function deleteProject(id: string, name?: string) {
    const ok = window.confirm(
      `Are you sure you want to delete the project "${name ?? ""}"?`
    );
    if (!ok) return;
  
    try {
      // Delete children first
      const results = await Promise.all([
        supabase.from("notes").delete().eq("project_id", id),
        supabase.from("todos").delete().eq("project_id", id),
        supabase.from("files").delete().eq("project_id", id),
        supabase.from("milestones").delete().eq("project_id", id),
        supabase.from("invitations").delete().eq("project_id", id),
        supabase.from("project_members").delete().eq("project_id", id),
      ]);
  
      for (const r of results) {
        if (r.error) {
          console.error("Child delete error:", r.error);
          alert(`Failed deleting related rows: ${r.error.message}`);
          return;
        }
      }
  
      // Delete project
      const { error: projectError } = await supabase
        .from("projects")
        .delete()
        .eq("id", id);
  
      if (projectError) {
        console.error("Project delete error:", projectError);
        alert(`Failed deleting project: ${projectError.message}`);
        return;
      }

      // Log project deletion
      await logActions.projectDeleted(workspaceId as string, name || "Unknown Project");

      // Projects will be updated automatically via real-time subscription
    } catch (err) {
      console.error("Unexpected delete error:", err);
    }
  }  

  return (
  <div>
    {/* Header */}
    <div className="flex items-center justify-between mb-6 mt-2">
      <h1 className="text-2xl font-semibold text-white">Projects</h1>

      {(userRole === "owner" ||
        userRole === "admin" ||
        userRole === "manager") && (
        <Link href={`/workspace/${workspaceId}/new`}>
          <button className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-full transition">
            ➕ New Project
          </button>
        </Link>
      )}
    </div>

    {/* Loading / Empty / Projects */}
    {loading ? (
      // 🔹 Skeleton cards
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-gray-800/40 border border-gray-700 rounded-2xl shadow-lg p-4 animate-pulse min-h-56 flex flex-col justify-between"
          >
            <div>
              <div className="h-5 w-3/4 bg-gray-700 rounded mb-3"></div>
              <div className="h-3 w-full bg-gray-700 rounded mb-2"></div>
              <div className="h-3 w-1/2 bg-gray-700 rounded"></div>
              <div className="h-3 w-full bg-gray-700 rounded mt-4"></div>
            </div>
            <div className="mt-4">
              <div className="h-2 w-full bg-gray-700 rounded"></div>
              <div className="flex items-center justify-between mt-3">
                <div className="h-3 w-24 bg-gray-700 rounded"></div>
                <div className="h-3 w-28 bg-gray-700 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    ) : projects.length === 0 ? (
      <p className="text-gray-500">No projects found. Start your first one!</p>
    ) : (
      <div className="h-[80svh] overflow-y-auto">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            // 🔹 Progress calculation from status_index
            // Progress is now calculated based on tasks' completion
            const projectTodos = todos.filter((todo) => todo.project_id === project.id);
            // Use dynamic last step index for completion
            const lastStepIndex = workflow.length > 0 ? workflow.length - 1 : 3;
            const completedTodos = projectTodos.filter((todo) => todo.status_index === lastStepIndex);
            const progress =
              projectTodos.length > 0
                ? Math.round((completedTodos.length / projectTodos.length) * 100)
                : 0;

            return (
              <div
                key={project.id}
                className="bg-gray-800/40 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-lg p-4 hover:border-green-600/50 hover:shadow-xl transition"
              >
                {editingProject === project.id ? (
                  // 🔹 Edit Mode
                  <div className="space-y-3">
                    <input
                      className="w-full p-2 rounded bg-gray-700 border border-gray-600"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <textarea
                      className="w-full p-2 rounded bg-gray-700 border border-gray-600"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                    />
                    <div className="flex gap-2 flex-wrap">
                      <button
                        className="bg-green-600 px-3 py-1 rounded hover:bg-green-500 transition"
                        onClick={() => saveEdit(project.id)}
                      >
                        Save
                      </button>
                      <button
                        className="px-3 py-1 border rounded hover:bg-gray-700 transition"
                        onClick={() => setEditingProject(null)}
                      >
                        Cancel
                      </button>
                      {(userRole === "owner" ||
                        userRole === "admin" ||
                        userRole === "manager") && (
                        <button
                          className="bg-yellow-600 px-3 py-1 rounded hover:bg-yellow-500 transition"
                          onClick={() => archiveProject(project.id)}
                        >
                          Archive
                        </button>
                      )}
                      {(userRole === "owner" ||
                        userRole === "admin") && (
                        <button
                          className="bg-red-600 px-3 py-1 rounded hover:bg-red-500 transition"
                          onClick={() => deleteProject(project.id, project.name)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  // 🔹 View Mode
                  <div>
                    <Link href={`projects/${project.id}`} className="block">
                      <h2 className="text-lg font-semibold text-white">
                        {project.name}
                      </h2>
                      <p className="text-gray-300 text-sm">
                        {project.description && project.description.trim().length > 0
                          ? project.description
                          : <span className="text-gray-500">No description</span>}
                      </p>

                      {/* Status */}
                      <p className="text-sm flex items-center gap-2 mt-1">
                        Status:
                        <span
                          className="inline-block w-3 h-3 rounded-full"
                          style={{
                            backgroundColor:
                              workflow[project.status_index]?.color ?? "gray",
                          }}
                        ></span>
                        {workflow[project.status_index]?.name ?? "Unknown"}
                      </p>

                      {/* 🔹 Progress bar */}
                      <div className="mt-3">
                        <div className="h-2 w-full bg-gray-700 rounded">
                          <div
                            className="h-2 bg-green-500 rounded"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {progress}% complete
                        </p>
                      </div>

                      {/* Created */}
                      <p className="text-xs text-gray-500">
                        Created:{" "}
                        {new Date(project.created_at).toLocaleDateString()}
                      </p>
                    </Link>

                    {(userRole === "owner" ||
                      userRole === "admin" ||
                      userRole === "manager") && (
                      <button
                        className="mt-3 bg-green-600 text-white px-3 py-1 rounded-full hover:bg-green-500 transition"
                        onClick={() => {
                          setEditingProject(project.id);
                          setEditName(project.name);
                          setEditDescription(project.description ?? "");
                        }}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    )}
  </div>
);

}
