import { createClient } from "./supabase/client";


export type LogAction = 
  // Workspace actions
  | "workspace_created"
  | "workspace_updated" 
  | "workspace_deleted"
  | "workspace_archived"
  | "workspace_restored"
  
  // Project actions
  | "project_created"
  | "project_updated"
  | "project_deleted"
  | "project_archived"
  | "project_restored"
  
  // Client actions
  | "client_created"
  | "client_updated"
  | "client_deleted"
  
  // Task/Todo actions
  | "task_created"
  | "task_updated"
  | "task_deleted"
  | "task_completed"
  | "task_reopened"
  
  // Notes actions
  | "note_created"
  | "note_updated"
  | "note_deleted"
  
  // Files actions
  | "file_uploaded"
  | "file_updated"
  | "file_deleted"
  
  // Milestones actions
  | "milestone_created"
  | "milestone_updated"
  | "milestone_deleted"
  | "milestone_completed"
  
  // Member management actions
  | "workspace_member_added"
  | "workspace_member_removed"
  | "workspace_member_role_changed"
  | "workspace_left"
  | "project_member_added"
  | "project_member_removed"
  | "project_member_role_changed";

export interface LogMetadata {
  // Common fields
  name?: string;
  description?: string;
  
  // Member management
  member_email?: string;
  member_role?: string;
  previous_role?: string;
  
  // File operations
  filename?: string;
  file_size?: number;
  file_type?: string;
  
  // Task operations
  task_title?: string;
  task_status?: string;
  previous_status?: string;
  
  // Project/Workspace operations
  workspace_name?: string;
  project_name?: string;
  client_name?: string;
  
  // Status changes
  status_from?: string;
  status_to?: string;
  
  // Any other structured data
  [key: string]: any;
}

export interface LogEntry {
  action: LogAction;
  workspace_id?: string;
  project_id?: string;
  metadata?: LogMetadata;
}

/**
 * Logs a user action to the database
 */
export async function logUserAction(entry: LogEntry): Promise<void> {
  try {
    const supabase = createClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Failed to get user for logging:", userError);
      return;
    }

    // Validate that workspace-related actions have workspace_id
    const workspaceActions = [
      "workspace_created", "workspace_updated", "workspace_deleted", "workspace_archived", "workspace_restored",
      "project_created", "project_updated", "project_deleted", "project_archived", "project_restored",
      "client_created", "client_updated", "client_deleted",
      "task_created", "task_updated", "task_deleted", "task_completed", "task_reopened",
      "note_created", "note_updated", "note_deleted",
      "file_uploaded", "file_updated", "file_deleted",
      "milestone_created", "milestone_updated", "milestone_deleted", "milestone_completed",
      "workspace_member_added", "workspace_member_removed", "workspace_member_role_changed", "workspace_left",
      "project_member_added", "project_member_removed", "project_member_role_changed"
    ];

    if (workspaceActions.includes(entry.action) && !entry.workspace_id) {
      console.error(`Workspace action '${entry.action}' requires workspace_id but none provided:`, entry);
      return;
    }

    // Insert log entry
    const { error: logError } = await supabase
      .from("user_logs")
      .insert({
        user_id: user.id,
        action: entry.action,
        workspace_id: entry.workspace_id || null,
        project_id: entry.project_id || null,
        metadata: entry.metadata || null,
      });

    if (logError) {
      console.error("Failed to log user action:", logError);
    }
  } catch (error) {
    console.error("Error in logUserAction:", error);
  }
}

/**
 * Convenience functions for common logging patterns
 */
