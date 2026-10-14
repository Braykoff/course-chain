import type { CourseChainProject } from "./schema";

/** Quotes a CSV field when it holds a comma, quote, or line break (RFC 4180). */
function csvField(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Export-only CSV view of a project: one row per course with its assigned
 * semester name and unit count, ordered by semester then calendar slot.
 */
export function projectToCsv(project: CourseChainProject): string {
  const rows = [...project.courses]
    .sort((a, b) => a.termNumber - b.termNumber || a.slots - b.slots)
    .map((course) =>
      [
        course.name,
        project.terms[course.termNumber]?.name ?? "",
        course.unitCount,
      ]
        .map(csvField)
        .join(","),
    );
  return ["Course,Semester,Units", ...rows].join("\r\n") + "\r\n";
}
