import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faFileCirclePlus,
  faFolderOpen,
  faDatabase,
} from "@fortawesome/free-solid-svg-icons";

type HomeOption = {
  icon: IconDefinition;
  title: string;
  description: string;
};

const options: HomeOption[] = [
  {
    icon: faFileCirclePlus,
    title: "New",
    description: "Start a new course-chain project from scratch",
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

export default function Home() {
  return (
    // Home screen — centered project-entry options
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      {/* Option row (stacks on mobile) */}
      <div className="grid w-full max-w-4xl gap-6 sm:grid-cols-3">
        {options.map((option) => (
          // Option card — no-op for now
          <button
            key={option.title}
            type="button"
            title={option.description}
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
    </div>
  );
}
