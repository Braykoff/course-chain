"use client";

import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { type Course, courseDependents, type NewCourseInput, type Track } from "@/lib/project";

const DEFAULT_UNITS = 4;
const MIN_UNITS = 0;
const MAX_UNITS = 1000;

const labelClass = "mb-1 block text-xs font-medium text-gray-600";
const inputClass =
  "w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 " +
  "placeholder:text-gray-400 focus:border-royal-500 focus:outline-none focus:ring-1 focus:ring-royal-500";

interface DraftPrereq {
  name: string;
  concurrent: boolean;
}

interface CourseDraft {
  title: string;
  unitCount: number;
  comments: string;
  trackIds: number[];
  prereqs: DraftPrereq[];
}

interface CourseFormProps {
  /** Courses already in the project — used for the prereq search and the
   *  duplicate-name check. */
  courses: Course[];
  /** Project tracks. The Tracks field is hidden entirely when this is empty. */
  tracks: Track[];
  onSubmit: (input: NewCourseInput) => void;
  onClose: () => void;
  /** Pre-fill the form (editing an existing course). Blank when omitted. */
  initial?: NewCourseInput;
  /** Text on the primary button. */
  submitLabel?: string;
  /** Heading shown at the top of the form. */
  heading?: string;
  /** When set, a Delete button is shown that calls this. */
  onDelete?: () => void;
  /** Course id to ignore in the duplicate-name check (the one being edited). */
  excludeCourseId?: number;
}

