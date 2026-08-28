"use client";

import { type RefObject, useLayoutEffect, useState } from "react";
import type { CourseChainProject } from "@/lib/project";

export interface PrereqArrow {
  key: string;
  d: string;
  /** The prereq course (arrow tail) and the course that needs it (arrow head). */
  fromId: number;
  toId: number;
  /** The dependent course is scheduled inconsistently with this prereq link. */
  conflict: boolean;
}

interface ArrowLayout {
  arrows: PrereqArrow[];
  width: number;
  height: number;
}

interface Anchor {
  left: number;
  right: number;
  midY: number;
}

const EMPTY: ArrowLayout = { arrows: [], width: 0, height: 0 };
const ALIGNED_TOLERANCE = 4;
const CRAMPED_GAP = 80;
const CORNER_RADIUS = 10;

type Pt = [number, number];

/**
 * Orthogonal path through `points` (start, corners…, end) with the corners
 * rounded off, so turns read as smooth bends rather than sharp angles.
 */
function roundedPath(points: Pt[], radius: number): string {
  if (points.length < 3) {
    return points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  }
  const parts = [`M ${points[0][0]} ${points[0][1]}`];
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1];
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    const dIn = Math.hypot(cx - px, cy - py) || 1;
    const dOut = Math.hypot(nx - cx, ny - cy) || 1;
    const r = Math.min(radius, dIn / 2, dOut / 2);
    parts.push(`L ${cx - ((cx - px) / dIn) * r} ${cy - ((cy - py) / dIn) * r}`);
    parts.push(`Q ${cx} ${cy} ${cx + ((nx - cx) / dOut) * r} ${cy + ((ny - cy) / dOut) * r}`);
  }
  const [ex, ey] = points[points.length - 1];
  parts.push(`L ${ex} ${ey}`);
  return parts.join(" ");
}

/**
 * Path from the prereq card to the course that needs it:
 *  - same term (concurrent): out to the gutter past both cards, then back into
 *    the dependent's right edge;
 *  - adjacent column with different heights: a rounded right-angle step through
 *    the gutter between the two cards;
 *  - otherwise: a straight line, or one gentle curve when the heights differ.
 */
function buildPath(from: Anchor, to: Anchor): string {
  const gap = to.left - from.right;
  const dy = to.midY - from.midY;
  const aligned = Math.abs(dy) <= ALIGNED_TOLERANCE;

  if (gap <= ALIGNED_TOLERANCE) {
    // Same column — route around the right side and turn back.
    const gutterX = Math.max(from.right, to.right) + 14;
    return roundedPath(
      [
        [from.right, from.midY],
        [gutterX, from.midY],
        [gutterX, to.midY],
        [to.right, to.midY],
      ],
      CORNER_RADIUS,
    );
  }

  if (aligned) {
    return `M ${from.right} ${from.midY} L ${to.left} ${to.midY}`;
  }

  if (gap < CRAMPED_GAP) {
    // Not enough width for a smooth diagonal — step through the mid-gutter.
    const midX = from.right + gap / 2;
    return roundedPath(
      [
        [from.right, from.midY],
        [midX, from.midY],
        [midX, to.midY],
        [to.left, to.midY],
      ],
      Math.min(CORNER_RADIUS, gap / 2, Math.abs(dy) / 2),
    );
  }

  const midX = (from.right + to.left) / 2;
  return `M ${from.right} ${from.midY} C ${midX} ${from.midY}, ${midX} ${to.midY}, ${to.left} ${to.midY}`;
}

/**
 * Measures the course cards inside `boardRef` and returns the SVG paths that
 * connect each prereq to the courses that require it, plus the size the overlay
 * SVG should be. Recomputed on project changes, sidebar resize, window resize,
 * and any board reflow.
 */
export function usePrereqArrows(
  boardRef: RefObject<HTMLElement | null>,
  project: CourseChainProject,
  sidebarWidth: number,
): ArrowLayout {
  const [layout, setLayout] = useState<ArrowLayout>(EMPTY);

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const measure = () => {
      const node = boardRef.current;
      if (!node) return;
      const boardRect = node.getBoundingClientRect();

      const anchorFor = (id: number): Anchor | null => {
        const el = node.querySelector<HTMLElement>(`[data-course-id="${id}"]`);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const left = rect.left - boardRect.left;
        return {
          left,
          right: left + rect.width,
          midY: rect.top - boardRect.top + rect.height / 2,
        };
      };

      const byId = new Map(project.courses.map((c) => [c.id, c]));
      const arrows: PrereqArrow[] = [];
      for (const course of project.courses) {
        const target = anchorFor(course.id);
        if (!target) continue;
        course.prereqs.forEach((prereqId, index) => {
          const source = anchorFor(prereqId);
          const prereq = byId.get(prereqId);
          if (!source || !prereq) return;
          const concurrent = course.concurrentPrereq[index] ?? false;
          const conflict =
            prereq.termNumber + (concurrent ? 0 : 1) > course.termNumber;
          arrows.push({
            key: `${prereqId}->${course.id}`,
            d: buildPath(source, target),
            fromId: prereqId,
            toId: course.id,
            conflict,
          });
        });
      }

      // Post-layout measurement: this setState runs before paint, no flicker.
      setLayout({ arrows, width: node.scrollWidth, height: node.scrollHeight });
    };

    measure();

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(board);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, [boardRef, project, sidebarWidth]);

  return layout;
}
