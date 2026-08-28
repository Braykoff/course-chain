"use client";

import type { DragEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import type { Course } from "@/lib/project";

interface CourseCardProps {
  course: Course;
  /** Placement is inconsistent with the course's prereq links. */
  conflict: boolean;
  /** Tooltip text describing the conflict. */
  conflictTitle?: string;
}

/**
 * One course block. Draggable — the drop target reads the course id from
 * `text/plain`. Conflict styling (red) wins over implicit styling (yellow dashed).
 */
export function CourseCard({ course, conflict, conflictTitle }: CourseCardProps) {
  const onDragStart = (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData("text/plain", String(course.id));
    event.dataTransfer.effectAllowed = "move";
  };

  const toneClass = conflict
    ? "border-red-400 bg-red-50 text-red-800"
    : course.implicit
      ? "border-dashed border-yellow-400 bg-yellow-50 text-yellow-800"
      : "border-gray-200 bg-white text-gray-800";

  return (
    <div
      data-course-id={course.id}
      draggable
      onDragStart={onDragStart}
      title={conflict ? conflictTitle : undefined}
      className={`cursor-grab rounded-md border p-2 text-sm shadow-sm transition active:cursor-grabbing ${toneClass}`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="font-medium leading-tight">{course.name || "Untitled course"}</span>
        {conflict && (
          <FontAwesomeIcon
            icon={faTriangleExclamation}
            className="mt-0.5 shrink-0 text-red-500"
            aria-label="Scheduling conflict"
          />
        )}
      </div>
      <div className="mt-0.5 text-xs opacity-70">
        {course.unitCount} {course.unitCount === 1 ? "unit" : "units"}
        {course.implicit && " · implicit"}
      </div>
    </div>
  );
}
