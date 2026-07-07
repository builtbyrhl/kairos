// ─────────────────────────────────────────────
// KAIROS — Simulation Controller
//
// Orchestration layer only. No business logic.
//
// This is the only file that imports from both:
//   • Hospital Engine + Investigation Engine
//   • Hospital Engine + Treatment Engine
//
// This design prevents circular dependencies
// between those engines.
//
// Investigation flow:
//   resolveOrderedInvestigation() orchestrates:
//     resolveInvestigation() → recordInvestigationResult()
//
// Treatment flow:
//   resolveAdministeredTreatment() orchestrates:
//     evaluateTreatment() → recordTreatmentResult()
//
// What this controller deliberately does NOT own:
//   • Resolution logic      — Investigation Engine
//   • Evaluation logic      — Treatment Engine
//   • State transitions     — Hospital Engine
//   • Scoring               — future Scoring Engine
//   • Reflection content    — future Reflection Engine
//
// Protected field handling:
//   Investigation:
//     resolvedSeverityTier → ResolvedInvestigation (Scoring Engine)
//     educationalNotes     → PostCaseInvestigationData (Reflection Engine)
//     falsePositives       → PostCaseInvestigationData (Reflection Engine)
//
//   Treatment:
//     correctness          → PostCaseTreatmentData (Reflection Engine)
//     educationalNotes     → PostCaseTreatmentData (Reflection Engine)
//
// Error propagation:
//   All engine errors propagated unchanged.
//   Never swallowed or converted to unrelated types.
// ─────────────────────────────────────────────

