"use server"

import { createClient } from "../lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function signup(
  prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  }

  const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

  const { error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm?next=/dashboard`
    },
  })

  if (error) {
    return { error: error.message } // return message instead of redirect
  }

  // If email confirmation is enabled, Supabase will send a link. Take user back to login with a hint.
  revalidatePath("/", "layout")
  redirect("/login?checkEmail=1")
}
