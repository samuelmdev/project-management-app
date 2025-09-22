"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "../../../../lib/supabase/client";
import { AnimatePresence, motion } from "framer-motion";

type Todo = {
  id: string;
  content: string;
  status_index: number;
};

type Milestone = {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  deadline?: string | null;
  tracked_todo_ids: string[];
  created_at?: string;
};

interface MilestonesComponentProps {
  projectId: string;
  todos: Todo[];
  canWrite: boolean;
  workflow: { name: string; color: string }[];
}

export default function MilestonesComponent({
  projectId,
  todos,
  canWrite,
  workflow,
}: MilestonesComponentProps) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(
    null
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [selectedTodoIds, setSelectedTodoIds] = useState<string[]>([]);
  const supabase = createClient();

  const cleanupEmptyMilestones = useCallback(async (milestonesData: Milestone[]) => {
    const validTodoIds = new Set(todos.map(todo => todo.id));
    const emptyMilestones = milestonesData.filter(milestone => {
      // Check if milestone has no valid todos
      // Note: fullProjectMilestone (id: "full") is never deleted as it's not in the database
      return milestone.tracked_todo_ids.length === 0 || 
             !milestone.tracked_todo_ids.some(id => validTodoIds.has(id));
    });

    // Delete empty milestones from database
    if (emptyMilestones.length > 0) {
      const milestoneIdsToDelete = emptyMilestones.map(m => m.id);
      
      const { error } = await supabase
        .from("milestones")
        .delete()
        .in("id", milestoneIdsToDelete);

      if (!error) {
        // Update local state to remove deleted milestones
        setMilestones(prev => prev.filter(m => !milestoneIdsToDelete.includes(m.id)));
        console.log(`Cleaned up ${emptyMilestones.length} empty milestone(s)`);
      } else {
        console.error("Error cleaning up empty milestones:", error);
      }
    }
  }, [todos, supabase]);

  useEffect(() => {
    fetchMilestones();
  }, [projectId]);

  // Clean up empty milestones when todos change (e.g., when todos are deleted)
  useEffect(() => {
    if (milestones.length > 0) {
      cleanupEmptyMilestones(milestones);
    }
  }, [todos, milestones, cleanupEmptyMilestones]);

  async function fetchMilestones() {
    setLoading(true);
    const { data, error } = await supabase
      .from("milestones")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      const milestonesData = data as Milestone[];
      setMilestones(milestonesData);
      
      // Clean up milestones with no valid todos
      await cleanupEmptyMilestones(milestonesData);
    }
    setLoading(false);
  }

  async function addMilestone() {
    const uniqueTodoIds = Array.from(new Set(selectedTodoIds));

    const { data, error } = await supabase
      .from("milestones")
      .insert([
        {
          project_id: projectId,
          name,
          description,
          deadline: deadline || null,
          tracked_todo_ids: uniqueTodoIds,
        },
      ])
      .select();

    if (!error && data && data.length > 0) {
      setMilestones([...milestones, data[0] as Milestone]);
      resetForm();
    }
  }

  async function updateMilestone() {
    if (!editingMilestone) return;
    const uniqueTodoIds = Array.from(new Set(selectedTodoIds));

    const { data, error } = await supabase
      .from("milestones")
      .update({
        name,
        description,
        deadline: deadline || null,
        tracked_todo_ids: uniqueTodoIds,
      })
      .eq("id", editingMilestone.id)
      .select();

    if (!error && data && data.length > 0) {
      const updatedMilestones = milestones.map((m) => (m.id === editingMilestone.id ? data[0] : m));
      setMilestones(updatedMilestones);
      
      // Clean up any milestones that became empty after this update
      await cleanupEmptyMilestones(updatedMilestones);
      
      resetForm();
    }
  }

  async function deleteMilestone(id: string) {
    await supabase.from("milestones").delete().eq("id", id);
    setMilestones((prev) => prev.filter((m) => m.id !== id));
  }

  function resetForm() {
    setName("");
    setDescription("");
    setDeadline("");
    setSelectedTodoIds([]);
    setAdding(false);
    setEditingMilestone(null);
  }

  function calculateProgress(todoIds: string[]) {
    if (!todoIds || todoIds.length === 0 || !workflow.length) return 0;
    const tracked = todos.filter((t) => todoIds.includes(t.id));
    const lastStepIndex = workflow.length - 1;
    const completed = tracked.filter((t) => t.status_index === lastStepIndex);
    return Math.round((completed.length / tracked.length) * 100);
  }

  const fullProjectMilestone: Milestone = {
    id: "full",
    project_id: projectId,
    name: "Full Project Completion",
    description: "Tracks completion of all project tasks",
    deadline: null,
    tracked_todo_ids: todos.map((t) => t.id),
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-medium mb-2">Milestones</h2>

      <div className="flex flex-col max-h-[50vh] overflow-y-auto gap-2">
        {[fullProjectMilestone, ...milestones].map((m) => {
          const progress = calculateProgress(m.tracked_todo_ids);
          const isExpanded = expandedId === m.id;

          return (
            <div
              key={m.id}
              className="border rounded p-3 bg-gray-800 shadow-sm hover:shadow-md transition"
            >
              <div
                className="flex justify-between items-center cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : m.id)}
              >
                <div>
                  <h3 className="font-bold">{m.name}</h3>
                  {m.description && (
                    <p className="text-sm text-gray-400">{m.description}</p>
                  )}
                  {m.deadline && (
                    <p className="text-sm text-red-400">
                      Deadline: {new Date(m.deadline).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div className="text-right min-w-[120px]">
                  <div className="text-sm">Completed: {progress}%</div>
                  <div className="w-32 h-2 bg-gray-600 rounded overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-2 bg-green-500"
                    />
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-3 space-y-1"
                  >
                    <h4 className="text-sm font-medium">Tasks:</h4>
                    {todos
                      .filter((t) => m.tracked_todo_ids.includes(t.id))
                      .map((t) => (
                        <p
                          key={t.id}
                          className={`text-sm ${
                            t.status_index === (workflow.length - 1)
                              ? "line-through text-gray-400"
                              : ""
                          }`}
                        >
                          • {t.content}
                        </p>
                      ))}

                    {canWrite && m.id !== "full" && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => {
                            setEditingMilestone(m);
                            setName(m.name);
                            setDescription(m.description || "");
                            setDeadline(m.deadline?.split("T")[0] || "");
                            setSelectedTodoIds(m.tracked_todo_ids);
                          }}
                          className="px-2 py-1 bg-yellow-600 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteMilestone(m.id)}
                          className="px-2 py-1 bg-red-600 rounded"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {canWrite && (
        <div className="relative group inline-block">
          <button
            onClick={() => todos.length > 0 && setAdding(true)}
            className={`px-3 py-1 border rounded ${todos.length === 0 ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-600"}`}
            disabled={todos.length === 0}
          >
            + Add Milestone
          </button>
          {todos.length === 0 && (
            <div className="absolute left-0 mt-2 z-10 hidden group-hover:block bg-gray-800 text-gray-200 text-xs rounded px-3 py-2 shadow-lg border border-gray-700 whitespace-nowrap">
              Add tasks first to create a milestone
            </div>
          )}
        </div>
      )}

      {/* MODAL */}
      <AnimatePresence>
        {(adding || editingMilestone) && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 p-6 rounded-lg w-full max-w-lg space-y-3 shadow-lg"
            >
              <h3 className="text-lg font-semibold text-green-500">
                {editingMilestone ? "Edit Milestone" : "New Milestone"}
              </h3>

              <input
                className="w-full p-2 rounded border bg-gray-800"
                placeholder="Milestone name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <textarea
                className="w-full p-2 rounded border bg-gray-800"
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <input
                type="date"
                className="w-full p-2 rounded border bg-gray-800"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />

              <div>
                <p className="text-sm font-medium mb-1">
                  Select Tasks to Track
                </p>
                <div className="max-h-40 overflow-y-auto border rounded p-2">
                  {todos.map((t) => (
                    <label key={t.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedTodoIds.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTodoIds([...selectedTodoIds, t.id]);
                          } else {
                            setSelectedTodoIds(
                              selectedTodoIds.filter((id) => id !== t.id)
                            );
                          }
                        }}
                      />
                      <span>{t.content}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={resetForm}
                  className="px-3 py-1 border rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={
                    editingMilestone
                      ? () => {
                          updateMilestone();
                          resetForm();
                        }
                      : () => {
                          addMilestone();
                          resetForm();
                        }
                  }
                  className="px-3 py-1 bg-green-600 rounded text-white"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
