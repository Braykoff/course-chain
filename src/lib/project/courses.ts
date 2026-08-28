import { create } from "@bufbuild/protobuf";
import {
  type Course,
  type CourseChainProject,
  CourseSchema,
} from "./schema";

const MS_PER_DAY = 86_400_000;

export interface PrereqInput {
  name: string;
  concurrent: boolean;
}

export interface NewCourseInput {
  name: string;
  unitCount: number;
  comments: string;
  trackIds: number[];
  prereqs: PrereqInput[];
  /** Explicit courses come from the Add Course form; implicit ones are created
   *  automatically for a prereq name that isn't in the project yet. */
  implicit?: boolean;
}

export interface AddCourseResult {
  project: CourseChainProject;
  /** Human-readable notes about placements that had to be forced. */
  warnings: string[];
}

/** Whole days from the Unix epoch to now, UTC. */
export function todayEpochDay(): number {
  return Math.floor(Date.now() / MS_PER_DAY);
}

/** Case-insensitive, trimmed name lookup. */
export function findCourseByName(
  project: CourseChainProject,
  name: string,
): Course | undefined {
  const key = name.trim().toLowerCase();
  return project.courses.find((course) => course.name.trim().toLowerCase() === key);
}

/** Index of the term whose date range is nearest `todayDay` (0 when inside one). */
export function nearestTermIndex(
  project: CourseChainProject,
  todayDay: number,
): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  project.terms.forEach((term, index) => {
    const distance =
      todayDay < term.start
        ? term.start - todayDay
        : todayDay > term.end
          ? todayDay - term.end
          : 0;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

/**
 * Reasons `course` is scheduled inconsistently with its prereq links: a prereq
 * that isn't early enough, or a dependent course that comes too soon. An empty
 * array means the course sits in a valid position.
 */
export function courseConflicts(
  project: CourseChainProject,
  course: Course,
): string[] {
  const byId = new Map(project.courses.map((c) => [c.id, c]));
  const messages: string[] = [];

  course.prereqs.forEach((prereqId, index) => {
    const prereq = byId.get(prereqId);
    if (!prereq) return;
    const concurrent = course.concurrentPrereq[index] ?? false;
    if (prereq.termNumber + (concurrent ? 0 : 1) > course.termNumber) {
      messages.push(
        `Prereq “${prereq.name}” is not scheduled ${concurrent ? "by" : "before"} this term.`,
      );
    }
  });

  for (const dependent of project.courses) {
    const index = dependent.prereqs.indexOf(course.id);
    if (index === -1) continue;
    const concurrent = dependent.concurrentPrereq[index] ?? false;
    if (course.termNumber + (concurrent ? 0 : 1) > dependent.termNumber) {
      messages.push(`“${dependent.name}” depends on this course but is scheduled earlier.`);
    }
  }

  return messages;
}

export function courseHasConflict(
  project: CourseChainProject,
  course: Course,
): boolean {
  return courseConflicts(project, course).length > 0;
}

interface PlacementBounds {
  prereqs: { term: number; concurrent: boolean }[];
  dependents: { term: number; concurrent: boolean }[];
  nearest: number;
}

/**
 * Pick a term index for a course: after its prereqs (same term when the link is
 * concurrent), before its dependents, otherwise the term nearest today. Clamps
 * into range and reports when clamping was needed.
 */
function pickTerm(
  termCount: number,
  bounds: PlacementBounds,
): { term: number; forced: boolean } {
  const lower = bounds.prereqs.length
    ? Math.max(...bounds.prereqs.map((p) => p.term + (p.concurrent ? 0 : 1)))
    : undefined;
  const upper = bounds.dependents.length
    ? Math.min(...bounds.dependents.map((d) => d.term - (d.concurrent ? 0 : 1)))
    : undefined;

  let candidate: number;
  if (lower === undefined && upper === undefined) candidate = bounds.nearest;
  else if (lower !== undefined) candidate = lower;
  else candidate = upper as number;

  const term = Math.min(termCount - 1, Math.max(0, candidate));
  const forced = term !== candidate || (lower !== undefined && upper !== undefined && lower > upper);
  return { term, forced };
}

/**
 * Add a course to a project. Prereq names that don't match an existing course
 * become new implicit courses. Every new course is auto-placed into a term
 * (see {@link pickTerm}); forced placements are returned as `warnings`.
 */
export function addCourse(
  project: CourseChainProject,
  input: NewCourseInput,
  todayDay: number = todayEpochDay(),
): AddCourseResult {
  const termCount = project.terms.length;
  const nearest = nearestTermIndex(project, todayDay);
  const warnings: string[] = [];

  const trimmedName = input.name.trim();
  const nameKey = trimmedName.toLowerCase();
  if (nameKey.length === 0) {
    return { project, warnings: ["Course name must not be blank."] };
  }
  // Course names are unique (case-insensitively). This also stops the "add a
  // course whose name matches an implicit prereq" trick that produced two
  // courses with the same name.
  if (findCourseByName(project, trimmedName)) {
    return {
      project,
      warnings: [`A course named “${trimmedName}” already exists — not added.`],
    };
  }

  let courses = [...project.courses];
  let nextId = courses.reduce((max, course) => Math.max(max, course.id), 0) + 1;

  // Resolve prereqs to ids, creating implicit courses for unknown names. Seeded
  // with the new course's own name so a prereq can't collide with it.
  const prereqIds: number[] = [];
  const concurrentFlags: boolean[] = [];
  const newImplicitIds: number[] = [];
  const seenPrereqNames = new Set<string>([nameKey]);

  for (const prereq of input.prereqs) {
    const name = prereq.name.trim();
    if (name.length === 0) continue;
    const nameKey = name.toLowerCase();
    if (seenPrereqNames.has(nameKey)) continue;
    seenPrereqNames.add(nameKey);
    const existing = findCourseByName({ ...project, courses }, name);
    if (existing) {
      prereqIds.push(existing.id);
    } else {
      const implicit = create(CourseSchema, {
        id: nextId++,
        name,
        implicit: true,
      });
      courses = [...courses, implicit];
      newImplicitIds.push(implicit.id);
      prereqIds.push(implicit.id);
    }
    concurrentFlags.push(prereq.concurrent);
  }

  const course = create(CourseSchema, {
    id: nextId++,
    name: trimmedName,
    unitCount: input.unitCount,
    prereqs: prereqIds,
    concurrentPrereq: concurrentFlags,
    implicit: input.implicit ?? false,
    notes: input.comments,
    tracks: input.trackIds,
  });
  courses = [...courses, course];

  const byId = new Map(courses.map((c) => [c.id, c]));

  // Place the new course relative to its already-placed prereqs.
  const placedPrereqBounds = prereqIds
    .map((id, index) => ({ course: byId.get(id), concurrent: concurrentFlags[index] }))
    .filter(
      (entry): entry is { course: Course; concurrent: boolean } =>
        entry.course !== undefined && !newImplicitIds.includes(entry.course.id),
    )
    .map(({ course: c, concurrent }) => ({ term: c.termNumber, concurrent }));

  const placement = pickTerm(termCount, {
    prereqs: placedPrereqBounds,
    dependents: [],
    nearest,
  });
  course.termNumber = placement.term;
  if (placement.forced) {
    warnings.push(
      `“${course.name}” could not fit after its prereqs — placed in ${project.terms[placement.term].name}.`,
    );
  }

  // Place each new implicit prereq just before the course that needs it.
  for (const id of newImplicitIds) {
    const implicit = byId.get(id);
    if (!implicit) continue;
    const index = course.prereqs.indexOf(id);
    const concurrent = course.concurrentPrereq[index] ?? false;
    const implicitPlacement = pickTerm(termCount, {
      prereqs: [],
      dependents: [{ term: course.termNumber, concurrent }],
      nearest,
    });
    implicit.termNumber = implicitPlacement.term;
    if (implicitPlacement.forced) {
      warnings.push(
        `Implicit prereq “${implicit.name}” could not be placed before “${course.name}” — placed in ${project.terms[implicitPlacement.term].name}.`,
      );
    }
  }

  return { project: { ...project, courses }, warnings };
}

/** Move a course to a different term (used by drag-and-drop). */
export function moveCourseToTerm(
  project: CourseChainProject,
  courseId: number,
  termNumber: number,
): CourseChainProject {
  return {
    ...project,
    courses: project.courses.map((course) =>
      course.id === courseId ? { ...course, termNumber } : course,
    ),
  };
}
