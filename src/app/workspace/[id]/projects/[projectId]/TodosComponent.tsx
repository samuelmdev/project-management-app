"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "../../../../lib/supabase/client";
import { AnimatePresence, motion } from "framer-motion";
import { logActions } from "../../../../lib/logging";
import { ChevronDown, X } from "lucide-react";

type WorkflowStep = { name: string; color: string };

interface Tag {
  name: string;
  color: string;
}

interface Todo {
  id: string;
  content: string;
  status_index: number;
  created_at: string;
  tag: Tag | null;
}

interface TodosComponentProps {
  projectId: string;
  workspaceId: string;
  todos: Todo[];
  workflow: WorkflowStep[];
  canWrite: boolean;
  onTodosChange?: (next: Todo[]) => void;
}

export default function TodosComponent({
  projectId,
  workspaceId,
  todos: initialTodos,
  workflow,
  canWrite,
  onTodosChange,
}: TodosComponentProps) {
  const supabase = createClient();

  const [todos, setTodos] = useState<Todo[]>(initialTodos || []);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [workspaceTags, setWorkspaceTags] = useState<Tag[]>([]);
  const [selectedTagName, setSelectedTagName] = useState<string>("");
  const [editingTodoTag, setEditingTodoTag] = useState<{ [todoId: string]: Tag | null }>({});
  const todoInputRef = useRef<HTMLTextAreaElement>(null);

  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState(0)
  const pendingEmitRef = useRef<Todo[] | null>(null)

  // When entering kanban/mobile carousel or when tasks change, choose sensible initial column:
  // - If all tasks share the same status_index, open that column
  // - Otherwise open the lowest status_index present
  useEffect(() => {
    if (!workflow || workflow.length === 0) return
    if (!todos || todos.length === 0) return
    // Determine unique status indices present within workflow bounds
    const indices = Array.from(
      new Set(
        todos
          .map((t) => t.status_index)
          .filter((i) => Number.isInteger(i) && i >= 0 && i < workflow.length)
      )
    )
    if (indices.length === 0) return
    const nextStep = indices.length === 1 ? indices[0] : Math.min(...indices)
    if (nextStep !== currentStep) {
      setDirection(0)
      setCurrentStep(nextStep)
    }
  }, [todos, workflow])

  // Keep local todos in sync with incoming prop (e.g., realtime updates)
  useEffect(() => {
    setTodos(initialTodos || [])
  }, [initialTodos])

  // Fetch workspace tags and todos with tags
  useEffect(() => {
    fetchWorkspaceTags();
    fetchTodosWithTags();
  }, [workspaceId, projectId]);

  async function fetchWorkspaceTags() {
    const { data, error } = await supabase
      .from("workspaces")
      .select("tags")
      .eq("id", workspaceId)
      .maybeSingle();

    if (!error && data?.tags) {
      setWorkspaceTags(data.tags);
    }
  }

  async function fetchTodosWithTags() {
    const { data: todosData, error: todosError } = await supabase
      .from("todos")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    if (!todosError && todosData) {
      const todosWithTags = todosData.map(todo => ({
        ...todo,
        tag: todo.tag || null
      }));
      setTodos(todosWithTags);
    }
  }

  // Post-commit emit to parent
  useEffect(() => {
    if (pendingEmitRef.current) {
      const payload = pendingEmitRef.current
      pendingEmitRef.current = null
      onTodosChange?.(payload)
    }
  })

  async function handleAddTodo(e: React.FormEvent) {
    e.preventDefault();
    const content = todoInputRef.current?.value?.trim();
    if (!content) return;

    const defaultIndex = 0; // always first step
    const selectedTag = selectedTagName ? workspaceTags.find(t => t.name === selectedTagName) : null;

    console.log("Creating todo with tag:", selectedTag); // Debug log

    const { data, error } = await supabase
      .from("todos")
      .insert([{ 
        project_id: projectId, 
        content, 
        status_index: defaultIndex,
        tag: selectedTag
      }])
      .select()
      .single();

    if (error) {
      console.error("Error creating todo:", error);
      return;
    }

    if (data) {
      console.log("Todo created successfully:", data); // Debug log
      
      // Log task creation
      await logActions.taskCreated(workspaceId, projectId, content);
      
      setTodos((prev) => {
        const exists = prev.some((t) => t.id === data.id);
        if (exists) return prev; // don't duplicate
        const next = [...prev, data as Todo]
        pendingEmitRef.current = next
        return next;
      });

      await updateProjectStatus(projectId, [...todos, data as Todo]);
      if (todoInputRef.current) todoInputRef.current.value = "";
      setSelectedTagName(""); // Reset tag selection
    }
  }


  async function updateStatus(id: string, status_index: number) {
    const todo = todos.find(t => t.id === id);
    const previousStatus = todo?.status_index;
    const { error } = await supabase
      .from("todos")
      .update({ status_index })
      .eq("id", id);

    if (!error) {
  // Log status change
  const lastStepIndex = workflow.length - 1;
  const isCompleted = status_index === lastStepIndex;
  const wasCompleted = previousStatus === lastStepIndex;
  
  if (isCompleted && !wasCompleted) {
    await logActions.taskCompleted(workspaceId, projectId, todo?.content || "Unknown Task");
  } else if (!isCompleted && wasCompleted) {
    await logActions.taskReopened(workspaceId, projectId, todo?.content || "Unknown Task");
  } else {
    await logActions.taskUpdated(workspaceId, projectId, todo?.content || "Unknown Task", ["status"]);
  }
  
  const newTodos = todos.map((t) =>
    t.id === id ? { ...t, status_index } : t
  );
  setTodos(newTodos);
  pendingEmitRef.current = newTodos
  await updateProjectStatus(projectId, newTodos);
}
  }

  async function handleDeleteTodo(id: string) {
    const toDelete = todos.find((t) => t.id === id);
    const preview = (toDelete?.content || "").slice(0, 60);
    const ok = window.confirm(
      `Delete this task? This cannot be undone.\n\nPreview: "${preview}"`
    );
    if (!ok) return;
    const { error } = await supabase.from("todos").delete().eq("id", id);
    if (!error) {
  // Log task deletion
  await logActions.taskDeleted(workspaceId, projectId, toDelete?.content || "Unknown Task");
  
  const newTodos = todos.filter((t) => t.id !== id);
  setTodos(newTodos);
  pendingEmitRef.current = newTodos
  await updateProjectStatus(projectId, newTodos);
}
  }

  function startEditing(todo: Todo) {
    setEditingTodoId(todo.id);
    setEditingContent(todo.content);
    
    console.log("Starting to edit todo:", { id: todo.id, tag: todo.tag }); // Debug log
    
    // Initialize editing tag for this todo
    setEditingTodoTag(prev => ({
      ...prev,
      [todo.id]: todo.tag || null
    }));
  }

  function updateTodoTag(todoId: string, tagName: string) {
    console.log("Available workspace tags:", workspaceTags); // Debug log
    console.log("Looking for tag with name:", tagName); // Debug log
    
    const tag = workspaceTags.find(t => t.name === tagName);
    
    console.log("Setting todo tag locally:", { todoId, tagName, tag }); // Debug log
    
    // Only update local state - don't save to database yet
    setEditingTodoTag(prev => ({
      ...prev,
      [todoId]: tag || null
    }));
  }

  function removeTagFromTodo(todoId: string) {
    console.log("Removing todo tag locally:", todoId); // Debug log
    
    // Only update local state - don't save to database yet
    setEditingTodoTag(prev => ({
      ...prev,
      [todoId]: null
    }));
  }

  async function saveEditedTodo(id: string) {
    const originalTodo = todos.find(t => t.id === id);
    const updatedTag = editingTodoTag[id] || null;
    
    console.log("Saving edited todo:", { id, content: editingContent, tag: updatedTag }); // Debug log
    
    const { error } = await supabase
      .from("todos")
      .update({ 
        content: editingContent,
        tag: updatedTag
      })
      .eq("id", id);
      
    if (error) {
      console.error("Error saving edited todo:", error);
      return;
    }
    
    console.log("Todo saved successfully"); // Debug log
    
    // Log task update
    await logActions.taskUpdated(workspaceId, projectId, editingContent, ["content"]);
    
    setTodos((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, content: editingContent, tag: updatedTag } : t
      )
    );
    setEditingTodoId(null);
    setEditingTodoTag(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
  }

  // call this after todos are updated
async function updateProjectStatus(projectId: string, todos: Todo[]) {
  if (!todos.length) {
    // if no todos, maybe reset project status to 0
    await supabase
      .from("projects")
      .update({ status_index: 0 })
      .eq("id", projectId);
    return;
  }

  const allStatus = todos.map((t) => t.status_index);
  const maxStatusUnder3 = Math.max(...allStatus.filter((s) => s < 3));

  const projectStatus =
    allStatus.every((s) => s === 3) ? 3 : maxStatusUnder3;

  await supabase
    .from("projects")
    .update({ status_index: projectStatus })
    .eq("id", projectId);
}

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

function renderTag(tag: Tag) {
  return (
    <div
      key={tag.name}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: tag.color + "20", color: tag.color }}
    >
      <div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: tag.color }}
      />
      {tag.name}
    </div>
  );
}

