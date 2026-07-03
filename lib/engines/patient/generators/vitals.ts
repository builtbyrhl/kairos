// ─────────────────────────────────────────────
// KAIROS — Vital Signs Generator
//
// Generates realistic vital sign values within
// the medically validated ranges stored in
// Disease.vitalSigns.
//
// Exceptions (e.g. bradycardia in inferior STEMI)
// are applied probabilistically when the patient's
// infarct location matches the exception condition.
//
// The Hospital Engine decides how to display
// generated vitals. This file contains no UI logic.
// ─────────────────────────────────────────────

import { SeededRNG }       from "../rng";
import { GeneratedVital }  from "../types";
import { Disease, VitalSign } from "../../disease/types";
import { Severity, InfarctLocation } from "../../../types/enums";
import { Range } from "../../../types/common";

// ─── Helpers ──────────────────────────────────

function getRangeForSeverity(
  vital: VitalSign,
  severity: Severity
): { range: Range } {
  switch (severity) {
    case Severity.Mild:     return vital.mild;
    case Severity.Moderate: return vital.moderate;
    case Severity.Severe:   return vital.severe;
  }
}

/**
 * Determine decimal places from unit string.
 * Temperature: 1 decimal place.
 * Ratio (e.g. CTR): 2 decimal places.
 * All others: integers.
 */
function decimalPlaces(unit: string): number {
  if (unit === "°C")    return 1;
  if (unit === "ratio") return 2;
  return 0;
}

function isOutsideRange(value: number, range: Range): boolean {
  return value < range.min || value > range.max;
}

function isRedFlag(value: number, vital: VitalSign): boolean {
  if (vital.redFlagBelow !== undefined && value < vital.redFlagBelow) return true;
  if (vital.redFlagAbove !== undefined && value > vital.redFlagAbove) return true;
  return false;
}

// ─── Single Vital Generator ───────────────────

/**
 * Probability that a location-specific exception triggers
 * when the patient's infarct location matches.
 * Example: not all inferior STEMI patients are bradycardic.
 */
const EXCEPTION_PROBABILITY = 0.35;

function generateSingleVital(
  rng:             SeededRNG,
  vital:           VitalSign,
  severity:        Severity,
  infarctLocation: InfarctLocation | undefined
): GeneratedVital {
  // Find an applicable exception for this patient's infarct location
  const applicableException = vital.exceptions?.find(ex =>
    infarctLocation !== undefined &&
    ex.locationDependency !== undefined &&
    ex.locationDependency.includes(infarctLocation)
  );

  // Apply exception probabilistically — not every matching patient shows it
  const useException = (
    applicableException !== undefined &&
    rng.chance(EXCEPTION_PROBABILITY)
  );

  const range = useException
    ? applicableException!.range
    : getRangeForSeverity(vital, severity).range;

  const value = rng.nextFloatRange(range.min, range.max, decimalPlaces(vital.unit));

  return {
    parameter:  vital.parameter,
    value,
    unit:       vital.unit,
    isAbnormal: isOutsideRange(value, vital.normal.range),
    isRedFlag:  isRedFlag(value, vital),
  };
}

// ─── Public Generator ─────────────────────────

export function generateVitals(
  rng:             SeededRNG,
  disease:         Disease,
  severity:        Severity,
  infarctLocation: InfarctLocation | undefined
): readonly GeneratedVital[] {
  return disease.vitalSigns.map(vital =>
    generateSingleVital(rng, vital, severity, infarctLocation)
  );
}
