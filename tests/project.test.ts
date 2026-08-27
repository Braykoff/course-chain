import { create, toBinary } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import {
  type CourseChainProject,
  CourseChainProjectSchema,
  CourseSchema,
  CURRENT_SCHEMA_VERSION,
  deserializeProject,
  ProjectValidationError,
  serializeProject,
  TermSchema,
  validateProject,
} from "@/lib/project";

/** A fresh, fully valid project on every call, so tests can mutate it freely. */
function makeValidProject(): CourseChainProject {
  return create(CourseChainProjectSchema, {
    versionNumber: CURRENT_SCHEMA_VERSION,
    name: "Four-Year Plan",
    terms: [
      { start: 19_723, end: 19_843, name: "Fall 2024", autopopulate: false },
      { start: 19_844, end: 19_960, name: "Spring 2025", autopopulate: true },
      // Shares a boundary with the previous term (end === next start), allowed.
      { start: 19_960, end: 20_081, name: "Fall 2025", autopopulate: false },
    ],
    courses: [
      { id: 1, name: "CS 61A", unitCount: 4, prereqs: [], termNumber: 0 },
      { id: 2, name: "CS 61B", unitCount: 4, prereqs: [1], termNumber: 1 },
      { id: 3, name: "CS 70", unitCount: 4, prereqs: [1], termNumber: 1 },
      { id: 4, name: "CS 170", unitCount: 4, prereqs: [2, 3], termNumber: 2 },
    ],
  });
}

const course = (id: number, prereqs: number[]) =>
  create(CourseSchema, { id, name: `c${id}`, unitCount: 3, prereqs, termNumber: 0 });

const term = (start: number, end: number, name: string) =>
  create(TermSchema, { start, end, name, autopopulate: false });

