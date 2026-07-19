import { GROUPING_TYPES, type GroupingType } from "../db/groupings-schema";
import { EngineError } from "../engine/errors";

/** Max grouping name length — generous but bounded (mirrors typical folder names). */
export const MAX_GROUPING_NAME = 80;

/**
 * Pure validators for spec 090 grouping input. Kept DB-free so they are unit-
 * testable and reused by both the create and update paths. Each throws a typed
 * EngineError the route handlers map to a 400.
 */

/** Trim + bound a grouping name; throws on empty / over-length. */
export function normalizeGroupingName(name: unknown): string {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) throw new EngineError("invalid_name", 400, "name is required");
  if (trimmed.length > MAX_GROUPING_NAME) {
    throw new EngineError("invalid_name", 400, `name exceeds ${MAX_GROUPING_NAME} chars`);
  }
  return trimmed;
}

/** Validate a grouping type against the allowed set (`general | projects`). */
export function normalizeGroupingType(type: unknown): GroupingType {
  if (typeof type === "string" && (GROUPING_TYPES as readonly string[]).includes(type)) {
    return type as GroupingType;
  }
  throw new EngineError("invalid_type", 400, `type must be one of: ${GROUPING_TYPES.join(", ")}`);
}

/** Coerce an optional position to a non-negative integer (defaults to 0). */
export function normalizePosition(position: unknown): number {
  if (position == null) return 0;
  const n = Number(position);
  if (!Number.isFinite(n) || n < 0) throw new EngineError("invalid_position", 400, "position must be >= 0");
  return Math.floor(n);
}
