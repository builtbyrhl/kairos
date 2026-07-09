// ─────────────────────────────────────────────
// KAIROS — Scoring Trigger Evaluators
//
// Maps ReflectionHook.trigger strings to
// evaluation functions.
//
// Each evaluator returns:
//   true  = bad condition was met (hook triggered, student loses points)
//   false = student avoided the mistake (student earns points)
//
// v1 limitations (documented per evaluator):
//   • Timing-based triggers use approximate heuristics.
//     Time Engine will enable precise evaluation.
//   • "Cath lab activation" has no explicit Hospital Engine
//     event — approximated from early investigation+treatment
//     action density.
//   • Drug interaction triggers not evaluatable until
//     DrugInteraction checking is implemented.
//   • AI-dependent triggers (e.g. atypical presentation
//     recognition) always return false — benefit of the doubt.
//
// Unknown triggers return false by default.
// Adding a new disease with new trigger strings requires
// adding corresponding evaluators here.
// (C1 architectural fix — ClinicalEvents const map —
// will enforce this at compile time before Disease #2.)
// ─────────────────────────────────────────────

import { ScoringContext } from "./types";

// ─── Evaluator type ───────────────────────────

export type TriggerEvaluator = (context: ScoringContext) => boolean;

// ─── STEMI trigger evaluators ─────────────────

/**
 * ECG not ordered within 10 clinical minutes.
 * Triggered if INVESTIGATION_ORDERED for ecg_12lead
 * occurred after 10 clinical minutes — or never.
 */
function ecgNotOrderedWithin10Minutes(ctx: ScoringContext): boolean {
  const event = ctx.state.events.find(
    e =>
      e.type                              === "INVESTIGATION_ORDERED" &&
      e.payload["investigationId"]        === "ecg_12lead"
  );
  if (!event) return true; // Never ordered = definitely triggered
  return event.clinicalMinutes > 10;
}

/**
 * Cath lab not activated within 30 clinical minutes.
 *
 * v1 approximation:
 * No "cath lab activation" event exists in Hospital Engine v1.
 * Approximated as: fewer than 2 investigation or treatment events
 * occurred within the first 30 clinical minutes.
 *
 * This is intentionally forgiving. Time Engine will enable
 * precise door-to-balloon time evaluation.
 */
function cathLabNotActivatedWithin30Minutes(ctx: ScoringContext): boolean {
  const earlyMeaningfulEvents = ctx.state.events.filter(
    e =>
      e.clinicalMinutes <= 30 &&
      (e.type === "INVESTIGATION_ORDERED" || e.type === "TREATMENT_ADMINISTERED")
  );
  return earlyMeaningfulEvents.length < 2;
}

/**
 * Dual antiplatelet therapy incomplete or missing.
 * Triggered if either aspirin OR clopidogrel was not administered.
 * Both must be given — neither alone is sufficient.
 */
function antiplateletIncompleteOrMissing(ctx: ScoringContext): boolean {
  const records = ctx.state.administeredTreatments;
  const aspirinGiven     = records.some(r => r.medicineId === "aspirin");
  const clopidogrelGiven = records.some(r => r.medicineId === "clopidogrel");
  return !aspirinGiven || !clopidogrelGiven;
}

/**
 * Echo ordered before ECG was ordered.
 * Triggered if echo_2d was ordered AND
 * its order preceded the ECG order (or ECG was never ordered).
 */
function echoBeforeCathLabActivation(ctx: ScoringContext): boolean {
  const ecgOrderEvent  = ctx.state.events.find(
    e => e.type === "INVESTIGATION_ORDERED" && e.payload["investigationId"] === "ecg_12lead"
  );
  const echoOrderEvent = ctx.state.events.find(
    e => e.type === "INVESTIGATION_ORDERED" && e.payload["investigationId"] === "echo_2d"
  );

  if (!echoOrderEvent) return false; // Echo not ordered = no issue
  if (!ecgOrderEvent)  return true;  // Echo ordered but ECG never ordered = issue
  return echoOrderEvent.clinicalMinutes < ecgOrderEvent.clinicalMinutes;
}

/**
 * Nitrate given when systolic BP was below 90 mmHg.
 *
 * v1: nitrates are not in our Medicine Registry, so this trigger
 * cannot fire under normal simulation conditions.
 * Will become evaluatable when nitrates are added to the registry.
 */
function nitrateGivenWithSBPBelow90(ctx: ScoringContext): boolean {
  const nitrateGiven = ctx.state.administeredTreatments.some(
    r =>
      r.medicineId.toLowerCase().includes("nitrate")    ||
      r.medicineId.toLowerCase().includes("nitroglycerin") ||
      r.medicineId.toLowerCase().includes("isosorbide")
  );
  if (!nitrateGiven) return false;

  const sbp = ctx.patientCase.hidden.generatedVitals.find(
    v => v.parameter === "Systolic Blood Pressure"
  )?.value;

  return sbp !== undefined && sbp < 90;
}

/**
 * Oxygen given when SpO₂ was at or above 94%.
 * Triggered if oxygen was administered but the patient's
 * generated SpO₂ was ≥ 94% (i.e. patient was normoxic).
 *
 * This is evaluatable in v1 because SpO₂ is in HiddenState.generatedVitals.
 */
function oxygenGivenWithSPO2Above94(ctx: ScoringContext): boolean {
  const oxygenGiven = ctx.state.administeredTreatments.some(
    r => r.medicineId === "oxygen"
  );
  if (!oxygenGiven) return false;

  const spo2 = ctx.patientCase.hidden.generatedVitals.find(
    v => v.parameter === "SpO₂"
  )?.value;

  // If we can't determine SpO₂, assume it was appropriate
  return spo2 !== undefined && spo2 >= 94;
}

/**
 * Atypical presentation not recognised.
 *
 * v1: cannot evaluate without AI analysis of the student's
 * history-taking responses. Always returns false — student
 * receives benefit of the doubt.
 * Will become evaluatable when AI Brain Engine is integrated.
 */
function atypicalPresentationNotRecognised(_ctx: ScoringContext): boolean {
  return false;
}

// ─── Evaluator registry ───────────────────────
// Keys must exactly match ReflectionHook.trigger strings.
// Unknown keys fall back to the defaultEvaluator (false).

const EVALUATORS: Readonly<Record<string, TriggerEvaluator>> = {
  "ecg_not_ordered_within_10_clinical_minutes":       ecgNotOrderedWithin10Minutes,
  "cath_lab_not_activated_within_30_clinical_minutes": cathLabNotActivatedWithin30Minutes,
  "antiplatelet_incomplete_or_missing":               antiplateletIncompleteOrMissing,
  "echo_ordered_before_cath_lab_activation":          echoBeforeCathLabActivation,
  "nitrate_given_with_sbp_below_90":                  nitrateGivenWithSBPBelow90,
  "oxygen_given_with_spo2_above_94":                  oxygenGivenWithSPO2Above94,
  "atypical_presentation_not_recognised":             atypicalPresentationNotRecognised,
};

// ─── Public lookup ────────────────────────────

/**
 * Returns the evaluator for a given trigger string.
 * Falls back to a permissive default (returns false) for
 * unknown triggers — unrecognised triggers never penalise students.
 */
export function getTriggerEvaluator(trigger: string): TriggerEvaluator {
  return EVALUATORS[trigger] ?? (() => false);
}

/**
 * All registered trigger strings.
 * Useful for validating disease data in the Disease validator.
 */
export function getRegisteredTriggers(): ReadonlySet<string> {
  return new Set(Object.keys(EVALUATORS));
}
