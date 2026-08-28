"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCaretDown, faPlus, faXmark } from "@fortawesome/free-solid-svg-icons";
import {
  MAX_PROJECT_NAME_LENGTH,
  MAX_TERM_NAME_LENGTH,
  MAX_TERMS,
  MAX_TRACK_NAME_LENGTH,
  MAX_TRACKS,
} from "@/lib/project";
import {
  buildTemplateTerms,
  type DraftTerm,
  emptyDraft,
  makeDraftTerm,
  makeDraftTrack,
  type NewProjectDraft,
  type TemplateId,
  TEMPLATE_OPTIONS,
  validateDraft,
} from "@/lib/onboarding";

interface NewProjectDialogProps {
  onClose: () => void;
  /** Called with the finished draft when "Start" is clicked and it is valid. */
  onStart: (draft: NewProjectDraft) => void;
}

const fieldClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 " +
  "placeholder:text-gray-400 transition focus:border-royal-500 focus:outline-none " +
  "focus:ring-2 focus:ring-royal-500/30";

const invalidFieldClass =
  "border-red-400 focus:border-red-400 focus:ring-red-400/30";

const cellInputClass =
  "w-full bg-transparent px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 " +
  "outline-none focus:bg-royal-50/60";

const addButtonClass =
  "inline-flex items-center gap-1.5 rounded-md border border-royal-200 bg-white px-3 py-1.5 " +
  "text-sm font-medium text-royal-700 transition hover:bg-royal-50 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-500 " +
  "disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-white";

const neutralButtonClass =
  "inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 " +
  "text-sm font-medium text-gray-700 transition hover:bg-gray-50 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-500";

const rowRemoveClass =
  "inline-flex h-7 w-7 items-center justify-center rounded text-gray-300 transition " +
  "hover:bg-gray-100 hover:text-red-600 focus-visible:opacity-100 focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-royal-500";

