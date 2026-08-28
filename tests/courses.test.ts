import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import {
  addCourse,
  CourseChainProjectSchema,
  courseConflicts,
  courseHasConflict,
  CURRENT_SCHEMA_VERSION,
  moveCourseToTerm,
  nearestTermIndex,
  type NewCourseInput,
  validateProject,
} from "@/lib/project";

// Term i spans epoch days [20000 + 100i, 20000 + 100i + 90].
function baseProject(termCount: number) {
  return create(CourseChainProjectSchema, {
    versionNumber: CURRENT_SCHEMA_VERSION,
    name: "Plan",
    terms: Array.from({ length: termCount }, (_, i) => ({
      name: `Term ${i}`,
      start: 20_000 + i * 100,
      end: 20_000 + i * 100 + 90,
      autopopulate: false,
    })),
    courses: [],
    tracks: [],
  });
}

const INSIDE_TERM_2 = 20_250;

const input = (over: Partial<NewCourseInput>): NewCourseInput => ({
  name: "Course",
  unitCount: 4,
  comments: "",
  trackIds: [],
  prereqs: [],
  ...over,
});

const named = (project: ReturnType<typeof baseProject>, name: string) =>
  project.courses.find((c) => c.name === name)!;

describe("nearestTermIndex", () => {
  it("returns the term containing the day", () => {
    expect(nearestTermIndex(baseProject(6), INSIDE_TERM_2)).toBe(2);
  });

  it("clamps to the first term before the calendar and the last term after it", () => {
    expect(nearestTermIndex(baseProject(6), 0)).toBe(0);
    expect(nearestTermIndex(baseProject(6), 999_999)).toBe(5);
  });
});

describe("addCourse — placement", () => {
  it("puts a course with no links in the term nearest today", () => {
    const { project, warnings } = addCourse(baseProject(6), input({ name: "A" }), INSIDE_TERM_2);
    expect(project.courses).toHaveLength(1);
    expect(named(project, "A")).toMatchObject({ termNumber: 2, implicit: false });
    expect(warnings).toEqual([]);
  });

  it("puts a course one term after a non-concurrent prereq", () => {
    const withP = addCourse(baseProject(6), input({ name: "P" }), INSIDE_TERM_2).project;
    const { project } = addCourse(
      withP,
      input({ name: "C", prereqs: [{ name: "P", concurrent: false }] }),
      INSIDE_TERM_2,
    );
    expect(named(project, "P").termNumber).toBe(2);
    expect(named(project, "C").termNumber).toBe(3);
  });

  it("puts a course in the same term as a concurrent prereq", () => {
    const withP = addCourse(baseProject(6), input({ name: "P" }), INSIDE_TERM_2).project;
    const { project } = addCourse(
      withP,
      input({ name: "C", prereqs: [{ name: "P", concurrent: true }] }),
      INSIDE_TERM_2,
    );
    expect(named(project, "C").termNumber).toBe(2);
  });

  it("forces into the last term and warns when the prereq order overflows", () => {
    // today after the calendar -> P lands in the last term (index 5).
    const withP = addCourse(baseProject(6), input({ name: "P" }), 999_999).project;
    const { project, warnings } = addCourse(
      withP,
      input({ name: "C", prereqs: [{ name: "P", concurrent: false }] }),
      999_999,
    );
    expect(named(project, "C").termNumber).toBe(5);
    expect(warnings.join(" ")).toMatch(/could not fit/);
  });
});