const handleNext = () => {
    if (currentStep < workflow.length - 1) {
      setDirection(1)
      setCurrentStep((s) => s + 1)
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setDirection(-1)
      setCurrentStep((s) => s - 1)
    }
  }

  return (
    <section className="space-y-6 max-w-[95vw]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700/50 pb-2">
        <h2 className="text-xl font-semibold text-white">Tasks</h2>
        {/* toggle views */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("list")}
            disabled={viewMode === "list"}
            className={`px-4 py-1.5 rounded-full md:text-sm text-xs font-medium transition ${
              viewMode === "list"
                ? "bg-green-600 text-white shadow-md"
                : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode("kanban")}
            disabled={todos.length === 0}
            className={`px-4 py-1.5 rounded-full md:text-sm text-xs font-medium transition ${
              viewMode === "kanban"
                ? "bg-green-600 text-white shadow-md"
                : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            Kanban
          </button>
        </div>
      </div>

      {/* LIST VIEW */}
      {viewMode === "list" ? (
        <div className="space-y-3 max-h-[43vh] overflow-y-auto max-w-full pr-2">
          {todos.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-8">
              Add first task
            </div>
          ) : (
            todos
              .slice()
              .sort((a: Todo, b: Todo) => {
                if (a.status_index !== b.status_index) return a.status_index - b.status_index
                // secondary stable sort by created_at for consistent ordering within same status
                const at = new Date(a.created_at).getTime()
                const bt = new Date(b.created_at).getTime()
                return at - bt
              })
              .map((todo: any) => {
                const step = workflow[todo.status_index]
                return (
                  <div
                    key={todo.id}
                    className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/70 hover:border-green-600/50 rounded-xl p-3 shadow-sm hover:shadow-md transition flex justify-between items-start"
                  >
                    <div className="flex-1 pr-4">
                      {editingTodoId === todo.id ? (
                        <div className="flex flex-col gap-3">
                          <input
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className="bg-gray-900 border border-gray-700 px-3 py-1.5 rounded-lg text-sm text-white"
                          />
                          
                          {/* Tag editing section */}
                          <div className="space-y-2">
                            <div className="flex flex-row items-center gap-2">
                            <div className="text-xs text-gray-300">Tag:</div>
                            <div className="flex items-center gap-2">
                              {editingTodoTag[todo.id] && (
                                <div className="relative group">
                                  {renderTag(editingTodoTag[todo.id]!)}
                                  <button
                                    onClick={() => removeTagFromTodo(todo.id)}
                                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    ×
                                  </button>
                                </div>
                              )}
                              <select
                                value={editingTodoTag[todo.id]?.name || ""}
                                onChange={(e) => {
                                  const newTagName = e.target.value;
                                  if (newTagName) {
                                    updateTodoTag(todo.id, newTagName);
                                  } else {
                                    removeTagFromTodo(todo.id);
                                  }
                                }}
                                className="text-xs bg-gray-800 border border-gray-600 rounded px-2 py-1"
                              >
                                <option value="">No tag</option>
                                {workspaceTags.map(tag => (
                                  <option
                                  key={tag.name}
                                  value={tag.name}
                                  style={{
                                    color: tag.color, // applies to both text and the "●"
                                    fontWeight: "500",
                                  }}
                                >
                                  ● {tag.name}
                                </option>
                                
                                ))}
                              </select>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-row gap-2">
                          <button
                            onClick={() => saveEditedTodo(todo.id)}
                            className="self-start text-sm text-green-500 hover:underline"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingTodoId(null)}
                            className="self-start text-sm text-gray-200 hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                        </div>
                      ) : (
                        <>
                          <div className="font-medium text-white flex items-center gap-2 flex-wrap">
                            {todo.content}
                            {todo.tag && renderTag(todo.tag)}
                          </div>
                          <div className="text-xs text-gray-400">
                            Added: {new Date(todo.created_at).toLocaleString()}
                          </div>
                          <div className="text-xs flex items-center gap-1 text-gray-300">
                            Status:
                            <span
                              className="inline-block w-3 h-3 rounded-full"
                              style={{ backgroundColor: step?.color || "gray" }}
                            ></span>
                            {step?.name ?? "Unknown"}
                          </div>
                        </>
                      )}
                    </div>

                    {canWrite && editingTodoId !== todo.id && (
                      <div className="flex md:flex-row flex-col md:gap-4 gap-2">
                        <button
                          className="text-sm text-blue-400 hover:text-blue-300"
                          onClick={() => startEditing(todo)}
                        >
                          Edit
                        </button>
                        <button
                          className="text-sm text-red-500 hover:text-red-400"
                          onClick={() => handleDeleteTodo(todo.id)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
          )}
        </div>
      ) : (
        <>
          {/* DESKTOP KANBAN */}
          <div className="hidden md:block overflow-x-auto max-w-[83vw] pb-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 justify-center mx-auto">
            <div className="flex gap-4 min-w-max">
              {workflow.map((step: any, index: number) => (
                <div
                  key={step.name}
                  className="bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700 
                             flex flex-col max-h-[43vh] overflow-y-auto min-w-[380px] flex-shrink-0"
              >
                <h4
                  className="text-md font-semibold px-3 py-2"
                  style={{
                    backgroundColor: step.color,
                    color: getContrastColor(step.color),
                  }}
                >
                  {step.name}
                </h4>
                <div className="flex-1 p-3 space-y-2 overflow-y-auto">
                  {todos
                    .filter((t: any) => t.status_index === index)
                    .map((todo: any) => (
                      <div
                        key={todo.id}
                        className="bg-gray-900 p-2 rounded-lg shadow border border-gray-700"
                      >
                        <div className="flex flex-row items-center gap-2">
                        <p className="text-sm text-white">{todo.content}</p>
                        {todo.tag && (
                          <div className="mt-1">
                          {renderTag(todo.tag)}
                          </div>
                        )}</div>
                        {canWrite && (
                          <select
                            value={todo.status_index}
                            onChange={(e) =>
                              updateStatus(todo.id, parseInt(e.target.value))
                            }
                            className="mt-2 w-full text-xs rounded bg-gray-800 border border-gray-600 text-gray-200"
                          >
                            {workflow.map((w: any, i: number) => (
                              <option key={i} value={i}>
                                {w.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
            </div>
          </div>

          {/* MOBILE KANBAN (carousel) */}
          <div className="relative md:hidden w-full h-[43vh] overflow-hidden">
            <AnimatePresence initial={false} custom={direction}>
              <motion.div
                key={workflow[currentStep].name}
                custom={direction}
                variants={{
                  enter: (dir: number) => ({
                    x: dir > 0 ? 300 : -300,
                    opacity: 0,
                  }),
                  center: { x: 0, opacity: 1 },
                  exit: (dir: number) => ({
                    x: dir > 0 ? -300 : 300,
                    opacity: 0,
                  }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="absolute top-0 left-0 w-full h-full"
              >
                <div
                  className="bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700 h-full flex flex-col"
                  style={{ backgroundColor: workflow[currentStep].color }}
                >
                  <h4
                    className="text-md font-semibold px-3 py-2 flex items-center justify-between"
                    style={{
                      backgroundColor: workflow[currentStep].color,
                      color: getContrastColor(workflow[currentStep].color),
                    }}
                  >
                    {workflow[currentStep].name}
                    <div className="flex gap-2">
                      {currentStep > 0 && (
                        <button
                          onClick={handlePrev}
                          className="px-2 py-1 bg-gray-900 rounded text-white text-xs"
                        >
                          ◀
                        </button>
                      )}
                      {currentStep < workflow.length - 1 && (
                        <button
                          onClick={handleNext}
                          className="px-2 py-1 bg-gray-900 rounded text-white text-xs"
                        >
                          ▶
                        </button>
                      )}
                    </div>
                  </h4>

                  <div className="flex-1 p-3 space-y-2 overflow-y-auto">
                    {todos
                      .filter((t: any) => t.status_index === currentStep)
                      .map((todo: any) => (
                        <div
                          key={todo.id}
                          className="bg-gray-900 p-2 rounded-lg shadow border border-gray-700"
                        >
                          <div className="flex flex-row items-center gap-2">
                          <p className="text-sm text-white">{todo.content}</p>
                          {todo.tag && (
                            <div className="mt-1">
                              {renderTag(todo.tag)}
                            </div>
                          )}
                          </div>
                          {canWrite && (
                            <select
                              value={todo.status_index}
                              onChange={(e) =>
                                updateStatus(todo.id, parseInt(e.target.value))
                              }
                              className="mt-2 w-full text-xs rounded bg-gray-800 border border-gray-600 text-gray-200"
                            >
                              {workflow.map((w: any, i: number) => (
                                <option key={i} value={i}>
                                  {w.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </>
      )}

      {/* ADD TODO */}
      {canWrite && (
        <div className="pt-4 border-t border-gray-700/50 md:w-[60vw] w-full mx-auto">
          <form
            onSubmit={handleAddTodo}
            className="flex gap-2"
          >
            <textarea
              name="content"
              ref={todoInputRef}
              placeholder="New task..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg ml-2 px-3 py-2 text-sm text-white placeholder-gray-500"
            />
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-500 text-white mr-2 px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              Add
            </button>
          </form>
          
          {/* Tag selection for new todo */}
          {workspaceTags.length > 0 && (
            <div className="mt-2 ml-2 flex items-center gap-2">
              <select
                value={selectedTagName}
                onChange={(e) => setSelectedTagName(e.target.value)}
                className="text-xs bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white"
              >
                <option value="">Select tag (optional)</option>
                {workspaceTags.map(tag => (
                  <option key={tag.name} value={tag.name} style={{ color: tag.color }}>
                    ● {tag.name}
                  </option>
                ))}
              </select>
              
              {/* Display selected tag */}
              {selectedTagName && (() => {
                const selectedTag = workspaceTags.find(tag => tag.name === selectedTagName);
                return selectedTag ? (
                  <div className="flex items-center gap-1">
                    {renderTag(selectedTag)}
                    <button
                      type="button"
                      onClick={() => setSelectedTagName("")}
                      className="text-xs text-gray-400 hover:text-white ml-1"
                    >
                      <X className="w-3 h-3 inline" />
                    </button>
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
