import { create } from "@bufbuild/protobuf";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type CourseChainProject,
  CourseChainProjectSchema,
  CURRENT_SCHEMA_VERSION,
} from "@/lib/project";
import {
  deleteProject,
  hasProject,
  listProjects,
  loadProject,
  saveProject,
} from "@/lib/storage";

function makeProject(id: string, name: string, lastModified: number) {
  return create(CourseChainProjectSchema, {
    versionNumber: CURRENT_SCHEMA_VERSION,
    projectId: id,
    lastModified,
    name,
    terms: [{ name: "Fall 2026", start: 20_000, end: 20_100, autopopulate: false }],
    tracks: [{ id: 0, name: "Theory" }],
    courses: [],
  });
}

function makeRichProject(): CourseChainProject {
  return create(CourseChainProjectSchema, {
    versionNumber: CURRENT_SCHEMA_VERSION,
    projectId: "rich-1",
    lastModified: 12_345,
    name: "Rich Plan",
    terms: [
      { name: "Fall 2026", start: 20_000, end: 20_100, autopopulate: false },
      { name: "Spring 2027", start: 20_100, end: 20_200, autopopulate: true },
    ],
    tracks: [
      { id: 0, name: "Theory" },
      { id: 1, name: "Systems" },
    ],
    courses: [
      { id: 1, name: "CS 61A", unitCount: 4, prereqs: [], termNumber: 0, slots: 0 },
      {
        id: 2,
        name: "CS 61B",
        unitCount: 4,
        prereqs: [1],
        concurrentPrereq: [false],
        termNumber: 1,
        slots: 0,
        tracks: [0, 1],
        notes: "heavy",
      },
    ],
  });
}

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    key: (index: number) => [...store.keys()][index] ?? null,
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("project storage", () => {
  it("round-trips a project through save/load", () => {
    const project = makeProject("id-a", "Plan A", 1000);
    saveProject(project);

    expect(hasProject("id-a")).toBe(true);
    const loaded = loadProject("id-a");
    expect(loaded?.name).toBe("Plan A");
    expect(loaded?.projectId).toBe("id-a");
    expect(loaded?.lastModified).toBe(1000);
    expect(loaded?.tracks[0].name).toBe("Theory");
  });

  it("returns null for a missing id", () => {
    expect(loadProject("nope")).toBeNull();
    expect(hasProject("nope")).toBe(false);
  });

  it("lists projects newest-first with track names", () => {
    saveProject(makeProject("old", "Old", 100));
    saveProject(makeProject("new", "New", 999));
    saveProject(makeProject("mid", "Mid", 500));

    const rows = listProjects();
    expect(rows.map((r) => r.name)).toEqual(["New", "Mid", "Old"]);
    expect(rows[0]).toMatchObject({ projectId: "new", lastModified: 999, trackNames: ["Theory"] });
  });

  it("deletes a project", () => {
    saveProject(makeProject("id-x", "X", 1));
    deleteProject("id-x");
    expect(hasProject("id-x")).toBe(false);
    expect(listProjects()).toEqual([]);
  });

  it("skips corrupt entries when listing", () => {
    saveProject(makeProject("good", "Good", 1));
    localStorage.setItem("coursechain:project:bad", "not base64 protobuf!!!");

    const rows = listProjects();
    expect(rows.map((r) => r.name)).toEqual(["Good"]);
  });

  it("preserves courses, prereqs, tracks and slots through a round trip", () => {
    saveProject(makeRichProject());
    const loaded = loadProject("rich-1");
    expect(loaded).toEqual(makeRichProject());
  });

  it("round-trips a spread project (the shape updateProject writes)", () => {
    const base = makeRichProject();
    const stamped = { ...base, lastModified: 99_999 };
    saveProject(stamped);

    const loaded = loadProject("rich-1");
    expect(loaded?.lastModified).toBe(99_999);
    expect(loaded?.courses).toHaveLength(2);
  });

  it("overwrites an existing id with the latest save", () => {
    saveProject(makeProject("dup", "First", 1));
    saveProject(makeProject("dup", "Second", 2));

    expect(listProjects()).toHaveLength(1);
    expect(loadProject("dup")?.name).toBe("Second");
  });

  it("ignores a project with no project id", () => {
    saveProject(makeProject("", "No id", 1));
    expect(localStorage.getItem("coursechain:project:")).toBeNull();
    expect(listProjects()).toEqual([]);
  });

  it("does nothing when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(() => saveProject(makeProject("x", "X", 1))).not.toThrow();
    expect(loadProject("x")).toBeNull();
    expect(hasProject("x")).toBe(false);
    expect(listProjects()).toEqual([]);
  });
});
