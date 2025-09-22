import { ReactNode } from "react";
import { createClient } from "@/app/lib/supabase/server";
import WorkspaceShell from "./components/WorkspaceShell";
import { WorkspaceProvider } from "./components/WorkspaceContext";

interface WorkspaceLayoutProps {
  children: ReactNode;
  params: any;
}

export default async function WorkspaceLayout({ children, params }: WorkspaceLayoutProps) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return <p className="p-6 text-red-600">Unauthorized. Please login.</p>;
  }

  // Await params in Next.js 15
  const { id } = await params;

  // fetch workspace name on server
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", id)
    .maybeSingle();

  return (
    <WorkspaceProvider workspaceId={id}>
      <WorkspaceShell
        workspaceName={workspace?.name ?? "Untitled"}
        id={id}
        userEmail={user.email ?? ""} 
      >
        {children}
      </WorkspaceShell>
    </WorkspaceProvider>
  );
}
