"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@/app/lib/supabase/client";
import { logActions } from "@/app/lib/logging";
import { X } from "lucide-react";

function getContrastColor(hex: string): string {
  // Strip leading #
  hex = hex.replace("#", "");

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Perceived brightness (YIQ formula)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;

  return yiq >= 128 ? "black" : "white";
}

const defaultWorkflow = [
  { name: "Backlog", color: "#6b7280" },
  { name: "In Progress", color: "#3b82f6" },
  { name: "Review", color: "#f59e0b" },
  { name: "Done", color: "#10b981" },
];

const defaultTags = [
  { name: "Important", color: "#e74c3c" },
  { name: "Architecture", color: "#8e44ad" },
  { name: "Styling", color: "#3498db" },
  { name: "Backend", color: "#27ae60" },
  { name: "Bug", color: "#e67e22" },
  { name: "Enhancement", color: "#f1c40f" },
];

export default function NewWorkspacePage() {
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<'private' | 'shared'>('private');
  const [customWorkflow, setCustomWorkflow] = useState(false);
  const [workflow, setWorkflow] = useState(defaultWorkflow);
  const [userWorkflows, setUserWorkflows] = useState<any[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [hasTriedToSubmit, setHasTriedToSubmit] = useState(false);
  
  // Tag states
  const [userTags, setUserTags] = useState<any[]>([]);
  const [workspaceTags, setWorkspaceTags] = useState<any[]>([]);
  const [customTags, setCustomTags] = useState(false);
  const [showTagEditor, setShowTagEditor] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch workflows
    const { data: workflows, error: workflowsError } = await supabase
      .from("workflows")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (workflowsError) {
      console.error("Error fetching workflows:", workflowsError);
    } else {
      setUserWorkflows(workflows || []);
      // Set default workflow if available
      const defaultWorkflow = workflows?.find(w => w.is_default);
      if (defaultWorkflow) {
        setWorkflow(defaultWorkflow.steps);
        setSelectedWorkflowId(defaultWorkflow.id);
      }
    }

    // Fetch user tags
    const { data: tags, error: tagsError } = await supabase
      .from("tags")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (tagsError) {
      console.error("Error fetching tags:", tagsError);
    } else {
      setUserTags(tags || []);
      // Set workspace tags to user tags by default
      setWorkspaceTags(tags || []);
    }

    setLoading(false);
  };
  

  const handleAddState = () => {
    if (workflow.length >= 6) return; // Cannot add more than 6 steps
    setWorkflow([...workflow, { name: "", color: "#000000" }]);
  };

  const handleStateChange = (index: number, field: "name" | "color", value: string) => {
    const updated = [...workflow];
    updated[index][field] = value;
    setWorkflow(updated);
  };

  const handleRemoveState = (index: number) => {
    if (workflow.length <= 3) return; // Cannot remove if only 3 steps remain
    setWorkflow(workflow.filter((_, i) => i !== index));
  };

  const handleWorkflowSelect = (workflowId: string) => {
    setSelectedWorkflowId(workflowId);
    const selectedWorkflow = userWorkflows.find(w => w.id === workflowId);
    if (selectedWorkflow) {
      setWorkflow(selectedWorkflow.steps);
    }
  };

  // Helper functions for tag validation
  const hasDuplicateTagName = (name: string, excludeIndex?: number) => {
    const trimmedName = name.trim();
    if (!trimmedName) return false;
    
    return workspaceTags.some((tag, i) => 
      i !== excludeIndex && 
      tag.name.toLowerCase() === trimmedName.toLowerCase()
    );
  };

  const hasAnyDuplicateTags = () => {
    return workspaceTags.some((tag, index) => hasDuplicateTagName(tag.name, index));
  };

  // Tag management functions
  const addTag = () => {
    if (workspaceTags.length >= 10) {
      alert("Maximum of 10 tags allowed.");
      return;
    }
    setWorkspaceTags([...workspaceTags, { name: "", color: "#3b82f6" }]);
  };

  const updateTag = (index: number, field: "name" | "color", value: string) => {
    const updated = [...workspaceTags];
    updated[index][field] = value;
    setWorkspaceTags(updated);
  };

  const removeTag = (index: number) => {
    setWorkspaceTags(workspaceTags.filter((_, i) => i !== index));
  };

  const resetToUserTags = () => {
    setWorkspaceTags([...userTags]);
    setCustomTags(false);
  };

  const useDefaultTags = () => {
    setWorkspaceTags([...defaultTags]);
    setCustomTags(true);
  };

  const handleCreate = async () => {
    setHasTriedToSubmit(true);
    
    if (!name.trim() || name.trim().length < 3 || hasAnyDuplicateTags() || creating) return;
    
    setCreating(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    console.log("🔍 Fetched user:", user);
    if (userError) {
      console.error("⚠️ User fetch error:", userError);
      alert("Authentication error. Please try logging in again.");
      setCreating(false);
      return;
    }

    if (!user) {
      console.error("❌ No authenticated user found");
      alert("You must be logged in to create a workspace.");
      setCreating(false);
      return;
    }

    try {
      // Create workspace
      const { data, error } = await supabase
        .from("workspaces")
        .insert([{ 
          name, 
          owner_id: user.id, 
          workflow: workflow,
          tags: workspaceTags,
          visibility: visibility
        }])
        .select()
        .single();

      if (error) {
        console.error("❌ Workspace creation error:", error);
        alert(`Failed to create workspace: ${error.message}`);
        setCreating(false);
        return;
      }

      if (!data) {
        console.error("❌ No workspace data returned");
        alert("Failed to create workspace. Please try again.");
        setCreating(false);
        return;
      }

      console.log("✅ Workspace created:", data);
      
      // Add workspace owner as member - CRITICAL: Don't proceed if this fails
      const { error: memberError } = await supabase
        .from("workspace_members")
        .insert([{
          workspace_id: data.id,
          user_id: user.id,
          role: "owner"
        }]);

      if (memberError) {
        console.error("❌ Member creation error:", memberError);
        // Clean up the workspace if member creation fails
        await supabase.from("workspaces").delete().eq("id", data.id);
        alert(`Failed to add you as workspace member: ${memberError.message}. Workspace creation cancelled.`);
        setCreating(false);
        return;
      }

      console.log("✅ Workspace owner added as member");

      // Log workspace creation
      try {
        await logActions.workspaceCreated(data.id, name);
      } catch (logError) {
        console.error("⚠️ Failed to log workspace creation:", logError);
        // Don't fail the whole process for logging errors
      }

      // Only redirect if everything succeeded
      router.replace(`/workspace/${data.id}`);
    } catch (error) {
      console.error("❌ Unexpected error during workspace creation:", error);
      alert("An unexpected error occurred. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  // Note: We rely on router.replace after creation to skip this page when going back.

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="text-gray-400">Loading workflows...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-xl font-semibold mb-4 text-white">Create New Workspace</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Workspace Name *
          </label>
          <input
            className={`w-full px-3 py-2 bg-gray-700 border rounded-lg text-white focus:outline-none focus:ring-2 ${
              hasTriedToSubmit && (name.trim() === '' || name.trim().length < 3)
                ? 'border-red-500 focus:ring-red-500' 
                : 'border-gray-600 focus:ring-green-500'
            }`}
            placeholder="Enter workspace name (minimum 3 characters)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {hasTriedToSubmit && name.trim() === '' && (
            <p className="text-red-400 text-xs mt-1">
              Please enter a workspace name
            </p>
          )}
          {hasTriedToSubmit && name.trim() !== '' && name.trim().length < 3 && (
            <p className="text-red-400 text-xs mt-1">
              Workspace name must be at least 3 characters long
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Visibility
          </label>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as 'private' | 'shared')}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="private">Private - Only you can see and manage this workspace</option>
            <option value="shared">Shared - You can invite others to collaborate</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">
            {visibility === 'private' 
              ? "Private workspaces are only visible to you. You can change this later in settings."
              : "Shared workspaces allow you to invite team members and collaborate on projects."
            }
          </p>
        </div>

        {userWorkflows.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Workflow
            </label>
            <select
              value={selectedWorkflowId}
              onChange={(e) => handleWorkflowSelect(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {userWorkflows.map((wf) => (
                <option key={wf.id} value={wf.id}>
                  {wf.name} {wf.is_default ? "(Default)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="flex items-center gap-2 text-gray-300">
            <input
              type="checkbox"
              checked={customWorkflow}
              onChange={(e) => setCustomWorkflow(e.target.checked)}
              className="rounded"
            />
            Customize workflow
          </label>
        </div>

        {customWorkflow && (
          <div className="space-y-3 p-4 bg-gray-800/40 border border-gray-700 rounded-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-white">Workflow Steps</h3>
              <p className="text-xs text-gray-400">
                {workflow.length}/6 steps (minimum 3, maximum 6)
              </p>
            </div>
            {workflow.map((state, index) => (
              <div key={index} className="flex items-center gap-3">
                <input
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Step name"
                  value={state.name}
                  onChange={(e) => handleStateChange(index, "name", e.target.value)}
                />
                <input
                  type="color"
                  value={state.color}
                  onChange={(e) => handleStateChange(index, "color", e.target.value)}
                  className="w-12 h-10 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer"
                />
                <button
                  onClick={() => handleRemoveState(index)}
                  disabled={workflow.length <= 3}
                  className="text-red-400 hover:text-red-300 disabled:text-gray-500 disabled:cursor-not-allowed p-2 transition"
                  type="button"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              className="text-sm text-green-400 hover:text-green-300 hover:underline disabled:text-gray-500 disabled:cursor-not-allowed disabled:hover:no-underline"
              onClick={handleAddState}
              disabled={workflow.length >= 6}
              type="button"
            >
              + Add Step
            </button>
          </div>
        )}

        {/* Tags Section */}
        {userTags.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">
                Workspace Tags
              </label>
              <button
                type="button"
                onClick={() => setShowTagEditor(!showTagEditor)}
                className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
              >
                {showTagEditor ? "Hide Editor" : "Edit Tags"}
              </button>
            </div>
            
            {/* Current Tags Display */}
            <div className="flex flex-wrap gap-2 mb-3">
              {workspaceTags.map((tag, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 px-3 py-1 rounded-full text-sm"
                  style={{ backgroundColor: tag.color + "20", color: tag.color }}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name || "Untitled Tag"}
                </div>
              ))}
            </div>

            {/* Tag Editor */}
            {showTagEditor && (
              <div className="space-y-3 p-4 bg-gray-800/40 border border-gray-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-white">Workspace Tags</h3>
                    <p className="text-xs text-gray-400">
                      {workspaceTags.length}/10 tags
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={resetToUserTags}
                      className="text-sm text-gray-400 hover:text-gray-300 hover:underline"
                    >
                      Reset to User Tags
                    </button>
                    <button
                      type="button"
                      onClick={useDefaultTags}
                      className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
                    >
                      Use Default Tags
                    </button>
                    <button
                      type="button"
                      onClick={addTag}
                      disabled={workspaceTags.length >= 10}
                      className="text-sm text-green-400 hover:text-green-300 hover:underline disabled:text-gray-500 disabled:cursor-not-allowed"
                    >
                      + Add Tag
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {workspaceTags.map((tag, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={tag.name}
                          onChange={(e) => updateTag(index, "name", e.target.value)}
                          className={`flex-1 px-3 py-2 bg-gray-700 border rounded-lg text-white focus:outline-none focus:ring-2 ${
                            hasDuplicateTagName(tag.name, index)
                              ? "border-red-500 focus:ring-red-500"
                              : "border-gray-600 focus:ring-green-500"
                          }`}
                          placeholder="Tag name"
                        />
                        <input
                          type="color"
                          value={tag.color}
                          onChange={(e) => updateTag(index, "color", e.target.value)}
                          className="w-12 h-10 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => removeTag(index)}
                          className="text-red-400 hover:text-red-300 p-2"
                        >
                          ✕
                        </button>
                      </div>
                      {hasDuplicateTagName(tag.name, index) && (
                        <div className="text-red-400 text-xs flex items-center gap-1">
                          <X size={12} />
                          Duplicate tag name
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Duplicate tags warning */}
        {hasAnyDuplicateTags() && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
            <div className="text-red-400 text-sm flex items-center gap-2">
              <X size={16} />
              Please fix duplicate tag names before creating the workspace
            </div>
          </div>
        )}

        {/* Validation Messages */}
        {hasTriedToSubmit && (!name.trim() || name.trim().length < 3) && (
          <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-3">
            <p className="text-yellow-400 text-sm">
              {!name.trim() 
                ? "Please enter a workspace name to continue"
                : "Workspace name must be at least 3 characters long"
              }
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleCreate}
            disabled={!name.trim() || name.trim().length < 3 || hasAnyDuplicateTags() || creating}
            className={`px-6 py-2 rounded-lg transition ${
              !name.trim() || name.trim().length < 3 || hasAnyDuplicateTags() || creating
                ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-500 text-white"
            }`}
          >
            {creating ? "Creating..." : "Create Workspace"}
          </button>
          <button
            onClick={() => router.back()}
            disabled={creating}
            className={`px-6 py-2 rounded-lg transition ${
              creating
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : "bg-gray-600 hover:bg-gray-500 text-white"
            }`}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

