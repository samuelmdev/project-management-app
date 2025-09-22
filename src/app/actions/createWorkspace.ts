// app/actions/createWorkspace.ts
'use client'

import { createClient } from "../lib/supabase/client";

export async function createWorkspace(name: string) {
  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase.from('workspaces').insert([
    {
      name,
      created_by: user.id,
    },
  ])

  if (error) throw error
  return data
}
