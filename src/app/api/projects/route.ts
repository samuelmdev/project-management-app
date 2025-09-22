import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createClient } from "../../lib/supabase/server"

/*
export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ projects: [] });

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ projects });
}  */

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log("Authenticated user:", user);

    if (userError || !user) {
      console.error("Auth error:", userError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("API user:", user?.id);  // confirms Supabase auth is working

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
    }

    const { data: projects, error } = await supabase
      .from("projects")
      .select("id, name, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });


console.log("Raw Supabase result:", { projects, error });

    if (error) {
      console.error("Supabase error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ projects });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/*
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, workspace_id, client_id, new_client_name, members } = body;

  let finalClientId = client_id;

  if (client_id === "new" && new_client_name) {
    const { data: newClient, error: clientError } = await supabase
      .from("clients")
      .insert({ name: new_client_name, workspace_id })
      .select()
      .single();

    if (clientError || !newClient) {
      return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
    }

    finalClientId = newClient.id;
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      name,
      workspace_id,
      user_id: user.id,
      client_id: finalClientId || null,
    })
    .select()
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }

  // Optionally: handle members here
  // Example: insert into project_members table

  return NextResponse.json({ projectId: project.id });
}  */

  export async function POST(req: NextRequest) {
    const supabase = createRouteHandlerClient({ cookies });
const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
  console.log("Cookies:", (await cookies()).getAll());
console.log("User:", user);

  const body = await req.json();

  const { name, description, workspace_id } = body;

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      name,
      description,
      workspace_id,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ project });
}