export function NewProjectDialog({ onClose, onStart }: NewProjectDialogProps) {
  // Mounted only while the dialog is open, so useState's lazy initializer gives
  // a fresh blank form every time.
  const [draft, setDraft] = useState<NewProjectDraft>(emptyDraft);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  // Errors stay hidden until the user actually tries to submit.
  const [showErrors, setShowErrors] = useState(false);
  const templateRef = useRef<HTMLDivElement>(null);

  // Escape closes the template menu first, then the dialog.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setTemplateMenuOpen((menuOpen) => {
        if (menuOpen) return false;
        onClose();
        return menuOpen;
      });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Click outside the template dropdown closes it.
  useEffect(() => {
    if (!templateMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!templateRef.current?.contains(event.target as Node)) {
        setTemplateMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [templateMenuOpen]);

  const errors = useMemo(() => validateDraft(draft), [draft]);

  const updateTerm = (index: number, patch: Partial<DraftTerm>) =>
    setDraft((current) => ({
      ...current,
      terms: current.terms.map((term, i) => (i === index ? { ...term, ...patch } : term)),
    }));

  const addTerm = () =>
    setDraft((current) =>
      current.terms.length >= MAX_TERMS
        ? current
        : { ...current, terms: [...current.terms, makeDraftTerm()] },
    );

  const removeTerm = (index: number) =>
    setDraft((current) => ({
      ...current,
      terms: current.terms.filter((_, i) => i !== index),
    }));

  const applyTemplate = (template: TemplateId) => {
    setDraft((current) => ({ ...current, terms: buildTemplateTerms(template) }));
    setTemplateMenuOpen(false);
  };

  const updateTrack = (index: number, name: string) =>
    setDraft((current) => ({
      ...current,
      tracks: current.tracks.map((track, i) => (i === index ? { ...track, name } : track)),
    }));

  const addTrack = () =>
    setDraft((current) => ({ ...current, tracks: [...current.tracks, makeDraftTrack()] }));

  const removeTrack = (index: number) =>
    setDraft((current) => ({
      ...current,
      tracks: current.tracks.filter((_, i) => i !== index),
    }));

  const lastTrackName = draft.tracks.at(-1)?.name ?? "";
  const canAddTrack =
    draft.tracks.length < MAX_TRACKS &&
    (draft.tracks.length === 0 || lastTrackName.trim().length > 0);

  const handleStart = () => {
    if (errors.length > 0) {
      setShowErrors(true);
      return;
    }
    onStart(draft);
  };

  const titleInvalid = showErrors && draft.title.trim() === "";

  return (
    // Backdrop — mousedown (not click) so dragging a selection out doesn't close it
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm sm:p-8"
      onMouseDown={onClose}
    >
      {/* Dialog panel: fixed header/footer, scrolling body */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 id="new-project-title" className="text-base font-semibold text-gray-900">
            New course-chain Project
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={rowRemoveClass}
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-7 overflow-y-auto px-6 py-6">
          {/* Title */}
          <div>
            <label
              htmlFor="project-title"
              className="mb-1.5 block text-sm font-semibold text-gray-900"
            >
              Title
            </label>
            <input
              id="project-title"
              className={`${fieldClass} ${titleInvalid ? invalidFieldClass : ""}`}
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="My four-year plan"
              maxLength={MAX_PROJECT_NAME_LENGTH}
              aria-invalid={titleInvalid}
            />
          </div>

          {/* Terms */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Terms</h3>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
                    <th className="px-3 py-2">Name</th>
                    <th className="w-40 border-l border-gray-200 px-3 py-2">Start date</th>
                    <th className="w-40 border-l border-gray-200 px-3 py-2">End date</th>
                    <th
                      className="w-28 border-l border-gray-200 px-3 py-2 text-center"
                      title="Automatically fill this term with courses"
                    >
                      Auto-populate
                    </th>
                    <th className="w-10 px-2 py-2">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {draft.terms.map((term, index) => {
                    const nameInvalid = showErrors && term.name.trim() === "";
                    const startInvalid = showErrors && !term.start;
                    const endInvalid = showErrors && !term.end;
                    return (
                      <tr key={term.id} className="group/row">
                        <td className={nameInvalid ? "bg-red-50" : ""}>
                          <input
                            className={cellInputClass}
                            value={term.name}
                            onChange={(event) => updateTerm(index, { name: event.target.value })}
                            placeholder="Fall 2026"
                            maxLength={MAX_TERM_NAME_LENGTH}
                            aria-label={`Term ${index + 1} name`}
                            aria-invalid={nameInvalid}
                          />
                        </td>
                        <td
                          className={`border-l border-gray-100 ${startInvalid ? "bg-red-50" : ""}`}
                        >
                          <input
                            type="date"
                            className={cellInputClass}
                            value={term.start}
                            onChange={(event) => updateTerm(index, { start: event.target.value })}
                            aria-label={`Term ${index + 1} start date`}
                            aria-invalid={startInvalid}
                          />
                        </td>
                        <td className={`border-l border-gray-100 ${endInvalid ? "bg-red-50" : ""}`}>
                          <input
                            type="date"
                            className={cellInputClass}
                            value={term.end}
                            onChange={(event) => updateTerm(index, { end: event.target.value })}
                            aria-label={`Term ${index + 1} end date`}
                            aria-invalid={endInvalid}
                          />
                        </td>
                        <td className="border-l border-gray-100 px-3 py-1.5 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer align-middle accent-royal-600"
                            checked={term.autopopulate}
                            onChange={(event) =>
                              updateTerm(index, { autopopulate: event.target.checked })
                            }
                            aria-label={`Term ${index + 1} auto-populate`}
                          />
                        </td>
                        <td className="px-2 text-center">
                          <button
                            type="button"
                            className={`${rowRemoveClass} opacity-0 group-hover/row:opacity-100`}
                            onClick={() => removeTerm(index)}
                            aria-label={`Remove term ${index + 1}`}
                          >
                            <FontAwesomeIcon icon={faXmark} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Add Term (left) / Template dropdown (right) */}
            <div className="mt-3 flex items-start justify-between">
              <button
                type="button"
                className={addButtonClass}
                onClick={addTerm}
                disabled={draft.terms.length >= MAX_TERMS}
              >
                <FontAwesomeIcon icon={faPlus} className="text-xs" />
                Add Term
              </button>

              <div className="relative" ref={templateRef}>
                <button
                  type="button"
                  className={neutralButtonClass}
                  onClick={() => setTemplateMenuOpen((menuOpen) => !menuOpen)}
                  aria-haspopup="menu"
                  aria-expanded={templateMenuOpen}
                  aria-label="Semester templates"
                >
                  Template
                  <FontAwesomeIcon icon={faCaretDown} className="text-xs" />
                </button>
                {templateMenuOpen && (
                  <ul
                    role="menu"
                    className="absolute right-0 z-10 mt-1 w-56 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg"
                  >
                    <li
                      role="presentation"
                      className="border-b border-gray-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400"
                    >
                      Semester templates
                    </li>
                    {TEMPLATE_OPTIONS.map((option) => (
                      <li key={option} role="none">
                        <button
                          type="button"
                          role="menuitem"
                          className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 transition hover:bg-royal-50 hover:text-royal-700"
                          onClick={() => applyTemplate(option)}
                        >
                          {option}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Tracks */}
          <div>
            <h3 className="mb-1 text-sm font-semibold text-gray-900">Tracks</h3>
            <p className="mb-2 text-xs text-gray-500">
              Optional. Add a row for each major or concentration this plan should satisfy.
            </p>
            <div className="space-y-2">
              {draft.tracks.map((track, index) => (
                <div key={track.id} className="group/track flex items-center gap-2">
                  <input
                    className={fieldClass}
                    value={track.name}
                    onChange={(event) => updateTrack(index, event.target.value)}
                    placeholder="Biology major"
                    maxLength={MAX_TRACK_NAME_LENGTH}
                    aria-label={`Track ${index + 1} name`}
                  />
                  <button
                    type="button"
                    className={`${rowRemoveClass} opacity-0 group-hover/track:opacity-100`}
                    onClick={() => removeTrack(index)}
                    aria-label={`Remove track ${index + 1}`}
                  >
                    <FontAwesomeIcon icon={faXmark} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className={`mt-3 ${addButtonClass}`}
              onClick={addTrack}
              disabled={!canAddTrack}
            >
              <FontAwesomeIcon icon={faPlus} className="text-xs" />
              Add Track
            </button>
          </div>
        </div>

        {/* Footer: validation summary (only after a Start attempt) + Start */}
        <div className="shrink-0 border-t border-gray-200 px-6 py-4">
          {showErrors && errors.length > 0 && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2">
              <p className="mb-1 text-xs font-semibold text-red-700">
                Please fix the following:
              </p>
              <ul className="space-y-0.5 text-xs text-red-600">
                {errors.map((error, index) => (
                  <li key={`${index}-${error}`}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex justify-center">
            <button
              type="button"
              className="rounded-md bg-royal-600 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-royal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-500 focus-visible:ring-offset-2"
              onClick={handleStart}
            >
              Start
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
