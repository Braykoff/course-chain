import { type DraftTerm, makeDraftTerm } from "./draft";

// The five "Template" dropdown choices, in display order.
export const TEMPLATE_OPTIONS = [
  "Incoming Freshman",
  "Current Freshman",
  "Current Sophomore",
  "Current Junior",
  "Current Senior",
] as const;

export type TemplateId = (typeof TEMPLATE_OPTIONS)[number];

type Season = "Fall" | "Spring" | "Summer";

// Each academic year contributes three terms. Fall sits in the year the
// academic year is named for; Spring and Summer fall in the next calendar year.
// Fall and Spring are auto-populated with courses; Summer is added to the table
// but left unchecked.
const SEASONS: Record<
  Season,
  {
    yearOffset: number;
    startMonth: number;
    startDay: number;
    endMonth: number;
    endDay: number;
    autopopulate: boolean;
  }
> = {
  Fall: { yearOffset: 0, startMonth: 8, startDay: 25, endMonth: 12, endDay: 15, autopopulate: true },
  Spring: { yearOffset: 1, startMonth: 1, startDay: 12, endMonth: 5, endDay: 10, autopopulate: true },
  Summer: { yearOffset: 1, startMonth: 6, startDay: 1, endMonth: 8, endDay: 10, autopopulate: false },
};

const SEASON_ORDER: Season[] = ["Fall", "Spring", "Summer"];

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Calendar year of the Fall term of the academic year in progress on `today`.
 * August or later counts as that year's Fall; earlier months belong to the
 * academic year that began the previous August.
 */
function currentAcademicFallYear(today: Date): number {
  const year = today.getFullYear();
  return today.getMonth() >= 7 ? year : year - 1;
}

/**
 * Fall year the student's degree begins in. A "Current Freshman" starts in the
 * academic year in progress; each older class started a year earlier; an
 * "Incoming Freshman" has not started yet, so they begin the following Fall.
 */
function degreeStartFallYear(template: TemplateId, today: Date): number {
  const base = currentAcademicFallYear(today);
  switch (template) {
    case "Incoming Freshman":
      return base + 1;
    case "Current Freshman":
      return base;
    case "Current Sophomore":
      return base - 1;
    case "Current Junior":
      return base - 2;
    case "Current Senior":
      return base - 3;
  }
}

/**
 * The 12 terms (4 years x Fall/Spring/Summer) for a template, anchored to
 * `today`. Terms may land in the past for students already partway through a
 * degree. Fall and Spring rows are auto-populate = true; Summer rows are false.
 */
export function buildTemplateTerms(template: TemplateId, today: Date = new Date()): DraftTerm[] {
  const startFall = degreeStartFallYear(template, today);
  const terms: DraftTerm[] = [];

  for (let yearIndex = 0; yearIndex < 4; yearIndex++) {
    const academicYear = startFall + yearIndex;
    for (const season of SEASON_ORDER) {
      const s = SEASONS[season];
      const calendarYear = academicYear + s.yearOffset;
      terms.push(
        makeDraftTerm({
          name: `${season} ${calendarYear}`,
          start: iso(calendarYear, s.startMonth, s.startDay),
          end: iso(calendarYear, s.endMonth, s.endDay),
          autopopulate: s.autopopulate,
        }),
      );
    }
  }

  return terms;
}
