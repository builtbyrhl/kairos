// ─────────────────────────────────────────────
// KAIROS — Scoring Engine Types
//
// Ownership: Scoring Engine exclusively.
//
// Scoring Engine evaluates a completed encounter
// by inspecting HospitalState.events against
// Disease.reflectionHooks.
//
// It consumes:
//   HospitalState — the complete event audit log
//   Disease       — reflectionHooks and scoring config
//   PatientCase   — hidden vitals for patient-specific
//                   trigger evaluation (e.g. SpO2 check)
//
// It never imports from:
//   Encounter Engine      — student-facing layer
//   Investigation Engine  — resolved already in HospitalState
//   Treatment Engine      — resolved already in HospitalState
//   Simulation Controller — orchestration layer above this engine
//
// Scoring is post-case only.
// scoreEncounter() is never called during an active encounter.
//
// Hook semantics:
//   triggered = true  → bad condition met → student loses points
//   triggered = false → student did the right thing → earns hook.weight
//
// PerformanceScore is immutable output.
// The Reflection Engine consumes it to build post-case feedback.
// ─────────────────────────────────────────────

import { ScoreCategory } from "../../types/enums";
import { HospitalState }  from "../hospital";
import { Disease }        from "../disease/types";
import { PatientCase }    from "../patient";

// ─── Scoring Context ──────────────────────────
// Everything required to score one encounter.
// PatientCase is included so patient-specific
// triggers (e.g. oxygen given with SpO2 ≥ 94)
// can be evaluated without accessing any UI state.

export interface ScoringContext {
  readonly state:       HospitalState;
  readonly disease:     Disease;
  readonly patientCase: PatientCase;
}

// ─── Hook Result ──────────────────────────────
// The evaluated result of one ReflectionHook.
//
// triggered: true  = bad condition occurred = pointsEarned is 0
// triggered: false = student avoided the mistake = pointsEarned = hook.weight
//
// message is the educational content for the hook,
// sourced directly from Disease.reflectionHooks[].message.
// It is safe to surface post-case — never during active encounter.

export interface HookResult {
  readonly hookId:       string;
  readonly trigger:      string;
  readonly triggered:    boolean;
  readonly pointsEarned: number;
  readonly category:     ScoreCategory;
  readonly weight:       number;
  readonly message:      string;
}

// ─── Category Score ───────────────────────────
// Aggregate earned vs maximum for one ScoreCategory.
// Used by the Reflection Engine to produce a
// category-level breakdown.

export interface CategoryScore {
  readonly category: ScoreCategory;
  readonly earned:   number;
  readonly maximum:  number;
}

// ─── Grade ────────────────────────────────────

export type Grade = "A" | "B" | "C" | "D" | "F";

// ─── Performance Score ────────────────────────
// The complete immutable output of scoreEncounter().
//
// total:      sum of pointsEarned across all hooks
// maximum:    disease.scoring.totalPoints (canonical maximum)
// percentage: 0–100
// grade:      derived from percentage
// byCategory: per-category breakdown for Reflection Engine
// hookResults: full per-hook detail for Reflection Engine

export interface PerformanceScore {
  readonly total:       number;
  readonly maximum:     number;
  readonly percentage:  number;
  readonly grade:       Grade;
  readonly byCategory:  readonly CategoryScore[];
  readonly hookResults: readonly HookResult[];
}
