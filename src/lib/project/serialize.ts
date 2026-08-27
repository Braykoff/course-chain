import { fromBinary, toBinary } from "@bufbuild/protobuf";
import { type CourseChainProject, CourseChainProjectSchema } from "./schema";
import { validateProject } from "./validate";

/**
 * Encode a project to protobuf bytes for writing to a file or to IndexedDB.
 * The project is validated first, so an invalid project is never persisted.
 *
 * @throws {ProjectValidationError} if `project` breaks a structural rule.
 */
export function serializeProject(project: CourseChainProject): Uint8Array {
  validateProject(project);
  return toBinary(CourseChainProjectSchema, project);
}

/**
 * Decode protobuf bytes (from a file or from IndexedDB) into a project and
 * validate every structural invariant before returning it.
 *
 * @throws error from the protobuf runtime if `bytes` are not a valid encoding.
 * @throws {ProjectValidationError} if the bytes decode but describe an invalid
 *   project (wrong version, bad term ordering, dangling prereq, etc.).
 */
export function deserializeProject(bytes: Uint8Array): CourseChainProject {
  const project = fromBinary(CourseChainProjectSchema, bytes);
  validateProject(project);
  return project;
}
