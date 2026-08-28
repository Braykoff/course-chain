"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import type { CourseChainProject } from "@/lib/project";

interface WorkspaceContextValue {
  /** The project currently open in the editor, or null on the launcher. */
  project: CourseChainProject | null;
  /** Replace the open project, or pass null to return to the launcher. */
  setProject: (project: CourseChainProject | null) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/**
 * Holds the open project. Lives in the root layout so both the top bar (Home
 * button) and the page can reach it. Nothing is persisted yet — a reload clears
 * it.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<CourseChainProject | null>(null);

  return (
    <WorkspaceContext.Provider value={{ project, setProject }}>
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
