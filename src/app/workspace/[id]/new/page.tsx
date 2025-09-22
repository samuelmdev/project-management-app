"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/app/lib/supabase/client";
import { logActions } from "@/app/lib/logging";

type Client = {
  id: string;
  name: string;
};

type Member = {
  email: string;
  role: "read" | "write" | "admin";
};

export default function NewProjectPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const workspaceId = params.id;

  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  const [showClientModal, setShowClientModal] = useState(false);
const [newClientName, setNewClientName] = useState("");
const [newClientContact, setNewClientContact] = useState("");
const [newClientNotes, setNewClientNotes] = useState("");
  const supabase = createClient(); // client-side Supabase instance


  useEffect(() => {
  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id,name")
        .eq("workspace_id", workspaceId)
        .order("name", { ascending: true });

      if (error) {
        console.error("Failed to fetch clients:", error);
        return;
      }

      setClients(data ?? []);
    } catch (err) {
      console.error("Error fetching clients:", err);
    }
  };

  fetchClients();
}, [supabase, workspaceId]);

  // Note: We rely on router.replace after creation to skip this page when going back.

  const handleAddMember = () => {
    setMembers([...members, { email: "", role: "read" }]);
  };

  const handleMemberChange = (index: number, field: keyof Member, value: string) => {
    const updated = [...members];
    updated[index][field] = value as any;
    setMembers(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("❌ Auth error:", userError);
    alert("You're not logged in.");
    setLoading(false);
    return;
  }

  let finalClientId = selectedClient;

  // Handle new client creation (optional)
  if (!selectedClient) {
   /* const { data: newClient, error: clientError } = await supabase
      .from("clients")
      .insert({
        name: newClientName,
        workspace_id: workspaceId,
      })
      .select()
      .single();

    if (clientError || !newClient) {
      console.error("❌ Client creation failed:", clientError);
      setLoading(false);
      return;
    } */

    finalClientId = selectedClient;
  }
  
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      name: projectName,
      description,
      workspace_id: workspaceId,
      user_id: user.id,
      client_id: finalClientId,
    })
    .select()
    .single();

  if (projectError || !project) {
    console.error("❌ Project creation failed:", projectError);
    setLoading(false);
    return;
  }



// ✅ Add creator as admin
const { error: memberError } = await supabase
  .from("project_members")
  .insert({
    project_id: project.id,
    user_id: user.id,
    role: "admin",
  });

if (memberError) {
  console.error("❌ Failed to add project member:", memberError);
  // not returning here → project is created even if membership fails
}

// Add all workspace owners as project owners
const { data: owners } = await supabase
  .from('workspace_members')
  .select('user_id, role')
  .eq('workspace_id', workspaceId)
  .eq('role', 'owner')

if (owners && owners.length) {
  const ownerRows = owners
    .filter((o: any) => o.user_id !== user.id) // avoid duplicate if creator is also workspace owner
    .map((o: any) => ({ project_id: project.id, user_id: o.user_id, role: 'owner' }))
  if (ownerRows.length) {
    await supabase.from('project_members').insert(ownerRows)
  }
}

// Add all workspace admins as project admins
const { data: admins } = await supabase
  .from('workspace_members')
  .select('user_id, role')
  .eq('workspace_id', workspaceId)
  .eq('role', 'admin')

if (admins && admins.length) {
  const adminRows = admins
    .filter((a: any) => a.user_id !== user.id) // avoid duplicate if creator is also workspace admin
    .map((a: any) => ({ project_id: project.id, user_id: a.user_id, role: 'admin' }))
  if (adminRows.length) {
    await supabase.from('project_members').insert(adminRows)
  }
}

