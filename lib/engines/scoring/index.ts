// ─────────────────────────────────────────────
// KAIROS — Scoring Engine Public API
//
// Callers import only from this file.
// Internal trigger evaluators are not exported —
// they are an implementation detail of scoreEncounter.
//
// The only file that should call scoreEncounter() is:
//   • A future Reflection Controller
//   • app/(hospital)/reflection/page.tsx post-case
// ─────────────────────────────────────────────

export { scoreEncounter }          from "./evaluate";
export { getRegisteredTriggers }   from "./triggers";

export type {
  ScoringContext,
  HookResult,
  CategoryScore,
  Grade,
  PerformanceScore,
} from "./types";
