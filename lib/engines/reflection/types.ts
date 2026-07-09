// ─────────────────────────────────────────────
// KAIROS — Reflection Engine Types
//
// Import explicitly from scoring/types rather than
// the directory "../scoring" to avoid TS2307 under
// strict moduleResolution ("node16" / "nodenext").
// ─────────────────────────────────────────────

import type { PerformanceScore, HookResult, CategoryScore } from "../scoring/types";
import type { Disease } from "../disease/types";

export interface PostCaseInvestigation {
  readonly investigationId:  string;
  readonly educationalNotes: string;
  readonly falsePositives:   readonly string[];
}

export interface PostCaseTreatment {
  readonly medicineId:       string;
  readonly medicineName:     string;
  readonly correctness:      string;
  readonly educationalNotes: readonly string[];
}

export interface ReflectionContext {
  readonly score:                  PerformanceScore;
  readonly postCaseInvestigations: readonly PostCaseInvestigation[];
  readonly postCaseTreatments:     readonly PostCaseTreatment[];
  readonly disease:                Disease;
}

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
  readonly isPositive:       boolean;
  readonly educationalNotes: readonly string[];
}

export interface ReflectionResult {
  readonly score:          PerformanceScore;
  readonly hookResults:    readonly HookResult[];
  readonly byCategory:     readonly CategoryScore[];
  readonly investigations: readonly InvestigationReflection[];
  readonly treatments:     readonly TreatmentReflection[];
  readonly summary:        string;
  readonly grade:          string;
}
