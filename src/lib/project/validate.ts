import {
  type Course,
  type CourseChainProject,
  CURRENT_SCHEMA_VERSION,
  MAX_PROJECT_NAME_LENGTH,
  MAX_TERM_NAME_LENGTH,
  MAX_TERMS,
  MAX_TRACK_NAME_LENGTH,
  MAX_TRACKS,
} from "./schema";

/** Thrown by {@link validateProject} when a project breaks a structural rule. */
export class ProjectValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectValidationError";
  }
}

function courseLabel(course: Course): string {
  return `course ${course.id}${course.name ? ` ("${course.name}")` : ""}`;
}

/** A string is "blank" if it is empty or only whitespace. */
function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

/**
 * Assert that `project` satisfies the invariants the app relies on, throwing
 * {@link ProjectValidationError} on the first violation. Run by both
 * {@link deserializeProject} and {@link serializeProject}, so a project that
 * fails here is never persisted and never handed to the UI.
 *
 * Checks, in order:
 *  - `versionNumber` equals this build's {@link CURRENT_SCHEMA_VERSION}.
 *  - Project name is non-blank and at most {@link MAX_PROJECT_NAME_LENGTH} chars.
 *  - There is at least one term and no more than {@link MAX_TERMS}.
 *  - Every term name is non-blank, at most {@link MAX_TERM_NAME_LENGTH} chars,
 *    and unique (compared trimmed).
 *  - Every term has `start < end` (Unix epoch days), and each term starts no
 *    earlier than the previous term ends.
 *  - There are no more than {@link MAX_TRACKS} tracks.
 *  - Every track name is non-blank, at most {@link MAX_TRACK_NAME_LENGTH} chars,
 *    and unique (compared trimmed).
 *  - Every course's `unitCount` is >= 0.
 *  - Every course's `termNumber` is >= 0 and indexes a real term
 *    (`< terms.length`).
 *  - Every prereq id refers to a course that exists in this project.
 *  - The prereq graph has no cycles (no course transitively requires itself).
 */
export function validateProject(project: CourseChainProject): void {
  // Version must match this build exactly.
  if (project.versionNumber !== CURRENT_SCHEMA_VERSION) {
    throw new ProjectValidationError(
      `schema version mismatch: document is v${project.versionNumber}, ` +
        `this build reads v${CURRENT_SCHEMA_VERSION}`,
    );
  }

  const { terms, courses, tracks } = project;

  if (isBlank(project.name)) {
    throw new ProjectValidationError("project name must not be blank");
  }
  if (project.name.trim().length > MAX_PROJECT_NAME_LENGTH) {
    throw new ProjectValidationError(
      `project name must be at most ${MAX_PROJECT_NAME_LENGTH} characters`,
    );
  }

  // --- Terms: count, unique non-blank names, ordered non-overlapping dates ---
  if (terms.length === 0) {
    throw new ProjectValidationError("project must have at least one term");
  }
  if (terms.length > MAX_TERMS) {
    throw new ProjectValidationError(
      `project has ${terms.length} terms; the maximum is ${MAX_TERMS}`,
    );
  }
  const termNames = new Set<string>();
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    const label = `term ${i}${term.name ? ` ("${term.name}")` : ""}`;

    if (isBlank(term.name)) {
      throw new ProjectValidationError(`term ${i}: name must not be blank`);
    }
    if (term.name.trim().length > MAX_TERM_NAME_LENGTH) {
      throw new ProjectValidationError(
        `term ${i}: name must be at most ${MAX_TERM_NAME_LENGTH} characters`,
      );
    }
    const key = term.name.trim();
    if (termNames.has(key)) {
      throw new ProjectValidationError(`duplicate term name "${key}"`);
    }
    termNames.add(key);

    if (term.start >= term.end) {
      throw new ProjectValidationError(
        `${label}: start (${term.start}) must be before end (${term.end})`,
      );
    }
    if (i > 0 && terms[i - 1].end > term.start) {
      throw new ProjectValidationError(
        `${label}: starts at day ${term.start}, before the previous term ends ` +
          `at day ${terms[i - 1].end}`,
      );
    }
  }

  // --- Tracks: count, unique non-blank names ---
  if (tracks.length > MAX_TRACKS) {
    throw new ProjectValidationError(
      `project has ${tracks.length} tracks; the maximum is ${MAX_TRACKS}`,
    );
  }
  const trackNames = new Set<string>();
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    if (isBlank(track.name)) {
      throw new ProjectValidationError(`track ${i}: name must not be blank`);
    }
    if (track.name.trim().length > MAX_TRACK_NAME_LENGTH) {
      throw new ProjectValidationError(
        `track ${i}: name must be at most ${MAX_TRACK_NAME_LENGTH} characters`,
      );
    }
    const key = track.name.trim();
    if (trackNames.has(key)) {
      throw new ProjectValidationError(`duplicate track name "${key}"`);
    }
    trackNames.add(key);
  }

  // --- Courses: unit/term numbers make sense, prereqs resolve ---
  const courseIds = new Set(courses.map((course) => course.id));
  for (const course of courses) {
    const label = courseLabel(course);

    if (course.unitCount < 0) {
      throw new ProjectValidationError(`${label}: unit count must be >= 0`);
    }
    if (course.termNumber < 0 || course.termNumber >= terms.length) {
      throw new ProjectValidationError(
        `${label}: term number ${course.termNumber} has no matching term ` +
          `(project has ${terms.length})`,
      );
    }
    for (const prereqId of course.prereqs) {
      if (!courseIds.has(prereqId)) {
        throw new ProjectValidationError(
          `${label}: prereq ${prereqId} has no matching course`,
        );
      }
    }
  }

  // --- Prereqs must form a DAG: no course may transitively require itself ---
  // Every prereq id resolves to a real course by this point. Depth-first walk
  // with a "visiting" marker; re-entering a node that's still on the current
  // path is a back edge, i.e. a cycle.
  const prereqsById = new Map(courses.map((course) => [course.id, course.prereqs]));
  const walkState = new Map<number, "visiting" | "done">();
  const path: number[] = [];

  const walk = (id: number): void => {
    const state = walkState.get(id);
    if (state === "done") return;
    if (state === "visiting") {
      const loop = [...path.slice(path.indexOf(id)), id];
      throw new ProjectValidationError(`prereq cycle: ${loop.join(" -> ")}`);
    }

    walkState.set(id, "visiting");
    path.push(id);
    for (const prereqId of prereqsById.get(id) ?? []) {
      walk(prereqId);
    }
    path.pop();
    walkState.set(id, "done");
  };

  for (const course of courses) {
    walk(course.id);
  }
}
