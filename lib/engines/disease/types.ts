// ─────────────────────────────────────────────
// KAIROS — Disease Engine Types
//
// The single canonical source of truth for all
// disease-related interfaces in Kairos.
//
// Rules:
//   • Medical truth only. No UI. No patient identity.
//   • No hardcoded medicine definitions.
//     Treatments reference Medicine Engine by ID only.
//   • Individual disease modules use:
//       Pick<Disease, "id" | ...>
//       Disease["symptoms"]
//       Disease["vitalSigns"]
//     Assembly and full interface satisfaction
//     happens only in each disease's index.ts.
//
// Every other engine imports FROM this file.
// This file never imports from other engines.
// ─────────────────────────────────────────────

import {
  BaseEntity,
  Range,
  Exception,
  FindingValue,
  KineticProfile,
  SerialTestingRule,
  IncorrectChoice,
  OutcomeModifier,
} from "../../types/common";

import {
  Severity,
  Frequency,
  Typicality,
  InfarctLocation,
  Interpretation,
  InvestigationType,
  InvestigationPriority,
  InvestigationTiming,
  UnlockMethod,
  Reliability,
  ClinicalImportance,
  ComplicationCategory,
  ComplicationOnset,
  OutcomeType,
  ScoreCategory,
} from "../../types/enums";

import { TreatmentReference } from "../medicine/types";

// ─── Symptom ──────────────────────────────────

export interface Symptom {
  readonly id:                  string;
  readonly name:                string;
  readonly typicality:          Typicality;
  readonly frequency:           Frequency;
  readonly severity:            Severity[];
  readonly redFlag:             boolean;
  readonly clinicalImportance:  ClinicalImportance;
  readonly reliability:         Reliability;
  readonly locationDependency?: InfarctLocation[];
  readonly unlockMethod:        UnlockMethod;
  readonly specialNotes:        string[];
  readonly patientPhrases:      string[];
}

// ─── Vital Sign ───────────────────────────────

export interface VitalSign {
  readonly parameter:     string;
  readonly unit:          string;
  readonly normal:        { range: Range };
  readonly mild:          { range: Range };
  readonly moderate:      { range: Range };
  readonly severe:        { range: Range };
  readonly exceptions?:   Exception[];
  readonly redFlagBelow?: number;
  readonly redFlagAbove?: number;
  readonly specialNotes:  string[];
}

// ─── ECG Finding ──────────────────────────────
// Structured so Hospital Engine can render an
// actual ECG waveform in future versions.
// interpretation and clinicalImportance are stored
// as their enum types here. The Encounter/Hospital
// Engine layer casts them to string for display.

export interface ECGFinding {
  readonly leads:               string[];
  readonly finding:             string;
  readonly interpretation:      Interpretation;
  readonly probability:         number;        // 0.0–1.0
  readonly severity:            Severity[];
  readonly clinicalImportance:  ClinicalImportance;
  readonly locationDependency?: InfarctLocation[];
}

// ─── Investigation Result ─────────────────────

export interface InvestigationResult {
  readonly severity:         Severity | "normal";
  readonly findings:         FindingValue[];
  readonly ecgFindings?:     ECGFinding[];
  readonly educationalNotes: string;
  readonly redFlags?:        string[];
}

// ─── Investigation ────────────────────────────

export interface Investigation {
  readonly id:                 string;
  readonly name:               string;
  readonly type:               InvestigationType;
  readonly priority:           InvestigationPriority;
  readonly timing:             InvestigationTiming;
  readonly unlockMethod:       UnlockMethod;
  readonly reliability:        Reliability;
  readonly probability:        number;
  readonly kineticProfile?:    KineticProfile;
  readonly falsePositives?:    string[];
  readonly results: {
    readonly normal:   InvestigationResult;
    readonly mild:     InvestigationResult;
    readonly moderate: InvestigationResult;
    readonly severe:   InvestigationResult;
  };
  readonly redFlagFindings:    string[];
  readonly serialTestingRule?: SerialTestingRule;
  readonly specialNotes:       string[];
}

// ─── Complication ─────────────────────────────

export interface Complication {
  readonly id:                  string;
  readonly name:                string;
  readonly category:            ComplicationCategory;
  readonly onset:               ComplicationOnset;
  readonly timing: {
    readonly hoursAfterEvent: Range;
  };
  readonly frequency:           Frequency;
  readonly severityRequired:    Severity[];
  readonly locationDependency?: InfarctLocation[];
  readonly prerequisites:       string[];
  readonly redFlag:             boolean;
  readonly educationalNotes:    string;
}

// ─── Outcome ──────────────────────────────────

export interface OutcomeScenario {
  readonly type:            OutcomeType;
  readonly baseProbability: number;
  readonly conditions:      string[];
}

export interface DiseaseOutcome {
  readonly scenarios:      OutcomeScenario[];
  readonly modifiers:      OutcomeModifier[];
  readonly deathIsAllowed: boolean;
  readonly deathIsCommon:  boolean;
  readonly deathNote:      string;
}

// ─── Reflection ───────────────────────────────

export interface ReflectionHook {
  readonly id:         string;
  readonly trigger:    string;
  readonly importance: ClinicalImportance;
  readonly category:   ScoreCategory;
  readonly weight:     number;
  readonly message:    string;
}

export interface PerformanceScoring {
  readonly algorithm:   "weighted";
  readonly weights:     { [key in ScoreCategory]?: number };
  readonly totalPoints: number;
}

// ─── Disease ──────────────────────────────────
// The complete canonical Disease contract.
// Satisfied only in each disease's index.ts.
// Modules use Pick<Disease,...> or Disease["field"].

export interface Disease extends BaseEntity {
  readonly name:            string;
  readonly icdCode:         string;
  readonly category:        string;
  readonly symptoms:        Symptom[];
  readonly vitalSigns:      VitalSign[];
  readonly investigations:  Investigation[];
  readonly treatments: {
    readonly correct:   TreatmentReference[];
    readonly incorrect: IncorrectChoice[];
  };
  readonly complications:   Complication[];
  readonly outcome:         DiseaseOutcome;
  readonly reflectionHooks: ReflectionHook[];
  readonly scoring:         PerformanceScoring;
}
