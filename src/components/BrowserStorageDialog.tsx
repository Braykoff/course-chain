"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import type { CourseChainProject } from "@/lib/project";
import {
  deleteProject,
  listProjects,
  loadProject,
  type StoredProjectSummary,
} from "@/lib/storage";
import { Modal } from "./Modal";

/** Epoch seconds -> "Aug 27, 2026, 3:14 PM" in the viewer's locale. */
function formatModified(seconds: number): string {
  if (!seconds) return "never";
  return new Date(seconds * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

interface BrowserStorageDialogProps {
  onOpen: (project: CourseChainProject) => void;
  onClose: () => void;
}

export function BrowserStorageDialog({ onOpen, onClose }: BrowserStorageDialogProps) {
  // Mounted only on click, so this only runs in the browser.
  const [rows, setRows] = useState<StoredProjectSummary[]>(() => listProjects());

  const handleDelete = (projectId: string) => {
    deleteProject(projectId);
    setRows(listProjects());
  };

  const handleOpen = (projectId: string) => {
    const project = loadProject(projectId);
    if (project) onOpen(project);
  };

  return (
    <Modal title="Browser storage" onClose={onClose}>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No projects are saved in this browser yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map((row) => (
            <li key={row.projectId} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {row.name || "Untitled project"}
                </p>
                <p className="text-xs text-gray-500">
                  Last modified {formatModified(row.lastModified)}
                </p>
                {row.trackNames.length > 0 && (
                  <p className="mt-0.5 truncate text-xs text-gray-400">
                    {row.trackNames.join(" · ")}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label={`Delete ${row.name || "project"}`}
                onClick={() => handleDelete(row.projectId)}
                className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <FontAwesomeIcon icon={faTrash} className="text-xs" />
              </button>
              <button
                type="button"
                onClick={() => handleOpen(row.projectId)}
                className="rounded-md bg-royal-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-royal-700"
              >
                Open
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
