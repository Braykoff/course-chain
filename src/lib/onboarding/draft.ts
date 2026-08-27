import { create } from "@bufbuild/protobuf";
import {
  type CourseChainProject,
  CourseChainProjectSchema,
  CURRENT_SCHEMA_VERSION,
  MAX_PROJECT_NAME_LENGTH,
  MAX_TERM_NAME_LENGTH,
  MAX_TERMS,
  MAX_TRACK_NAME_LENGTH,
  MAX_TRACKS,
} from "@/lib/project";

// The in-progress state of the "New course-chain Project" form, before it is
// turned into a CourseChainProject. Dates are the raw ISO strings an
// <input type="date"> produces ("YYYY-MM-DD", or "" when empty); track names
// are plain strings. Each row carries a client-only `id` for stable React keys.

export interface DraftTerm {
  id: string;
  name: string;
  start: string;
  end: string;
  autopopulate: boolean;
}

export interface DraftTrack {
  id: string;
  name: string;
}

export interface NewProjectDraft {
  title: string;
  terms: DraftTerm[];
  tracks: DraftTrack[];
}

let idCounter = 0;
const nextId = (): string => `d${(idCounter += 1)}`;

export function makeDraftTerm(init: Partial<Omit<DraftTerm, "id">> = {}): DraftTerm {
  return {
    id: nextId(),
    name: init.name ?? "",
    start: init.start ?? "",
    end: init.end ?? "",
    autopopulate: init.autopopulate ?? false,
  };
}

export function makeDraftTrack(name = ""): DraftTrack {
  return { id: nextId(), name };
}

/** A blank form: one empty term row and one empty track row. */
export function emptyDraft(): NewProjectDraft {
  return { title: "", terms: [makeDraftTerm()], tracks: [makeDraftTrack()] };
}

const isBlank = (value: string): boolean => value.trim().length === 0;

/**
 * Check a draft against the same rules {@link validateProject} enforces, phrased
 * for the form. Returns a list of human-readable problems; an empty list means
 * the draft is ready and the "Start" button can be enabled.
 *
 * Rules: project name non-blank and at most {@link MAX_PROJECT_NAME_LENGTH}
 * chars; 1..{@link MAX_TERMS} terms; every term name non-blank, at most
 * {@link MAX_TERM_NAME_LENGTH} chars, and unique; every term has both dates,
 * with start before end and no overlap with the previous term. Blank track
 * inputs are ignored (zero tracks is allowed); the rest must be unique, at most
 * {@link MAX_TRACK_NAME_LENGTH} chars each, and number at most
 * {@link MAX_TRACKS}.
 */
export function validateDraft(draft: NewProjectDraft): string[] {
  const errors: string[] = [];

  if (isBlank(draft.title)) {
    errors.push("Project name must not be blank.");
  } else if (draft.title.trim().length > MAX_PROJECT_NAME_LENGTH) {
    errors.push(`Project name must be at most ${MAX_PROJECT_NAME_LENGTH} characters.`);
  }

  // --- Terms ---
  if (draft.terms.length === 0) {
    errors.push("Add at least one term.");
  }
  if (draft.terms.length > MAX_TERMS) {
    errors.push(`Too many terms (${draft.terms.length}); the maximum is ${MAX_TERMS}.`);
  }

  const seenTermNames = new Set<string>();
  draft.terms.forEach((term, index) => {
    const n = index + 1;
    if (isBlank(term.name)) {
      errors.push(`Term ${n}: name must not be blank.`);
    } else {
      const key = term.name.trim();
      if (key.length > MAX_TERM_NAME_LENGTH) {
        errors.push(`Term ${n}: name must be at most ${MAX_TERM_NAME_LENGTH} characters.`);
      }
      if (seenTermNames.has(key)) {
        errors.push(`Term ${n}: duplicate name "${key}".`);
      }
      seenTermNames.add(key);
    }
    if (!term.start) errors.push(`Term ${n}: start date is required.`);
    if (!term.end) errors.push(`Term ${n}: end date is required.`);
    if (term.start && term.end && term.start >= term.end) {
      errors.push(`Term ${n}: start date must be before end date.`);
    }
  });

  for (let i = 1; i < draft.terms.length; i++) {
    const prev = draft.terms[i - 1];
    const current = draft.terms[i];
    if (prev.end && current.start && prev.end > current.start) {
      errors.push(`Term ${i + 1}: starts before term ${i} ends.`);
    }
  }

  // --- Tracks (blank inputs are dropped, so zero named tracks is fine) ---
  const trackNames = draft.tracks
    .map((track) => track.name.trim())
    .filter((name) => name.length > 0);

  if (trackNames.length > MAX_TRACKS) {
    errors.push(`Too many tracks (${trackNames.length}); the maximum is ${MAX_TRACKS}.`);
  }
  const seenTrackNames = new Set<string>();
  for (const name of trackNames) {
    if (name.length > MAX_TRACK_NAME_LENGTH) {
      errors.push(`Track "${name.slice(0, 20)}…": name must be at most ${MAX_TRACK_NAME_LENGTH} characters.`);
    }
    if (seenTrackNames.has(name)) {
      errors.push(`Duplicate track name "${name}".`);
    }
    seenTrackNames.add(name);
  }

  return errors;
}

/** Whole days from the Unix epoch to `iso` (a "YYYY-MM-DD" string), UTC. */
export function isoToEpochDay(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
}

/**
 * Build a {@link CourseChainProject} from a draft: names are trimmed, dates
 * become epoch-day counts, blank track inputs are dropped and the rest get
 * sequential ids, and the course list starts empty. Callers should still run
 * {@link validateProject} on the result (or {@link validateDraft} on the draft
 * first).
 */
export function draftToProject(draft: NewProjectDraft): CourseChainProject {
  const trackNames = draft.tracks
    .map((track) => track.name.trim())
    .filter((name) => name.length > 0);

  return create(CourseChainProjectSchema, {
    versionNumber: CURRENT_SCHEMA_VERSION,
    name: draft.title.trim(),
    terms: draft.terms.map((term) => ({
      name: term.name.trim(),
      start: isoToEpochDay(term.start),
      end: isoToEpochDay(term.end),
      autopopulate: term.autopopulate,
    })),
    tracks: trackNames.map((name, index) => ({ id: index, name })),
    courses: [],
  });
}
