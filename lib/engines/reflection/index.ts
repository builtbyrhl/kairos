// ─────────────────────────────────────────────
// KAIROS — Reflection Engine Public API
//
// Callers: post-case UI page (app/(hospital)/reflection)
// or a future Reflection Controller.
//
// Never called during an active encounter.
// ─────────────────────────────────────────────

export { generateReflection } from "./generate";

export type {
  PostCaseInvestigation,
  PostCaseTreatment,
  ReflectionContext,
  InvestigationReflection,
  TreatmentReflection,
  ReflectionResult,
} from "./types";