export const logActions = {
  // Workspace actions
  workspaceCreated: (workspaceId: string, workspaceName: string) =>
    logUserAction({
      action: "workspace_created",
      workspace_id: workspaceId,
      metadata: { workspace_name: workspaceName }
    }),

  workspaceUpdated: (workspaceId: string, workspaceName: string, changes: string[]) =>
    logUserAction({
      action: "workspace_updated",
      workspace_id: workspaceId,
      metadata: { 
        workspace_name: workspaceName,
        changes: changes.join(", ")
      }
    }),

  workspaceDeleted: (workspaceId: string, workspaceName: string) =>
    logUserAction({
      action: "workspace_deleted",
      workspace_id: workspaceId,
      metadata: { workspace_name: workspaceName }
    }),

  workspaceArchived: (workspaceId: string, workspaceName: string) =>
    logUserAction({
      action: "workspace_archived",
      workspace_id: workspaceId,
      metadata: { workspace_name: workspaceName }
    }),

  workspaceRestored: (workspaceId: string, workspaceName: string) =>
    logUserAction({
      action: "workspace_restored",
      workspace_id: workspaceId,
      metadata: { workspace_name: workspaceName }
    }),

  // Project actions
  projectCreated: (workspaceId: string, projectId: string, projectName: string) =>
    logUserAction({
      action: "project_created",
      workspace_id: workspaceId,
      project_id: projectId,
      metadata: { project_name: projectName }
    }),

  projectUpdated: (workspaceId: string, projectId: string, projectName: string, changes: string[]) =>
    logUserAction({
      action: "project_updated",
      workspace_id: workspaceId,
      project_id: projectId,
      metadata: { 
        project_name: projectName,
        changes: changes.join(", ")
      }
    }),

  projectDeleted: (workspaceId: string, projectName: string) =>
    logUserAction({
      action: "project_deleted",
      workspace_id: workspaceId,
      metadata: { project_name: projectName }
    }),

  projectArchived: (workspaceId: string, projectId: string, projectName: string) =>
    logUserAction({
      action: "project_archived",
      workspace_id: workspaceId,
      project_id: projectId,
      metadata: { project_name: projectName }
    }),

  projectRestored: (workspaceId: string, projectId: string, projectName: string) =>
    logUserAction({
      action: "project_restored",
      workspace_id: workspaceId,
      project_id: projectId,
      metadata: { project_name: projectName }
    }),

  // Client actions
  clientCreated: (workspaceId: string, clientName: string) =>
    logUserAction({
      action: "client_created",
      workspace_id: workspaceId,
      metadata: { client_name: clientName }
    }),

  clientUpdated: (workspaceId: string, clientName: string, changes: string[]) =>
    logUserAction({
      action: "client_updated",
      workspace_id: workspaceId,
      metadata: { 
        client_name: clientName,
        changes: changes.join(", ")
      }
    }),

  clientDeleted: (workspaceId: string, clientName: string) =>
    logUserAction({
      action: "client_deleted",
      workspace_id: workspaceId,
      metadata: { client_name: clientName }
    }),

  // Task actions
  taskCreated: (workspaceId: string, projectId: string, taskTitle: string) =>
    logUserAction({
      action: "task_created",
      workspace_id: workspaceId,
      project_id: projectId,
      metadata: { task_title: taskTitle }
    }),

  taskUpdated: (workspaceId: string, projectId: string, taskTitle: string, changes: string[]) =>
    logUserAction({
      action: "task_updated",
      workspace_id: workspaceId,
      project_id: projectId,
      metadata: { 
        task_title: taskTitle,
        changes: changes.join(", ")
      }
    }),

  taskDeleted: (workspaceId: string, projectId: string, taskTitle: string) =>
    logUserAction({
      action: "task_deleted",
      workspace_id: workspaceId,
      project_id: projectId,
      metadata: { task_title: taskTitle }
    }),

  taskCompleted: (workspaceId: string, projectId: string, taskTitle: string) =>
    logUserAction({
      action: "task_completed",
      workspace_id: workspaceId,
      project_id: projectId,
      metadata: { task_title: taskTitle }
    }),

  taskReopened: (workspaceId: string, projectId: string, taskTitle: string) =>
    logUserAction({
      action: "task_reopened",
      workspace_id: workspaceId,
      project_id: projectId,
      metadata: { task_title: taskTitle }
    }),

  // Notes actions
  noteCreated: (workspaceId: string, projectId: string, noteTitle?: string) =>
    logUserAction({
      action: "note_created",
      workspace_id: workspaceId,
      project_id: projectId,
      metadata: { name: noteTitle || "Untitled Note" }
    }),

  noteUpdated: (workspaceId: string, projectId: string, noteTitle?: string, changes: string[] = []) =>
    logUserAction({
      action: "note_updated",
      workspace_id: workspaceId,
      project_id: projectId,
      metadata: { 
        name: noteTitle || "Untitled Note",
        changes: changes.join(", ")
      }
    }),

  noteDeleted: (workspaceId: string, projectId: string, noteTitle?: string) =>
    logUserAction({
      action: "note_deleted",
      workspace_id: workspaceId,
      project_id: projectId,
      metadata: { name: noteTitle || "Untitled Note" }
    }),

  // Files actions
  fileUploaded: (workspaceId: string, projectId: string, filename: string, fileSize?: number, fileType?: string) =>
    logUserAction({
      action: "file_uploaded",
      workspace_id: workspaceId,
      project_id: projectId,
      metadata: { 
        filename,
        file_size: fileSize,
        file_type: fileType
      }
    }),

  fileUpdated: (workspaceId: string, projectId: string, filename: string, changes: string[] = []) =>
    logUserAction({
      action: "file_updated",
      workspace_id: workspaceId,
      project_id: projectId,
      metadata: { 
        filename,
        changes: changes.join(", ")
      }
    }),

  fileDeleted: (workspaceId: string, projectId: string, filename: string) =>
    logUserAction({
      action: "file_deleted",
      workspace_id: workspaceId,
      project_id: projectId,
      metadata: { filename }
    }),

  // Milestones actions
  milestoneCreated: (workspaceId: string, projectId: string, milestoneTitle: string) =>
    logUserAction({
      action: "milestone_created",
      workspace_id: workspaceId,
      project_id: projectId,
      metadata: { name: milestoneTitle }
    }),

  milestoneUpdated: (workspaceId: string, projectId: string, milestoneTitle: string, changes: string[] = []) =>
    logUserAction({
      action: "milestone_updated",
      workspace_id: workspaceId,
      project_id: projectId,
      metadata: { 
        name: milestoneTitle,
        changes: changes.join(", ")
      }
    }),

  milestoneDeleted: (workspaceId: string, projectId: string, milestoneTitle: string) =>
    logUserAction({
      action: "milestone_deleted",
      workspace_id: workspaceId,
      project_id: projectId,
      metadata: { name: milestoneTitle }
    }),

  milestoneCompleted: (workspaceId: string, projectId: string, milestoneTitle: string) =>
    logUserAction({
      action: "milestone_completed",
      workspace_id: workspaceId,
      project_id: projectId,
      metadata: { name: milestoneTitle }
    }),

  // Member management actions
  workspaceMemberAdded: (workspaceId: string, memberEmail: string, memberRole: string) =>
    logUserAction({
      action: "workspace_member_added",
      workspace_id: workspaceId,
      metadata: { 
        member_email: memberEmail,
        member_role: memberRole
      }
    }),

  workspaceMemberRemoved: (workspaceId: string, memberEmail: string) =>
    logUserAction({
      action: "workspace_member_removed",
      workspace_id: workspaceId,
      metadata: { member_email: memberEmail }
    }),

  workspaceMemberRoleChanged: (workspaceId: string, memberEmail: string, previousRole: string, newRole: string) =>
    logUserAction({
      action: "workspace_member_role_changed",
      workspace_id: workspaceId,
      metadata: { 
        member_email: memberEmail,
        previous_role: previousRole,
        member_role: newRole
      }
    }),

  workspaceLeft: (workspaceId: string) =>
    logUserAction({
      action: "workspace_left",
      workspace_id: workspaceId
    }),

  projectMemberAdded: (workspaceId: string, projectId: string, memberEmail: string, memberRole: string) =>
    logUserAction({
      action: "project_member_added",
      workspace_id: workspaceId,
      project_id: projectId,
      metadata: { 
        member_email: memberEmail,
        member_role: memberRole
      }
    }),

  projectMemberRemoved: (workspaceId: string, projectId: string, memberEmail: string) =>
    logUserAction({
      action: "project_member_removed",
      workspace_id: workspaceId,
      project_id: projectId,
      metadata: { member_email: memberEmail }
    }),

  projectMemberRoleChanged: (workspaceId: string, projectId: string, memberEmail: string, previousRole: string, newRole: string) =>
    logUserAction({
      action: "project_member_role_changed",
      workspace_id: workspaceId,
      project_id: projectId,
      metadata: { 
        member_email: memberEmail,
        previous_role: previousRole,
        member_role: newRole
      }
    }),
};
