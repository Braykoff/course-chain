"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHouse,
  faDownload,
  faCircleQuestion,
} from "@fortawesome/free-solid-svg-icons";
import { serializeProject } from "@/lib/project";
import { useWorkspace } from "./WorkspaceContext";

const iconButton =
  "inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-500 transition-colors " +
  "enabled:hover:bg-gray-100 enabled:hover:text-royal-600 " +
  "disabled:opacity-40 disabled:cursor-not-allowed " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-500 focus-visible:ring-offset-2";

/** File name for a downloaded project: the project name, made filesystem-safe. */
function downloadName(name: string): string {
  const safe = name.trim().replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "");
  return `${safe || "project"}.chain`;
}

export function TopBar() {
  const { project, closeProject } = useWorkspace();
  // With no project open we're already on the launcher, so Home and Download
  // have nothing to do.
  const onLauncher = project === null;

  const handleDownload = () => {
    if (!project) return;
    const bytes = (() => {
      try {
        return new Uint8Array(serializeProject(project));
      } catch {
        return null;
      }
    })();
    if (!bytes) {
      window.alert("This project can't be exported right now.");
      return;
    }
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = downloadName(project.name);
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
      <div className="grid grid-cols-3 items-center px-4 py-2">
        {/* Home — returns to the launcher; disabled when already there */}
        <button
          type="button"
          aria-label="Home"
          title="Home"
          disabled={onLauncher}
          onClick={closeProject}
          className={`${iconButton} justify-self-start`}
        >
          <FontAwesomeIcon icon={faHouse} className="text-base" />
        </button>

        {/* Site name */}
        <span className="justify-self-center select-none text-base font-semibold tracking-tight text-royal-700">
          course-chain
        </span>

        {/* Download + Help */}
        <div className="flex items-center gap-1 justify-self-end">
          {/* Download the project as a .chain file */}
          <button
            type="button"
            aria-label="Download project"
            title="Download project (.chain)"
            disabled={onLauncher}
            onClick={handleDownload}
            className={iconButton}
          >
            <FontAwesomeIcon icon={faDownload} className="text-base" />
          </button>

          {/* Help — no-op for now */}
          <button
            type="button"
            aria-label="Help"
            title="Help"
            className={iconButton}
          >
            <FontAwesomeIcon icon={faCircleQuestion} className="text-base" />
          </button>
        </div>
      </div>
    </header>
  );
}
