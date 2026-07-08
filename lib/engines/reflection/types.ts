// ─────────────────────────────────────────────
// KAIROS — Reflection Engine Types
//
// Ownership: Reflection Engine exclusively.
//
// The Reflection Engine takes post-case data and
// produces a structured learning breakdown.
//
// It consumes:
//   PerformanceScore       — from Scoring Engine
//   PostCaseInvestigation  — educational notes per investigation
//   PostCaseTreatment      — correctness + notes per treatment
//   Disease                — investigation names for display
//
// It never imports from:
//   Simulation Controller  — to avoid controller ↔ engine coupling.
//     Instead, PostCaseInvestigation and PostCaseTreatment mirror
//     the simulation controller's PostCase types structurally.
//     TypeScript's structural typing ensures compatibility.
//   Hospital Engine        — not needed; PerformanceScore comes
//     from Scoring Engine which already consumed HospitalState.
//   Encounter Engine       — student-facing layer, above this.
//
// All output is post-case only.
// Never surface ReflectionResult to the student during
// an active encounter.
// ─────────────────────────────────────────────

import type { PerformanceScore, HookResult, CategoryScore } from "../scoring";
import type { Disease } from "../disease/types";

// ─── Input types ──────────────────────────────
// These structurally match PostCaseInvestigationData
// and PostCaseTreatmentData from the Simulation Controller.
// Defined here to prevent reflection engine from depending
// on the orchestration layer.

export interface PostCaseInvestigation {
  readonly investigationId:  string;
  readonly educationalNotes: string;
  readonly falsePositives:   readonly string[];
}

export interface PostCaseTreatment {
  readonly medicineId:       string;
  readonly medicineName:     string;
  readonly correctness:      string;   // TreatmentCorrectness as string
  readonly educationalNotes: readonly string[];
}

// ─── Reflection Context ───────────────────────

export interface ReflectionContext {
  readonly score:                  PerformanceScore;
  readonly postCaseInvestigations: readonly PostCaseInvestigation[];
  readonly postCaseTreatments:     readonly PostCaseTreatment[];
  readonly disease:                Disease;
}

// ─── Output types ─────────────────────────────

export interface InvestigationReflection {
  readonly investigationId:  string;
  readonly name:             string;
  readonly educationalNotes: string;
  readonly falsePositives:   readonly string[];
}

export interface TreatmentReflection {
  readonly medicineId:       string;
  readonly medicineName:     string;
  readonly correctness:      string;
  readonly isPositive:       boolean;   // correct or acceptable
  readonly educationalNotes: readonly string[];
}

export interface ReflectionResult {
  readonly score:           PerformanceScore;
  readonly hookResults:     readonly HookResult[];
  readonly byCategory:      readonly CategoryScore[];
  readonly investigations:  readonly InvestigationReflection[];
  readonly treatments:      readonly TreatmentReflection[];
  readonly summary:         string;
  readonly grade:           string;
}
