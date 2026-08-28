"use client";

import { useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faDatabase,
  faFileCirclePlus,
  faFolderOpen,
} from "@fortawesome/free-solid-svg-icons";
import { type CourseChainProject, deserializeProject } from "@/lib/project";
import { draftToProject } from "@/lib/onboarding";
import { hasProject, loadProject } from "@/lib/storage";
import { BrowserStorageDialog } from "./BrowserStorageDialog";
import { FileConflictDialog } from "./FileConflictDialog";
import { NewProjectDialog } from "./NewProjectDialog";

type HomeAction = "new" | "file" | "storage";

interface HomeOption {
  action: HomeAction;
  icon: IconDefinition;
  title: string;
  description: string;
}

interface HomeOptionsProps {
  onOpenProject: (project: CourseChainProject) => void;
}

export function HomeOptions({ onOpenProject }: HomeOptionsProps) {
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [browserStorageOpen, setBrowserStorageOpen] = useState(false);
  const [conflict, setConflict] = useState<{
    file: CourseChainProject;
    stored: CourseChainProject;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runAction = (action: HomeAction) => {
    if (action === "new") setNewProjectOpen(true);
    else if (action === "file") fileInputRef.current?.click();
    else setBrowserStorageOpen(true);
  };

  const handleFile = async (file: File) => {
    let fileProject: CourseChainProject;
    try {
      fileProject = deserializeProject(new Uint8Array(await file.arrayBuffer()));
    } catch {
      window.alert("That file isn't a valid course-chain project.");
      return;
    }
    const stored = hasProject(fileProject.projectId)
      ? loadProject(fileProject.projectId)
      : null;
    if (stored) {
      setConflict({ file: fileProject, stored });
    } else {
      onOpenProject(fileProject);
    }
  };

  const options: HomeOption[] = [
    {
      action: "new",
      icon: faFileCirclePlus,
      title: "New",
      description: "Start a new course-chain project from scratch",
    },
    {
      action: "file",
      icon: faFolderOpen,
      title: "Open File",
      description: "Open a course-chain project from a local .chain file",
    },
    {
      action: "storage",
      icon: faDatabase,
      title: "Browser Storage",
      description: "Open a course-chain project saved in this browser",
    },
  ];

  return (
    <>
      {/* Option row */}
      <div className="grid w-full max-w-4xl grid-cols-3 gap-6">
        {options.map((option) => (
          <button
            key={option.title}
            type="button"
            title={option.description}
            onClick={() => runAction(option.action)}
            className="group flex flex-col items-center gap-4 rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-royal-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-500 focus-visible:ring-offset-2"
          >
            {/* Icon */}
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-royal-50 text-royal-600 transition-colors group-hover:bg-royal-600 group-hover:text-white">
              <FontAwesomeIcon icon={option.icon} className="text-xl" />
            </span>

            {/* Title */}
            <span className="text-lg font-semibold text-gray-900">
              {option.title}
            </span>

            {/* Description */}
            <span className="text-sm leading-relaxed text-gray-500">
              {option.description}
            </span>
          </button>
        ))}
      </div>

      {/* Hidden picker for "Open File" */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".chain"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void handleFile(file);
        }}
      />

      {/* New course-chain Project onboarding — mounted only while open */}
      {newProjectOpen && (
        <NewProjectDialog
          onClose={() => setNewProjectOpen(false)}
          onStart={(draft) => {
            onOpenProject(draftToProject(draft));
            setNewProjectOpen(false);
          }}
        />
      )}

      {browserStorageOpen && (
        <BrowserStorageDialog
          onOpen={(project) => {
            onOpenProject(project);
            setBrowserStorageOpen(false);
          }}
          onClose={() => setBrowserStorageOpen(false)}
        />
      )}

      {conflict && (
        <FileConflictDialog
          file={conflict.file}
          stored={conflict.stored}
          onKeepStored={() => {
            onOpenProject(conflict.stored);
            setConflict(null);
          }}
          onUseFile={() => {
            onOpenProject(conflict.file);
            setConflict(null);
          }}
          onClose={() => setConflict(null)}
        />
      )}
    </>
  );
}
