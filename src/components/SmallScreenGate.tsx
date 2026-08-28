"use client";

import { useSyncExternalStore } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDisplay } from "@fortawesome/free-solid-svg-icons";

// course-chain's editor lays terms out in wide horizontal columns beside a
// sidebar, so it needs the room of a laptop or desktop display. Rather than
// support a cramped mobile layout, anything narrower than this gets a
// full-screen notice instead of the app.
const MIN_WIDTH = 1024;

function subscribe(onChange: () => void) {
  const query = window.matchMedia(`(max-width: ${MIN_WIDTH - 1}px)`);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function isSmallScreen() {
  return window.innerWidth < MIN_WIDTH;
}

export function SmallScreenGate() {
  // The static export prerenders without a window; assume a large screen there
  // and let the client correct it on hydration.
  const tooSmall = useSyncExternalStore(subscribe, isSmallScreen, () => false);

  if (!tooSmall) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-white px-8 text-center">
      {/* Icon */}
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-royal-50 text-royal-600">
        <FontAwesomeIcon icon={faDisplay} className="text-2xl" />
      </span>

      {/* Message */}
      <h1 className="text-xl font-semibold text-gray-900">
        course-chain works better on a larger screen
      </h1>
      <p className="max-w-sm text-sm leading-relaxed text-gray-500">
        The planner needs the horizontal room of a laptop or desktop display.
        Open course-chain on a bigger screen to get started.
      </p>
    </div>
  );
}
