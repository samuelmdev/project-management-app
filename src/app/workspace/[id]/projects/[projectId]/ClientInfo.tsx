'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../../../lib/supabase/client'

export default function ClientInfo({
  workspaceId,
  projectId,
  clientId,
  canWrite, // instead of canEdit
}: {
  workspaceId: string
  projectId: string
  clientId: string | null
  canWrite: boolean
}) {
  const supabase = createClient()
  const [client, setClient] = useState<any>(null)
  const [workspaceClients, setWorkspaceClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSelector, setShowSelector] = useState(false)

  // form state for new client
  const [newName, setNewName] = useState('')
  const [newContact, setNewContact] = useState('')
  const [newNotes, setNewNotes] = useState('')

  // 🔹 Load current client
  useEffect(() => {
    async function fetchClient() {
      if (clientId) {
        const { data: clientData } = await supabase
          .from("clients")
          .select("*")
          .eq("id", clientId)
          .maybeSingle()
        if (clientData) setClient(clientData)
      }
      setLoading(false)
    }
    fetchClient()
  }, [clientId, supabase])

  // 🔹 Load all workspace clients
  useEffect(() => {
    async function fetchWorkspaceClients() {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("name")
      if (!error && data) setWorkspaceClients(data)
    }
    fetchWorkspaceClients()
  }, [workspaceId, supabase])

  const handleSelectClient = async (selectedId: string) => {
    if (!canWrite) return
    setSaving(true)
    const { error } = await supabase
      .from("projects")
      .update({ client_id: selectedId })
      .eq("id", projectId)
    if (error) console.error("Error linking client:", error)
    else {
      const newClient = workspaceClients.find(c => c.id === selectedId)
      setClient(newClient || null)
    }
    setSaving(false)
    setShowSelector(false)
  }

  const handleAddClient = async () => {
    if (!canWrite) return
    setSaving(true)

    const { data: newClient, error } = await supabase
      .from("clients")
      .insert({
        workspace_id: workspaceId,
        name: newName,
        contact_method: newContact,
        notes: newNotes,
      })
      .select()
      .single()

    if (error) {
      console.error("Error adding new client:", error)
      setSaving(false)
      return
    }

    // link to project
    const { error: updateError } = await supabase
      .from("projects")
      .update({ client_id: newClient.id })
      .eq("id", projectId)

    if (updateError) {
      console.error("Error linking client to project:", updateError)
    } else {
      setClient(newClient)
      setWorkspaceClients(prev => [...prev, newClient])
    }

    setSaving(false)
    setShowSelector(false)
    setNewName('')
    setNewContact('')
    setNewNotes('')
  }

  const handleRemoveClient = async () => {
    if (!canWrite) return
    setSaving(true)
    // link to project
    const { error: updateError } = await supabase
      .from("projects")
      .update({ client_id: null })
      .eq("id", projectId)

    if (updateError) {
      console.error("Error linking client to project:", updateError)
    } else {
      setClient("")
    }

    setSaving(false)
    setShowSelector(false)
    setNewName('')
    setNewContact('')
    setNewNotes('')
  }

  if (loading) return <p className="text-gray-400">Loading client info...</p>

  return (
    <div className="space-y-4 max-w-[95vw]">
  {!client ? (
    <p className="text-gray-400 break-words">No client linked to this project.</p>
  ) : (
    <div className="space-y-1">
      <p className="text-sm font-medium text-gray-300">Linked Client:</p>
      <p className="px-3 py-2 rounded bg-gray-800 border border-gray-700 text-gray-100 truncate">{client.name}</p>
      {client.contact_method && (
        <p className="text-gray-400 text-sm truncate">{client.contact_method}</p>
      )}
    </div>
  )}

  {canWrite && (
    <>
      {!showSelector ? (
        <div className="flex flex-col sm:flex-row sm:gap-4 gap-2 w-full">
          <button
            onClick={() => setShowSelector(true)}
            className="flex-1 text-sm md:text-base bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 truncate"
          >
            {client ? "Change Client" : "Select Client or Add New"}
          </button>
          {client && (
            <button
              disabled={saving}
              onClick={handleRemoveClient}
              className="flex-1 text-sm md:text-base text-red-500 hover:text-red-600 truncate"
            >
              {saving ? "Removing client link" : "Remove linked client"}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4 bg-gray-800/40 backdrop-blur-sm border border-gray-700 rounded-2xl p-4 max-w-full overflow-x-hidden">
          <label className="block text-sm font-medium text-gray-300 truncate">
            Select existing client
          </label>
          <select
            className="px-3 py-2 rounded bg-gray-800 border border-gray-700 text-gray-100 w-full max-w-full truncate"
            onChange={(e) => handleSelectClient(e.target.value)}
            value={client?.id ?? ""}
          >
            <option value="" disabled>
              -- Select a client --
            </option>
            {workspaceClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="border-t border-gray-700 pt-4 space-y-2">
            <p className="text-sm font-medium mb-2 text-gray-300 truncate">
              Or add a new client
            </p>
            <input
              type="text"
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="px-3 py-2 rounded bg-gray-800 border border-gray-700 text-gray-100 w-full max-w-full truncate"
            />
            <input
              type="text"
              placeholder="Contact Method"
              value={newContact}
              onChange={(e) => setNewContact(e.target.value)}
              className="px-3 py-2 rounded bg-gray-800 border border-gray-700 text-gray-100 w-full max-w-full truncate"
            />
            <textarea
              placeholder="Notes"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              className="px-3 py-2 rounded bg-gray-800 border border-gray-700 text-gray-100 w-full max-w-full resize-none"
            />
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <button
                onClick={handleAddClient}
                disabled={saving}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-500 disabled:opacity-50 truncate"
              >
                {saving ? "Saving..." : "Add & Link Client"}
              </button>
              <button
                disabled={saving}
                className="flex-1 px-4 py-2 rounded border border-gray-700 hover:bg-gray-700 text-gray-100 disabled:opacity-50 truncate"
                onClick={() => setShowSelector(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )}
</div>

  )
}