export function CourseForm({
  courses,
  tracks,
  onSubmit,
  onClose,
  initial,
  submitLabel = "Add",
  heading = "Add Course",
  onDelete,
  excludeCourseId,
}: CourseFormProps) {
  const [draft, setDraft] = useState<CourseDraft>(() => ({
    title: initial?.name ?? "",
    unitCount: initial?.unitCount ?? DEFAULT_UNITS,
    comments: initial?.comments ?? "",
    trackIds: initial?.trackIds ? [...initial.trackIds] : [],
    prereqs: initial?.prereqs ? initial.prereqs.map((p) => ({ ...p })) : [],
  }));
  const [prereqQuery, setPrereqQuery] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  // Jump focus to the title when the form opens.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const trimmedTitle = draft.title.trim();
  const nameTaken = useMemo(
    () =>
      trimmedTitle.length > 0 &&
      courses.some(
        (course) =>
          course.id !== excludeCourseId &&
          course.name.trim().toLowerCase() === trimmedTitle.toLowerCase(),
      ),
    [courses, excludeCourseId, trimmedTitle],
  );
  // Names of courses that (transitively) require the course being edited —
  // choosing one as a prereq would close a loop, so it's blocked.
  const cyclicNameKeys = useMemo(() => {
    if (excludeCourseId == null) return new Set<string>();
    const blockedIds = courseDependents(courses, excludeCourseId);
    return new Set(
      courses
        .filter((course) => blockedIds.has(course.id))
        .map((course) => course.name.trim().toLowerCase()),
    );
  }, [courses, excludeCourseId]);

  const wouldCycle = (name: string) => cyclicNameKeys.has(name.trim().toLowerCase());
  const draftHasCycle = draft.prereqs.some((prereq) => wouldCycle(prereq.name));
  const submitDisabled = trimmedTitle.length === 0 || nameTaken || draftHasCycle;

  const query = prereqQuery.trim().toLowerCase();
  const prereqMatches = useMemo(() => {
    if (query.length === 0) return [];
    const chosen = new Set(draft.prereqs.map((prereq) => prereq.name.toLowerCase()));
    return courses
      .filter(
        (course) =>
          course.id !== excludeCourseId && !cyclicNameKeys.has(course.name.trim().toLowerCase()),
      )
      .map((course) => course.name.trim())
      .filter(
        (name) =>
          name.toLowerCase().includes(query) &&
          !chosen.has(name.toLowerCase()) &&
          name.toLowerCase() !== trimmedTitle.toLowerCase(),
      );
  }, [courses, cyclicNameKeys, draft.prereqs, excludeCourseId, query, trimmedTitle]);

  const addPrereq = (name: string) => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    // A course can't be its own prereq, nor one that depends on it (a loop).
    if (trimmedTitle.length > 0 && trimmed.toLowerCase() === trimmedTitle.toLowerCase()) {
      return;
    }
    if (wouldCycle(trimmed)) return;
    setDraft((current) =>
      current.prereqs.some((prereq) => prereq.name.toLowerCase() === trimmed.toLowerCase())
        ? current
        : { ...current, prereqs: [...current.prereqs, { name: trimmed, concurrent: false }] },
    );
    setPrereqQuery("");
  };

  const removePrereq = (name: string) =>
    setDraft((current) => ({
      ...current,
      prereqs: current.prereqs.filter((prereq) => prereq.name !== name),
    }));

  const toggleConcurrent = (name: string) =>
    setDraft((current) => ({
      ...current,
      prereqs: current.prereqs.map((prereq) =>
        prereq.name === name ? { ...prereq, concurrent: !prereq.concurrent } : prereq,
      ),
    }));

  const toggleTrack = (id: number) =>
    setDraft((current) => ({
      ...current,
      trackIds: current.trackIds.includes(id)
        ? current.trackIds.filter((trackId) => trackId !== id)
        : [...current.trackIds, id],
    }));

  const onPrereqKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addPrereq(prereqQuery);
    }
  };

  const handleSubmit = () => {
    if (submitDisabled) return;
    onSubmit({
      name: trimmedTitle,
      unitCount: draft.unitCount,
      comments: draft.comments.trim(),
      trackIds: draft.trackIds,
      prereqs: draft.prereqs,
    });
    onClose();
  };

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">{heading}</span>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <FontAwesomeIcon icon={faXmark} className="text-xs" />
        </button>
      </div>

      {/* Course Title */}
      <div>
        <label htmlFor="course-title" className={labelClass}>
          Course Title
        </label>
        <input
          id="course-title"
          ref={titleRef}
          className={`${inputClass} ${nameTaken ? "border-red-400 focus:border-red-400 focus:ring-red-400" : ""}`}
          value={draft.title}
          onChange={(event) =>
            setDraft((current) => ({ ...current, title: event.target.value }))
          }
          placeholder="MATH 54"
          aria-invalid={nameTaken}
        />
        {nameTaken && (
          <p className="mt-1 text-xs text-red-600">A course with this name already exists.</p>
        )}
      </div>

      {/* Unit count */}
      <div>
        <label htmlFor="course-units" className={labelClass}>
          Unit count
        </label>
        <input
          id="course-units"
          type="number"
          min={MIN_UNITS}
          max={MAX_UNITS}
          className={`${inputClass} w-24`}
          value={draft.unitCount}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            setDraft((current) => ({
              ...current,
              unitCount: Number.isFinite(parsed)
                ? Math.min(MAX_UNITS, Math.max(MIN_UNITS, Math.round(parsed)))
                : MIN_UNITS,
            }));
          }}
        />
      </div>

      {/* Comments */}
      <div>
        <label htmlFor="course-comments" className={labelClass}>
          Comments
        </label>
        <textarea
          id="course-comments"
          rows={2}
          className={`${inputClass} resize-y`}
          value={draft.comments}
          onChange={(event) =>
            setDraft((current) => ({ ...current, comments: event.target.value }))
          }
        />
      </div>

      {/* Tracks (only when the project has tracks) */}
      {tracks.length > 0 && (
        <div>
          <span className={labelClass}>Tracks</span>
          <div className="space-y-1">
            {tracks.map((track) => (
              <label key={track.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 cursor-pointer accent-royal-600"
                  checked={draft.trackIds.includes(track.id)}
                  onChange={() => toggleTrack(track.id)}
                />
                {track.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Prereqs */}
      <div>
        <span className={labelClass}>Prereqs</span>
        {draft.prereqs.length > 0 && (
          <ul className="mb-1.5 space-y-1">
            {draft.prereqs.map((prereq) => (
              <li
                key={prereq.name}
                className="flex items-center gap-2 rounded-md bg-gray-50 px-2 py-1 text-xs"
              >
                <span className="flex-1 truncate font-medium text-gray-800">{prereq.name}</span>
                <label className="flex items-center gap-1 text-gray-500">
                  <input
                    type="checkbox"
                    className="h-3 w-3 cursor-pointer accent-royal-600"
                    checked={prereq.concurrent}
                    onChange={() => toggleConcurrent(prereq.name)}
                  />
                  concurrent
                </label>
                <button
                  type="button"
                  aria-label={`Remove prereq ${prereq.name}`}
                  onClick={() => removePrereq(prereq.name)}
                  className="inline-flex h-4 w-4 items-center justify-center rounded text-gray-400 hover:text-red-600"
                >
                  <FontAwesomeIcon icon={faXmark} className="text-[10px]" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="relative">
          <input
            className={inputClass}
            value={prereqQuery}
            onChange={(event) => setPrereqQuery(event.target.value)}
            onKeyDown={onPrereqKeyDown}
            placeholder="Course name, then Enter"
            aria-label="Prereq course name"
          />
          {prereqQuery.trim().length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg">
              {prereqMatches.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    className="block w-full px-3 py-1 text-left text-gray-700 hover:bg-royal-50 hover:text-royal-700"
                    onClick={() => addPrereq(name)}
                  >
                    {name}
                  </button>
                </li>
              ))}
              {prereqQuery.trim().toLowerCase() === trimmedTitle.toLowerCase() &&
              trimmedTitle.length > 0 ? (
                <li className="px-3 py-1 text-xs text-gray-400">
                  A course can&rsquo;t be its own prereq.
                </li>
              ) : wouldCycle(prereqQuery) ? (
                <li className="px-3 py-1 text-xs text-gray-400">
                  &ldquo;{prereqQuery.trim()}&rdquo; depends on this course &mdash; that
                  would create a loop.
                </li>
              ) : (
                <li>
                  <button
                    type="button"
                    className="block w-full px-3 py-1 text-left text-royal-700 hover:bg-royal-50"
                    onClick={() => addPrereq(prereqQuery)}
                  >
                    Add &ldquo;{prereqQuery.trim()}&rdquo;
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        {onDelete ? (
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
            onClick={onDelete}
          >
            Delete
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          className="rounded-md bg-royal-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-royal-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={submitDisabled}
          onClick={handleSubmit}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
