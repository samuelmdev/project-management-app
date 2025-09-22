"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../../lib/supabase/client";

interface FileRecord {
  id: string;
  project_id: string;
  filename: string;
  path: string;
  type: string | null;
  size: number;
  created_at: string;
}

interface FilesComponentProps {
  projectId: string;
  canWrite: boolean;
  files: FileRecord[];
}

export default function FilesComponent({ projectId, canWrite, files }: FilesComponentProps) {
  const supabase = createClient();
  const [filesState, setFilesState] = useState<FileRecord[]>(files || []);
  const [uploading, setUploading] = useState(false);

  // Update local state when parent files change
  useEffect(() => {
    setFilesState(files || []);
  }, [files]);

  // No initial fetch - rely on parent's real-time data

  // Real-time subscription is handled by parent component (project page)

  // fetchFiles function removed - using parent's real-time data


  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      if (!e.target.files?.length) return;
      const file = e.target.files[0];
      setUploading(true);

      const filePath = `${projectId}/${Date.now()}-${file.name}`;

      // Upload binary to storage
      const { error: storageError } = await supabase.storage
        .from("project-files")
        .upload(filePath, file);

      if (storageError) throw storageError;

      // Insert metadata into DB
      const { error: dbError } = await supabase.from("project_files").insert({
        project_id: projectId,
        filename: file.name,
        path: filePath,
        type: file.type,
        size: file.size,
      });

      if (dbError) throw dbError;
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
      e.target.value = ""; // reset input
    }
  }

  async function handleDownload(path: string, filename: string) {
    if (!confirm(`Download "${filename}"?`)) return;
    
    const { data, error } = await supabase.storage
      .from("project-files")
      .download(path);

    if (error || !data) {
      console.error("Download error:", error);
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleDelete(path: string, filename: string) {
    if (!confirm(`Are you sure you want to delete "${filename}"? This action cannot be undone.`)) return;
    
    const { error: storageError } = await supabase.storage.from("project-files").remove([path]);
    if (storageError) {
      console.error("Storage delete error:", storageError);
      return;
    }
  
    const { error: dbError } = await supabase.from("project_files").delete().eq("path", path);
    if (dbError) {
      console.error("DB delete error:", dbError);
    }
  }  

  return (
    <div>
      <h2 className="text-xl font-medium mb-2">Files</h2>

      {canWrite && (
        <div className="mb-4 md:text-base text-sm">
          <input type="file" onChange={handleUpload} disabled={uploading} />
        </div>
      )}

      {filesState.length === 0 ? (
        <p className="text-gray-400">No files uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {filesState.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between border border-gray-700 rounded-lg p-2 bg-gray-800/40"
            >
              <div className="flex flex-col max-w-[90vw] truncate">
                <span className="font-medium text-gray-200 truncate">{file.filename}</span>
                <span className="text-xs text-gray-400">
                  {(file.size / 1024).toFixed(1)} KB — {file.type || "unknown"}
                </span>
              </div>
              <div className="flex gap-2 max-w-[90vw] truncate">
                <button
                  onClick={() => handleDownload(file.path, file.filename)}
                  className="px-2 py-1 border rounded text-sm hover:bg-gray-700 text-gray-200"
                >
                  Download
                </button>
                {canWrite && (
                  <button
                    onClick={() => handleDelete(file.path, file.filename)}
                    className="px-2 py-1 border rounded text-sm hover:bg-red-600/30 text-red-400"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
