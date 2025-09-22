import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "../lib/supabase/server";
import DashboardShell from "./DashboardShell";
import { DashboardProvider } from "./components/DashboardContext";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  // Ensure user has a profile (create if doesn't exist)
  try {
    await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || null,
        username: user.user_metadata?.username || null,
        avatar_url: user.user_metadata?.avatar_url || null
      }, {
        onConflict: 'id'
      });
  } catch (profileError) {
    console.error("Failed to ensure user profile:", profileError);
    // Continue anyway - profile creation is not critical for dashboard access
  }

  return (
    <DashboardProvider>
      <DashboardShell userEmail={user.email ?? ""}>
        {children}
      </DashboardShell>
    </DashboardProvider>
  );
}
