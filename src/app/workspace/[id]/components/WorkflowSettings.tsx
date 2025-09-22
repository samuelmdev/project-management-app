"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/app/lib/supabase/client";
import { X, Plus, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const defaultWorkflow = [
  { name: "Backlog", color: "#6b7280" },
  { name: "In Progress", color: "#3b82f6" },
  { name: "Review", color: "#f59e0b" },
  { name: "Done", color: "#10b981" },
];

interface WorkflowStep {
  name: string;
  color: string;
}

interface Tag {
  id?: string;
  name: string;
  color: string;
}

interface WorkflowSettingsProps {
  workspaceId: string;
}

export default function WorkflowSettings({ workspaceId }: WorkflowSettingsProps) {
  const supabase = createClient();
  const [workflow, setWorkflow] = useState<WorkflowStep[]>(defaultWorkflow);
  const [tags, setTags] = useState<Tag[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasActiveTodos, setHasActiveTodos] = useState(false);
  const [showMigrationWarning, setShowMigrationWarning] = useState(false);
  const [migrationWarningAcknowledged, setMigrationWarningAcknowledged] = useState(false);
  const [originalWorkflow, setOriginalWorkflow] = useState<WorkflowStep[]>([]);

  useEffect(() => {
    fetchWorkflow();
    fetchTags();
    checkActiveTodos();
  }, [workspaceId]);

  async function fetchWorkflow() {
    const { data, error } = await supabase
      .from("workspaces")
      .select("workflow")
      .eq("id", workspaceId)
      .maybeSingle();

    if (!error && data?.workflow) {
      setWorkflow(data.workflow);
      setOriginalWorkflow(data.workflow);
    }
  }

  async function fetchTags() {
    const { data, error } = await supabase
      .from("workspaces")
      .select("tags")
      .eq("id", workspaceId)
      .maybeSingle();

    if (!error && data?.tags) {
      setTags(data.tags);
    }
  }

  async function checkActiveTodos() {
    // First get all project IDs for this workspace
    const { data: projects } = await supabase
      .from("projects")
      .select("id")
      .eq("workspace_id", workspaceId);

    if (!projects || projects.length === 0) {
      setHasActiveTodos(false);
      return;
    }

    const projectIds = projects.map(p => p.id);

    // Check if any todos in this workspace have status_index > 0
    const { data, error } = await supabase
      .from("todos")
      .select("status_index")
      .in("project_id", projectIds)
      .gt("status_index", 0);

    if (!error) {
      setHasActiveTodos(data && data.length > 0);
    }
  }

  function hasWorkflowChanged() {
    if (originalWorkflow.length !== workflow.length) return true;
    return originalWorkflow.some((step, index) => 
      step.name !== workflow[index]?.name || step.color !== workflow[index]?.color
    );
  }

  async function migrateTodos() {
    if (!hasWorkflowChanged()) return;

    const oldLastIndex = originalWorkflow.length - 1;
    const newLastIndex = workflow.length - 1;

    // Get all todos in this workspace
    const { data: projects } = await supabase
      .from("projects")
      .select("id")
      .eq("workspace_id", workspaceId);

    if (!projects || projects.length === 0) return;

    const projectIds = projects.map(p => p.id);

    // Get all todos with their project_id
    const { data: todos } = await supabase
      .from("todos")
      .select("id, status_index, project_id")
      .in("project_id", projectIds);

    if (!todos || todos.length === 0) return;

    const updates = todos.map(todo => {
      let newStatusIndex = todo.status_index;

      // If todo was in the last step of old workflow, move to last step of new workflow
      if (todo.status_index === oldLastIndex) {
        newStatusIndex = newLastIndex;
      }
      // If todo was in first step (0), keep it there
      else if (todo.status_index === 0) {
        newStatusIndex = 0;
      }
      // All other todos (middle steps) go to first step
      else {
        newStatusIndex = 0;
      }

      return {
        id: todo.id,
        status_index: newStatusIndex
      };
    });

    // Update todos in batches
    for (const update of updates) {
      await supabase
        .from("todos")
        .update({ status_index: update.status_index })
        .eq("id", update.id);
    }

    // Update project statuses after migration
    await updateProjectStatusesAfterMigration(projects, todos, updates);
  }

  async function updateProjectStatusesAfterMigration(
    projects: { id: string }[], 
    originalTodos: { id: string; status_index: number; project_id: string }[], 
    updates: { id: string; status_index: number }[]
  ) {
    // Create a map of updated todos for quick lookup
    const updatedTodosMap = new Map(updates.map(update => [update.id, update.status_index]));
    
    // Group todos by project
    const todosByProject = new Map<string, { id: string; status_index: number }[]>();
    
    for (const todo of originalTodos) {
      if (!todosByProject.has(todo.project_id)) {
        todosByProject.set(todo.project_id, []);
      }
      
      // Use updated status_index if available, otherwise use original
      const updatedStatusIndex = updatedTodosMap.get(todo.id) ?? todo.status_index;
      todosByProject.get(todo.project_id)!.push({
        id: todo.id,
        status_index: updatedStatusIndex
      });
    }

    // Update each project's status
    for (const [projectId, projectTodos] of todosByProject) {
      if (projectTodos.length === 0) continue;
      
      const lastStepIndex = workflow.length - 1;
      let newStatusIndex: number;
      
      // Check if all tasks are completed
      const allCompleted = projectTodos.every(todo => todo.status_index === lastStepIndex);
      if (allCompleted) {
        newStatusIndex = lastStepIndex;
      } else {
        // Find the highest status_index among all tasks
        newStatusIndex = Math.max(...projectTodos.map(todo => todo.status_index));
      }
      
      // Update project status in database
      await supabase
        .from("projects")
        .update({ status_index: newStatusIndex })
        .eq("id", projectId);
    }
  }

  async function saveWorkflow() {
    if (!canSaveWorkflow()) return;
    
    setLoading(true);
    
    // If workflow changed and there are active todos, migrate them
    if (hasWorkflowChanged() && hasActiveTodos) {
      await migrateTodos();
    }
    
    const { error } = await supabase
      .from("workspaces")
      .update({ workflow, tags })
      .eq("id", workspaceId);

    setLoading(false);
    if (!error) {
      setOriginalWorkflow(workflow);
      setShowMigrationWarning(false);
      setOpen(false);
    }
  }

  function resetToDefault() {
    setWorkflow(defaultWorkflow);
  }

  function updateStep(index: number, key: keyof WorkflowStep, value: string) {
    const updated = [...workflow];
    updated[index] = { ...updated[index], [key]: value };
    setWorkflow(updated);
  }

  function addStep() {
    if (workflow.length >= 6) return; // Cannot add more than 6 steps
    setWorkflow([...workflow, { name: "", color: "#6b7280" }]);
    
    // Show migration warning if there are active todos
    if (hasActiveTodos) {
      setShowMigrationWarning(true);
    }
  }

  function removeStep(index: number) {
    if (workflow.length <= 3) return; // Cannot remove if only 3 steps remain
    const updated = [...workflow];
    updated.splice(index, 1);
    setWorkflow(updated);
    
    // Show migration warning if there are active todos
    if (hasActiveTodos) {
      setShowMigrationWarning(true);
    }
  }

  function addTag() {
    if (tags.length >= 10) {
      alert("Maximum of 10 tags allowed.");
      return;
    }
    setTags([...tags, { name: "", color: "#6b7280" }]);
  }

  function removeTag(index: number) {
    // Tags can always be removed regardless of workflow step count
    const updated = [...tags];
    updated.splice(index, 1);
    setTags(updated);
  }

  // Helper functions for tag validation
  const hasDuplicateTagName = (name: string, excludeIndex?: number) => {
    const trimmedName = name.trim();
    if (!trimmedName) return false;
    
    return tags.some((tag, i) => 
      i !== excludeIndex && 
      tag.name.toLowerCase() === trimmedName.toLowerCase()
    );
  };

  const hasAnyDuplicateTags = () => {
    return tags.some((tag, index) => hasDuplicateTagName(tag.name, index));
  };

  const canSaveWorkflow = () => {
    const hasDuplicates = hasAnyDuplicateTags();
    const hasUnacknowledgedWarning = showMigrationWarning && !migrationWarningAcknowledged;
    return !hasDuplicates && !hasUnacknowledgedWarning;
  };

  function updateTag(index: number, key: keyof Tag, value: string) {
    const updated = [...tags];
    updated[index] = { ...updated[index], [key]: value };
    setTags(updated);
  }

  function acknowledgeMigrationWarning() {
    setMigrationWarningAcknowledged(true);
  }

  function cancelChanges() {
    setWorkflow(originalWorkflow);
    setTags([]); // Reset tags to original state
    fetchTags(); // Reload original tags
    setShowMigrationWarning(false);
    setMigrationWarningAcknowledged(false);
    setOpen(false);
  }

  return (
    <div>
  {/* Button to open drawer */}
  <div className="flex w-full justify-end">
  <button
    onClick={() => {
      setOpen(true);
      setShowMigrationWarning(false);
      setMigrationWarningAcknowledged(false);
    }}
    className="px-4 py-2 rounded bg-green-600 text-white font-medium hover:bg-green-500 transition flex items-center gap-2"
  >
    <span className="text-xl">◀</span> Workflow Settings
  </button>
  </div>

  {/* Slide-over Drawer with animation */}
  <AnimatePresence>
    {open && (
      <>
        {/* Background overlay */}
        <motion.div
          className="fixed inset-0 bg-black/50 z-40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            setOpen(false);
            setShowMigrationWarning(false);
            setMigrationWarningAcknowledged(false);
          }}
        />

        {/* Drawer panel */}
        <motion.div
          className="fixed inset-y-0 right-0 w-full max-w-md bg-gray-900/50  backdrop-blur-sm border-l border-gray-700 p-4 overflow-y-auto z-50"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "tween", duration: 0.3 }}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Workflow Settings</h2>
            <button onClick={() => {
              setOpen(false);
              setShowMigrationWarning(false);
              setMigrationWarningAcknowledged(false);
            }}>
              <X className="w-5 h-5 text-gray-300 hover:text-white" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Workflow Steps */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-medium text-gray-300">Workflow Steps</h3>
                  <p className="text-xs text-gray-400">
                    {workflow.length}/6 steps (minimum 3, maximum 6)
                  </p>
                </div>
                <button
                  onClick={addStep}
                  disabled={workflow.length >= 6}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition"
                >
                  <Plus className="w-3 h-3" />
                  Add Step
                </button>
              </div>
              <div className="space-y-3">
                {workflow.map((step, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 border rounded p-2"
                  >
                    <input
                      className="flex-1 px-2 py-1 rounded bg-gray-800 text-white border border-gray-600"
                      value={step.name}
                      onChange={(e) => updateStep(index, "name", e.target.value)}
                      placeholder="Step name"
                    />
                    <input
                      type="color"
                      value={step.color}
                      onChange={(e) => updateStep(index, "color", e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-gray-600"
                    />
                    <button
                      onClick={() => removeStep(index)}
                      disabled={workflow.length <= 3}
                      className="p-1 text-red-400 hover:text-red-300 disabled:text-gray-500 disabled:cursor-not-allowed transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

          {/* Migration warning */}
          {showMigrationWarning && hasActiveTodos && (
            <div className="mt-4 bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-3">
              <div className="text-yellow-400 text-sm">
                <div className="font-medium mb-2">⚠️ Workflow Change Warning</div>
                <div className="text-xs space-y-1 mb-3">
                  <p>• Tasks in the first step will stay in the first step</p>
                  <p>• Completed tasks will move to the new last step</p>
                  <p>• All other tasks will be moved back to the first step</p>
                </div>
                {!migrationWarningAcknowledged && (
                  <button
                    onClick={acknowledgeMigrationWarning}
                    className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white text-xs rounded transition"
                  >
                    OK, I understand
                  </button>
                )}
                {migrationWarningAcknowledged && (
                  <div className="text-green-400 text-xs flex items-center gap-1">
                    ✓ Warning acknowledged - you can now save
                  </div>
                )}
              </div>
            </div>
          )}

            {/* Tags */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-medium text-gray-300">Tags</h3>
                  <p className="text-xs text-gray-400">
                    {tags.length}/10 tags
                  </p>
                </div>
                <button
                  onClick={addTag}
                  disabled={tags.length >= 10}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition"
                >
                  <Plus className="w-3 h-3" />
                  Add Tag
                </button>
              </div>
              <div className="space-y-2">
                {tags.map((tag, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center gap-2 border rounded p-2">
                      <input
                        className={`flex-1 px-2 py-1 rounded bg-gray-800 text-white border ${
                          hasDuplicateTagName(tag.name, index)
                            ? "border-red-500"
                            : "border-gray-600"
                        }`}
                        value={tag.name}
                        onChange={(e) => updateTag(index, "name", e.target.value)}
                        placeholder="Tag name"
                      />
                      <input
                        type="color"
                        value={tag.color}
                        onChange={(e) => updateTag(index, "color", e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-gray-600"
                      />
                      <button
                        onClick={() => removeTag(index)}
                        className="p-1 text-red-400 hover:text-red-300 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {hasDuplicateTagName(tag.name, index) && (
                      <div className="text-red-400 text-xs flex items-center gap-1 ml-2">
                        <X size={12} />
                        Duplicate tag name
                      </div>
                    )}
                  </div>
                ))}
                {tags.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-2">
                    No tags yet. Add your first tag above.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Duplicate tags warning */}
          {hasAnyDuplicateTags() && (
            <div className="mt-4 bg-red-900/20 border border-red-500/50 rounded-lg p-3">
              <div className="text-red-400 text-sm flex items-center gap-2">
                <X size={16} />
                Please fix duplicate tag names before saving
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={cancelChanges}
              className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 transition"
            >
              Cancel
            </button>
            <button
              onClick={resetToDefault}
              className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 transition"
            >
              Reset Default
            </button>
            <button
              onClick={saveWorkflow}
              disabled={loading || !canSaveWorkflow()}
              className={`px-3 py-1 rounded transition ${
                loading || !canSaveWorkflow()
                  ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-500"
              }`}
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
</div>
  );
}
