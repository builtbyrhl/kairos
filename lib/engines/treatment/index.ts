// ─────────────────────────────────────────────
// KAIROS — Treatment Engine Public API
//
// Callers import only from this file.
// Internal functions (checkers, determineCorrectness,
// assembleEducationalNotes) are not exported —
// they are implementation details of evaluateTreatment.
// ─────────────────────────────────────────────

export { evaluateTreatment, evaluateAllTreatments } from "./evaluate";

export type {
  TreatmentCorrectness,
  TreatmentIssueKind,
  TreatmentIssue,
  TreatmentContext,
  TreatmentEvaluation,
  TreatmentError,
  TreatmentResult,
} from "./types";
