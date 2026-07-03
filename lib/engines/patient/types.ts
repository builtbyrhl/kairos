// ─────────────────────────────────────────────
// KAIROS — Patient Engine Types
//
// All interfaces are readonly.
// PatientCase is the complete immutable output
// of the Patient Engine.
//
// HiddenState is initialised here and consumed
// by future engines (Clinical Time, Outcome,
// Reflection). It is never shown to the student.
// ─────────────────────────────────────────────

import { Severity, InfarctLocation } from "../../types/enums";

// ─── Primitives ───────────────────────────────

export type PatientSex = "male" | "female";

// ─── Comorbidity Profile ──────────────────────

export interface ComorbidityProfile {
  readonly isSmoker:        boolean;
  readonly hasDiabetes:     boolean;
  readonly hasHypertension: boolean;
  readonly hasPreviousMI:   boolean;
}

// ─── Patient Profile ──────────────────────────
// The human being behind the disease.
// Generated independently of disease data.

export interface PatientProfile {
  readonly fullName:      string;
  readonly age:           number;
  readonly sex:           PatientSex;
  readonly occupation:    string;
  readonly comorbidities: ComorbidityProfile;
}

// ─── Generated Vital ──────────────────────────
// A single vital sign with its generated value.
// Hospital Engine decides how to display this.

export interface GeneratedVital {
  readonly parameter:  string;
  readonly value:      number;
  readonly unit:       string;
  readonly isAbnormal: boolean;
  readonly isRedFlag:  boolean;
}

// ─── Selected Symptom ─────────────────────────
// A symptom chosen for this patient, with one
// natural-language phrase selected from the
// disease data's patientPhrases array.

export interface SelectedSymptom {
  readonly id:            string;
  readonly name:          string;
  readonly patientPhrase: string;
  readonly isRedFlag:     boolean;
}

// ─── Hidden State ─────────────────────────────
// Internal engine state. Never shown to student.
// Consumed by Clinical Time, Outcome, and
// Reflection engines in future phases.
//
// Only initialised here — no progression logic.

export interface HiddenState {
  readonly chosenSeverity:           Severity;
  readonly selectedInfarctLocation:  InfarctLocation | undefined;
  readonly elapsedClinicalMinutes:   number;
  readonly generatedVitals:          readonly GeneratedVital[];
  readonly selectedSymptomIds:       readonly string[];
  readonly comorbidities:            ComorbidityProfile;
}

// ─── Patient Case ─────────────────────────────
// The complete, immutable, playable case.
// Output of generatePatientCase().

export interface PatientCase {
  readonly caseId:               string;
  readonly diseaseId:            string;
  readonly seed:                 number;
  readonly generatedAt:          string;
  readonly profile:              PatientProfile;
  readonly severity:             Severity;
  readonly symptomOnsetHours:    number;
  readonly presentingComplaints: readonly string[];
  readonly generatedVitals:      readonly GeneratedVital[];
  readonly selectedSymptoms:     readonly SelectedSymptom[];
  readonly hidden:               HiddenState;
}
