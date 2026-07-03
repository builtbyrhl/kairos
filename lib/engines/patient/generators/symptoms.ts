// ─────────────────────────────────────────────
// KAIROS — Symptom Selector
//
// Selects an appropriate set of symptoms from
// Disease.symptoms based on:
//   • severity compatibility
//   • frequency-derived probability
//   • infarct location adjustment
//
// For each selected symptom, one patientPhrase
// is chosen from the disease data.
//
// A safety guarantee ensures at least one symptom
// is always selected, preventing empty presentations.
// ─────────────────────────────────────────────

import { SeededRNG }        from "../rng";
import { SelectedSymptom }  from "../types";
import { Disease }          from "../../disease/types";
import { Severity, Frequency, InfarctLocation, ClinicalImportance } from "../../../types/enums";

// ─── Frequency → Probability ──────────────────

const FREQUENCY_PROBABILITY: Readonly<Record<Frequency, number>> = {
  [Frequency.Most]: 0.90,
  [Frequency.Some]: 0.55,
  [Frequency.Rare]: 0.15,
};

/**
 * When a symptom has locationDependency and the patient's
 * infarct location does NOT match, reduce probability but
 * do not eliminate — some crossover is clinically realistic.
 * Example: jaw pain is less common in anterior STEMI but not impossible.
 */
const LOCATION_MISMATCH_MULTIPLIER = 0.20;

// ─── Clinical Importance Sort Order ──────────

const IMPORTANCE_ORDER: Readonly<Record<ClinicalImportance, number>> = {
  [ClinicalImportance.Critical]: 0,
  [ClinicalImportance.High]:     1,
  [ClinicalImportance.Moderate]: 2,
  [ClinicalImportance.Low]:      3,
};

// ─── Helpers ──────────────────────────────────

function adjustedProbability(
  frequency:          Frequency,
  locationDependency: InfarctLocation[] | undefined,
  infarctLocation:    InfarctLocation | undefined
): number {
  const base = FREQUENCY_PROBABILITY[frequency];

  // Symptom is location-specific and patient location doesn't match
  if (
    infarctLocation    !== undefined &&
    locationDependency !== undefined &&
    locationDependency.length > 0    &&
    !locationDependency.includes(infarctLocation)
  ) {
    return base * LOCATION_MISMATCH_MULTIPLIER;
  }

  return base;
}

// ─── Public Selector ──────────────────────────

export function selectSymptoms(
  rng:             SeededRNG,
  disease:         Disease,
  severity:        Severity,
  infarctLocation: InfarctLocation | undefined
): readonly SelectedSymptom[] {
  const selected: SelectedSymptom[] = [];

  for (const symptom of disease.symptoms) {
    // Skip symptoms not applicable to this severity
    if (!symptom.severity.includes(severity)) continue;

    const probability = adjustedProbability(
      symptom.frequency,
      symptom.locationDependency,
      infarctLocation
    );

    if (!rng.chance(probability)) continue;

    selected.push({
      id:            symptom.id,
      name:          symptom.name,
      patientPhrase: rng.pick(symptom.patientPhrases),
      isRedFlag:     symptom.redFlag,
    });
  }

  // ─── Safety Guarantee ─────────────────────
  // If all symptoms failed their probability roll,
  // force-include the most clinically important one
  // applicable to this severity.

  if (selected.length === 0) {
    const candidates = disease.symptoms
      .filter(s => s.severity.includes(severity))
      .sort((a, b) =>
        IMPORTANCE_ORDER[a.clinicalImportance] -
        IMPORTANCE_ORDER[b.clinicalImportance]
      );

    const fallback = candidates[0];

    if (fallback !== undefined) {
      selected.push({
        id:            fallback.id,
        name:          fallback.name,
        patientPhrase: rng.pick(fallback.patientPhrases),
        isRedFlag:     fallback.redFlag,
      });
    }
  }

  return selected;
}
