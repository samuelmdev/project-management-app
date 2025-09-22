"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "../../../../lib/supabase/client";
import { AnimatePresence, motion } from "framer-motion";

interface Note {
  id: string;
  content: string;
  created_at: string;
  priority: number;
  color: string;
}

interface NotesComponentProps {
  projectId: string;
  notes: Note[];
  canWrite: boolean;
}

const PASTEL_COLORS = {
  yellow: "#FEF08A", // yellow-200
  pink: "#FBCFE8",   // pink-200
  blue: "#BFDBFE",   // blue-200
  green: "#BBF7D0",  // green-200
  purple: "#E9D5FF", // purple-200
  orange: "#FED7AA", // orange-200
};

function Modal({
  title,
  color = PASTEL_COLORS.yellow,
  onClose,
  children,
}: {
  title: string;
  color?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center text-black">
      <div
  className="p-6 rounded shadow-lg max-w-lg w-full relative"
  style={{ backgroundColor: color || "#FEF08A" }}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-700 hover:text-black"
        >
          &times;
        </button>
        <h2 className="text-xl font-semibold mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export default function NotesComponent({
  projectId,
  notes: initialNotes,
  canWrite,
}: NotesComponentProps) {
  const supabase = createClient();

  const [notes, setNotes] = useState<Note[]>(initialNotes || []);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [formContent, setFormContent] = useState("");
  const [formPriority, setFormPriority] = useState(4);
  const [formColor, setFormColor] = useState(PASTEL_COLORS.yellow);
  // Track ids we've deleted locally to avoid transient re-appearance from slightly stale parent props
  const ignoredDeletedIdsRef = useRef<Set<string>>(new Set());

  function sortNotes(list: Note[]): Note[] {
    return [...list].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority; // lower first
      // newer first within same priority
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  useEffect(() => {
    fetchNotes();
  }, [projectId]);

  // Keep local notes in sync with parent-provided notes (realtime updates in ProjectPage)
  useEffect(() => {
    if (!initialNotes) return;
    // Clean up ignored ids that parent no longer has (confirmed deletion propagated)
    if (ignoredDeletedIdsRef.current.size > 0) {
      for (const id of Array.from(ignoredDeletedIdsRef.current)) {
        if (!initialNotes.some((n) => n.id === id)) {
          ignoredDeletedIdsRef.current.delete(id);
        }
      }
    }
    const filtered = initialNotes.filter((n) => !ignoredDeletedIdsRef.current.has(n.id));
    setNotes(sortNotes(filtered));
  }, [initialNotes]);

  async function fetchNotes() {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("project_id", projectId)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false });
    if (!error && data) setNotes(sortNotes(data as Note[]));
  }

  function openAddModal() {
    setFormContent("");
    setFormPriority(4);
    setFormColor(PASTEL_COLORS.yellow);
    setIsEditing(true);
    setSelectedNote(null);
    setIsModalOpen(true);
  }

  function openViewModal(note: Note) {
    setSelectedNote(note);
    setFormContent(note.content);
    setFormPriority(note.priority);
    setFormColor(note.color);
    setIsEditing(false);
    setIsModalOpen(true);
  }

  async function handleSaveNote() {
    if (!formContent.trim()) return;

    if (selectedNote) {
      // update
      const { error } = await supabase
        .from("notes")
        .update({ content: formContent, priority: formPriority, color: formColor })
        .eq("id", selectedNote.id);

      if (!error) {
        setNotes((prev) => {
          const updated = prev.map((n) =>
            n.id === selectedNote.id ? { ...n, content: formContent, priority: formPriority, color: formColor } : n
          );
          return sortNotes(updated);
        });
      }
    } else {
      // insert
      const { data, error } = await supabase
        .from("notes")
        .insert([{ project_id: projectId, content: formContent, priority: formPriority, color: formColor }])
        .select()
        .single();

      if (!error && data) {
        setNotes((prev) => sortNotes([...(prev || []), data as Note]));
      }
    }

    setIsModalOpen(false);
  }

  async function handleDeleteNote() {
    if (!selectedNote) return;
    const ok = window.confirm(
      `Delete this note? This cannot be undone.\n\nPreview: "${(selectedNote.content || "").slice(0, 60)}"`
    );
    if (!ok) return;
    ignoredDeletedIdsRef.current.add(selectedNote.id);
    const { error } = await supabase.from("notes").delete().eq("id", selectedNote.id);
    if (!error) {
      setNotes((prev) => prev.filter((n) => n.id !== selectedNote.id));
      setIsModalOpen(false);
    }
    if (error) {
      // Roll back ignore if delete failed
      ignoredDeletedIdsRef.current.delete(selectedNote.id);
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-medium">Notes</h2>

      {/* Notes Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[52vh] overflow-y-auto">
        <AnimatePresence>
          {notes.map((note) => (
            <motion.div
              key={note.id}
              layout
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="border p-3 rounded shadow cursor-pointer transition text-black"
              style={{ backgroundColor: note.color || "#FEF08A" }}
              onClick={() => openViewModal(note)}
            >
              <p className="truncate font-medium">{note.content}</p>
              <span className="text-xs text-gray-700">
                Priority {note.priority}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add Note Button */}
      {canWrite && (
        <button
          onClick={openAddModal}
          className="bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition"
        >
          + Add Note
        </button>
      )}

      {/* Note Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 text-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-6 rounded-lg w-full max-w-lg space-y-4 shadow-lg"
              style={{ backgroundColor: formColor }}
            >
              {/* Title */}
              <h3 className="text-lg font-semibold">
                {selectedNote
                  ? isEditing
                    ? "Edit Note"
                    : "Note Details"
                  : "New Note"}
              </h3>

              {/* Content */}
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                disabled={!canWrite || (!!selectedNote && !isEditing)}
                className="w-full border p-2 rounded min-h-[120px] bg-white/60"
                placeholder="Write your note..."
              />

              {/* Options */}
              <div className="flex gap-6 items-center">
                <label className="flex items-center gap-2">
                  <span className="text-sm">Priority:</span>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(Number(e.target.value))}
                    disabled={!canWrite || (!!selectedNote && !isEditing)}
                    className="border rounded p-1"
                  >
                    {[1, 2, 3, 4].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-2">
                  <span className="text-sm">Color:</span>
                  <select
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    disabled={!canWrite || (!!selectedNote && !isEditing)}
                    className="border p-1 rounded w-32"
                  >
                    {Object.entries(PASTEL_COLORS).map(([name, hex]) => (
                      <option key={name} value={hex}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Footer Actions */}
              <div className="flex justify-between items-center pt-2">
                {selectedNote && canWrite && !isEditing && (
                  <div className="space-x-2">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="bg-yellow-500 text-white px-3 py-1 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={handleDeleteNote}
                      className="bg-red-500 text-white px-3 py-1 rounded"
                    >
                      Delete
                    </button>
                  </div>
                )}

                <div className="flex gap-2 ml-auto">
                  {canWrite && (isEditing || !selectedNote) && (
                    <button
                      onClick={handleSaveNote}
                      className="bg-blue-600 text-white px-3 py-1 rounded"
                    >
                      Save
                    </button>
                  )}
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-1 rounded border"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
