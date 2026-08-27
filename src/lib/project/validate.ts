import {
  type Course,
  type CourseChainProject,
  CURRENT_SCHEMA_VERSION,
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

/**
 * Assert that `project` satisfies the invariants the app relies on, throwing
 * {@link ProjectValidationError} on the first violation. Run by both
 * {@link deserializeProject} and {@link serializeProject}, so a project that
 * fails here is never persisted and never handed to the UI.
 *
 * Checks, in order:
 *  - `versionNumber` equals this build's {@link CURRENT_SCHEMA_VERSION}.
 *  - There is at least one term.
 *  - Every term has `start < end` (Unix epoch days), and each term starts no
 *    earlier than the previous term ends.
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

  const { terms, courses } = project;

  // --- Terms: non-empty, each start < end, non-overlapping in sequence ---
  if (terms.length === 0) {
    throw new ProjectValidationError("project must have at least one term");
  }
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    const label = `term ${i}${term.name ? ` ("${term.name}")` : ""}`;

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
      throw new ProjectValidationError(
        `prereq cycle: ${loop.join(" -> ")}`,
      );
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
