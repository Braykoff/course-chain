"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import {
  applyProjectSettings,
  type CourseChainProject,
  MAX_PROJECT_NAME_LENGTH,
  MAX_TRACK_NAME_LENGTH,
  MAX_TRACKS,
} from "@/lib/project";
import { Modal } from "./Modal";

interface TrackRow {
  /** Existing track id, or null for a row added in this dialog. */
  id: number | null;
  name: string;
}

interface ProjectSettingsDialogProps {
  project: CourseChainProject;
  onClose: () => void;
  onSave: (next: CourseChainProject) => void;
}

/** Collects the settings-form rules the save path would otherwise throw on. */
function collectErrors(name: string, tracks: TrackRow[]): string[] {
  const errors: string[] = [];
  const trimmedName = name.trim();

  if (trimmedName.length === 0) {
    errors.push("Project name must not be blank.");
  } else if (trimmedName.length > MAX_PROJECT_NAME_LENGTH) {
    errors.push(
      `Project name must be at most ${MAX_PROJECT_NAME_LENGTH} characters.`,
    );
  }

  if (tracks.length > MAX_TRACKS) {
    errors.push(`Too many tracks (${tracks.length}); the maximum is ${MAX_TRACKS}.`);
  }

  const seen = new Set<string>();
  for (const row of tracks) {
    const key = row.name.trim();
    if (key.length === 0) {
      errors.push("Every track needs a name.");
      continue;
    }
    if (key.length > MAX_TRACK_NAME_LENGTH) {
      errors.push(
        `Track "${key.slice(0, 20)}…": name must be at most ${MAX_TRACK_NAME_LENGTH} characters.`,
      );
    }
    if (seen.has(key)) errors.push(`Duplicate track name "${key}".`);
    seen.add(key);
  }

  return [...new Set(errors)];
}

/**
 * Project-level settings reached from the top bar's gear button: rename the
 * project, manage its tracks (rename / add / delete), and read its UUID.
 * Changes apply only on Save.
 */
export function ProjectSettingsDialog({
  project,
  onClose,
  onSave,
}: ProjectSettingsDialogProps) {
  const [name, setName] = useState(project.name);
  const [tracks, setTracks] = useState<TrackRow[]>(() =>
    project.tracks.map((track) => ({ id: track.id, name: track.name })),
  );
  const [showErrors, setShowErrors] = useState(false);

  const renameTrack = (index: number, value: string) =>
    setTracks((rows) =>
      rows.map((row, i) => (i === index ? { ...row, name: value } : row)),
    );
  const removeTrack = (index: number) =>
    setTracks((rows) => rows.filter((_, i) => i !== index));
  const addTrack = () =>
    setTracks((rows) => [...rows, { id: null, name: "" }]);

  const errors = collectErrors(name, tracks);
  const fieldClass =
    "w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-royal-400 focus:outline-none focus:ring-2 focus:ring-royal-200";

  const handleSave = () => {
    if (errors.length > 0) {
      setShowErrors(true);
      return;
    }
    onSave(applyProjectSettings(project, { name, tracks }));
    onClose();
  };

  return (
    <Modal title="Project settings" onClose={onClose} maxWidthClass="max-w-lg">
      {/* Title */}
      <div>
        <label
          htmlFor="cc-settings-title"
          className="mb-1 block text-sm font-semibold text-gray-900"
        >
          Title
        </label>
        <input
          id="cc-settings-title"
          className={fieldClass}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={MAX_PROJECT_NAME_LENGTH}
        />
      </div>

      {/* Tracks */}
      <div className="mt-5">
        <h3 className="mb-1 text-sm font-semibold text-gray-900">Tracks</h3>
        <p className="mb-2 text-xs text-gray-500">
          Rename, add, or remove the majors and concentrations this plan should
          satisfy. Removing a track also clears it from every course.
        </p>
        {tracks.length > 0 ? (
          <div className="space-y-2">
            {tracks.map((track, index) => (
              <div
                key={track.id ?? `new-${index}`}
                className="group/track flex items-center gap-2"
              >
                <input
                  className={fieldClass}
                  value={track.name}
                  onChange={(event) => renameTrack(index, event.target.value)}
                  placeholder="Biology major"
                  maxLength={MAX_TRACK_NAME_LENGTH}
                  aria-label={`Track ${index + 1} name`}
                />
                <button
                  type="button"
                  onClick={() => removeTrack(index)}
                  aria-label={`Remove track ${index + 1}`}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-gray-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover/track:opacity-100"
                >
                  <FontAwesomeIcon icon={faTrash} className="text-xs" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">No tracks.</p>
        )}
        <button
          type="button"
          onClick={addTrack}
          disabled={tracks.length >= MAX_TRACKS}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-royal-200 px-3 py-1.5 text-sm font-medium text-royal-700 transition hover:bg-royal-50 disabled:opacity-40"
        >
          <FontAwesomeIcon icon={faPlus} className="text-xs" />
          Add Track
        </button>
      </div>

      {/* Validation summary — only after a failed Save */}
      {showErrors && errors.length > 0 && (
        <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2">
          <ul className="space-y-0.5 text-xs text-red-600">
            {errors.map((error, index) => (
              <li key={`${index}-${error}`}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-md bg-royal-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-royal-700"
        >
          Save
        </button>
      </div>

      {/* Project UUID */}
      <p className="mt-6 border-t border-gray-100 pt-3 text-[11px] text-gray-400">
        Project ID:{" "}
        <span className="select-all font-mono">{project.projectId}</span>
      </p>
    </Modal>
  );
}
