import { create } from "@bufbuild/protobuf";
import {
  type Course,
  type CourseChainProject,
  CourseSchema,
  MAX_SLOT,
} from "./schema";

const MS_PER_DAY = 86_400_000;

export interface PrereqInput {
  name: string;
  concurrent: boolean;
}

/** The editable fields of a course — what the course form produces. */
export interface NewCourseInput {
  name: string;
  unitCount: number;
  comments: string;
  trackIds: number[];
  prereqs: PrereqInput[];
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

/** Whole seconds since the Unix epoch (for `CourseChainProject.lastModified`). */
export function nowEpochSeconds(): number {
  return Math.floor(Date.now() / 1000);
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

/**
 * Every course reachable from `courseId` by following prereq links in either
 * direction — its prereqs (and theirs), and the courses that require it (and
 * theirs), to any depth. Includes `courseId` itself.
 */
export function prereqChain(
  project: CourseChainProject,
  courseId: number,
): Set<number> {
  const byId = new Map(project.courses.map((c) => [c.id, c]));
  const dependents = new Map<number, number[]>();
  for (const course of project.courses) {
    for (const prereqId of course.prereqs) {
      const list = dependents.get(prereqId);
      if (list) list.push(course.id);
      else dependents.set(prereqId, [course.id]);
    }
  }

  const chain = new Set<number>();
  const stack = [courseId];
  while (stack.length > 0) {
    const id = stack.pop() as number;
    if (chain.has(id)) continue;
    chain.add(id);
    for (const prereqId of byId.get(id)?.prereqs ?? []) stack.push(prereqId);
    for (const dependentId of dependents.get(id) ?? []) stack.push(dependentId);
  }
  return chain;
}

/**
 * Every course that counts toward `trackId`, plus every course that is a prereq
 * (to any depth) of one of them.
 */
export function trackPrereqClosure(
  project: CourseChainProject,
  trackId: number,
): Set<number> {
  const byId = new Map(project.courses.map((c) => [c.id, c]));
  const set = new Set<number>();
  const stack: number[] = [];
  for (const course of project.courses) {
    if (course.tracks.includes(trackId)) {
      set.add(course.id);
      stack.push(course.id);
    }
  }
  while (stack.length > 0) {
    const id = stack.pop() as number;
    for (const prereqId of byId.get(id)?.prereqs ?? []) {
      if (!set.has(prereqId)) {
        set.add(prereqId);
        stack.push(prereqId);
      }
    }
  }
  return set;
}

/** Every course that requires `courseId`, directly or transitively. */
export function courseDependents(courses: Course[], courseId: number): Set<number> {
  const dependents = new Map<number, number[]>();
  for (const course of courses) {
    for (const prereqId of course.prereqs) {
      const list = dependents.get(prereqId);
      if (list) list.push(course.id);
      else dependents.set(prereqId, [course.id]);
    }
  }
  const result = new Set<number>();
  const stack = [...(dependents.get(courseId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop() as number;
    if (result.has(id)) continue;
    result.add(id);
    for (const dependentId of dependents.get(id) ?? []) stack.push(dependentId);
  }
  return result;
}

/** True if the prereq graph over `courses` contains a directed cycle. */
export function hasPrereqCycle(courses: Course[]): boolean {
  const prereqsById = new Map(courses.map((c) => [c.id, c.prereqs]));
  const state = new Map<number, "visiting" | "done">();

  const visit = (id: number): boolean => {
    const s = state.get(id);
    if (s === "done") return false;
    if (s === "visiting") return true;
    state.set(id, "visiting");
    for (const prereqId of prereqsById.get(id) ?? []) {
      if (visit(prereqId)) return true;
    }
    state.set(id, "done");
    return false;
  };

  return courses.some((course) => visit(course.id));
}

interface PlacementBounds {
  prereqs: { term: number; concurrent: boolean }[];
  dependents: { term: number; concurrent: boolean }[];
  nearest: number;
}

/**
 * Pick a term index for a course: after its prereqs (same term when the link is
 * concurrent), before its dependents, otherwise the term nearest today. Terms
 * with `autopopulate` off are skipped when a suitable one with it on is
 * reachable within the allowed window. Clamps into range and reports when
 * clamping was needed.
 */
function pickTerm(
  autopopulate: boolean[],
  bounds: PlacementBounds,
): { term: number; forced: boolean } {
  const termCount = autopopulate.length;
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

  if (autopopulate[term]) return { term, forced };

  // Prefer an autopopulate term. Stay within the window the prereq/dependent
  // links allow; search toward later terms when the course has prereqs (right
  // after them), toward earlier terms when the course is itself a prereq, and
  // outward from the anchor otherwise.
  const lo = Math.max(0, lower ?? 0);
  const hi = Math.min(termCount - 1, upper ?? termCount - 1);
  const inWindow = (t: number) => t >= lo && t <= hi && autopopulate[t];

  if (lower !== undefined) {
    for (let t = term; t <= hi; t += 1) if (inWindow(t)) return { term: t, forced };
  } else if (upper !== undefined) {
    for (let t = term; t >= lo; t -= 1) if (inWindow(t)) return { term: t, forced };
  } else {
    for (let d = 1; d < termCount; d += 1) {
      if (inWindow(term - d)) return { term: term - d, forced };
      if (inWindow(term + d)) return { term: term + d, forced };
    }
  }

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
  const autopopulate = project.terms.map((term) => term.autopopulate);
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
    implicit: false,
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

  const placement = pickTerm(autopopulate, {
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
    const implicitPlacement = pickTerm(autopopulate, {
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

  // Assign each new course the lowest free slot in its term. If a term is full
  // (every slot 0..MAX_SLOT taken) the whole add is rejected.
  const takenSlots = new Map<number, Set<number>>();
  const slotsOf = (term: number): Set<number> => {
    let set = takenSlots.get(term);
    if (!set) {
      set = new Set();
      takenSlots.set(term, set);
    }
    return set;
  };
  for (const c of project.courses) slotsOf(c.termNumber).add(c.slots);

  for (const id of [...newImplicitIds, course.id]) {
    const c = byId.get(id);
    if (!c) continue;
    const used = slotsOf(c.termNumber);
    let slot = 0;
    while (used.has(slot)) slot += 1;
    if (slot > MAX_SLOT) {
      return {
        project,
        warnings: [
          `${project.terms[c.termNumber].name} is full — it already holds ${MAX_SLOT + 1} courses.`,
        ],
      };
    }
    c.slots = slot;
    used.add(slot);
  }

  return { project: { ...project, courses }, warnings };
}

/** Lowest-free-slot picker for a term, seeded from `existing` courses. */
function makeSlotAssigner(existing: Course[]): (term: number) => number | null {
  const taken = new Map<number, Set<number>>();
  const slotsOf = (term: number): Set<number> => {
    let set = taken.get(term);
    if (!set) {
      set = new Set();
      taken.set(term, set);
    }
    return set;
  };
  for (const c of existing) slotsOf(c.termNumber).add(c.slots);
  return (term: number): number | null => {
    const set = slotsOf(term);
    let slot = 0;
    while (set.has(slot)) slot += 1;
    if (slot > MAX_SLOT) return null;
    set.add(slot);
    return slot;
  };
}

/** Drop implicit courses that no course lists as a prereq (repeatedly). */
function gcStrandedImplicits(courses: Course[]): Course[] {
  let result = courses;
  for (;;) {
    const referenced = new Set(result.flatMap((c) => c.prereqs));
    const kept = result.filter((c) => !c.implicit || referenced.has(c.id));
    if (kept.length === result.length) return result;
    result = kept;
  }
}

/**
 * Save edits to an existing course. Unlike {@link addCourse} this never moves
 * the course — its term and slot are left alone. New prereq names still spawn
 * implicit courses; a prereq removed here may leave an implicit course stranded,
 * in which case it is deleted. Pass `promote` to also clear the implicit flag
 * (turning an auto-created prereq into a real course).
 */
export function updateCourse(
  project: CourseChainProject,
  courseId: number,
  input: NewCourseInput,
  options: { promote?: boolean } = {},
  todayDay: number = todayEpochDay(),
): AddCourseResult {
  const target = project.courses.find((c) => c.id === courseId);
  if (!target) return { project, warnings: [] };

  const trimmedName = input.name.trim();
  const nameKey = trimmedName.toLowerCase();
  if (nameKey.length === 0) {
    return { project, warnings: ["Course name must not be blank."] };
  }
  if (
    project.courses.some(
      (c) => c.id !== courseId && c.name.trim().toLowerCase() === nameKey,
    )
  ) {
    return {
      project,
      warnings: [`A course named “${trimmedName}” already exists — not saved.`],
    };
  }

  const autopopulate = project.terms.map((term) => term.autopopulate);
  const nearest = nearestTermIndex(project, todayDay);
  const warnings: string[] = [];

  let courses = [...project.courses];
  let nextId = courses.reduce((max, c) => Math.max(max, c.id), 0) + 1;

  const prereqIds: number[] = [];
  const concurrentFlags: boolean[] = [];
  const newImplicitIds: number[] = [];
  const seen = new Set<string>([nameKey]);

  for (const prereq of input.prereqs) {
    const name = prereq.name.trim();
    if (name.length === 0) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const found = findCourseByName({ ...project, courses }, name);
    if (found && found.id !== courseId) {
      prereqIds.push(found.id);
    } else if (!found) {
      const implicit = create(CourseSchema, { id: nextId++, name, implicit: true });
      courses = [...courses, implicit];
      newImplicitIds.push(implicit.id);
      prereqIds.push(implicit.id);
    } else {
      continue; // matched the course itself
    }
    concurrentFlags.push(prereq.concurrent);
  }

  courses = courses.map((c) =>
    c.id === courseId
      ? {
          ...c,
          name: trimmedName,
          unitCount: input.unitCount,
          notes: input.comments,
          tracks: [...input.trackIds],
          prereqs: prereqIds,
          concurrentPrereq: concurrentFlags,
          implicit: options.promote ? false : c.implicit,
        }
      : c,
  );

  if (hasPrereqCycle(courses)) {
    return {
      project,
      warnings: ["Those prereqs would create a circular dependency — not saved."],
    };
  }

  const updated = courses.find((c) => c.id === courseId);
  if (updated && newImplicitIds.length > 0) {
    const assignSlot = makeSlotAssigner(
      courses.filter((c) => !newImplicitIds.includes(c.id)),
    );
    for (const id of newImplicitIds) {
      const implicit = courses.find((c) => c.id === id);
      if (!implicit) continue;
      const index = updated.prereqs.indexOf(id);
      const concurrent = updated.concurrentPrereq[index] ?? false;
      const placement = pickTerm(autopopulate, {
        prereqs: [],
        dependents: [{ term: updated.termNumber, concurrent }],
        nearest,
      });
      implicit.termNumber = placement.term;
      const slot = assignSlot(placement.term);
      if (slot === null) {
        return {
          project,
          warnings: [
            `${project.terms[placement.term].name} is full — cannot add prereq “${implicit.name}”.`,
          ],
        };
      }
      implicit.slots = slot;
      if (placement.forced) {
        warnings.push(
          `Prereq “${implicit.name}” could not be placed before “${trimmedName}” — placed in ${project.terms[placement.term].name}.`,
        );
      }
    }
  }

  courses = gcStrandedImplicits(courses);

  return { project: { ...project, courses }, warnings };
}

/**
 * Remove a course from the project: off the schedule and out of every prereq
 * list. Any implicit course left with no dependents is removed too, so nothing
 * is stranded. The course(s) that referenced a deleted implicit prereq are
 * kept.
 */
export function deleteCourse(
  project: CourseChainProject,
  courseId: number,
): CourseChainProject {
  let courses = project.courses
    .filter((c) => c.id !== courseId)
    .map((c) => {
      if (!c.prereqs.includes(courseId)) return c;
      const prereqs: number[] = [];
      const concurrentPrereq: boolean[] = [];
      c.prereqs.forEach((pid, i) => {
        if (pid !== courseId) {
          prereqs.push(pid);
          concurrentPrereq.push(c.concurrentPrereq[i] ?? false);
        }
      });
      return { ...c, prereqs, concurrentPrereq };
    });
  courses = gcStrandedImplicits(courses);
  return { ...project, courses };
}

/**
 * Move a course to a term, taking the lowest free slot there (keeping its
 * current slot if that one is free).
 */
export function moveCourseToTerm(
  project: CourseChainProject,
  courseId: number,
  termNumber: number,
): CourseChainProject {
  const moving = project.courses.find((course) => course.id === courseId);
  if (!moving) return project;

  const taken = new Set(
    project.courses
      .filter((course) => course.id !== courseId && course.termNumber === termNumber)
      .map((course) => course.slots),
  );
  let slot = taken.has(moving.slots) ? 0 : moving.slots;
  while (taken.has(slot)) slot += 1;
  if (slot > MAX_SLOT) return project;

  return {
    ...project,
    courses: project.courses.map((course) =>
      course.id === courseId ? { ...course, termNumber, slots: slot } : course,
    ),
  };
}

/**
 * Move a course to an exact term + slot. If another course already sits there,
 * the two swap positions so no slot is ever double-booked.
 */
export function moveCourseToSlot(
  project: CourseChainProject,
  courseId: number,
  termNumber: number,
  slot: number,
): CourseChainProject {
  if (slot < 0 || slot > MAX_SLOT) return project;
  const moving = project.courses.find((course) => course.id === courseId);
  if (!moving) return project;
  if (moving.termNumber === termNumber && moving.slots === slot) return project;

  const occupant = project.courses.find(
    (course) =>
      course.id !== courseId && course.termNumber === termNumber && course.slots === slot,
  );

  return {
    ...project,
    courses: project.courses.map((course) => {
      if (course.id === courseId) return { ...course, termNumber, slots: slot };
      if (occupant && course.id === occupant.id) {
        return { ...course, termNumber: moving.termNumber, slots: moving.slots };
      }
      return course;
    }),
  };
}
