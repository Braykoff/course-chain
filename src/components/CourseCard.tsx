"use client";

import type { DragEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import type { Course } from "@/lib/project";

interface CourseCardProps {
  course: Course;
  /** Placement is inconsistent with the course's prereq links. */
  conflict: boolean;
  /** Tooltip text describing the conflict. */
  conflictTitle?: string;
  /** This is the course the user clicked — draw an extra-bold border. */
  focused?: boolean;
  /** Something else is focused and this course isn't in its chain — fade it. */
  dimmed?: boolean;
  /** The course sits in a term that has already ended — grey it, mark it done. */
  completed?: boolean;
  /** Called on a plain click (not a drag). */
  onSelect?: (courseId: number) => void;
}

/**
 * One course block. Draggable — the drop target reads the course id from
 * `text/plain`. Conflict styling (red) wins over implicit styling (yellow dashed).
 */
export function CourseCard({
  course,
  conflict,
  conflictTitle,
  focused = false,
  dimmed = false,
  completed = false,
  onSelect,
}: CourseCardProps) {
  const onDragStart = (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData("text/plain", String(course.id));
    event.dataTransfer.effectAllowed = "move";
  };

  const surfaceClass = conflict
    ? "bg-red-50 text-red-800"
    : course.implicit
      ? "bg-yellow-50 text-yellow-800"
      : "bg-white text-gray-800";

  const borderClass = focused
    ? "border-2 border-royal-600"
    : conflict
      ? "border border-red-400"
      : course.implicit
        ? "border border-dashed border-yellow-400"
        : "border border-gray-200";

  const fadeClass = dimmed ? "opacity-30" : completed ? "opacity-60" : "";

  return (
    <div
      data-course-id={course.id}
      draggable
      onDragStart={onDragStart}
      onClick={
        onSelect
          ? (event) => {
              event.stopPropagation();
              onSelect(course.id);
            }
          : undefined
      }
      title={conflict ? conflictTitle : undefined}
      className={`cursor-grab rounded-md p-2 text-sm shadow-sm transition active:cursor-grabbing ${surfaceClass} ${borderClass} ${fadeClass}`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="font-medium leading-tight">{course.name || "Untitled course"}</span>
        <span className="mt-0.5 flex shrink-0 items-center gap-1">
          {completed && (
            <FontAwesomeIcon
              icon={faCircleCheck}
              className="text-green-500"
              title="Completed"
              aria-label="Completed"
            />
          )}
          {conflict && (
            <FontAwesomeIcon
              icon={faTriangleExclamation}
              className="text-red-500"
              aria-label="Scheduling conflict"
            />
          )}
        </span>
      </div>
      <div className="mt-0.5 text-xs opacity-70">
        {course.unitCount} {course.unitCount === 1 ? "unit" : "units"}
        {course.implicit && " · implicit"}
      </div>
    </div>
  );
}
