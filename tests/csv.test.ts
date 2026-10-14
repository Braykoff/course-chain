import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import {
  CourseChainProjectSchema,
  CURRENT_SCHEMA_VERSION,
  projectToCsv,
} from "@/lib/project";

function project(courses: { name: string; unitCount: number; termNumber: number; slots: number }[]) {
  return create(CourseChainProjectSchema, {
    versionNumber: CURRENT_SCHEMA_VERSION,
    name: "Plan",
    terms: [
      { name: "Fall 2025", start: 20_000, end: 20_090 },
      { name: "Spring 2026", start: 20_100, end: 20_190 },
    ],
    courses: courses.map((course, i) => ({ id: i + 1, ...course })),
    tracks: [],
  });
}

describe("projectToCsv", () => {
  it("writes a header-only file for a project with no courses", () => {
    expect(projectToCsv(project([]))).toBe("Course,Semester,Units\r\n");
  });

  it("lists each course with its semester and units, ordered by term then slot", () => {
    const csv = projectToCsv(
      project([
        { name: "Math 53", unitCount: 4, termNumber: 1, slots: 0 },
        { name: "CS 61B", unitCount: 4, termNumber: 0, slots: 1 },
        { name: "Math 1A", unitCount: 4, termNumber: 0, slots: 0 },
      ]),
    );
    expect(csv).toBe(
      "Course,Semester,Units\r\n" +
        "Math 1A,Fall 2025,4\r\n" +
        "CS 61B,Fall 2025,4\r\n" +
        "Math 53,Spring 2026,4\r\n",
    );
  });

  it("quotes fields containing commas, quotes, or line breaks", () => {
    const csv = projectToCsv(
      project([{ name: 'Upper div, "H/SS"', unitCount: 3, termNumber: 0, slots: 0 }]),
    );
    expect(csv).toBe('Course,Semester,Units\r\n"Upper div, ""H/SS""",Fall 2025,3\r\n');
  });
});
