"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleQuestion,
  faDownload,
  faFilePdf,
  faGear,
  faHouse,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { serializeProject } from "@/lib/project";
import { version } from "../../package.json";
import { ProjectSettingsDialog } from "./ProjectSettingsDialog";
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
  const { project, closeProject, updateProject } = useWorkspace();
  const [savingPdf, setSavingPdf] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
    // On screen the board is `min-h-full`, so its columns fill the viewport even
    // when nearly empty. For the capture, pin it to the real content height: the
    // PDF then isn't a viewport-tall strip of blank columns, and — because the
    // html-to-image clone can't re-stretch a board with an explicit height — the
    // empty columns' centered "No courses yet" labels stay centered.
    const prevMinHeight = board.style.minHeight;
    const prevHeight = board.style.height;
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);

      board.style.minHeight = "0px";
      const width = board.scrollWidth;
      // scrollHeight would include the (viewport-tall) arrow overlay, so measure
      // the tallest column instead — every column is stretched to that height.
      const height = Math.max(...columns.map((column) => column.offsetHeight));
      board.style.height = `${height}px`;

      const dataUrl = await toPng(board, {
        width,
        height,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });

      board.style.minHeight = prevMinHeight;
      board.style.height = prevHeight;

      // Tracks render as a titled strip above the calendar image.
      const trackNames = project.tracks
        .map((track) => track.name.trim())
        .filter(Boolean);
      const stripHeight = trackNames.length > 0 ? 40 : 0;
      const pageHeight = stripHeight + height;

      // One page the exact pixel width of the calendar (px = 1/96in). Orientation
      // must match the aspect ratio or jsPDF swaps the format and the image
      // stops fitting the page.
      const pdf = new jsPDF({
        orientation: width >= pageHeight ? "landscape" : "portrait",
        unit: "px",
        format: [width, pageHeight],
      });

      if (stripHeight > 0) {
        const baseline = stripHeight / 2 + 4;
        // Soft background band with a hairline divider along its bottom edge.
        pdf.setFillColor(246, 247, 249);
        pdf.rect(0, 0, width, stripHeight, "F");
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(1);
        pdf.line(0, stripHeight, width, stripHeight);
        // Accent-coloured label, then the track names, bullet-separated.
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(65, 105, 225);
        pdf.text("TRACKS", 20, baseline);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(12);
        pdf.setTextColor(51, 65, 85);
        pdf.text(
          trackNames.join("    •    "),
          20 + pdf.getTextWidth("TRACKS") + 16,
          baseline,
        );
      }
      pdf.addImage(dataUrl, "PNG", 0, stripHeight, width, height);

      pdf.save(`${safeStem(project.name)}.pdf`);
    } catch {
      window.alert("Couldn't create the PDF.");
    } finally {
      board.style.minHeight = prevMinHeight;
      board.style.height = prevHeight;
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
        <span className="flex items-baseline gap-1.5 justify-self-center select-none">
          <span className="text-base font-semibold tracking-tight text-royal-700">
            course-chain
          </span>
          <span className="text-xs font-medium text-gray-400">v{version}</span>
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

          {/* Project settings */}
          <button
            type="button"
            aria-label="Project settings"
            title="Project settings"
            disabled={onLauncher}
            onClick={() => setSettingsOpen(true)}
            className={iconButton}
          >
            <FontAwesomeIcon icon={faGear} className="text-base" />
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

      {/* Project settings dialog */}
      {settingsOpen && project && (
        <ProjectSettingsDialog
          project={project}
          onClose={() => setSettingsOpen(false)}
          onSave={updateProject}
        />
      )}
    </header>
  );
}
