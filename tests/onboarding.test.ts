import { describe, expect, it } from "vitest";
import {
  MAX_PROJECT_NAME_LENGTH,
  MAX_TERM_NAME_LENGTH,
  MAX_TERMS,
  MAX_TRACK_NAME_LENGTH,
  MAX_TRACKS,
  validateProject,
} from "@/lib/project";
import {
  buildTemplateTerms,
  draftToProject,
  emptyDraft,
  isoToEpochDay,
  makeDraftTerm,
  makeDraftTrack,
  type NewProjectDraft,
  type TemplateId,
  TEMPLATE_OPTIONS,
  validateDraft,
} from "@/lib/onboarding";

function validDraft(): NewProjectDraft {
  return {
    title: "My Plan",
    terms: [
      makeDraftTerm({ name: "Fall 2026", start: "2026-08-25", end: "2026-12-15", autopopulate: true }),
      makeDraftTerm({ name: "Spring 2027", start: "2027-01-12", end: "2027-05-10", autopopulate: true }),
    ],
    tracks: [makeDraftTrack("Biology major"), makeDraftTrack("")],
  };
}

const draftWithTerms = (terms: NewProjectDraft["terms"]): NewProjectDraft => ({
  title: "x",
  terms,
  tracks: [],
});

describe("validateDraft", () => {
  it("accepts a well-formed draft (a trailing blank track is ignored)", () => {
    expect(validateDraft(validDraft())).toEqual([]);
  });

  it("rejects the blank starting draft", () => {
    expect(validateDraft(emptyDraft()).length).toBeGreaterThan(0);
  });

  it.each([
    ["", "empty"],
    ["   ", "whitespace"],
  ])("rejects a %s project name (%s)", (title) => {
    const draft = { ...validDraft(), title };
    expect(validateDraft(draft)).toContain("Project name must not be blank.");
  });

  it("rejects zero terms", () => {
    expect(validateDraft(draftWithTerms([]))).toContain("Add at least one term.");
  });

  it(`rejects more than ${MAX_TERMS} terms`, () => {
    const terms = Array.from({ length: MAX_TERMS + 1 }, (_, i) =>
      makeDraftTerm({
        name: `T${i}`,
        start: `20${String(i).padStart(2, "0")}-01-01`,
        end: `20${String(i).padStart(2, "0")}-02-01`,
      }),
    );
    expect(validateDraft(draftWithTerms(terms)).join("\n")).toMatch(/maximum is 100/);
  });

  it("rejects a blank term name", () => {
    const draft = validDraft();
    draft.terms[0].name = "   ";
    expect(validateDraft(draft)).toContain("Term 1: name must not be blank.");
  });

  it(`rejects a project name longer than ${MAX_PROJECT_NAME_LENGTH} characters`, () => {
    const draft = { ...validDraft(), title: "x".repeat(MAX_PROJECT_NAME_LENGTH + 1) };
    expect(validateDraft(draft)).toContain(
      `Project name must be at most ${MAX_PROJECT_NAME_LENGTH} characters.`,
    );
  });

  it(`rejects a term name longer than ${MAX_TERM_NAME_LENGTH} characters`, () => {
    const draft = validDraft();
    draft.terms[0].name = "x".repeat(MAX_TERM_NAME_LENGTH + 1);
    expect(validateDraft(draft)).toContain(
      `Term 1: name must be at most ${MAX_TERM_NAME_LENGTH} characters.`,
    );
  });

  it(`rejects a track name longer than ${MAX_TRACK_NAME_LENGTH} characters`, () => {
    const draft = validDraft();
    draft.tracks = [makeDraftTrack("x".repeat(MAX_TRACK_NAME_LENGTH + 1))];
    expect(validateDraft(draft).join("\n")).toMatch(/name must be at most 100 characters/);
  });

  it("accepts names exactly at their maximum length", () => {
    const draft: NewProjectDraft = {
      title: "P".repeat(MAX_PROJECT_NAME_LENGTH),
      terms: [
        makeDraftTerm({
          name: "T".repeat(MAX_TERM_NAME_LENGTH),
          start: "2026-08-25",
          end: "2026-12-15",
        }),
      ],
      tracks: [makeDraftTrack("K".repeat(MAX_TRACK_NAME_LENGTH))],
    };
    expect(validateDraft(draft)).toEqual([]);
  });

  it("rejects duplicate term names", () => {
    const draft = validDraft();
    draft.terms[1].name = draft.terms[0].name;
    expect(validateDraft(draft)).toContain('Term 2: duplicate name "Fall 2026".');
  });

  it("requires both dates on every term", () => {
    const draft = validDraft();
    draft.terms[0].start = "";
    draft.terms[0].end = "";
    const errors = validateDraft(draft);
    expect(errors).toContain("Term 1: start date is required.");
    expect(errors).toContain("Term 1: end date is required.");
  });

  it("rejects a term whose start is not before its end", () => {
    const draft = validDraft();
    draft.terms[0].end = draft.terms[0].start;
    expect(validateDraft(draft)).toContain("Term 1: start date must be before end date.");
  });

  it("rejects terms that are out of order", () => {
    const draft = validDraft();
    draft.terms[1].start = "2026-01-01"; // before term 1 ends
    expect(validateDraft(draft)).toContain("Term 2: starts before term 1 ends.");
  });

  it("allows zero named tracks (all track inputs blank)", () => {
    const draft = validDraft();
    draft.tracks = [makeDraftTrack("  "), makeDraftTrack("")];
    expect(validateDraft(draft)).toEqual([]);
  });

  it("rejects duplicate track names (compared trimmed)", () => {
    const draft = validDraft();
    draft.tracks = [makeDraftTrack("Biology major"), makeDraftTrack("  Biology major  ")];
    expect(validateDraft(draft)).toContain('Duplicate track name "Biology major".');
  });

  it(`rejects more than ${MAX_TRACKS} tracks`, () => {
    const draft = validDraft();
    draft.tracks = Array.from({ length: MAX_TRACKS + 1 }, (_, i) => makeDraftTrack(`Track ${i}`));
    expect(validateDraft(draft).join("\n")).toMatch(
      new RegExp(`maximum is ${MAX_TRACKS}`),
    );
  });
});

