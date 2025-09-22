"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/app/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Trash2, Check, X, Palette } from "lucide-react";

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

type Workflow = {
  id: string;
  name: string;
  steps: Array<{ name: string; color: string }>;
  is_default: boolean;
  created_at: string;
};

type Tag = {
  id: string;
  name: string;
  color: string;
  created_at: string;
};

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

export default function SettingsPage() {
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"workflows" | "tags">("workflows");
  const [creatingDefaults, setCreatingDefaults] = useState(false);

  // Workflow editing states
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [newWorkflowSteps, setNewWorkflowSteps] = useState<Array<{ name: string; color: string }>>([]);
  const [showNewWorkflowForm, setShowNewWorkflowForm] = useState(false);

  // Tag editing states
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3b82f6");

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    fetchUser();
  }, [supabase]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user || creatingDefaults) return;

    try {
      // Fetch workflows
      const { data: workflowsData, error: workflowsError } = await supabase
        .from("workflows")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (workflowsError) {
        console.error("Error fetching workflows:", workflowsError);
      } else {
        setWorkflows(workflowsData || []);
      }

      // Fetch tags
      const { data: tagsData, error: tagsError } = await supabase
        .from("tags")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (tagsError) {
        console.error("Error fetching tags:", tagsError);
      } else {
        setTags(tagsData || []);
      }

      // If no workflows exist, create default
      if (!workflowsData || workflowsData.length === 0) {
        await createDefaultWorkflow();
      }

      // If no tags exist, create defaults
      if (!tagsData || tagsData.length === 0) {
        await createDefaultTags();
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultWorkflow = async () => {
    if (!user || creatingDefaults) return;
    
    setCreatingDefaults(true);
    
    try {
      const { data, error } = await supabase
        .from("workflows")
        .insert({
          user_id: user.id,
          name: "Default Workflow",
          steps: defaultWorkflow,
          is_default: true,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating default workflow:", error);
      } else {
        // Add to state directly instead of refetching
        setWorkflows(prev => [...prev, data]);
      }
    } finally {
      setCreatingDefaults(false);
    }
  };

  const createDefaultTags = async () => {
    if (!user || creatingDefaults) return;
    
    setCreatingDefaults(true);
    
    try {
      const tagsToInsert = defaultTags.map(tag => ({
        user_id: user.id,
        name: tag.name,
        color: tag.color,
      }));

      const { data, error } = await supabase
        .from("tags")
        .insert(tagsToInsert)
        .select();

      if (error) {
        console.error("Error creating default tags:", error);
      } else {
        // Add to state directly instead of refetching
        setTags(prev => [...prev, ...(data || [])]);
      }
    } finally {
      setCreatingDefaults(false);
    }
  };

  // Workflow functions
  const startEditingWorkflow = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
    setNewWorkflowName(workflow.name);
    setNewWorkflowSteps([...workflow.steps]);
  };

  const addWorkflowStep = () => {
    if (newWorkflowSteps.length >= 6) return; // Cannot add more than 6 steps
    setNewWorkflowSteps([...newWorkflowSteps, { name: "", color: "#6b7280" }]);
  };

  const updateWorkflowStep = (index: number, field: "name" | "color", value: string) => {
    const updated = [...newWorkflowSteps];
    updated[index][field] = value;
    setNewWorkflowSteps(updated);
  };

  const removeWorkflowStep = (index: number) => {
    if (newWorkflowSteps.length <= 3) return; // Cannot remove if only 3 steps remain
    setNewWorkflowSteps(newWorkflowSteps.filter((_, i) => i !== index));
  };

  const saveWorkflow = async () => {
    if (!editingWorkflow || !newWorkflowName.trim() || newWorkflowSteps.length === 0) return;

    const { error } = await supabase
      .from("workflows")
      .update({
        name: newWorkflowName.trim(),
        steps: newWorkflowSteps,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingWorkflow.id);

    if (error) {
      console.error("Error updating workflow:", error);
    } else {
      setEditingWorkflow(null);
      fetchData();
    }
  };

  const createNewWorkflow = async () => {
    if (!user || !newWorkflowName.trim() || newWorkflowSteps.length < 3) return;

    // Validate that all steps have names
    const validSteps = newWorkflowSteps.filter(step => step.name.trim());
    if (validSteps.length < 3) {
      alert("Please provide at least 3 workflow steps with names.");
      return;
    }

    const { error } = await supabase
      .from("workflows")
      .insert({
        user_id: user.id,
        name: newWorkflowName.trim(),
        steps: validSteps,
        is_default: false,
      });

    if (error) {
      console.error("Error creating workflow:", error);
    } else {
      setNewWorkflowName("");
      setNewWorkflowSteps([]);
      setShowNewWorkflowForm(false);
      fetchData();
    }
  };

  const setDefaultWorkflow = async (workflowId: string) => {
    if (!user) return;

    // First, unset all defaults
    await supabase
      .from("workflows")
      .update({ is_default: false })
      .eq("user_id", user.id);

    // Then set the new default
    const { error } = await supabase
      .from("workflows")
      .update({ is_default: true })
      .eq("id", workflowId);

    if (error) {
      console.error("Error setting default workflow:", error);
    } else {
      fetchData();
    }
  };

  const deleteWorkflow = async (workflowId: string) => {
    if (!confirm("Are you sure you want to delete this workflow?")) return;

    const { error } = await supabase
      .from("workflows")
      .delete()
      .eq("id", workflowId);

    if (error) {
      console.error("Error deleting workflow:", error);
    } else {
      fetchData();
    }
  };

  // Helper functions for tag validation
  const hasDuplicateTagName = (name: string, excludeId?: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return false;
    
    return tags.some(tag => 
      tag.id !== excludeId && 
      tag.name.toLowerCase() === trimmedName.toLowerCase()
    );
  };

  const canSaveTag = () => {
    if (!newTagName.trim()) return false;
    return !hasDuplicateTagName(newTagName, editingTag?.id);
  };

  // Tag functions
  const startEditingTag = (tag: Tag) => {
    setEditingTag(tag);
    setNewTagName(tag.name);
    setNewTagColor(tag.color);
  };

  const saveTag = async () => {
    if (!editingTag || !canSaveTag()) return;

    const { error } = await supabase
      .from("tags")
      .update({
        name: newTagName.trim(),
        color: newTagColor,
      })
      .eq("id", editingTag.id);

    if (error) {
      console.error("Error updating tag:", error);
    } else {
      setEditingTag(null);
      fetchData();
    }
  };

  const createNewTag = async () => {
    if (!user || !canSaveTag()) return;

    if (tags.length >= 10) {
      alert("Maximum of 10 tags allowed.");
      return;
    }

    const { error } = await supabase
      .from("tags")
      .insert({
        user_id: user.id,
        name: newTagName.trim(),
        color: newTagColor,
      });

    if (error) {
      console.error("Error creating tag:", error);
    } else {
      setNewTagName("");
      setNewTagColor("#3b82f6");
      fetchData();
    }
  };

  const useDefaultTags = async () => {
    if (!user) return;

    if (tags.length > 0) {
      const confirmed = confirm(
        "This will delete all your existing tags and replace them with default tags. Are you sure you want to continue?"
      );
      if (!confirmed) return;
    }

    try {
      // Delete all existing tags
      if (tags.length > 0) {
        const { error: deleteError } = await supabase
          .from("tags")
          .delete()
          .eq("user_id", user.id);

        if (deleteError) {
          console.error("Error deleting existing tags:", deleteError);
          return;
        }
      }

      // Insert default tags
      const tagsToInsert = defaultTags.map(tag => ({
        user_id: user.id,
        name: tag.name,
        color: tag.color,
      }));

      const { error: insertError } = await supabase
        .from("tags")
        .insert(tagsToInsert);

      if (insertError) {
        console.error("Error creating default tags:", insertError);
      } else {
        fetchData();
      }
    } catch (error) {
      console.error("Error using default tags:", error);
    }
  };

  const deleteTag = async (tagId: string) => {
    if (!confirm("Are you sure you want to delete this tag?")) return;

    const { error } = await supabase
      .from("tags")
      .delete()
      .eq("id", tagId);

    if (error) {
      console.error("Error deleting tag:", error);
    } else {
      fetchData();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">Loading settings...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl text-white mb-3">Workflow Settings</h1>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-8 bg-gray-800/50 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("workflows")}
          className={`px-4 py-2 rounded-md transition ${
            activeTab === "workflows"
              ? "bg-green-600 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Workflows
        </button>
        <button
          onClick={() => setActiveTab("tags")}
          className={`px-4 py-2 rounded-md transition ${
            activeTab === "tags"
              ? "bg-green-600 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Tags
        </button>
      </div>

      {/* Workflows Tab */}
      {activeTab === "workflows" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-white">Workflows</h2>
            <button
              onClick={() => {
                setEditingWorkflow(null);
                setNewWorkflowName("");
                setNewWorkflowSteps([...defaultWorkflow]);
                setShowNewWorkflowForm(true);
              }}
              className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 md:text-base text-sm rounded-lg transition flex items-center gap-2"
            >
              <Plus size={16} />
              New Workflow
            </button>
          </div>

          {/* Workflow List */}
          <div className="grid gap-4">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="bg-gray-800/40 border border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-medium text-white">{workflow.name}</h3>
                    {workflow.is_default && (
                      <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!workflow.is_default && (
                      <button
                        onClick={() => setDefaultWorkflow(workflow.id)}
                        className="text-green-400 hover:text-green-300 text-sm"
                      >
                        Set as Default
                      </button>
                    )}
                    <button
                      onClick={() => startEditingWorkflow(workflow)}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      <Edit2 size={16} />
                    </button>
                    {!workflow.is_default && (
                      <button
                        onClick={() => deleteWorkflow(workflow.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Workflow Steps */}
                <div className="flex flex-wrap gap-2">
                  {workflow.steps.map((step, index) => (
                    <div
                      key={index}
                      className="px-3 py-2 rounded-lg text-sm font-medium"
                      style={{ 
                        backgroundColor: step.color, 
                        color: getContrastColor(step.color) 
                      }}
                    >
                      {step.name}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Workflow Editor */}
          <AnimatePresence>
            {(editingWorkflow || showNewWorkflowForm) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-gray-800/60 border border-gray-700 rounded-lg p-6"
              >
                <h3 className="text-lg font-medium text-white mb-4">
                  {editingWorkflow ? "Edit Workflow" : "New Workflow"}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block md:text-base text-sm font-medium text-gray-300 mb-2">
                      Workflow Name
                    </label>
                    <input
                      type="text"
                      value={newWorkflowName}
                      onChange={(e) => setNewWorkflowName(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Enter workflow name"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <label className="block md:text-base text-sm font-medium text-gray-300">
                          Workflow Steps
                        </label>
                        <p className="text-xs text-gray-400">
                          {newWorkflowSteps.length}/6 steps (minimum 3, maximum 6)
                        </p>
                      </div>
                      <button
                        onClick={addWorkflowStep}
                        disabled={newWorkflowSteps.length >= 6}
                        className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-3 py-1 md:text-base text-sm rounded transition flex items-center gap-1"
                      >
                        <Plus size={14} />
                        Add Step
                      </button>
                    </div>

                    <div className="space-y-2">
                      {newWorkflowSteps.map((step, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={step.name}
                            onChange={(e) => updateWorkflowStep(index, "name", e.target.value)}
                            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="Step name"
                          />
                          <input
                            type="color"
                            value={step.color}
                            onChange={(e) => updateWorkflowStep(index, "color", e.target.value)}
                            className="w-12 h-10 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer"
                          />
                          <button
                            onClick={() => removeWorkflowStep(index)}
                            disabled={newWorkflowSteps.length <= 3}
                            className="text-red-400 hover:text-red-300 disabled:text-gray-500 disabled:cursor-not-allowed p-2 transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={editingWorkflow ? saveWorkflow : createNewWorkflow}
                      className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 md:text-base text-sm rounded-lg transition flex items-center gap-2"
                    >
                      <Check size={16} />
                      {editingWorkflow ? "Save Changes" : "Create Workflow"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingWorkflow(null);
                        setNewWorkflowName("");
                        setNewWorkflowSteps([]);
                        setShowNewWorkflowForm(false);
                      }}
                      className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 md:text-base text-sm rounded-lg transition flex items-center gap-2"
                    >
                      <X size={16} />
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Tags Tab */}
      {activeTab === "tags" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Tags</h2>
              <p className="text-sm text-gray-400">
                {tags.length}/10 tags
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={useDefaultTags}
                className="bg-blue-600 hover:bg-blue-500 text-white md:text-base text-sm px-4 py-2 rounded-lg transition flex items-center gap-2"
              >
                Use Default Tags
              </button>
              <button
                onClick={() => {
                  setEditingTag(null);
                  setNewTagName("");
                  setNewTagColor("#3b82f6");
                }}
                disabled={tags.length >= 10}
                className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition flex items-center gap-2 md:text-base text-sm"
              >
                <Plus size={16} />
                New Tag
              </button>
            </div>
          </div>

          {/* Tags Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="bg-gray-800/40 border border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex items-center gap-2 px-3 py-1 rounded-full text-sm"
                      style={{ backgroundColor: tag.color + "20", color: tag.color }}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="font-medium">{tag.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEditingTag(tag)}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => deleteTag(tag.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tag Editor */}
          <AnimatePresence>
            {(editingTag || (!editingTag && newTagName)) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-gray-800/60 border border-gray-700 rounded-lg p-6"
              >
                <h3 className="text-lg font-medium text-white mb-4">
                  {editingTag ? "Edit Tag" : "New Tag"}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block md:text-base text-sm font-medium text-gray-300 mb-2">
                      Tag Name
                    </label>
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Enter tag name"
                    />
                  </div>

                  <div>
                    <label className="block md:text-base text-sm font-medium text-gray-300 mb-2">
                      Tag Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={newTagColor}
                        onChange={(e) => setNewTagColor(e.target.value)}
                        className="w-12 h-10 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer"
                      />
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full border border-gray-600"
                          style={{ backgroundColor: newTagColor }}
                        />
                        <span className="text-gray-300 text-sm">{newTagColor}</span>
                      </div>
                    </div>
                  </div>

                  {/* Duplicate name hint */}
                  {newTagName.trim() && hasDuplicateTagName(newTagName, editingTag?.id) && (
                    <div className="text-red-400 text-sm flex items-center gap-2">
                      <X size={16} />
                      A tag with this name already exists
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={editingTag ? saveTag : createNewTag}
                      disabled={!canSaveTag()}
                      className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                        canSaveTag()
                          ? "bg-green-600 hover:bg-green-500 text-white"
                          : "bg-gray-600 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      <Check size={16} />
                      {editingTag ? "Save Changes" : "Create Tag"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingTag(null);
                        setNewTagName("");
                        setNewTagColor("#3b82f6");
                      }}
                      className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
                    >
                      <X size={16} />
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
