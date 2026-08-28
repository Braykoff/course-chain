"use client";

import {
  type CourseChainProject,
  deserializeProject,
  serializeProject,
} from "@/lib/project";

// Projects live in localStorage, keyed by their UUID. Each value is the
// base64-encoded protobuf bytes of the project.
const KEY_PREFIX = "coursechain:project:";
const CHUNK = 0x8000;

export interface StoredProjectSummary {
  projectId: string;
  name: string;
  /** Whole seconds since the Unix epoch. */
  lastModified: number;
  trackNames: string[];
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Serialize `project` and write it to localStorage under its `projectId`. */
export function saveProject(project: CourseChainProject): void {
  const store = storage();
  if (!store || !project.projectId) return;
  try {
    store.setItem(KEY_PREFIX + project.projectId, bytesToBase64(serializeProject(project)));
  } catch {
    // Quota exceeded or an invalid project — skip the save rather than crash.
  }
}

/** Read and decode the project stored under `projectId`, or null. */
export function loadProject(projectId: string): CourseChainProject | null {
  const store = storage();
  const raw = store?.getItem(KEY_PREFIX + projectId);
  if (raw == null) return null;
  try {
    return deserializeProject(base64ToBytes(raw));
  } catch {
    return null;
  }
}

export function hasProject(projectId: string): boolean {
  return storage()?.getItem(KEY_PREFIX + projectId) != null;
}

export function deleteProject(projectId: string): void {
  storage()?.removeItem(KEY_PREFIX + projectId);
}

/** Every stored project, newest first. Corrupt entries are skipped. */
export function listProjects(): StoredProjectSummary[] {
  const store = storage();
  if (!store) return [];

  const summaries: StoredProjectSummary[] = [];
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i);
    if (!key?.startsWith(KEY_PREFIX)) continue;
    const raw = store.getItem(key);
    if (raw == null) continue;
    try {
      const project = deserializeProject(base64ToBytes(raw));
      summaries.push({
        projectId: project.projectId,
        name: project.name,
        lastModified: project.lastModified,
        trackNames: project.tracks.map((track) => track.name),
      });
    } catch {
      // Skip anything that doesn't decode.
    }
  }
  summaries.sort((a, b) => b.lastModified - a.lastModified);
  return summaries;
}
