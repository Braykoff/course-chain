"use client";

import { EditorScreen } from "./EditorScreen";
import { HomeOptions } from "./HomeOptions";
import { useWorkspace } from "./WorkspaceContext";

/**
 * Switches between the launcher (New / Open File / Browser Storage) and the
 * editor, based on whether a project is open in the workspace context.
 */
export function Workspace() {
  const { project, openProject } = useWorkspace();

  if (project) {
    return <EditorScreen project={project} />;
  }

  return (
    // Launcher — centered project-entry options
    <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-16">
      <HomeOptions onOpenProject={openProject} />
    </div>
  );
}
