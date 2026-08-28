// Re-exports the generated protobuf types and descriptors, plus the constants
// the rest of the library validates against. Import project data types from
// here (or the package index) rather than reaching into src/lib/gen.

export {
  type CourseChainProject,
  type Course,
  type Term,
  type Track,
  type CourseChainProjectJson,
  type CourseJson,
  type TermJson,
  type TrackJson,
  CourseChainProjectSchema,
  CourseSchema,
  TermSchema,
  TrackSchema,
} from "../gen/coursechain/v1/course_chain_pb";

/**
 * Schema version this build reads and writes. `deserializeProject` rejects any
 * document whose `versionNumber` differs. Bump it whenever the `.proto` changes
 * in a way that needs a migration.
 */
export const CURRENT_SCHEMA_VERSION = 1;

/** Largest number of terms a project may contain. */
export const MAX_TERMS = 100;

/** Largest number of tracks a project may contain. */
export const MAX_TRACKS = 100;

/** Longest allowed project name, in characters (trimmed). */
export const MAX_PROJECT_NAME_LENGTH = 100;

/** Longest allowed term name, in characters (trimmed). */
export const MAX_TERM_NAME_LENGTH = 40;

/** Longest allowed track name, in characters (trimmed). */
export const MAX_TRACK_NAME_LENGTH = 100;

/**
 * Highest allowed `Course.slots` value (the vertical position within a term).
 * A term therefore holds at most MAX_SLOT + 1 courses.
 */
export const MAX_SLOT = 50;
