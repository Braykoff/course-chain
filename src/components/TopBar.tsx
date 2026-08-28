"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHouse,
  faDownload,
  faCircleQuestion,
} from "@fortawesome/free-solid-svg-icons";
import { useWorkspace } from "./WorkspaceContext";

const iconButton =
  "inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-500 transition-colors " +
  "enabled:hover:bg-gray-100 enabled:hover:text-royal-600 " +
  "disabled:opacity-40 disabled:cursor-not-allowed " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-500 focus-visible:ring-offset-2";

export function TopBar() {
  const { project, setProject } = useWorkspace();
  // With no project open we're already on the launcher, so Home and Download
  // have nothing to do.
  const onLauncher = project === null;

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
      <div className="grid grid-cols-3 items-center px-4 py-2">
        {/* Home — returns to the launcher; disabled when already there */}
        <button
          type="button"
          aria-label="Home"
          title="Home"
          disabled={onLauncher}
          onClick={() => setProject(null)}
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
          {/* Download project — no-op; disabled when no project is open */}
          <button
            type="button"
            aria-label="Download project"
            title="Download project"
            disabled={onLauncher}
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
