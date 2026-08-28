"use client";

import type { CourseChainProject } from "@/lib/project";
import { Modal } from "./Modal";

function formatModified(seconds: number): string {
  if (!seconds) return "unknown";
  return new Date(seconds * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

interface FileConflictDialogProps {
  /** The project decoded from the picked file. */
  file: CourseChainProject;
  /** The copy already in browser storage with the same id. */
  stored: CourseChainProject;
  onKeepStored: () => void;
  onUseFile: () => void;
  onClose: () => void;
}

export function FileConflictDialog({
  file,
  stored,
  onKeepStored,
  onUseFile,
  onClose,
}: FileConflictDialogProps) {
  const fileNewer = file.lastModified > stored.lastModified;
  const storedNewer = stored.lastModified > file.lastModified;

  const optionClass = (isNewer: boolean) =>
    `rounded-md border p-3 ${
      isNewer ? "border-royal-300 bg-royal-50" : "border-gray-200"
    }`;

  return (
    <Modal title="Project already in browser storage" onClose={onClose} maxWidthClass="max-w-md">
      <p className="text-sm text-gray-600">
        A project with this id is already saved in this browser
        {stored.name ? ` as “${stored.name}”` : ""}. Which copy do you want to open?
      </p>

      <div className="mt-4 space-y-2 text-sm">
        <div className={optionClass(storedNewer)}>
          <p className="font-medium text-gray-900">
            Browser copy{storedNewer && " — newer"}
          </p>
          <p className="text-xs text-gray-500">
            Last modified {formatModified(stored.lastModified)}
          </p>
        </div>
        <div className={optionClass(fileNewer)}>
          <p className="font-medium text-gray-900">File{fileNewer && " — newer"}</p>
          <p className="text-xs text-gray-500">
            Last modified {formatModified(file.lastModified)}
          </p>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onKeepStored}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Keep browser copy
        </button>
        <button
          type="button"
          onClick={onUseFile}
          className="rounded-md bg-royal-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-royal-700"
        >
          Replace with file
        </button>
      </div>
    </Modal>
  );
}
