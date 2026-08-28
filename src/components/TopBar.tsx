"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleQuestion,
  faDownload,
  faFilePdf,
  faHouse,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { serializeProject } from "@/lib/project";
import { useWorkspace } from "./WorkspaceContext";

/** Element id of the calendar board, set in EditorScreen. */
const BOARD_ID = "cc-calendar-board";

const iconButton =
  "inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-500 transition-colors " +
  "enabled:hover:bg-gray-100 enabled:hover:text-royal-600 " +
  "disabled:opacity-40 disabled:cursor-not-allowed " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-500 focus-visible:ring-offset-2";

/** Filesystem-safe stem from a project name. */
function safeStem(name: string): string {
  return (
    name.trim().replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "project"
  );
}

export function TopBar() {
  const { project, closeProject } = useWorkspace();
  const [savingPdf, setSavingPdf] = useState(false);
  // With no project open we're already on the launcher, so the project actions
  // have nothing to do.
  const onLauncher = project === null;

  const handleDownload = () => {
    if (!project) return;
    const bytes = (() => {
      try {
        return new Uint8Array(serializeProject(project));
      } catch {
        return null;
      }
    })();
    if (!bytes) {
      window.alert("This project can't be exported right now.");
      return;
    }
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeStem(project.name)}.chain`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSavePdf = async () => {
    if (!project || savingPdf) return;
    const board = document.getElementById(BOARD_ID);
    const columns = board
      ? Array.from(board.querySelectorAll<HTMLElement>("section"))
      : [];
    if (!board || columns.length === 0) return;

    setSavingPdf(true);
    // The board is `min-h-full` on screen so its columns fill the viewport even
    // when nearly empty. Drop that just for the capture so the PDF is the real
    // content size, not a viewport-tall strip of blank columns.
    const prevMinHeight = board.style.minHeight;
    board.style.minHeight = "0px";
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);

      const width = board.scrollWidth;
      // scrollHeight would include the (viewport-tall) arrow overlay, so measure
      // the tallest column instead — every column is stretched to that height.
      const height = Math.max(...columns.map((column) => column.offsetHeight));

      // The clone html-to-image makes inherits the inline min-height above.
      const pngPromise = toPng(board, {
        width,
        height,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      // Restore the live view; the clone was already snapshotted synchronously.
      board.style.minHeight = prevMinHeight;

      const dataUrl = await pngPromise;

      // One page the exact pixel size of the board (px = 1/96in). Orientation
      // must match the aspect ratio or jsPDF swaps the format and the image
      // stops fitting the page.
      const pdf = new jsPDF({
        orientation: width >= height ? "landscape" : "portrait",
        unit: "px",
        format: [width, height],
      });
      pdf.addImage(dataUrl, "PNG", 0, 0, width, height);
      pdf.save(`${safeStem(project.name)}.pdf`);
    } catch {
      window.alert("Couldn't create the PDF.");
    } finally {
      board.style.minHeight = prevMinHeight;
      setSavingPdf(false);
    }
  };

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
      <div className="grid grid-cols-3 items-center px-4 py-2">
        {/* Home — returns to the launcher; disabled when already there */}
        <button
          type="button"
          aria-label="Home"
          title="Home"
          disabled={onLauncher}
          onClick={closeProject}
          className={`${iconButton} justify-self-start`}
        >
          <FontAwesomeIcon icon={faHouse} className="text-base" />
        </button>

        {/* Site name */}
        <span className="justify-self-center select-none text-base font-semibold tracking-tight text-royal-700">
          course-chain
        </span>

        {/* Project actions */}
        <div className="flex items-center gap-1 justify-self-end">
          {/* Download the project as a .chain file */}
          <button
            type="button"
            aria-label="Download project"
            title="Download project (.chain)"
            disabled={onLauncher}
            onClick={handleDownload}
            className={iconButton}
          >
            <FontAwesomeIcon icon={faDownload} className="text-base" />
          </button>

          {/* Save the full calendar as a PDF */}
          <button
            type="button"
            aria-label="Save calendar as PDF"
            title="Save calendar as PDF"
            disabled={onLauncher || savingPdf}
            onClick={handleSavePdf}
            className={iconButton}
          >
            <FontAwesomeIcon
              icon={savingPdf ? faSpinner : faFilePdf}
              className={`text-base ${savingPdf ? "animate-spin" : ""}`}
            />
          </button>

          {/* Help — no-op for now */}
          <button
            type="button"
            aria-label="Help"
            title="Help"
            className={iconButton}
          >
            <FontAwesomeIcon icon={faCircleQuestion} className="text-base" />
          </button>
        </div>
      </div>
    </header>
  );
}
