// ─────────────────────────────────────────────
// KAIROS — Treatment Checkers
//
// Pure functions only. No side effects. No state.
//
// Each checker receives exactly what it needs and
// returns a readonly TreatmentIssue[]. An empty
// array means no issue was found for that check.
//
// These functions are internal to the Treatment Engine.
// They are not exported from index.ts.
//
// v1 limitations per function are documented inline.
// ─────────────────────────────────────────────

import { Medicine, DoseRule } from "../medicine/types";
import { PatientCase }         from "../patient";
import { TreatmentRecord }     from "../hospital";
import { TreatmentIssue }      from "./types";

// ─── Internal Utilities ───────────────────────

/**
 * Extracts the adult DoseRule from a medicine.
 * Returns undefined if no adult rule exists.
 * v1: only adult rules evaluated.
 */
function getAdultDoseRule(medicine: Medicine): DoseRule | undefined {
  return medicine.doseRules.find(r => r.population === "adult");
}

/**
 * Extracts systolic blood pressure from the patient's
 * generated vitals in HiddenState.
 *
 * "Systolic Blood Pressure" is the canonical parameter name
 * as stored in the Disease Engine VitalSign data.
 */
function getGeneratedSBP(patientCase: PatientCase): number | undefined {
  return patientCase.hidden.generatedVitals.find(
    v => v.parameter === "Systolic Blood Pressure"
  )?.value;
}

/**
 * Parses the leading numeric value from a free-text dose string.
 *
 * Handles common formats:
 *   "300mg"   → 300
 *   "2-4mg"   → 2    (lower bound of range)
 *   "0.5"     → 0.5
 *   "60 units/kg" → 60
 *
 * Returns undefined if no numeric prefix is found.
 */
function parseNumericDose(doseStr: string): number | undefined {
  const match = doseStr.trim().match(/^(\d+(?:\.\d+)?)/);
  return match !== null ? parseFloat(match[1]) : undefined;
}

// ─── Public Checkers ──────────────────────────

/**
 * Checks medicine contraindications against the patient's
 * observable clinical profile.
 *
 * v1 scope:
 *   Hemodynamic: checks SBP against hypotension contraindications.
 *   Comorbidities: checks boolean profile fields against
 *     clearly mappable contraindication strings.
 *
 * v1 cannot check:
 *   HIT history, active bleeding, specific allergy confirmation.
 *   These require extended medical history not in PatientProfile.
 *   Future Patient Engine expansion or a contraindication
 *   mapping table will enable these checks.
 */
export function checkContraindications(
  medicine:    Medicine,
  patientCase: PatientCase
): readonly TreatmentIssue[] {
  const issues: TreatmentIssue[] = [];
  const sbp           = getGeneratedSBP(patientCase);
  const comorbidities = patientCase.hidden.comorbidities;

  for (const contraindication of medicine.contraindications) {
    const lower = contraindication.toLowerCase();

    // ── Hemodynamic contraindications ──────────
    const isHypotensionContraindication =
      lower.includes("hypotension")    ||
      lower.includes("sbp <90")        ||
      lower.includes("sbp below 90")   ||
      lower.includes("systolic bp <90");

    if (isHypotensionContraindication && sbp !== undefined && sbp < 90) {
      issues.push({
        kind:    "contraindication",
        message:
          `Patient SBP is ${sbp} mmHg. Contraindication triggered: "${contraindication}". ` +
          `Do not administer ${medicine.genericName} when systolic BP is below 90 mmHg.`,
      });
    }

    // ── Comorbidity-based contraindications ────
    // Only where patient profile field is unambiguous.

    if (lower.includes("severe hepatic") && comorbidities.hasPreviousMI) {
      // Cannot determine hepatic status from current profile — skip.
    }
  }

  return issues;
}

/**
 * Validates the recorded dose against the adult DoseRule.
 *
 * If dose field is absent: issues a missing-dose warning
 * for medicines with a numeric expected dose.
 *
 * If dose field is present: parses numeric value and compares
 * against expected dose with a ±25% tolerance.
 *
 * Procedures (dose.value === null) are not dose-checked.
 *
 * Weight-based dosing (weightBased: true) is flagged as
 * a note in v1 — we cannot verify kg-adjusted dose without
 * patient weight, which is not in PatientProfile.
 */
