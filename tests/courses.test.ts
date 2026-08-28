import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import {
  addCourse,
  CourseChainProjectSchema,
  courseConflicts,
  courseHasConflict,
  CURRENT_SCHEMA_VERSION,
  courseDependents,
  deleteCourse,
  hasPrereqCycle,
  MAX_SLOT,
  moveCourseToSlot,
  moveCourseToTerm,
  nearestTermIndex,
  type NewCourseInput,
  prereqChain,
  trackPrereqClosure,
  updateCourse,
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

describe("slots", () => {
  const addAll = (names: string[]) =>
    names.reduce(
      (project, name) => addCourse(project, input({ name }), INSIDE_TERM_2).project,
      baseProject(6),
    );

  it("assigns the lowest free slot in the term", () => {
    const project = addAll(["A", "B", "C"]);
    expect(named(project, "A")).toMatchObject({ termNumber: 2, slots: 0 });
    expect(named(project, "B")).toMatchObject({ termNumber: 2, slots: 1 });
    expect(named(project, "C")).toMatchObject({ termNumber: 2, slots: 2 });
  });

  it("gives courses in different terms their own slot 0", () => {
    const { project } = addCourse(
      baseProject(6),
      input({ name: "C", prereqs: [{ name: "MATH 55", concurrent: false }] }),
      INSIDE_TERM_2,
    );
    expect(named(project, "C").slots).toBe(0);
    expect(named(project, "MATH 55").slots).toBe(0);
  });

  it(`rejects a course once a term holds ${MAX_SLOT + 1} of them`, () => {
    let project = baseProject(6);
    for (let i = 0; i <= MAX_SLOT; i++) {
      project = addCourse(project, input({ name: `C${i}` }), INSIDE_TERM_2).project;
    }
    const full = project.courses.filter((c) => c.termNumber === 2);
    expect(full).toHaveLength(MAX_SLOT + 1);

    const result = addCourse(project, input({ name: "overflow" }), INSIDE_TERM_2);
    expect(result.project.courses).toHaveLength(MAX_SLOT + 1);
    expect(result.warnings.join(" ")).toMatch(/is full/);
  });

  it("every add produces a project that passes validateProject", () => {
    expect(() => validateProject(addAll(["A", "B", "C", "D"]))).not.toThrow();
  });
});

describe("moveCourseToSlot", () => {
  const twoInTerm2 = () => {
    const withA = addCourse(baseProject(6), input({ name: "A" }), INSIDE_TERM_2).project;
    return addCourse(withA, input({ name: "B" }), INSIDE_TERM_2).project; // A slot 0, B slot 1
  };

  it("moves a course to an empty slot", () => {
    const moved = moveCourseToSlot(twoInTerm2(), named(twoInTerm2(), "B").id, 5, 3);
    expect(named(moved, "B")).toMatchObject({ termNumber: 5, slots: 3 });
    expect(named(moved, "A")).toMatchObject({ termNumber: 2, slots: 0 });
  });

  it("swaps when the target slot is already taken", () => {
    const project = twoInTerm2();
    const moved = moveCourseToSlot(project, named(project, "A").id, 2, 1); // onto B
    expect(named(moved, "A").slots).toBe(1);
    expect(named(moved, "B").slots).toBe(0); // took A's old spot
    expect(() => validateProject(moved)).not.toThrow();
  });

  it("ignores a slot above the cap", () => {
    const project = twoInTerm2();
    expect(moveCourseToSlot(project, named(project, "A").id, 2, MAX_SLOT + 1)).toBe(project);
  });
});

describe("updateCourse", () => {
  const project = () =>
    addCourse(baseProject(6), input({ name: "A", unitCount: 4 }), INSIDE_TERM_2).project;

  it("edits fields in place without moving the course", () => {
    const start = project();
    const a = named(start, "A");
    const result = updateCourse(
      start,
      a.id,
      input({ name: "A2", unitCount: 3, comments: "note", trackIds: [] }),
      {},
      INSIDE_TERM_2,
    );
    const updated = result.project.courses.find((c) => c.id === a.id)!;
    expect(updated).toMatchObject({
      name: "A2",
      unitCount: 3,
      notes: "note",
      termNumber: a.termNumber,
      slots: a.slots,
    });
  });

  it("rejects a rename that collides with another course", () => {
    const start = addCourse(project(), input({ name: "B" }), INSIDE_TERM_2).project;
    const result = updateCourse(
      start,
      named(start, "A").id,
      input({ name: "b" }),
      {},
      INSIDE_TERM_2,
    );
    expect(result.project).toBe(start);
    expect(result.warnings.join(" ")).toMatch(/already exists/);
  });

  it("promote clears the implicit flag", () => {
    const start = addCourse(
      baseProject(6),
      input({ name: "C", prereqs: [{ name: "MATH 55", concurrent: false }] }),
      INSIDE_TERM_2,
    ).project;
    const implicit = named(start, "MATH 55");
    const result = updateCourse(
      start,
      implicit.id,
      input({ name: "MATH 55", unitCount: 4 }),
      { promote: true },
      INSIDE_TERM_2,
    );
    expect(result.project.courses.find((c) => c.id === implicit.id)?.implicit).toBe(false);
  });

  it("removing a prereq garbage-collects a now-stranded implicit course", () => {
    const start = addCourse(
      baseProject(6),
      input({ name: "C", prereqs: [{ name: "MATH 55", concurrent: false }] }),
      INSIDE_TERM_2,
    ).project;
    expect(named(start, "MATH 55")).toBeDefined();

    const result = updateCourse(
      start,
      named(start, "C").id,
      input({ name: "C", prereqs: [] }),
      {},
      INSIDE_TERM_2,
    );
    expect(result.project.courses.some((c) => c.name === "MATH 55")).toBe(false);
    expect(() => validateProject(result.project)).not.toThrow();
  });

  it("adding a new prereq name creates an implicit course", () => {
    const start = project();
    const result = updateCourse(
      start,
      named(start, "A").id,
      input({ name: "A", prereqs: [{ name: "NEW 1", concurrent: false }] }),
      {},
      INSIDE_TERM_2,
    );
    const implicit = result.project.courses.find((c) => c.name === "NEW 1");
    expect(implicit?.implicit).toBe(true);
    expect(named(result.project, "A").prereqs).toContain(implicit!.id);
  });
});

describe("deleteCourse", () => {
  it("removes the course and strips it from other prereq lists", () => {
    const withA = addCourse(baseProject(6), input({ name: "A" }), INSIDE_TERM_2).project;
    const withB = addCourse(
      withA,
      input({ name: "B", prereqs: [{ name: "A", concurrent: false }] }),
      INSIDE_TERM_2,
    ).project;

    const after = deleteCourse(withB, named(withB, "A").id);
    expect(after.courses.some((c) => c.name === "A")).toBe(false);
    expect(named(after, "B").prereqs).toEqual([]);
    expect(named(after, "B").concurrentPrereq).toEqual([]);
    expect(() => validateProject(after)).not.toThrow();
  });

  it("deleting a real course removes an implicit prereq that only it used", () => {
    const withC = addCourse(
      baseProject(6),
      input({ name: "C", prereqs: [{ name: "MATH 55", concurrent: false }] }),
      INSIDE_TERM_2,
    ).project;

    const after = deleteCourse(withC, named(withC, "C").id);
    expect(after.courses.some((c) => c.name === "MATH 55")).toBe(false);
  });

  it("keeps an implicit prereq that another course still needs", () => {
    let p = baseProject(6);
    p = addCourse(p, input({ name: "C1", prereqs: [{ name: "SHARED", concurrent: false }] }), INSIDE_TERM_2).project;
    p = addCourse(p, input({ name: "C2", prereqs: [{ name: "SHARED", concurrent: false }] }), INSIDE_TERM_2).project;

    const after = deleteCourse(p, named(p, "C1").id);
    expect(after.courses.some((c) => c.name === "SHARED")).toBe(true);
    expect(named(after, "C2").prereqs).toContain(named(after, "SHARED").id);
  });

  it("deleting an implicit course leaves the course that added it", () => {
    const withC = addCourse(
      baseProject(6),
      input({ name: "C", prereqs: [{ name: "MATH 55", concurrent: false }] }),
      INSIDE_TERM_2,
    ).project;

    const after = deleteCourse(withC, named(withC, "MATH 55").id);
    expect(named(after, "C")).toBeDefined();
    expect(named(after, "C").prereqs).toEqual([]);
    expect(after.courses.some((c) => c.name === "MATH 55")).toBe(false);
  });
});

describe("prereqChain", () => {
  it("collects prereqs and dependents transitively in both directions", () => {
    let p = baseProject(6);
    p = addCourse(p, input({ name: "Q" }), INSIDE_TERM_2).project;
    p = addCourse(p, input({ name: "P", prereqs: [{ name: "Q", concurrent: false }] }), INSIDE_TERM_2).project;
    p = addCourse(p, input({ name: "C", prereqs: [{ name: "P", concurrent: false }] }), INSIDE_TERM_2).project;
    p = addCourse(p, input({ name: "D", prereqs: [{ name: "C", concurrent: false }] }), INSIDE_TERM_2).project;
    p = addCourse(p, input({ name: "Unrelated" }), INSIDE_TERM_2).project;

    const chain = prereqChain(p, named(p, "C").id);
    const names = new Set([...chain].map((id) => p.courses.find((c) => c.id === id)!.name));
    expect(names).toEqual(new Set(["Q", "P", "C", "D"]));
  });

  it("returns just the course itself when it has no links", () => {
    const p = addCourse(baseProject(6), input({ name: "Lonely" }), INSIDE_TERM_2).project;
    expect([...prereqChain(p, named(p, "Lonely").id)]).toEqual([named(p, "Lonely").id]);
  });
});

describe("trackPrereqClosure", () => {
  const trackedProject = () => {
    let p = create(CourseChainProjectSchema, {
      versionNumber: CURRENT_SCHEMA_VERSION,
      name: "Plan",
      terms: Array.from({ length: 6 }, (_, i) => ({
        name: `Term ${i}`,
        start: 20_000 + i * 100,
        end: 20_000 + i * 100 + 90,
        autopopulate: false,
      })),
      courses: [],
      tracks: [{ id: 0, name: "Theory" }],
    });
    // BASE  <- MID  <- TOP(track 0)   ;   OFF(track 0, no prereqs)   ;   OTHER (unrelated)
    p = addCourse(p, input({ name: "BASE" }), INSIDE_TERM_2).project;
    p = addCourse(p, input({ name: "MID", prereqs: [{ name: "BASE", concurrent: false }] }), INSIDE_TERM_2).project;
    p = addCourse(
      p,
      input({ name: "TOP", trackIds: [0], prereqs: [{ name: "MID", concurrent: false }] }),
      INSIDE_TERM_2,
    ).project;
    p = addCourse(p, input({ name: "OFF", trackIds: [0] }), INSIDE_TERM_2).project;
    p = addCourse(p, input({ name: "OTHER" }), INSIDE_TERM_2).project;
    return p;
  };

  it("includes track courses and every prereq beneath them", () => {
    const p = trackedProject();
    const ids = trackPrereqClosure(p, 0);
    const names = new Set([...ids].map((id) => p.courses.find((c) => c.id === id)!.name));
    expect(names).toEqual(new Set(["TOP", "MID", "BASE", "OFF"]));
  });

  it("is empty for a track no course uses", () => {
    const p = trackedProject();
    expect([...trackPrereqClosure(p, 99)]).toEqual([]);
  });
});

describe("circular prereqs", () => {
  // BASE <- MID <- TOP  (TOP requires MID requires BASE)
  const chain = () => {
    let p = baseProject(6);
    p = addCourse(p, input({ name: "BASE" }), INSIDE_TERM_2).project;
    p = addCourse(p, input({ name: "MID", prereqs: [{ name: "BASE", concurrent: false }] }), INSIDE_TERM_2).project;
    p = addCourse(p, input({ name: "TOP", prereqs: [{ name: "MID", concurrent: false }] }), INSIDE_TERM_2).project;
    return p;
  };

  it("courseDependents returns transitive dependents", () => {
    const p = chain();
    const deps = courseDependents(p.courses, named(p, "BASE").id);
    const names = new Set([...deps].map((id) => p.courses.find((c) => c.id === id)!.name));
    expect(names).toEqual(new Set(["MID", "TOP"]));
  });

  it("hasPrereqCycle is false for a DAG and true once a loop is closed", () => {
    const p = chain();
    expect(hasPrereqCycle(p.courses)).toBe(false);
    const looped = p.courses.map((c) =>
      c.name === "BASE" ? { ...c, prereqs: [named(p, "TOP").id] } : c,
    );
    expect(hasPrereqCycle(looped)).toBe(true);
  });

  it("updateCourse refuses a prereq that depends on the course", () => {
    const p = chain();
    const result = updateCourse(
      p,
      named(p, "BASE").id,
      input({ name: "BASE", prereqs: [{ name: "TOP", concurrent: false }] }),
      {},
      INSIDE_TERM_2,
    );
    expect(result.project).toBe(p);
    expect(result.warnings.join(" ")).toMatch(/circular/i);
  });
});

describe("autopopulate-aware placement", () => {
  const projectWith = (autopop: boolean[]) =>
    create(CourseChainProjectSchema, {
      versionNumber: CURRENT_SCHEMA_VERSION,
      name: "Plan",
      terms: autopop.map((ap, i) => ({
        name: `Term ${i}`,
        start: 20_000 + i * 100,
        end: 20_000 + i * 100 + 90,
        autopopulate: ap,
      })),
      courses: [],
      tracks: [],
    });

  it("puts a link-free course in the nearest autopopulate term", () => {
    // today is inside term 2, which is off; term 3 is on.
    const p = projectWith([false, false, false, true, false, false]);
    const { project } = addCourse(p, input({ name: "A" }), INSIDE_TERM_2);
    expect(named(project, "A").termNumber).toBe(3);
  });

  it("skips an off term when placing a course after its prereq", () => {
    const p = projectWith([false, false, true, false, true, false]);
    const withP = addCourse(p, input({ name: "P" }), INSIDE_TERM_2).project; // term 2
    const { project } = addCourse(
      withP,
      input({ name: "C", prereqs: [{ name: "P", concurrent: false }] }),
      INSIDE_TERM_2,
    );
    expect(named(project, "P").termNumber).toBe(2);
    expect(named(project, "C").termNumber).toBe(4); // term 3 skipped
  });

  it("falls back to an off term when no on term is available in range", () => {
    const p = projectWith([false, false, true, false]);
    const withP = addCourse(p, input({ name: "P" }), INSIDE_TERM_2).project; // term 2
    const { project } = addCourse(
      withP,
      input({ name: "C", prereqs: [{ name: "P", concurrent: false }] }),
      INSIDE_TERM_2,
    );
    expect(named(project, "C").termNumber).toBe(3); // only the off term is left
  });

  it("places an implicit prereq before its dependent on an autopopulate term", () => {
    const p = projectWith([true, false, false, true, false, false]);
    const { project } = addCourse(
      p,
      input({ name: "C", prereqs: [{ name: "MATH 55", concurrent: false }] }),
      INSIDE_TERM_2,
    );
    expect(named(project, "C").termNumber).toBe(3); // nearest on term from term 2
    expect(named(project, "MATH 55").termNumber).toBe(0); // before C, skipping off 1 & 2
  });

  it("updateCourse places a new implicit prereq on an autopopulate term", () => {
    const p = projectWith([true, false, false, true, true, false]);
    const withX = addCourse(p, input({ name: "X" }), INSIDE_TERM_2).project; // term 3
    const { project } = updateCourse(
      withX,
      named(withX, "X").id,
      input({ name: "X", prereqs: [{ name: "NEW", concurrent: false }] }),
      {},
      INSIDE_TERM_2,
    );
    expect(named(project, "NEW").termNumber).toBe(0);
  });

  it("still works when no term is autopopulate", () => {
    const p = projectWith([false, false, false, false, false, false]);
    const { project } = addCourse(p, input({ name: "A" }), INSIDE_TERM_2);
    expect(named(project, "A").termNumber).toBe(2); // nearest, unchanged
  });
});