describe("addCourse — implicit prereqs", () => {
  it("creates an implicit course for an unknown prereq name and places it earlier", () => {
    const { project } = addCourse(
      baseProject(6),
      input({ name: "C", prereqs: [{ name: "MATH 55", concurrent: false }] }),
      INSIDE_TERM_2,
    );
    const implicit = named(project, "MATH 55");
    const course = named(project, "C");
    expect(implicit.implicit).toBe(true);
    expect(course.prereqs).toEqual([implicit.id]);
    expect(course.termNumber).toBe(2);
    expect(implicit.termNumber).toBe(1);
  });

  it("reuses an existing course (case-insensitively) instead of creating an implicit one", () => {
    const withMath = addCourse(baseProject(6), input({ name: "Math 54" }), INSIDE_TERM_2).project;
    const { project } = addCourse(
      withMath,
      input({ name: "C", prereqs: [{ name: "MATH 54", concurrent: false }] }),
      INSIDE_TERM_2,
    );
    expect(project.courses.filter((c) => c.name.toLowerCase() === "math 54")).toHaveLength(1);
    expect(named(project, "C").prereqs).toEqual([named(project, "Math 54").id]);
  });

  it("ignores a prereq whose name matches the new course (no duplicate name)", () => {
    const { project } = addCourse(
      baseProject(6),
      input({ name: "FOO", prereqs: [{ name: "foo", concurrent: false }] }),
      INSIDE_TERM_2,
    );
    expect(project.courses).toHaveLength(1);
    expect(project.courses[0]).toMatchObject({ name: "FOO", implicit: false });
    expect(project.courses[0].prereqs).toEqual([]);
  });

  it("refuses to add a course whose name already exists, case-insensitively", () => {
    const withA = addCourse(baseProject(6), input({ name: "Math 54" }), INSIDE_TERM_2).project;
    const result = addCourse(withA, input({ name: "MATH 54" }), INSIDE_TERM_2);
    expect(result.project).toBe(withA);
    expect(result.project.courses).toHaveLength(1);
    expect(result.warnings.join(" ")).toMatch(/already exists/);
  });

  it("de-duplicates repeated prereq names", () => {
    const { project } = addCourse(
      baseProject(6),
      input({
        name: "C",
        prereqs: [
          { name: "DUP", concurrent: false },
          { name: "dup", concurrent: true },
        ],
      }),
      INSIDE_TERM_2,
    );
    expect(project.courses.filter((c) => c.name === "DUP")).toHaveLength(1);
    expect(named(project, "C").prereqs).toHaveLength(1);
  });

  it("produces a project that passes validateProject", () => {
    const { project } = addCourse(
      baseProject(6),
      input({ name: "C", prereqs: [{ name: "MATH 55", concurrent: false }] }),
      INSIDE_TERM_2,
    );
    expect(() => validateProject(project)).not.toThrow();
  });
});

describe("courseConflicts", () => {
  it("flags a course scheduled before its prereq, and clears after a move", () => {
    const withP = addCourse(baseProject(6), input({ name: "P" }), INSIDE_TERM_2).project; // term 2
    const added = addCourse(
      withP,
      input({ name: "C", prereqs: [{ name: "P", concurrent: false }] }),
      INSIDE_TERM_2,
    ).project; // C in term 3, valid

    const conflicted = moveCourseToTerm(added, named(added, "C").id, 1); // before P
    expect(courseHasConflict(conflicted, named(conflicted, "C"))).toBe(true);
    expect(courseHasConflict(conflicted, named(conflicted, "P"))).toBe(true);
    expect(courseConflicts(conflicted, named(conflicted, "C"))[0]).toMatch(/Prereq/);

    const fixed = moveCourseToTerm(conflicted, named(conflicted, "C").id, 4);
    expect(courseHasConflict(fixed, named(fixed, "C"))).toBe(false);
  });
});

describe("moveCourseToTerm", () => {
  it("changes only the target course's term", () => {
    const start = addCourse(baseProject(6), input({ name: "A" }), INSIDE_TERM_2).project;
    const withB = addCourse(start, input({ name: "B" }), INSIDE_TERM_2).project;

    const moved = moveCourseToTerm(withB, named(withB, "A").id, 5);
    expect(named(moved, "A").termNumber).toBe(5);
    expect(named(moved, "B").termNumber).toBe(2);
    expect(moved).not.toBe(withB);
  });
});