import {
  StudentSession,
  ResolvedInvestigation,
  ResolvedTreatment,
  recordInvestigationResult,
  recordTreatmentResult,
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

import {
  evaluateTreatment,
  TreatmentContext,
  TreatmentError,
  TreatmentEvaluation,
  TreatmentIssue,
} from "../engines/treatment";

import { InvestigationType } from "../types/enums";

// ══════════════════════════════════════════════
// INVESTIGATION FLOW
// ══════════════════════════════════════════════

// ─── Student Facing Report ────────────────────
// Protected fields explicitly absent:
//   resolvedSeverityTier — Scoring Engine only
//   educationalNotes     — post-case, Reflection Engine
//   falsePositives       — post-case, Reflection Engine

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
// Released post-case by Reflection Engine only.
// Must never be shown during an active encounter.
// Caller accumulates one entry per resolved investigation.

export interface PostCaseInvestigationData {
  readonly investigationId:  string;
  readonly educationalNotes: string;
  readonly falsePositives:   readonly string[];
}

// ─── Simulation Result ────────────────────────

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

// ─── Private Mapping (Investigation) ──────────

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
 * @param context         InvestigationContext — clinicalMinutes must match
 *                        session.state.timeState.elapsedClinicalMinutes.
 * @param investigationId ID of the investigation to resolve.
 */
export function resolveOrderedInvestigation(
  session:         StudentSession,
  context:         InvestigationContext,
  investigationId: string
): SimulationResult {

  const result = resolveInvestigation(investigationId, context, session.state);

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

// ══════════════════════════════════════════════
// TREATMENT FLOW
// ══════════════════════════════════════════════

// ─── Treatment Facing Result ──────────────────
// What the student sees immediately after a treatment
// is administered and evaluated.
//
// correctness is deliberately absent — revealing it
// immediately violates the Kairos "no instant right/wrong
// feedback" principle. The student must reason from
// patient response and investigation results.
//
// issues ARE shown because they represent real-time
// clinical safety signals — a pharmacist or nurse in
// a real hospital would raise contraindications and
// duplication warnings immediately. These are not
// correctness verdicts; they are safety information.
//
// educationalNotes are post-case only.

export interface TreatmentFacingResult {
  readonly medicineId:   string;
  readonly medicineName: string;
  readonly evaluatedAt:  number;              // clinical minutes
  readonly issues:       readonly TreatmentIssue[];
}

// ─── Post Case Treatment Data ─────────────────
// Protected data released post-case by Reflection Engine.
// Must NOT be shown to the student during an active encounter.
// Caller accumulates one entry per evaluated treatment.
//
// correctness is revealed here — the Reflection Engine
// uses it alongside Disease Engine ReflectionHooks to
// produce the post-case learning breakdown.

export interface PostCaseTreatmentData {
  readonly medicineId:       string;
  readonly medicineName:     string;
  readonly correctness:      string;           // TreatmentCorrectness as string
  readonly educationalNotes: readonly string[];
}

// ─── Treatment Simulation Error ───────────────
// RECORD_NOT_FOUND: raised at controller boundary when no
//   TreatmentRecord exists for the given medicineId.
//   Indicates the caller forgot to apply ADMINISTER_TREATMENT
//   before calling resolveAdministeredTreatment.
//
// TreatmentError variants (MEDICINE_NOT_FOUND,
//   RECORD_NOT_IN_CONTEXT) propagated unchanged from
//   Treatment Engine.

export type TreatmentSimulationError =
  | TreatmentError
  | {
      readonly kind:       "RECORD_NOT_FOUND";
      readonly medicineId: string;
      readonly message:    string;
    };

// ─── Treatment Simulation Result ──────────────

export type TreatmentSimulationResult =
  | {
      readonly ok:           true;
      readonly session:      StudentSession;
      readonly result:       TreatmentFacingResult;
      readonly postCaseData: PostCaseTreatmentData;
    }
  | {
      readonly ok:    false;
      readonly error: TreatmentSimulationError;
    };

// ─── Private Mapping (Treatment) ──────────────

/**
 * Maps TreatmentEvaluation to the minimal ResolvedTreatment
 * stored by Hospital Engine in HospitalState.
 *
 * educationalNotes deliberately absent — held in PostCaseTreatmentData.
 * correctness stored as string — Hospital Engine does not import
 * Treatment Engine types to prevent circular dependency.
 */
function mapToResolvedTreatment(
  evaluation:      TreatmentEvaluation,
  clinicalMinutes: number
): ResolvedTreatment {
  return {
    medicineId:   evaluation.medicineId,
    medicineName: evaluation.medicineName,
    evaluatedAt:  clinicalMinutes,
    correctness:  evaluation.correctness,
    hasIssues:    evaluation.issues.length > 0,
    issueCount:   evaluation.issues.length,
  };
}

/**
 * Projects the student-safe subset of TreatmentEvaluation.
 * correctness and educationalNotes deliberately absent.
 */
function buildTreatmentFacingResult(
  evaluation:      TreatmentEvaluation,
  clinicalMinutes: number
): TreatmentFacingResult {
  return {
    medicineId:   evaluation.medicineId,
    medicineName: evaluation.medicineName,
    evaluatedAt:  clinicalMinutes,
    issues:       evaluation.issues,
  };
}

/**
 * Extracts protected content for Reflection Engine consumption.
 * Must not be shown to the student during an active encounter.
 */
function buildPostCaseTreatmentData(
  evaluation: TreatmentEvaluation
): PostCaseTreatmentData {
  return {
    medicineId:       evaluation.medicineId,
    medicineName:     evaluation.medicineName,
    correctness:      evaluation.correctness,
    educationalNotes: evaluation.educationalNotes,
  };
}

// ─── Public API ───────────────────────────────

/**
 * Evaluates a treatment that has already been administered
 * (via applyAction ADMINISTER_TREATMENT) and records the
 * result into HospitalState.
 *
 * Mirrors resolveOrderedInvestigation() in structure:
 *   1. Find the most recently administered record for medicineId.
 *   2. Call evaluateTreatment() from Treatment Engine.
 *   3. Map TreatmentEvaluation → ResolvedTreatment.
 *   4. Call recordTreatmentResult() on Hospital Engine.
 *   5. Return updated session + student-safe result + post-case data.
 *
 * Precondition: ADMINISTER_TREATMENT for this medicineId has
 * already been applied via applyAction() before calling this.
 *
 * @param session    Current StudentSession.
 * @param context    TreatmentContext. Caller sets allRecords to
 *                   session.state.administeredTreatments and clinicalMinutes
 *                   to session.state.timeState.elapsedClinicalMinutes.
 * @param medicineId The medicine ID to evaluate.
 */
export function resolveAdministeredTreatment(
  session:    StudentSession,
  context:    TreatmentContext,
  medicineId: string
): TreatmentSimulationResult {

  // ── 1. Find the most recent TreatmentRecord ──
  // Records are appended in order so the last matching
  // entry is the most recently administered.
  const matchingRecords = context.allRecords.filter(
    r => r.medicineId === medicineId
  );
  const record = matchingRecords[matchingRecords.length - 1];

  if (record === undefined) {
    return {
      ok:    false,
      error: {
        kind:       "RECORD_NOT_FOUND",
        medicineId,
        message:
          `No TreatmentRecord found for medicine "${medicineId}". ` +
          `Apply ADMINISTER_TREATMENT via applyAction() before calling ` +
          `resolveAdministeredTreatment().`,
      },
    };
  }

  // ── 2. Evaluate via Treatment Engine ─────────
  const result = evaluateTreatment(record, context);

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  // ── 3. Map to Hospital Engine types ──────────
  const clinicalMinutes = session.state.timeState.elapsedClinicalMinutes;
  const resolved        = mapToResolvedTreatment(result.evaluation, clinicalMinutes);

  // ── 4. Record result in HospitalState ─────────
  const newState = recordTreatmentResult(session.state, resolved);

  // ── 5. Reconstruct session immutably ──────────
  // sessionId and encounter preserved exactly.
  // Only state is replaced.
  const newSession: StudentSession = {
    sessionId: session.sessionId,
    encounter: session.encounter,
    state:     newState,
  };

  return {
    ok:           true,
    session:      newSession,
    result:       buildTreatmentFacingResult(result.evaluation, clinicalMinutes),
    postCaseData: buildPostCaseTreatmentData(result.evaluation),
  };
}