describe("serialize / deserialize round trip", () => {
  it("restores every field of a valid project", () => {
    const original = makeValidProject();

    const restored = deserializeProject(serializeProject(original));

    expect(restored).toEqual(original);
  });

  it("produces a non-empty byte array", () => {
    const bytes = serializeProject(makeValidProject());

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("preserves zero / default values (proto3 omits them on the wire)", () => {
    const original = create(CourseChainProjectSchema, {
      versionNumber: CURRENT_SCHEMA_VERSION,
      name: "",
      terms: [{ start: 0, end: 1, name: "", autopopulate: false }],
      courses: [{ id: 0, name: "", unitCount: 0, prereqs: [], termNumber: 0 }],
    });

    const restored = deserializeProject(serializeProject(original));

    expect(restored.name).toBe("");
    expect(restored.terms[0].start).toBe(0);
    expect(restored.terms[0].autopopulate).toBe(false);
    expect(restored.courses[0].id).toBe(0);
    expect(restored.courses[0].unitCount).toBe(0);
  });

  it("round-trips values larger than 255 (no 8-bit ceiling is enforced)", () => {
    const original = makeValidProject();
    // "CS 170" (index 3) is a leaf: nothing lists it as a prereq.
    original.courses[3].id = 5_000;
    original.courses[3].unitCount = 900;

    const restored = deserializeProject(serializeProject(original));

    expect(restored.courses[3].id).toBe(5_000);
    expect(restored.courses[3].unitCount).toBe(900);
    expect(restored.courses[3].prereqs).toEqual([2, 3]);
  });
});

describe("validateProject accepts", () => {
  it("a fully valid project", () => {
    expect(() => validateProject(makeValidProject())).not.toThrow();
  });

  it("adjacent terms that share a boundary (prev end === next start)", () => {
    const project = makeValidProject();
    project.terms = [term(10, 20, "A"), term(20, 30, "B")];
    project.courses = [];

    expect(() => validateProject(project)).not.toThrow();
  });

  it("a diamond-shaped prereq graph", () => {
    const project = makeValidProject();
    project.courses = [course(1, [2, 3]), course(2, [4]), course(3, [4]), course(4, [])];

    expect(() => validateProject(project)).not.toThrow();
  });

  it("a linear prereq chain", () => {
    const project = makeValidProject();
    project.courses = [course(1, [2]), course(2, [3]), course(3, [])];

    expect(() => validateProject(project)).not.toThrow();
  });

  it("a course with no prereqs", () => {
    const project = makeValidProject();
    project.courses = [course(1, []), course(2, [])];

    expect(() => validateProject(project)).not.toThrow();
  });
});

interface RejectionCase {
  name: string;
  mutate: (project: CourseChainProject) => void;
  message: RegExp;
}

const rejectionCases: RejectionCase[] = [
  {
    name: "version number below the current build",
    mutate: (p) => {
      p.versionNumber = 0;
    },
    message: /schema version mismatch/,
  },
  {
    name: "version number above the current build",
    mutate: (p) => {
      p.versionNumber = CURRENT_SCHEMA_VERSION + 1;
    },
    message: /schema version mismatch/,
  },
  {
    name: "no terms at all",
    mutate: (p) => {
      p.terms = [];
    },
    message: /at least one term/,
  },
  {
    name: "a term whose start equals its end",
    mutate: (p) => {
      p.terms[0].end = p.terms[0].start;
    },
    message: /must be before end/,
  },
  {
    name: "a term whose start is after its end",
    mutate: (p) => {
      p.terms[0].start = p.terms[0].end + 1;
    },
    message: /must be before end/,
  },
  {
    name: "consecutive terms that overlap",
    mutate: (p) => {
      p.terms[1].start = p.terms[0].end - 1;
    },
    message: /before the previous term ends/,
  },
  {
    name: "a negative unit count",
    mutate: (p) => {
      p.courses[0].unitCount = -1;
    },
    message: /unit count must be >= 0/,
  },
  {
    name: "a negative term number",
    mutate: (p) => {
      p.courses[0].termNumber = -1;
    },
    message: /has no matching term/,
  },
  {
    name: "a term number one past the last term",
    mutate: (p) => {
      p.courses[0].termNumber = p.terms.length;
    },
    message: /has no matching term/,
  },
  {
    name: "a term number far out of range",
    mutate: (p) => {
      p.courses[0].termNumber = 99;
    },
    message: /has no matching term/,
  },
  {
    name: "a prereq id with no matching course",
    mutate: (p) => {
      p.courses[0].prereqs = [999];
    },
    message: /prereq 999 has no matching course/,
  },
  {
    name: "a three-course prereq cycle (A -> B -> C -> A)",
    mutate: (p) => {
      p.courses = [course(1, [2]), course(2, [3]), course(3, [1])];
    },
    message: /prereq cycle: 1 -> 2 -> 3 -> 1/,
  },
  {
    name: "a course that lists itself as a prereq",
    mutate: (p) => {
      p.courses = [course(1, [1])];
    },
    message: /prereq cycle: 1 -> 1/,
  },
  {
    name: "a two-course prereq cycle (A <-> B)",
    mutate: (p) => {
      p.courses = [course(1, [2]), course(2, [1])];
    },
    message: /prereq cycle: 1 -> 2 -> 1/,
  },
];

describe("validateProject rejects", () => {
  it.each(rejectionCases)("$name", ({ mutate, message }) => {
    const project = makeValidProject();
    mutate(project);

    expect(() => validateProject(project)).toThrow(ProjectValidationError);
    expect(() => validateProject(project)).toThrow(message);
  });
});

describe("serialize / deserialize enforce validation", () => {
  it("serializeProject refuses to encode an invalid project", () => {
    const project = makeValidProject();
    project.terms = [];

    expect(() => serializeProject(project)).toThrow(ProjectValidationError);
  });

  it("deserializeProject rejects bytes that decode to an invalid project", () => {
    const invalid = makeValidProject();
    invalid.courses[0].prereqs = [999];
    // Encode directly, bypassing serializeProject's validation.
    const bytes = toBinary(CourseChainProjectSchema, invalid);

    expect(() => deserializeProject(bytes)).toThrow(ProjectValidationError);
  });
});