describe("buildTemplateTerms", () => {
  // A Friday in late August: Fall 2026 has just begun.
  const today = new Date("2026-08-27T12:00:00Z");

  it.each(TEMPLATE_OPTIONS)("produces 12 valid, in-order terms for %s", (template) => {
    const terms = buildTemplateTerms(template, today);

    expect(terms).toHaveLength(12);
    expect(validateDraft({ title: "x", terms, tracks: [] })).toEqual([]);
  });

  it.each(TEMPLATE_OPTIONS)("marks Fall/Spring auto-populate and Summer not, for %s", (template) => {
    for (const term of buildTemplateTerms(template, today)) {
      const isSummer = term.name.startsWith("Summer");
      expect(term.autopopulate).toBe(!isSummer);
    }
  });

  it("starts an Incoming Freshman at next Fall (they have not started yet)", () => {
    const [first, second, third] = buildTemplateTerms("Incoming Freshman", today);
    expect(first.name).toBe("Fall 2027");
    expect(second.name).toBe("Spring 2028");
    expect(third.name).toBe("Summer 2028");
  });

  it("starts a Current Freshman in the academic year in progress", () => {
    const names = buildTemplateTerms("Current Freshman", today).map((t) => t.name);
    expect(names.slice(0, 3)).toEqual(["Fall 2026", "Spring 2027", "Summer 2027"]);
    expect(names.at(-1)).toBe("Summer 2030");
  });

  it.each([
    ["Current Sophomore", "Fall 2025"],
    ["Current Junior", "Fall 2024"],
    ["Current Senior", "Fall 2023"],
  ] as [TemplateId, string][])("puts %s's first term in the past (%s)", (template, firstName) => {
    expect(buildTemplateTerms(template, today)[0].name).toBe(firstName);
  });

  it("uses the current calendar year's Spring when run in the spring", () => {
    const spring = new Date("2026-03-01T12:00:00Z");
    expect(buildTemplateTerms("Current Freshman", spring)[0].name).toBe("Fall 2025");
    expect(buildTemplateTerms("Incoming Freshman", spring)[0].name).toBe("Fall 2026");
  });
});

describe("isoToEpochDay", () => {
  it("counts whole UTC days from the epoch", () => {
    expect(isoToEpochDay("1970-01-01")).toBe(0);
    expect(isoToEpochDay("1970-01-02")).toBe(1);
    expect(isoToEpochDay("1971-01-01")).toBe(365);
  });
});

describe("draftToProject", () => {
  it("trims names, converts dates, drops blank tracks, and validates", () => {
    const draft = validDraft();
    draft.title = "  Spaced Out  ";

    const project = draftToProject(draft);

    expect(project.name).toBe("Spaced Out");
    expect(project.terms).toHaveLength(2);
    expect(project.terms[0]).toMatchObject({
      name: "Fall 2026",
      start: isoToEpochDay("2026-08-25"),
      end: isoToEpochDay("2026-12-15"),
      autopopulate: true,
    });
    expect(project.tracks).toHaveLength(1);
    expect(project.tracks[0]).toMatchObject({ id: 0, name: "Biology major" });
    expect(project.courses).toEqual([]);
    expect(() => validateProject(project)).not.toThrow();
  });

  it("turns each template into a project that passes validateProject", () => {
    const today = new Date("2026-08-27T12:00:00Z");
    for (const template of TEMPLATE_OPTIONS) {
      const project = draftToProject({
        title: template,
        terms: buildTemplateTerms(template, today),
        tracks: [makeDraftTrack("Biology major")],
      });
      expect(() => validateProject(project)).not.toThrow();
    }
  });
});
