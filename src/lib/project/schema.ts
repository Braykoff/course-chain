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
