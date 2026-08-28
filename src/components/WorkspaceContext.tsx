"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import { type CourseChainProject, nowEpochSeconds } from "@/lib/project";
import { saveProject } from "@/lib/storage";

interface WorkspaceContextValue {
  /** The project currently open in the editor, or null on the launcher. */
  project: CourseChainProject | null;
  /** Load a project into the editor and make sure it's in browser storage. */
  openProject: (project: CourseChainProject) => void;
  /** Apply an editor change: stamp `lastModified` and persist. */
  updateProject: (project: CourseChainProject) => void;
  /** Return to the launcher. */
  closeProject: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/**
 * Holds the open project. Lives in the root layout so both the top bar and the
 * page can reach it. Every change is mirrored to localStorage, keyed by the
 * project's UUID.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<CourseChainProject | null>(null);

  const openProject = (next: CourseChainProject) => {
    saveProject(next);
    setProject(next);
  };

  const updateProject = (next: CourseChainProject) => {
    const stamped = { ...next, lastModified: nowEpochSeconds() };
    saveProject(stamped);
    setProject(stamped);
  };

  const closeProject = () => setProject(null);

  return (
    <WorkspaceContext.Provider
      value={{ project, openProject, updateProject, closeProject }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return value;
}
