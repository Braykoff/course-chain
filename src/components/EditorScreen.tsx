"use client";

import {
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faPlus, faXmark } from "@fortawesome/free-solid-svg-icons";
import {
  addCourse,
  type Course,
  type CourseChainProject,
  courseConflicts,
  deleteCourse,
  MAX_SLOT,
  moveCourseToSlot,
  type NewCourseInput,
  prereqChain,
  trackPrereqClosure,
  updateCourse,
} from "@/lib/project";
import { CourseCard } from "./CourseCard";
import { CourseForm } from "./CourseForm";
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
  const { updateProject } = useWorkspace();

  // Captured once when the editor opens; used to grey out past terms.
  const [todayDay] = useState(() => Math.floor(Date.now() / MS_PER_DAY));
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_START_WIDTH);
  const [addCourseOpen, setAddCourseOpen] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [dropTarget, setDropTarget] = useState<{ term: number; slot: number } | null>(null);
  const [implicitHelpHover, setImplicitHelpHover] = useState(false);
  const [implicitHelpPinned, setImplicitHelpPinned] = useState(false);
  const [expandedCourseId, setExpandedCourseId] = useState<number | null>(null);
  const [focusedCourseId, setFocusedCourseId] = useState<number | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);

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

  // A clicked course fades everything outside its prereq chain; a clicked track
  // fades everything but its courses and their prereqs. Only one at a time.
  const highlightIds =
    focusedCourseId != null && project.courses.some((c) => c.id === focusedCourseId)
      ? prereqChain(project, focusedCourseId)
      : selectedTrackId != null && project.tracks.some((t) => t.id === selectedTrackId)
        ? trackPrereqClosure(project, selectedTrackId)
        : null;

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

  // Autosave only when something actually changed — a rejected or no-op
  // operation returns the same project and must not bump `lastModified`.
  const commit = (next: CourseChainProject) => {
    if (next !== project) updateProject(next);
  };

  const handleAddCourse = (input: NewCourseInput) => {
    const result = addCourse(project, input, todayDay);
    commit(result.project);
    setWarnings(result.warnings);
  };

  const clearHighlight = () => {
    setFocusedCourseId(null);
    setSelectedTrackId(null);
  };

  const handleSelectCourse = (id: number) => {
    setSelectedTrackId(null);
    setFocusedCourseId((current) => (current === id ? null : id));
  };

  const handleSelectTrack = (id: number) => {
    setFocusedCourseId(null);
    setSelectedTrackId((current) => (current === id ? null : id));
  };

  const handleSaveCourse = (id: number, input: NewCourseInput, promote: boolean) => {
    const result = updateCourse(project, id, input, { promote }, todayDay);
    commit(result.project);
    setWarnings(result.warnings);
    setExpandedCourseId(null);
  };

  const handleDeleteCourse = (course: Course) => {
    const ok = window.confirm(
      `Delete “${course.name}”? It's removed from the schedule and from any ` +
        `prereq lists.`,
    );
    if (!ok) return;
    commit(deleteCourse(project, course.id));
    setExpandedCourseId(null);
  };

  /** The existing course's editable fields, for pre-filling the form. */
  const courseToInput = (course: Course): NewCourseInput => ({
    name: course.name,
    unitCount: course.unitCount,
    comments: course.notes,
    trackIds: [...course.tracks],
    prereqs: course.prereqs.map((prereqId, index) => ({
      name:
        project.courses.find((c) => c.id === prereqId)?.name ?? `#${prereqId}`,
      concurrent: course.concurrentPrereq[index] ?? false,
    })),
  });

  /** A sidebar course: the draggable card, an expand toggle, and an edit form. */
  const renderCourseRow = (course: Course) => {
    const expanded = expandedCourseId === course.id;
    return (
      <div key={course.id}>
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            <CourseCard
              course={course}
              conflict={conflictsById.has(course.id)}
              conflictTitle={conflictsById.get(course.id)?.join("\n")}
              completed={statuses[course.termNumber] === "past"}
            />
          </div>
          <button
            type="button"
            aria-label={expanded ? "Collapse" : `Edit ${course.name}`}
            aria-expanded={expanded}
            onClick={() =>
              setExpandedCourseId((id) => (id === course.id ? null : course.id))
            }
            className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <FontAwesomeIcon
              icon={faChevronDown}
              className={`text-xs transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>
        {expanded && (
          <div className="mt-2">
            <CourseForm
              heading={course.implicit ? "Define course" : "Edit course"}
              courses={project.courses}
              tracks={project.tracks}
              excludeCourseId={course.id}
              initial={courseToInput(course)}
              submitLabel={course.implicit ? "Add" : "Save"}
              onSubmit={(input) => handleSaveCourse(course.id, input, course.implicit)}
              onDelete={() => handleDeleteCourse(course)}
              onClose={() => setExpandedCourseId(null)}
            />
          </div>
        )}
      </div>
    );
  };

  const handleDropSlot = (
    term: number,
    slot: number,
    event: DragEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    // `dragend` can be missed when the drop re-renders away the drag source,
    // so clear the drag state here too.
    setDragging(false);
    setDropTarget(null);
    const id = Number(event.dataTransfer.getData("text/plain"));
    if (Number.isInteger(id)) {
      commit(moveCourseToSlot(project, id, term, slot));
    }
  };

  return (
    <div
      className="relative flex min-h-0 flex-1 overflow-hidden"
      onClick={clearHighlight}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => {
        setDragging(false);
        setDropTarget(null);
      }}
    >
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
        className="relative flex shrink-0 flex-col bg-gray-50/60"
      >
        <div className="flex-1 space-y-4 overflow-y-auto p-4 pb-20">
          {/* Add Course panel — opens at the top of the sidebar */}
          {addCourseOpen && (
            <CourseForm
              heading="Add Course"
              submitLabel="Add"
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
            <div className="space-y-2">{explicitCourses.map(renderCourseRow)}</div>
          )}

          {implicitCourses.length > 0 && (
            <div className="relative">
              <div className="mb-2 flex items-center gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-yellow-600">
                  Implicit classes
                </span>
                <button
                  type="button"
                  aria-label="What are implicit classes?"
                  onClick={() => setImplicitHelpPinned((pinned) => !pinned)}
                  onMouseEnter={() => setImplicitHelpHover(true)}
                  onMouseLeave={() => setImplicitHelpHover(false)}
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-yellow-500 text-[10px] font-bold leading-none text-yellow-600 transition-colors hover:bg-yellow-100"
                >
                  ?
                </button>
              </div>
              {(implicitHelpHover || implicitHelpPinned) && (
                <div
                  role="tooltip"
                  className="absolute left-0 right-0 top-6 z-20 rounded-md border border-gray-200 bg-white p-2 text-[11px] font-normal normal-case leading-snug tracking-normal text-gray-600 shadow-lg"
                >
                  Courses added automatically because you named them as a prereq
                  without defining them.
                </div>
              )}
              <div className="space-y-2">{implicitCourses.map(renderCourseRow)}</div>
            </div>
          )}
        </div>

        {/* Add Course — floats over the bottom-right of the sidebar */}
        <div className="absolute bottom-4 right-4">
          <button
            type="button"
            onClick={() => setAddCourseOpen((open) => !open)}
            aria-expanded={addCourseOpen}
            className="inline-flex items-center gap-1.5 rounded-md border border-royal-200 bg-white px-3 py-1.5 text-sm font-medium text-royal-700 shadow-sm transition hover:bg-royal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-500"
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

      {/* Semester columns — one board that scrolls as a whole, both axes */}
      <div ref={scrollRef} className="min-w-0 flex-1 overflow-auto">
        <div ref={boardRef} className="relative flex min-h-full items-stretch">
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
                <marker
                  id="cc-prereq-arrowhead-conflict"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto"
                >
                  <path d="M0 0 L10 5 L0 10 z" className="fill-red-500" />
                </marker>
              </defs>
              {arrows.arrows.map((arrow) => {
                const inChain =
                  highlightIds == null ||
                  (highlightIds.has(arrow.fromId) && highlightIds.has(arrow.toId));
                return (
                  <path
                    key={arrow.key}
                    d={arrow.d}
                    fill="none"
                    className={`${arrow.conflict ? "stroke-red-500" : "stroke-royal-500"} ${
                      inChain ? "" : "opacity-20"
                    }`}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    markerEnd={
                      arrow.conflict
                        ? "url(#cc-prereq-arrowhead-conflict)"
                        : "url(#cc-prereq-arrowhead)"
                    }
                  />
                );
              })}
            </svg>
          )}

          {project.terms.map((term, index) => {
            const status = statuses[index];
            const termCourses = project.courses.filter(
              (course) => course.termNumber === index,
            );
            const units = termCourses.reduce((sum, course) => sum + course.unitCount, 0);
            const courseBySlot = new Map(termCourses.map((course) => [course.slots, course]));
            const maxSlot = termCourses.reduce((max, course) => Math.max(max, course.slots), -1);
            // At rest, render exactly the slots in use so the column never
            // scrolls past its courses. While dragging, expose every slot so a
            // course can be dropped anywhere (the column scrolls then, as needed).
            const rowCount = dragging ? MAX_SLOT + 1 : maxSlot + 1;

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
                className={`flex w-80 shrink-0 flex-col border-r border-gray-200 last:border-r-0 ${toneClass}`}
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

                {/* Slot rows — each is a drop target; dropping onto a taken
                    slot swaps the two courses. Space below appends. */}
                <div
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDropSlot(index, maxSlot + 1, event)}
                  className="flex flex-1 flex-col p-3"
                >
                  {rowCount === 0 ? (
                    <span className="m-auto select-none text-xs text-gray-300">
                      No courses yet
                    </span>
                  ) : (
                    Array.from({ length: rowCount }, (_, slot) => {
                      const course = courseBySlot.get(slot);
                      const active =
                        dropTarget?.term === index && dropTarget.slot === slot;
                      return (
                        <div
                          key={slot}
                          onDragOver={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setDropTarget({ term: index, slot });
                          }}
                          onDragLeave={(event) => {
                            if (
                              !event.currentTarget.contains(
                                event.relatedTarget as Node | null,
                              )
                            ) {
                              setDropTarget((current) =>
                                current?.term === index && current.slot === slot
                                  ? null
                                  : current,
                              );
                            }
                          }}
                          onDrop={(event) => handleDropSlot(index, slot, event)}
                          className={`mb-2 min-h-[52px] rounded-md last:mb-0 ${
                            active && !course
                              ? "border-2 border-dashed border-royal-300 bg-royal-50/60"
                              : active
                                ? "ring-2 ring-royal-300"
                                : ""
                          }`}
                        >
                          {course && (
                            <CourseCard
                              course={course}
                              conflict={conflictsById.has(course.id)}
                              conflictTitle={conflictsById.get(course.id)?.join("\n")}
                              onSelect={handleSelectCourse}
                              focused={focusedCourseId === course.id}
                              dimmed={highlightIds != null && !highlightIds.has(course.id)}
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Floating track filter — bottom-right; click one to highlight its chain */}
      {project.tracks.length > 0 && (
        <div
          onClick={(event) => event.stopPropagation()}
          className="absolute bottom-4 right-4 z-20 max-w-[14rem] rounded-lg border border-gray-200 bg-white/95 p-2 shadow-lg backdrop-blur"
        >
          <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Tracks
          </p>
          <div className="flex flex-col gap-0.5">
            {project.tracks.map((track) => {
              const active = selectedTrackId === track.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => handleSelectTrack(track.id)}
                  className={`truncate rounded px-2 py-1 text-left text-xs transition-colors ${
                    active
                      ? "bg-royal-100 font-medium text-royal-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {track.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
