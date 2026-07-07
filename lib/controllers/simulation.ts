// ─────────────────────────────────────────────
// KAIROS — Simulation Controller
//
// Orchestration layer only. No business logic.
//
// This is the only file in the codebase that
// imports from both Hospital Engine and
// Investigation Engine. This design prevents
// circular dependencies between those engines.
//
// Responsibilities:
//   • Receive an ordered investigation ID and context.
//   • Call resolveInvestigation() from Investigation Engine.
//   • On success: map InvestigationReport → ResolvedInvestigation.
//   • Call recordInvestigationResult() on Hospital Engine.
//   • Return updated StudentSession, a student-safe report,
//     and post-case data for the future Reflection Engine.
//   • On failure: propagate InvestigationError unchanged.
//
// What this controller deliberately does NOT own:
//   • Resolution logic       — Investigation Engine.
//   • State transitions      — Hospital Engine.
//   • Scoring                — future Scoring Engine.
//   • Reflection content     — future Reflection Engine.
//   • Treatment evaluation   — future Treatment Engine.
//
// Protected field handling:
//   resolvedSeverityTier → stored in ResolvedInvestigation
//                          for Scoring Engine. Never in student report.
//   educationalNotes     → returned as PostCaseInvestigationData.
//                          Caller must hold this and release it only
//                          after encounter completion via Reflection Engine.
//   falsePositives       → same as educationalNotes.
//
// Error propagation:
//   InvestigationError variants are never swallowed or converted.
//   ORDER_NOT_FOUND, INVESTIGATION_NOT_FOUND, and NOT_YET_RESULTED
//   are returned as-is inside SimulationResult.
// ─────────────────────────────────────────────

import {
  StudentSession,
  ResolvedInvestigation,
  recordInvestigationResult,
} from "../engines/hospital";

import {
  resolveInvestigation,
  InvestigationContext,
  InvestigationError,
  InvestigationReport,
  ResolvedFinding,
  GeneratedECGFinding,
  SerialTestingAdvisory,
} from "../engines/investigation";

import { InvestigationType } from "../types/enums";

// ─── Student Facing Report ────────────────────
// The investigation result safe for student display.
//
// Protected fields explicitly absent:
//   educationalNotes     — post-case only, via Reflection Engine.
//   falsePositives       — post-case only, via Reflection Engine.
//   resolvedSeverityTier — Scoring Engine internal only.

export interface StudentFacingReport {
  readonly investigationId:        string;
  readonly name:                   string;
  readonly type:                   InvestigationType;
  readonly resolvedAt:             number;
  readonly findings:               readonly ResolvedFinding[];
  readonly ecgFindings:            readonly GeneratedECGFinding[];
  readonly redFlagFindings:        readonly string[];
  readonly serialTestingAdvisory?: SerialTestingAdvisory;
}

// ─── Post Case Investigation Data ─────────────
// Holds protected educational content for future
// Reflection Engine consumption.
//
// The caller is responsible for:
//   1. Accumulating one entry per resolved investigation.
//   2. Holding this data outside the student-facing session.
//   3. Releasing it only after encounter completion via the
//      Reflection Engine, which combines it with Disease Engine
//      ReflectionHooks to produce the post-case breakdown.

export interface PostCaseInvestigationData {
  readonly investigationId:  string;
  readonly educationalNotes: string;
  readonly falsePositives:   readonly string[];
}

// ─── Simulation Result ────────────────────────
// Discriminated union returned by resolveOrderedInvestigation.
//
// On success:
//   session:      updated StudentSession with result in state.
//   report:       student-safe result for immediate display.
//   postCaseData: protected content — do NOT show during encounter.
//
// On failure:
//   error: InvestigationError exactly as produced by Investigation Engine.

export type SimulationResult =
  | {
      readonly ok:           true;
      readonly session:      StudentSession;
      readonly report:       StudentFacingReport;
      readonly postCaseData: PostCaseInvestigationData;
    }
  | {
      readonly ok:    false;
      readonly error: InvestigationError;
    };

// ─── Private Mapping Functions ────────────────
// Pure field projections only. Zero business logic.

/**
 * Maps InvestigationReport to the minimal ResolvedInvestigation
 * stored by Hospital Engine in HospitalState.
 *
 * timestamp is intentionally absent — wall-clock time is already
 * captured in HospitalState.events via INVESTIGATION_RESULTED.
 * resolvedAt (clinical minutes) is the canonical time reference.
 */
function mapToResolvedInvestigation(
  report: InvestigationReport
): ResolvedInvestigation {
  return {
    investigationId: report.investigationId,
    name:            report.name,
    resolvedAt:      report.resolvedAt,
    hasRedFlags:     report.redFlagFindings.length > 0,
    findingCount:    report.findings.length + report.ecgFindings.length,
    severityTier:    report.resolvedSeverityTier,
  };
}

/**
 * Projects the student-safe subset of InvestigationReport.
 * Protected fields deliberately absent.
 */
function buildStudentFacingReport(
  report: InvestigationReport
): StudentFacingReport {
  return {
    investigationId:       report.investigationId,
    name:                  report.name,
    type:                  report.type,
    resolvedAt:            report.resolvedAt,
    findings:              report.findings,
    ecgFindings:           report.ecgFindings,
    redFlagFindings:       report.redFlagFindings,
    serialTestingAdvisory: report.serialTestingAdvisory,
  };
}

/**
 * Extracts protected educational content for Reflection Engine.
 * Must not be shown to the student during an active encounter.
 */
function buildPostCaseData(
  report: InvestigationReport
): PostCaseInvestigationData {
  return {
    investigationId:  report.investigationId,
    educationalNotes: report.educationalNotes,
    falsePositives:   report.falsePositives,
  };
}

// ─── Public API ───────────────────────────────

/**
 * Resolves an already-ordered investigation and records
 * the result into HospitalState.
 *
 * Precondition: ORDER_INVESTIGATION for this investigationId
 * has already been applied via applyAction() before calling this.
 *
 * @param session         Current StudentSession.
 * @param context         InvestigationContext — clinicalMinutes must
 *                        equal session.state.timeState.elapsedClinicalMinutes.
 * @param investigationId ID of the investigation to resolve.
 */
export function resolveOrderedInvestigation(
  session:         StudentSession,
  context:         InvestigationContext,
  investigationId: string
): SimulationResult {

  const result = resolveInvestigation(
    investigationId,
    context,
    session.state
  );

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const resolved   = mapToResolvedInvestigation(result.report);
  const newState   = recordInvestigationResult(session.state, resolved);

  const newSession: StudentSession = {
    sessionId: session.sessionId,
    encounter: session.encounter,
    state:     newState,
  };

  return {
    ok:           true,
    session:      newSession,
    report:       buildStudentFacingReport(result.report),
    postCaseData: buildPostCaseData(result.report),
  };
}
