'use client'

import { useEffect, useState } from "react"
import { createClient } from "@/app/lib/supabase/client"
import { useRouter } from "next/navigation"

type Profile = {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  email?: string | null
}

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    fetchProfile()
  }, [])

  async function fetchProfile() {
    setLoading(true)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      router.push("/login")
      return
    }

    // Try to fetch existing profile
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, email")
      .eq("id", user.id)
      .single()

    if (error && error.code === "PGRST116") {
      // Profile doesn't exist, create it
      const { data: newProfile, error: createError } = await supabase
        .from("profiles")
        .insert({ 
          id: user.id, 
          email: user.email,
          full_name: user.user_metadata?.full_name || null,
          username: user.user_metadata?.username || null,
          avatar_url: user.user_metadata?.avatar_url || null
        })
        .select()
        .single()
      
      if (createError) {
        console.error("Failed to create profile:", createError)
        // Set a minimal profile object so the page doesn't break
        setProfile({
          id: user.id,
          email: user.email,
          full_name: null,
          username: null,
          avatar_url: null
        })
      } else {
        setProfile(newProfile)
      }
    } else if (error) {
      console.error("Failed to fetch profile:", error)
      // Set a minimal profile object so the page doesn't break
      setProfile({
        id: user.id,
        email: user.email,
        full_name: null,
        username: null,
        avatar_url: null
      })
    } else {
      setProfile(data)
    }

    setLoading(false)
  }

  async function updateProfile() {
    if (!profile) return

    setLoading(true)
    const updates = {
      ...profile,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from("profiles").upsert(updates)

    if (error) console.error(error)
    else alert("Profile updated!")

    setLoading(false)
  }

  if (loading) return <p className="p-4 text-gray-400">Loading...</p>

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl text-white mb-3">Your Profile</h1>

      <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-lg p-6 space-y-4">
        {/* Email (readonly) */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
          <input
            type="email"
            value={profile?.email || ""}
            disabled
            className="w-full p-2 rounded bg-gray-700 text-gray-400 border border-gray-600 cursor-not-allowed"
          />
        </div>

        {/* Full Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
          <input
            type="text"
            value={profile?.full_name || ""}
            onChange={(e) =>
              setProfile({ ...profile!, full_name: e.target.value })
            }
            className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600"
          />
        </div>

        {/* Username */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
          <input
            type="text"
            value={profile?.username || ""}
            onChange={(e) =>
              setProfile({ ...profile!, username: e.target.value })
            }
            className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600"
          />
        </div>

        {/* Avatar URL */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Avatar URL</label>
          <input
            type="text"
            value={profile?.avatar_url || ""}
            onChange={(e) =>
              setProfile({ ...profile!, avatar_url: e.target.value })
            }
            className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600"
          />
          {profile?.avatar_url && (
            <img
              src={profile.avatar_url}
              alt="Avatar"
              className="mt-3 h-20 w-20 rounded-full object-cover border border-gray-600"
            />
          )}
        </div>

        {/* Save Button */}
        <div className="pt-2">
          <button
            onClick={updateProfile}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-500 transition disabled:opacity-50"
          >
            Save Profile
          </button>
        </div>
      </div>
    </div>
  )
}
