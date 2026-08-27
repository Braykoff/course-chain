"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faDatabase,
  faFileCirclePlus,
  faFolderOpen,
} from "@fortawesome/free-solid-svg-icons";
import { NewProjectDialog } from "./NewProjectDialog";

interface HomeOption {
  icon: IconDefinition;
  title: string;
  description: string;
  onSelect?: () => void;
}

export function HomeOptions() {
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  const options: HomeOption[] = [
    {
      icon: faFileCirclePlus,
      title: "New",
      description: "Start a new course-chain project from scratch",
      onSelect: () => setNewProjectOpen(true),
    },
    {
      icon: faFolderOpen,
      title: "Open File",
      description: "Open a course-chain project from a local file",
    },
    {
      icon: faDatabase,
      title: "Browser Storage",
      description: "Open a course-chain project from local browser storage",
    },
  ];

  return (
    <>
      {/* Option row (stacks on mobile) */}
      <div className="grid w-full max-w-4xl gap-6 sm:grid-cols-3">
        {options.map((option) => (
          // Option card — "New" opens the onboarding dialog; the rest are no-ops
          <button
            key={option.title}
            type="button"
            title={option.description}
            onClick={option.onSelect}
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

      {/* New course-chain Project onboarding — mounted only while open, so it
          always starts from a blank form */}
      {newProjectOpen && (
        <NewProjectDialog onClose={() => setNewProjectOpen(false)} />
      )}
    </>
  );
}
