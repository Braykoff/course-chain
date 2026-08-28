"use client";

import {
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faXmark } from "@fortawesome/free-solid-svg-icons";
import {
  addCourse,
  type Course,
  type CourseChainProject,
  courseConflicts,
  moveCourseToTerm,
  type NewCourseInput,
} from "@/lib/project";
import { AddCourseForm } from "./AddCourseForm";
import { CourseCard } from "./CourseCard";
import { usePrereqArrows } from "./usePrereqArrows";
import { useWorkspace } from "./WorkspaceContext";

const MS_PER_DAY = 86_400_000;

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 520;
const SIDEBAR_START_WIDTH = 320;

/** Format an epoch-day count as a short local date, e.g. "Aug 25, 2026". */
function formatDay(day: number): string {
  return new Date(day * MS_PER_DAY).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

type TermStatus = "past" | "current" | "future";

function termStatus(startDay: number, endDay: number, todayDay: number): TermStatus {
  if (endDay < todayDay) return "past";
  if (startDay > todayDay) return "future";
  return "current";
}

const byCalendarOrder = (a: Course, b: Course): number =>
  a.termNumber - b.termNumber || a.id - b.id;

interface EditorScreenProps {
  project: CourseChainProject;
}

export function EditorScreen({ project }: EditorScreenProps) {
  const { setProject } = useWorkspace();

  // Captured once when the editor opens; used to grey out past terms.
  const [todayDay] = useState(() => Math.floor(Date.now() / MS_PER_DAY));
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_START_WIDTH);
  const [addCourseOpen, setAddCourseOpen] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dragOverTerm, setDragOverTerm] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const currentColumnRef = useRef<HTMLElement>(null);

  const arrows = usePrereqArrows(boardRef, project, sidebarWidth);

  const statuses = project.terms.map((term) =>
    termStatus(term.start, term.end, todayDay),
  );
  // Center on the in-progress term, or the most recent past one, else the first.
  let focusIndex = statuses.indexOf("current");
  if (focusIndex === -1) focusIndex = statuses.lastIndexOf("past");
  if (focusIndex === -1) focusIndex = 0;

  // Conflicts are derived from the current arrangement — recomputed every render.
  const conflictsById = new Map<number, string[]>();
  for (const course of project.courses) {
    const messages = courseConflicts(project, course);
    if (messages.length > 0) conflictsById.set(course.id, messages);
  }

  const explicitCourses = project.courses
    .filter((course) => !course.implicit)
    .sort(byCalendarOrder);
  const implicitCourses = project.courses
    .filter((course) => course.implicit)
    .sort(byCalendarOrder);

  // Start the board scrolled so the focused term sits in the middle.
  useEffect(() => {
    const column = currentColumnRef.current;
    const container = scrollRef.current;
    if (!column || !container) return;
    const columnRect = column.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    container.scrollLeft +=
      columnRect.left -
      containerRect.left -
      (containerRect.width - columnRect.width) / 2;
  }, [focusIndex]);

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;

    const onMove = (moveEvent: PointerEvent) => {
      const next = startWidth + (moveEvent.clientX - startX);
      setSidebarWidth(Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, next)));
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
    };

    document.body.style.userSelect = "none";
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  const handleAddCourse = (input: NewCourseInput) => {
    const result = addCourse(project, input, todayDay);
    setProject(result.project);
    setWarnings(result.warnings);
  };

  const handleDropOnTerm = (termIndex: number, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOverTerm(null);
    const id = Number(event.dataTransfer.getData("text/plain"));
    if (Number.isInteger(id)) {
      setProject(moveCourseToTerm(project, id, termIndex));
    }
  };

  return (
    <div className="relative flex min-h-0 flex-1">
      {/* Forced-placement warnings */}
      {warnings.length > 0 && (
        <div
          role="alert"
          className="absolute left-1/2 top-4 z-30 w-[28rem] max-w-[90%] -translate-x-1/2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <ul className="space-y-1">
              {warnings.map((warning, index) => (
                <li key={`${index}-${warning}`}>{warning}</li>
              ))}
            </ul>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setWarnings([])}
              className="shrink-0 rounded p-1 hover:bg-amber-100"
            >
              <FontAwesomeIcon icon={faXmark} className="text-xs" />
            </button>
          </div>
        </div>
      )}

      {/* Sidebar — course list + Add Course; drag its right edge to resize */}
      <aside
        style={{ width: sidebarWidth }}
        className="flex shrink-0 flex-col bg-gray-50/60"
      >
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {/* Add Course panel — opens at the top of the sidebar */}
          {addCourseOpen && (
            <AddCourseForm
              courses={project.courses}
              tracks={project.tracks}
              onSubmit={handleAddCourse}
              onClose={() => setAddCourseOpen(false)}
            />
          )}

          <h2 className="truncate text-sm font-semibold text-gray-900" title={project.name}>
            {project.name}
          </h2>

          {explicitCourses.length === 0 && implicitCourses.length === 0 ? (
            <p className="text-xs text-gray-400">
              Courses will appear here as you add them.
            </p>
          ) : (
            <div className="space-y-2">
              {explicitCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  conflict={conflictsById.has(course.id)}
                  conflictTitle={conflictsById.get(course.id)?.join("\n")}
                />
              ))}
            </div>
          )}

          {implicitCourses.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-yellow-600">
                Implicit classes
              </p>
              <div className="space-y-2">
                {implicitCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    conflict={conflictsById.has(course.id)}
                    conflictTitle={conflictsById.get(course.id)?.join("\n")}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer — Add Course button in the lower-right corner */}
        <div className="flex justify-end border-t border-gray-200 p-3">
          <button
            type="button"
            onClick={() => setAddCourseOpen((open) => !open)}
            aria-expanded={addCourseOpen}
            className="inline-flex items-center gap-1.5 rounded-md border border-royal-200 bg-white px-3 py-1.5 text-sm font-medium text-royal-700 transition hover:bg-royal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-500"
          >
            <FontAwesomeIcon icon={faPlus} className="text-xs" />
            Add Course
          </button>
        </div>
      </aside>

      {/* Resize handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        onPointerDown={startResize}
        className="w-1 shrink-0 cursor-col-resize bg-gray-200 transition-colors hover:bg-royal-300"
      />

      {/* Semester columns — one contiguous board, hairline between columns */}
      <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto">
        <div ref={boardRef} className="relative flex h-full items-stretch">
          {/* Prereq connectors — painted under the columns so cards cover them */}
          {arrows.arrows.length > 0 && (
            <svg
              width={arrows.width}
              height={arrows.height}
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0"
            >
              <defs>
                <marker
                  id="cc-prereq-arrowhead"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto"
                >
                  <path d="M0 0 L10 5 L0 10 z" className="fill-royal-500" />
                </marker>
              </defs>
              {arrows.arrows.map((arrow) => (
                <path
                  key={arrow.key}
                  d={arrow.d}
                  fill="none"
                  className="stroke-royal-500"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  markerEnd="url(#cc-prereq-arrowhead)"
                />
              ))}
            </svg>
          )}

          {project.terms.map((term, index) => {
            const status = statuses[index];
            const termCourses = project.courses
              .filter((course) => course.termNumber === index)
              .sort((a, b) => a.id - b.id);
            const units = termCourses.reduce((sum, course) => sum + course.unitCount, 0);

            // Backgrounds stay translucent so the connectors show through the
            // open space between cards.
            const toneClass =
              status === "past"
                ? "bg-gray-100/50"
                : status === "current"
                  ? "bg-royal-50/40"
                  : "bg-transparent";

            return (
              <section
                key={term.name}
                ref={index === focusIndex ? currentColumnRef : undefined}
                className={`flex h-full w-80 shrink-0 flex-col border-r border-gray-200 last:border-r-0 ${toneClass}`}
              >
                {/* Column header — name, date range, running unit count */}
                <header className="border-b border-gray-200 px-4 py-3 text-center">
                  <h3
                    className={`font-bold ${status === "past" ? "text-gray-400" : "text-gray-900"}`}
                  >
                    {term.name}
                  </h3>
                  <p
                    className={`mt-0.5 text-xs ${status === "past" ? "text-gray-400" : "text-gray-500"}`}
                  >
                    {formatDay(term.start)} – {formatDay(term.end)}
                  </p>
                  <p
                    className={`mt-0.5 text-xs font-medium ${status === "past" ? "text-gray-400" : "text-gray-500"}`}
                  >
                    {units} {units === 1 ? "unit" : "units"}
                  </p>
                </header>

                {/* Course list — drop target for drag-and-drop */}
                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOverTerm(index);
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setDragOverTerm((current) => (current === index ? null : current));
                    }
                  }}
                  onDrop={(event) => handleDropOnTerm(index, event)}
                  className={`flex flex-1 flex-col gap-2 overflow-y-auto p-3 transition-colors ${
                    dragOverTerm === index ? "bg-royal-100/60" : ""
                  }`}
                >
                  {termCourses.length === 0 ? (
                    <span className="m-auto select-none text-xs text-gray-300">
                      No courses yet
                    </span>
                  ) : (
                    termCourses.map((course) => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        conflict={conflictsById.has(course.id)}
                        conflictTitle={conflictsById.get(course.id)?.join("\n")}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
