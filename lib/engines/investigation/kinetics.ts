// ─────────────────────────────────────────────
// KAIROS — Investigation Kinetics
//
// Pure functions for resolving which result tier
// to use for an investigation based on:
//   • Disease severity (the base tier)
//   • Kinetic profile (time-dependent biomarkers)
//   • Time elapsed since the pathological event
//
// No randomness. No side effects. No mutation.
//
// computeHoursAfterEvent combines two time axes:
//   1. Patient's wait before presenting (symptomOnsetHours)
//   2. Clinical time elapsed since case started
//
// This accurately represents when in the disease
// timeline the investigation was ordered.
//
// resolveSeverityTier applies the kinetic profile.
// Investigations without a kineticProfile (e.g. ECG,
// chest X-ray) always return the base severity tier.
// Biomarkers (e.g. troponin) rise and fall over time.
//
// Phase 1 applies a binary model:
//   Before rise → normal
//   During rise/peak → base severity
//   After normalisation → normal
//
// A graduated model (interpolating between tiers
// during the rising phase) can be introduced without
// interface changes when clinical accuracy demands it.
// ─────────────────────────────────────────────

import { Severity }      from "../../types/enums";
import { Investigation } from "../disease/types";

// ─── Time Computation ─────────────────────────

/**
 * Computes total hours since the pathological event began.
 *
 * symptomOnsetHours:      how long before presentation the event started.
 *                         From PatientCase.symptomOnsetHours.
 *
 * elapsedClinicalMinutes: how many clinical minutes have elapsed
 *                         since the hospital encounter began.
 *                         From HospitalState.timeState.elapsedClinicalMinutes.
 *
 * The sum represents the total time the disease process has
 * been active at the moment the investigation is resolved.
 */
export function computeHoursAfterEvent(
  symptomOnsetHours:      number,
  elapsedClinicalMinutes: number
): number {
  return symptomOnsetHours + (elapsedClinicalMinutes / 60);
}

// ─── Severity Tier Resolution ─────────────────

/**
 * Resolves which InvestigationResult tier to use.
 *
 * If the investigation has no kineticProfile, the result
 * tier equals the disease severity directly. This applies
 * to findings that do not change over time (ECG morphology,
 * chest X-ray appearances, echocardiographic wall motion).
 *
 * If a kineticProfile exists, the function determines
 * where on the biomarker curve the current time falls:
 *
 *   Before riseOnset.hoursAfterEvent.min:
 *     Biomarker has not yet detached from myocardium.
 *     Return "normal" — this is clinically correct for
 *     troponin drawn within 3 hours of symptom onset.
 *
 *   After normalises.hoursAfterEvent.min:
 *     Biomarker has cleared. Return "normal".
 *     This enables simulation of late presentations
 *     where troponin has returned to baseline.
 *
 *   Between rise onset and normalisation:
 *     Biomarker is detectable and elevated.
 *     Return baseSeverity — the Disease Engine defines
 *     the expected value range for that severity tier.
 *
 * Using the minimum of the rise onset range is intentional
 * and conservative: we report elevation as soon as it is
 * possible rather than as soon as it is guaranteed. This
 * models real-world variability where some patients
 * show earlier elevation than others.
 */
export function resolveSeverityTier(
  investigation:   Investigation,
  hoursAfterEvent: number,
  baseSeverity:    Severity
): Severity | "normal" {
  const profile = investigation.kineticProfile;

  if (!profile) {
    // No time-dependence — result equals disease severity
    return baseSeverity;
  }

  const riseStartsAt    = profile.riseOnset.hoursAfterEvent.min;
  const normalisesAfter = profile.normalises.hoursAfterEvent.min;

  if (hoursAfterEvent < riseStartsAt) {
    return "normal";
  }

  if (hoursAfterEvent >= normalisesAfter) {
    return "normal";
  }

  return baseSeverity;
}

// ─── Result Availability ──────────────────────

/**
 * Determines whether an investigation has resulted
 * based on the order record and current clinical time.
 *
 * In v1, Investigation Engine sets resultAvailableAt
 * equal to orderedAt (results available immediately).
 * This function is the future hook for Time Engine
 * integration — when result delays are modelled, this
 * function uses investigation type and timing to compute
 * the delay.
 *
 * Returns true when the result is available.
 */
export function hasResulted(
  resultAvailableAt: number,
  currentMinutes:    number
): boolean {
  return currentMinutes >= resultAvailableAt;
}

// ─── Qualitative Finding Detection ───────────

/**
 * Detects whether a FindingValue represents a qualitative
 * (presence/absence) rather than a quantitative (sampled)
 * finding.
 *
 * The Disease Engine represents qualitative findings using
 * the semantic convention range:{min:0,max:0} for absent
 * and range:{min:1,max:1} for present.
 *
 * Sampling within these ranges always returns 0 or 1 —
 * not a meaningful clinical value. This function signals
 * to findings.ts that no sampling should occur.
 */
export function isQualitativeFinding(
  range: { min: number; max: number }
): boolean {
  return range.min === range.max;
}

// ─── Normal Range Extraction ──────────────────

/**
 * Extracts reference range bounds from the "normal" tier
 * of a specific finding parameter.
 *
 * Returns undefined if the parameter is not found in the
 * normal tier — which signals the Hospital Engine to omit
 * the reference range from display.
 *
 * These bounds give the student context for interpreting
 * whether a result is within expected limits.
 */
export function extractNormalRange(
  investigation: Investigation,
  parameter:     string
): { min: number; max: number } | undefined {
  return investigation.results.normal.findings.find(
    f => f.parameter === parameter
  )?.range;
}
