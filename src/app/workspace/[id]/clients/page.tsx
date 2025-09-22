"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";
import { useWorkspace } from "../components/WorkspaceContext";
import { logActions } from "@/app/lib/logging";

type Client = {
  id: string;
  name: string;
  contact_method: string | null;
  notes: string | null;
  created_at: string;
};

export default function ClientsPage() {
  const { id: workspaceId } = useParams();
  const supabase = createClient();
  const { clients, userRole, loading } = useWorkspace();

  // Form states for adding
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContact, setNewContact] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Editing states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editContact, setEditContact] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [showClientModal, setShowClientModal] = useState(false);

  // Check access permissions
  const canAccess = userRole !== "limited" && userRole !== null;

  async function addClient() {
    if (!newName.trim()) return;

    const { data, error } = await supabase
      .from("clients")
      .insert([
        {
          workspace_id: workspaceId,
          name: newName,
          contact_method: newContact,
          notes: newNotes,
        },
      ])
      .select()
      .single();

    if (!error && data) {
      // Log client creation
      await logActions.clientCreated(workspaceId as string, newName);
      
      setNewName("");
      setNewContact("");
      setNewNotes("");
      setAdding(false);
      setShowClientModal(false);
      // Clients will be updated automatically via real-time subscription
    }
  }

  async function deleteClient(id: string) {
    if (!confirm("Are you sure you want to delete this client?")) return;

    // Find client name for logging
    const client = clients.find(c => c.id === id);
    const clientName = client?.name || "Unknown Client";

    console.log('Deleting client:', id, 'from workspace:', workspaceId);
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);
      
    if (!error) {
      // Log client deletion
      await logActions.clientDeleted(workspaceId as string, clientName);
      
      console.log('Client deleted successfully, waiting for real-time update...');
      // Clients will be updated automatically via real-time subscription
      // Fallback: refresh after a short delay if real-time doesn't work
      setTimeout(async () => {
       {/* const { data } = await supabase
          .from("clients")
          .select("*")
          .eq("workspace_id", workspaceId);
        setClients(data ?? []); */}
      }, 2000);      
    } else {
      console.error('Error deleting client:', error);
    }
  }

  function startEditing(client: Client) {
    setEditingId(client.id);
    setEditName(client.name);
    setEditContact(client.contact_method ?? "");
    setEditNotes(client.notes ?? "");
  }

  async function saveEditClient(id: string) {
    const { error } = await supabase
      .from("clients")
      .update({
        name: editName,
        contact_method: editContact,
        notes: editNotes,
      })
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (!error) {
      // Log client update
      const changes = [];
      if (editName !== clients.find(c => c.id === id)?.name) changes.push("name");
      if (editContact !== clients.find(c => c.id === id)?.contact_method) changes.push("contact");
      if (editNotes !== clients.find(c => c.id === id)?.notes) changes.push("notes");
      
      await logActions.clientUpdated(workspaceId as string, editName, changes);
      
      setEditingId(null);
      // Clients will be updated automatically via real-time subscription
    }
  }

  function cancelEdit() {
    setEditingId(null);
  }

  if (loading) return <p className="text-gray-500">Loading clients...</p>;
  if (!canAccess) return <p>No access to this page.</p>;

  return (
    <div className="space-y-6">
  <div className="flex justify-between items-center mb-6 pt-2">
    <h1 className="text-2xl font-semibold text-white">Clients</h1>
    {(userRole === "owner" || userRole === "admin" || userRole === "manager") && (
      <button
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        onClick={() => setShowClientModal(true)}
      >
        ➕ Add Client
      </button>
    )}
  </div>

  {clients.length === 0 ? (
    <p className="text-gray-400">No clients yet.</p>
  ) : (
    <div className="h-[80svh] overflow-y-auto">
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {clients.map((client) => (
        <div
          key={client.id}
          className="bg-gray-800/40 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-lg p-4 hover:border-green-600/50 hover:shadow-xl transition flex justify-between items-start"
        >
          {editingId === client.id ? (
            <div className="flex-1 space-y-2">
              <input
                className="w-full p-2 rounded bg-gray-700 text-white"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <input
                className="w-full p-2 rounded bg-gray-700 text-white"
                value={editContact}
                onChange={(e) => setEditContact(e.target.value)}
              />
              <textarea
                className="w-full p-2 rounded bg-gray-700 text-white"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => saveEditClient(client.id)}
                  className="bg-green-600 px-3 py-1 rounded text-white hover:bg-green-500 transition"
                >
                  Save
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-3 py-1 border rounded text-white hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-green-500">{client.name}</h2>
              {client.contact_method && (
                <p className="text-gray-300 text-sm mt-1">
                  Contact: {client.contact_method}
                </p>
              )}
              {client.notes && (
                <p className="text-gray-300 text-sm mt-1">{client.notes}</p>
              )}
            </div>
          )}

          {(userRole === "owner" || userRole === "admin") && editingId !== client.id && (
            <div className="flex flex-col gap-2 ml-4">
              <button
                onClick={() => deleteClient(client.id)}
                className="text-red-400 hover:text-red-600 transition"
              >
                Delete
              </button>
              <button
                onClick={() => startEditing(client)}
                className="text-yellow-400 hover:text-yellow-600 transition"
              >
                Edit
              </button>
            </div>
          )}
        </div>
      ))}
    </div>  
    </div>
  )}

  {/* ✅ Add Client Modal */}
{showClientModal && (
  <div className="fixed inset-0 z-40 flex items-start justify-center pt-24">
    {/* Overlay */}
    <div
      className="absolute inset-0 bg-black/30 backdrop-blur-sm"
      onClick={() => setShowClientModal(false)}
    />

    {/* Modal panel */}
    <div className="relative z-50 w-full max-w-md bg-gray-900/90 border border-gray-700/50 backdrop-blur-sm rounded-2xl shadow-lg p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Add New Client</h2>
      <div className="space-y-3">
        <input
          className="w-full p-2 rounded bg-gray-800 text-white"
          placeholder="Client name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          className="w-full p-2 rounded bg-gray-800 text-white"
          placeholder="Contact method (email, phone, etc.)"
          value={newContact}
          onChange={(e) => setNewContact(e.target.value)}
        />
        <textarea
          className="w-full p-2 rounded bg-gray-800 text-white"
          placeholder="Notes"
          value={newNotes}
          onChange={(e) => setNewNotes(e.target.value)}
        />
        <div className="flex gap-2 justify-end">
          <button
            className="bg-green-600 px-4 py-2 rounded text-white hover:bg-green-500 transition"
            onClick={addClient}
          >
            Save
          </button>
          <button
            className="px-4 py-2 border rounded text-white hover:bg-gray-700 transition"
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