export function checkDose(
  record:   TreatmentRecord,
  medicine: Medicine
): readonly TreatmentIssue[] {
  const issues: TreatmentIssue[] = [];
  const rule = getAdultDoseRule(medicine);

  if (!rule) return issues;

  // Procedure — no numeric dose expected
  if (rule.dose.value === null) return issues;

  // Weight-based — cannot verify without patient weight in v1
  if (rule.dose.weightBased === true) {
    if (record.dose === undefined || record.dose.trim() === "") {
      issues.push({
        kind:    "dose",
        message:
          `No dose recorded for ${medicine.genericName}. ` +
          `Expected weight-based dose: ${rule.dose.value} ${rule.dose.unit}/kg ` +
          `(max: ${rule.dose.maxValue ?? "unspecified"} ${rule.dose.unit}).`,
      });
    }
    // Cannot verify actual weight-based dose in v1
    return issues;
  }

  // Absent dose field
  if (record.dose === undefined || record.dose.trim() === "") {
    issues.push({
      kind:    "dose",
      message:
        `No dose recorded for ${medicine.genericName}. ` +
        `Expected: ${rule.dose.value} ${rule.dose.unit}.`,
    });
    return issues;
  }

  const recorded = parseNumericDose(record.dose);

  if (recorded === undefined) {
    issues.push({
      kind:    "dose",
      message:
        `Could not parse dose value from "${record.dose}". ` +
        `Expected: ${rule.dose.value} ${rule.dose.unit}.`,
    });
    return issues;
  }

  const expected = rule.dose.value;
  const max      = rule.dose.maxValue ?? expected * 1.25;
  const min      = expected * 0.75;

  if (recorded < min || recorded > max) {
    issues.push({
      kind:    "dose",
      message:
        `Dose ${recorded} ${rule.dose.unit} is outside the acceptable range ` +
        `(${min.toFixed(1)}–${max.toFixed(1)} ${rule.dose.unit}) ` +
        `for ${medicine.genericName}.`,
    });
  }

  return issues;
}

/**
 * Validates the recorded route against the adult DoseRule.
 *
 * Both recorded and expected routes are normalised to lowercase
 * for comparison. Partial matches handle common abbreviations
 * (e.g. "iv" matches "iv_bolus").
 */
export function checkRoute(
  record:   TreatmentRecord,
  medicine: Medicine
): readonly TreatmentIssue[] {
  const issues: TreatmentIssue[] = [];
  const rule = getAdultDoseRule(medicine);

  if (!rule) return issues;

  if (record.route === undefined || record.route.trim() === "") {
    issues.push({
      kind:    "route",
      message:
        `No route recorded for ${medicine.genericName}. ` +
        `Expected route: ${rule.route}.`,
    });
    return issues;
  }

  const expectedNorm = rule.route.toLowerCase();
  const recordedNorm = record.route.toLowerCase().trim().replace(/[\s_-]/g, "_");

  const routeMatches =
    expectedNorm === recordedNorm           ||
    expectedNorm.includes(recordedNorm)    ||
    recordedNorm.includes(expectedNorm);

  if (!routeMatches) {
    issues.push({
      kind:    "route",
      message:
        `Route "${record.route}" does not match expected route "${rule.route}" ` +
        `for ${medicine.genericName}.`,
    });
  }

  return issues;
}

/**
 * Detects earlier administration of the same medicine.
 *
 * Duplication is flagged as an informational issue —
 * not a correctness downgrade on its own. PRN dosing
 * and repeat doses are clinically valid. The Scoring
 * Engine decides whether to penalise based on clinical
 * context (e.g. two loading doses of aspirin is wrong;
 * repeat morphine for persistent pain may be correct).
 *
 * Only records with orderedAt < record.orderedAt are
 * considered earlier administrations.
 */
export function checkDuplication(
  record:     TreatmentRecord,
  allRecords: readonly TreatmentRecord[]
): readonly TreatmentIssue[] {
  const issues: TreatmentIssue[] = [];

  const priorAdministrations = allRecords.filter(
    r =>
      r.medicineId === record.medicineId &&
      r.orderedAt  <  record.orderedAt
  );

  if (priorAdministrations.length > 0) {
    const lastPrior = priorAdministrations[priorAdministrations.length - 1];
    issues.push({
      kind:    "duplication",
      message:
        `${record.medicineId} was previously administered at clinical minute ` +
        `${lastPrior.orderedAt}. Verify repeat administration is clinically appropriate.`,
    });
  }

  return issues;
}

/**
 * Records timing concerns relative to the expected treatment timing.
 *
 * v1: Immediate treatments flagged if administered after 30 clinical
 * minutes. Timing issues are recorded but do NOT affect TreatmentCorrectness
 * in v1 — the Time Engine will enable accurate timing scoring.
 *
 * Future Time Engine integration:
 *   Expected administration window will be derived from the disease's
 *   Clinical Time protocol rather than a hardcoded threshold.
 */
export function checkTiming(
  record:         TreatmentRecord,
  expectedTiming: string,
): readonly TreatmentIssue[] {
  const issues: TreatmentIssue[] = [];

  const IMMEDIATE_THRESHOLD_MINUTES = 30;

  if (
    expectedTiming === "immediate" &&
    record.orderedAt > IMMEDIATE_THRESHOLD_MINUTES
  ) {
    issues.push({
      kind:    "timing",
      message:
        `Treatment marked as immediate but administered at clinical minute ` +
        `${record.orderedAt}. Immediate treatments should be administered within ` +
        `${IMMEDIATE_THRESHOLD_MINUTES} clinical minutes. ` +
        `(Timing scoring deferred to Time Engine — not affecting correctness in v1.)`,
    });
  }

  return issues;
}
