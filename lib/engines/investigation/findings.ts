// ─────────────────────────────────────────────
// KAIROS — Investigation Findings Generator
//
// Pure functions for sampling finding values from
// medically defined ranges and selecting ECG findings.
//
// All functions are pure:
//   • No side effects
//   • No mutation of inputs
//   • Same seed → same output
//
// Two finding types are handled:
//
// Quantitative — FindingValue.range.min !== max
//   A realistic value is sampled within the range.
//   isAbnormal is determined by comparison against
//   the normal tier's range for the same parameter.
//
// Qualitative — FindingValue.range.min === max (0/0 or 1/1)
//   The Disease Engine convention for presence/absence.
//   No sampling occurs — interpretation is used directly.
//   Detected via isQualitativeFinding() from kinetics.ts.
//
// ECG findings are filtered by:
//   1. Infarct location compatibility
//   2. Probability gate (deterministic via SeededRNG)
//
// Severity filtering is NOT applied here. The correct
// result tier was already resolved in resolve.ts before
// this function is called. All ecgFindings passed in
// are already tier-appropriate.
// ─────────────────────────────────────────────

import { SeededRNG }      from "../../shared/rng";
import { FindingValue, ECGFinding } from "../disease/types";
import { InfarctLocation }          from "../../types/enums";
import { isQualitativeFinding }     from "./kinetics";
import { ResolvedFinding, GeneratedECGFinding } from "./types";

// ─── Seed Derivation ──────────────────────────

/**
 * Derives a deterministic investigation-specific seed
 * from the patient's base seed and the investigation ID.
 *
 * Uses djb2 hash to produce a unique seed per investigation,
 * ensuring that ECG, Troponin, and CXR all produce
 * independent but reproducible value sequences for the
 * same patient.
 *
 * The `>>> 0` coercion enforces unsigned 32-bit integer.
 * `|| 1` prevents the zero seed which produces a degenerate sequence.
 */
export function deriveInvestigationSeed(
  baseSeed:        number,
  investigationId: string
): number {
  let hash = 5381;
  for (let i = 0; i < investigationId.length; i++) {
    hash = ((hash << 5) + hash + investigationId.charCodeAt(i)) | 0;
  }
  return ((baseSeed ^ hash) >>> 0) || 1;
}

// ─── Unit-Aware Decimal Rounding ──────────────

/**
 * Returns the number of decimal places appropriate for
 * the given unit. Prevents unrealistic values such as
 * "Troponin I: 4.8143 ng/mL" when "4.81 ng/mL" is correct.
 */
function decimalPlacesForUnit(unit: string): number {
  if (unit === "°C")      return 1;
  if (unit === "ratio")   return 2;
  if (unit === "ng/mL")   return 2;
  if (unit === "g/dL")    return 1;
  if (unit === "×10⁹/L")  return 1;
  if (unit === "mmol/L")  return 1;
  // Default: integers for mmHg, bpm, %, /min, /µL, U/L, etc.
  return 0;
}

// ─── Normal Range Lookup ──────────────────────

/**
 * Finds the reference range for a parameter from the
 * normal result tier's findings array.
 *
 * Returns undefined if the parameter is not present in
 * the normal tier. This triggers the isAbnormal fallback
 * in generateSingleFinding.
 */
function normalRangeFor(
  normalFindings: readonly FindingValue[],
  parameter:      string
): { min: number; max: number } | undefined {
  return normalFindings.find(f => f.parameter === parameter)?.range;
}

// ─── Abnormality Check ────────────────────────

/**
 * Determines whether a sampled value falls outside the
 * normal reference range.
 *
 * Returns false when no normal range is available — it
 * is safer to assume normal than to incorrectly flag
 * a finding as abnormal without a reference.
 */
function isValueAbnormal(
  value:       number,
  normalRange: { min: number; max: number } | undefined
): boolean {
  if (!normalRange) return false;
  return value < normalRange.min || value > normalRange.max;
}

// ─── Single Finding Generator ─────────────────

function generateSingleFinding(
  finding:        FindingValue,
  normalFindings: readonly FindingValue[],
  rng:            SeededRNG
): ResolvedFinding {
  if (isQualitativeFinding(finding.range)) {
    // Qualitative: range.min === range.max
    // No sampling — interpretation is the complete result
    return {
      kind:           "qualitative",
      parameter:      finding.parameter,
      interpretation: finding.interpretation,
      unit:           "none",
    };
  }

  // Quantitative: sample a realistic value within the range
  const decimals    = decimalPlacesForUnit(finding.unit);
  const value       = rng.nextFloatRange(finding.range.min, finding.range.max, decimals);
  const normalRange = normalRangeFor(normalFindings, finding.parameter);

  return {
    kind:           "quantitative",
    parameter:      finding.parameter,
    value,
    unit:           finding.unit,
    interpretation: finding.interpretation,
    isAbnormal:     isValueAbnormal(value, normalRange),
    // Fallback: use the tier's own range bounds when no normal reference exists.
    // This covers investigations without a normal tier counterpart.
    referenceMin:   normalRange?.min ?? finding.range.min,
    referenceMax:   normalRange?.max ?? finding.range.max,
  };
}

// ─── Public: Findings Generator ───────────────

/**
 * Generates ResolvedFinding objects for all findings in
 * the resolved result tier.
 *
 * tierFindings:   findings from the resolved severity tier
 * normalFindings: findings from results.normal for reference ranges
 * rng:            seeded RNG (deterministic per investigation)
 *
 * Returns an empty array if tierFindings is empty — valid for
 * investigations with only ECG findings (e.g. 12-Lead ECG).
 */
export function generateFindings(
  tierFindings:   readonly FindingValue[],
  normalFindings: readonly FindingValue[],
  rng:            SeededRNG
): readonly ResolvedFinding[] {
  return tierFindings.map(finding =>
    generateSingleFinding(finding, normalFindings, rng)
  );
}

// ─── Public: ECG Findings Generator ──────────

/**
 * Selects and maps ECG findings from the resolved result tier.
 *
 * Filtering pipeline:
 *
 * 1. Location filter:
 *    Findings with no locationDependency are always included.
 *    Findings with locationDependency that matches the patient's
 *    infarct location are included.
 *    Findings with mismatched location are included with 10%
 *    probability — reflecting real anatomical variability where
 *    inferior changes can occasionally appear in anterior STEMI.
 *    When infarctLocation is undefined, mismatched findings are
 *    included with 5% probability (location not determinable).
 *
 * 2. Probability filter:
 *    Each finding has a probability [0,1]. The RNG decides
 *    deterministically whether the finding appears.
 *    Example: VF has probability 0.40 → present in 40% of cases.
 *
 * Severity filtering is intentionally absent.
 * Callers pass ecgFindings from the already-resolved result tier.
 */
export function generateECGFindings(
    ecgFindings:     readonly ECGFinding[],
      infarctLocation: InfarctLocation | undefined,
        rng:             SeededRNG
        ): readonly GeneratedECGFinding[] {
          return ecgFindings
              .filter(f => {
                    if (!f.locationDependency || f.locationDependency.length === 0) return true;
                          if (infarctLocation !== undefined && f.locationDependency.includes(infarctLocation)) return true;
                                return false;
                                    })
                                        .filter(f => rng.chance(f.probability))
                                            .map(f => ({
                                                  leads:              f.leads,
                                                        finding:            f.finding,
                                                              interpretation:     f.interpretation as string,
                                                                    clinicalImportance: f.clinicalImportance as string,
                                                                        }));
                                                                        }

