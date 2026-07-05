// ─────────────────────────────────────────────
// KAIROS — Investigation Engine Public API
//
// Phase 1: types and kinetics exported.
//
// resolveInvestigation will be exported from this
// file when resolve.ts is implemented in Phase 2.
//
// Future exports (added when implemented):
//   export { resolveInvestigation } from "./resolve";
// ─────────────────────────────────────────────

export {
  computeHoursAfterEvent,
  resolveSeverityTier,
  hasResulted,
  isQualitativeFinding,
  extractNormalRange,
} from "./kinetics";

export type {
  InvestigationContext,
  GeneratedFinding,
  GeneratedQualitativeFinding,
  GeneratedECGFinding,
  ResolvedFinding,
  SerialTestingAdvisory,
  InvestigationReport,
  InvestigationError,
  ResolutionResult,
  InvestigationReportMapping,
} from "./types";