// Loop over invited members
for (const m of members) {
  if (!m.email) continue;

  // Check if user exists by looking for their profile (which should exist if they've used the app)
  // If no profile exists, we'll create an invitation instead
  const { data: existingUser, error: userLookupError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", m.email)
    .single();

  if (existingUser) {
    // ✅ User exists: add them directly as workspace + project member
    await supabase.from("workspace_members").insert({
      workspace_id: workspaceId,
      user_id: existingUser.id,
      role: "member", // or map from your workspace roles logic
    });

    await supabase.from("project_members").insert({
      project_id: project.id,
      user_id: existingUser.id,
      role: m.role,
    });
  } else {
    // 🚀 User does not exist: create an invitation
    await supabase.from("invitations").insert({
      workspace_id: workspaceId,
      project_id: project.id,
      email: m.email,
      workspace_role: "member", // assign a base role
      project_role: m.role,
      invited_by: user.id,
    });

    // Here you can also trigger a serverless function / email send
    // e.g. via Supabase Functions, Resend, or SendGrid
  }
  }

  // Log project creation
  await logActions.projectCreated(workspaceId, project.id, projectName);

  router.replace(`/workspace/${workspaceId}/projects/${project.id}`);
  setLoading(false);
};

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <h1 className="text-2xl font-semibold mb-4">Start New Project</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block mb-1 font-medium">Project Name</label>
          <input
            type="text"
            required
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
  <label className="block mb-1 font-medium">Project Description</label>
  <textarea
    value={description}
    onChange={(e) => setDescription(e.target.value)}
    className="w-full border rounded px-3 py-2"
  />
</div>
        <div>
          <label className="block mb-1 font-medium">Client (optional)</label>
          <select
            value={selectedClient || ""}
            onChange={(e) => {
              if (e.target.value === "new") {
                setShowClientModal(true);
                return;
              }
              setSelectedClient(e.target.value || null);
            }}
            className="w-full border rounded px-3 py-2"
          >
            <option value="new">➕ Add New Client</option>
            <optgroup label="Existing clients">
              {clients?.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </optgroup>
            <option value="">— None —</option>
          </select>
        </div>

        {/* New client input handled via modal */}

        <div>
          <label className="block mb-2 font-medium">Invite Members</label>
          {members.map((member, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <input
                type="email"
                placeholder="Email"
                value={member.email}
                onChange={(e) => handleMemberChange(index, "email", e.target.value)}
                className="flex-1 border rounded px-3 py-2"
              />
              <select
                value={member.role}
                onChange={(e) => handleMemberChange(index, "role", e.target.value)}
                className="border rounded px-3 py-2"
              >
                <option value="read">Read</option>
                <option value="write">Write</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddMember}
            className="text-blue-600 hover:underline mt-1"
          >
            ➕ Add Member
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
        >
          {loading ? "Creating..." : "Create Project"}
        </button>
      </form>

      {showClientModal && (
  <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
    <div className="bg-gray-700 p-6 rounded-xl shadow-lg w-full max-w-md">
      <h2 className="text-lg font-semibold mb-4 text-white">Add New Client</h2>
      <div className="space-y-3">
        <input
          className="w-full p-2 rounded bg-gray-800 text-white"
          placeholder="Client name"
          value={newClientName}
          onChange={(e) => setNewClientName(e.target.value)}
        />
        <input
          className="w-full p-2 rounded bg-gray-800 text-white"
          placeholder="Contact method (email, phone, etc.)"
          value={newClientContact}
          onChange={(e) => setNewClientContact(e.target.value)}
        />
        <textarea
          className="w-full p-2 rounded bg-gray-800 text-white"
          placeholder="Notes"
          value={newClientNotes}
          onChange={(e) => setNewClientNotes(e.target.value)}
        />
        <div className="flex gap-2 justify-end">
          <button
            className="bg-green-600 px-3 py-1 rounded text-white"
            onClick={async () => {
              const { data: newClient, error } = await supabase
                .from("clients")
                .insert({
                  workspace_id: workspaceId,
                  name: newClientName,
                  contact_method: newClientContact,
                  notes: newClientNotes,
                })
                .select()
                .single();

              if (!error && newClient) {
                setClients((prev) => [...prev, newClient]);
                setSelectedClient(newClient.id);
                setShowClientModal(false);
                setNewClientName("");
                setNewClientContact("");
                setNewClientNotes("");
              } else {
                console.error("Error creating client:", error);
              }
            }}
          >
            Save
          </button>
          <button
            className="px-3 py-1 border rounded text-white"
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
