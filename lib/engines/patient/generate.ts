// ─────────────────────────────────────────────
// KAIROS — Patient Case Generator
//
// Single public entry point for the Patient Engine.
// Orchestrates all sub-generators to produce
// a complete, immutable PatientCase.
//
// generatePatientCase is a pure function:
//   • Same seed → identical output
//   • No side effects
//   • No I/O
//   • No mutation of disease data
// ─────────────────────────────────────────────

import { Disease }          from "../disease/types";
import { Severity, InfarctLocation } from "../../types/enums";
import { PatientCase, HiddenState, SelectedSymptom } from "./types";
import { SeededRNG }        from "./rng";
import { generateProfile }  from "./generators/profile";
import { generateVitals }   from "./generators/vitals";
import { selectSymptoms }   from "./generators/symptoms";

// ─── Symptom Onset Configuration ─────────────
// How long the patient waited before presenting.
// Severer presentations → shorter onset window.

const ONSET_HOURS: Readonly<Record<Severity, { min: number; max: number }>> = {
  [Severity.Mild]:     { min: 4.0, max: 12.0 },
  [Severity.Moderate]: { min: 1.5, max: 6.0  },
  [Severity.Severe]:   { min: 0.5, max: 3.0  },
};

// ─── Infarct Location Derivation ─────────────

/**
 * Derives possible infarct locations from the symptom
 * locationDependency data in the disease.
 *
 * Only locations that appear in symptom data are considered.
 * This is honest about what the current Disease schema supports.
 *
 * Future improvement: add Disease.validLocations?: InfarctLocation[]
 * when the Disease interface is next reviewed.
 */
function selectInfarctLocation(
  rng:     SeededRNG,
  disease: Disease
): InfarctLocation | undefined {
  const mentioned = new Set<InfarctLocation>();

  for (const symptom of disease.symptoms) {
    symptom.locationDependency?.forEach(loc => mentioned.add(loc));
  }

  // No location-specific symptoms → location not clinically relevant
  if (mentioned.size === 0) return undefined;

  // 50% chance of a location-specific presentation
  if (!rng.chance(0.50)) return undefined;

  return rng.pick(Array.from(mentioned));
}

// ─── Presenting Complaints ────────────────────

/**
 * Derives presenting complaints from selected symptoms.
 * Red-flag symptoms are listed first.
 * Maximum 4 complaints (mirrors real clinical documentation).
 */
function buildPresentingComplaints(
  selectedSymptoms: readonly SelectedSymptom[]
): readonly string[] {
  const redFlags = selectedSymptoms.filter(s => s.isRedFlag);
  const others   = selectedSymptoms.filter(s => !s.isRedFlag);
  return [...redFlags, ...others]
    .slice(0, 4)
    .map(s => s.patientPhrase);
}

// ─── Utilities ────────────────────────────────

function generateOnsetHours(rng: SeededRNG, severity: Severity): number {
  const { min, max } = ONSET_HOURS[severity];
  const raw = min + rng.nextFloat() * (max - min);
  return Math.round(raw * 10) / 10;
}

function buildCaseId(
  diseaseId: string,
  severity: Severity,
  seed: number
): string {
  return `${diseaseId}-${severity}-${seed}`;
}

// ─── Public API ───────────────────────────────

/**
 * Generates a complete, immutable PatientCase from
 * a Disease and Severity.
 *
 * @param disease   A Disease object from the Disease Registry.
 * @param severity  The clinical severity to simulate.
 * @param seed      Optional seed for deterministic generation.
 *                  Same seed + disease + severity → identical case.
 */
export function generatePatientCase(
  disease:  Disease,
  severity: Severity,
  seed?:    number
): PatientCase {
  const resolvedSeed = seed ?? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  const rng          = new SeededRNG(resolvedSeed);

  // ─── Generation Sequence ──────────────────
  // Order matters: infarct location influences
  // both vitals and symptoms, so it is selected first.

  const infarctLocation   = selectInfarctLocation(rng, disease);
  const profile           = generateProfile(rng);
  const generatedVitals   = generateVitals(rng, disease, severity, infarctLocation);
  const selectedSymptoms  = selectSymptoms(rng, disease, severity, infarctLocation);
  const symptomOnsetHours = generateOnsetHours(rng, severity);

  // ─── Hidden State Initialisation ──────────
  // Consumed by future engines.
  // elapsedClinicalMinutes starts at 0.
  // Clinical Time Engine will advance this.

  const hidden: HiddenState = {
    chosenSeverity:          severity,
    selectedInfarctLocation: infarctLocation,
    elapsedClinicalMinutes:  0,
    generatedVitals,
    selectedSymptomIds:      selectedSymptoms.map(s => s.id),
    comorbidities:           profile.comorbidities,
  };

  return {
    caseId: buildCaseId(
  disease.id,
  severity,
  resolvedSeed
),
    diseaseId:            disease.id,
    seed:                 resolvedSeed,
    generatedAt:          new Date().toISOString(),
    profile,
    severity,
    symptomOnsetHours,
    presentingComplaints: buildPresentingComplaints(selectedSymptoms),
    generatedVitals,
    selectedSymptoms,
    hidden,
  };
}
