// ─────────────────────────────────────────────
// KAIROS — Treatment Evaluator
//
// Core evaluation logic. Orchestrates all checker
// functions to produce a TreatmentEvaluation.
//
// Single public function: evaluateTreatment()
// Convenience wrapper:    evaluateAllTreatments()
//
// This function is pure:
//   • No side effects
//   • No mutation of any input
//   • Same inputs → same evaluation
//
// v1 known gaps (see types.ts):
//   • TreatmentReference.condition not evaluated
//   • IncorrectChoice matching by medicine ID absent
//   • Drug interaction checks deferred
// ─────────────────────────────────────────────

import { TreatmentRecord }   from "../hospital";
import { MedicineRegistry }  from "../../data/medicines/registry";

import {
  TreatmentContext,
  TreatmentCorrectness,
  TreatmentEvaluation,
  TreatmentIssue,
  TreatmentResult,
} from "./types";

import {
  checkContraindications,
  checkDose,
  checkRoute,
  checkDuplication,
  checkTiming,
} from "./checkers";

// ─── Private Helpers ──────────────────────────

/**
 * Determines the overall TreatmentCorrectness level
 * from the collected issues and list membership.
 *
 * Priority order (highest severity wins):
 *   1. contraindicated — safety issue for this patient
 *   2. incorrect       — explicitly wrong per Disease Engine
 *   3. unnecessary     — not indicated for this disease
 *   4. acceptable      — correct medicine, issues present
 *   5. correct         — correct medicine, no issues
 *
 * Note: timing issues alone do not downgrade correctness
 * in v1 because timing scoring requires the Time Engine.
 */
function determineCorrectness(
  inCorrectList:  boolean,
  contraindicated: boolean,
  issues:          readonly TreatmentIssue[]
): TreatmentCorrectness {
  if (contraindicated) return "contraindicated";
  if (!inCorrectList)  return "unnecessary";

  // Has non-timing issues that affect appropriateness
  const hasSignificantIssues = issues.some(
    i => i.kind === "dose" || i.kind === "route"
  );

  return hasSignificantIssues ? "acceptable" : "correct";
}

/**
 * Assembles educational notes from all available sources.
 *
 * Sources in priority order:
 *   1. Disease Engine's TreatmentReference.educationalNotes
 *      (disease-specific context for this treatment)
 *   2. Medicine Engine's Medicine.educationalNotes
 *      (general pharmacology notes)
 *
 * These notes must NOT be shown during active encounter.
 * Released post-case via Reflection Engine only.
 */
function assembleEducationalNotes(
  context:    TreatmentContext,
  medicineId: string
): readonly string[] {
  const notes: string[] = [];

  const treatmentRef = context.disease.treatments.correct.find(
    t => t.medicineId === medicineId
  );
  if (treatmentRef) {
    notes.push(...treatmentRef.educationalNotes);
  }

  const medicine = MedicineRegistry.getById(medicineId);
  if (medicine) {
    notes.push(...medicine.educationalNotes);
  }

  return notes;
}

// ─── Public API ───────────────────────────────

/**
 * Evaluates a single TreatmentRecord against the disease
 * protocol and patient profile.
 *
 * Evaluation pipeline:
 *   1. Look up medicine in MedicineRegistry.
 *   2. Check Disease Engine correct + incorrect lists.
 *   3. Run all checker functions (contraindications,
 *      dose, route, duplication, timing).
 *   4. Determine overall correctness.
 *   5. Assemble educational notes.
 *   6. Return TreatmentEvaluation.
 *
 * @param record   The specific TreatmentRecord to evaluate.
 * @param context  TreatmentContext including all session records.
 */
export function evaluateTreatment(
  record:  TreatmentRecord,
  context: TreatmentContext
): TreatmentResult {

  // ── 1. Resolve medicine ──────────────────────
  const medicine = MedicineRegistry.getById(record.medicineId);

  if (!medicine) {
    return {
      ok:    false,
      error: {
        kind:       "MEDICINE_NOT_FOUND",
        medicineId: record.medicineId,
        message:
          `Medicine "${record.medicineId}" is not registered in the Medicine Registry. ` +
          `Add it to lib/data/medicines/ and register it in MedicineRegistry.`,
      },
    };
  }

  // ── 2. Check Disease Engine lists ────────────
  const correctRef = context.disease.treatments.correct.find(
    t => t.medicineId === record.medicineId
  );
  const inCorrectList = correctRef !== undefined;

  // v1 note: IncorrectChoice matching by medicineId deferred.
  // IncorrectChoice.id values describe decision patterns, not medicine IDs.
  // Resolution: Disease Engine schema update (IncorrectChoice.medicineIds?: string[]).
  // Until then: medicines not in treatments.correct are "unnecessary".

  // ── 3. Collect all issues ────────────────────
  const allIssues: TreatmentIssue[] = [];

  // Contraindications — run regardless of list membership
  const contraindicationIssues = checkContraindications(medicine, context.patientCase);
  allIssues.push(...contraindicationIssues);
  const contraindicated = contraindicationIssues.length > 0;

  // Dose, route, duplication, timing — only if in correct list
  if (inCorrectList) {
    allIssues.push(...checkDose(record, medicine));
    allIssues.push(...checkRoute(record, medicine));
    allIssues.push(...checkDuplication(record, context.allRecords));

    if (correctRef?.timing) {
      allIssues.push(...checkTiming(record, correctRef.timing));
    }
  }

  // ── 4. Determine correctness ─────────────────
  const correctness = determineCorrectness(
    inCorrectList,
    contraindicated,
    allIssues
  );

  // ── 5. Build evaluation ───────────────────────
  const evaluation: TreatmentEvaluation = {
    medicineId:       record.medicineId,
    medicineName:     medicine.genericName,
    correctness,
    issues:           allIssues,
    educationalNotes: assembleEducationalNotes(context, record.medicineId),
  };

  return { ok: true, evaluation };
}

/**
 * Evaluates all TreatmentRecords in the session.
 *
 * Convenience wrapper — calls evaluateTreatment for each record.
 * No logic duplication: context.allRecords provides the full set.
 *
 * @param context TreatmentContext — allRecords contains all records to evaluate.
 */
export function evaluateAllTreatments(
  context: TreatmentContext
): readonly TreatmentResult[] {
  return context.allRecords.map(record =>
    evaluateTreatment(record, context)
  );
}
