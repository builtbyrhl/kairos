// ─────────────────────────────────────────────
// KAIROS — Scoring Evaluator
//
// Single public function: scoreEncounter()
//
// Pure function. Same ScoringContext → same PerformanceScore.
// No side effects. No I/O. No mutation of inputs.
//
// Evaluation pipeline:
//   1. For each ReflectionHook in disease.reflectionHooks:
//      a. Look up trigger evaluator.
//      b. Evaluate against ScoringContext.
//      c. Record HookResult with earned points.
//   2. Sum points → total.
//   3. Build per-category breakdown.
//   4. Derive percentage and grade.
//   5. Return PerformanceScore.
//
// Scoring is always post-case.
// Never call this during an active encounter.
// ─────────────────────────────────────────────

import { ScoreCategory } from "../../types/enums";

import {
  ScoringContext,
  PerformanceScore,
  HookResult,
  CategoryScore,
  Grade,
} from "./types";

import { getTriggerEvaluator } from "./triggers";

// ─── Grade derivation ─────────────────────────

function deriveGrade(percentage: number): Grade {
  if (percentage >= 90) return "A";
  if (percentage >= 75) return "B";
  if (percentage >= 60) return "C";
  if (percentage >= 45) return "D";
  return "F";
}

// ─── Category breakdown ───────────────────────

function buildCategoryScores(
  hookResults: readonly HookResult[]
): readonly CategoryScore[] {
  const map = new Map<ScoreCategory, { earned: number; maximum: number }>();

  for (const result of hookResults) {
    const existing = map.get(result.category) ?? { earned: 0, maximum: 0 };
    map.set(result.category, {
      earned:  existing.earned  + result.pointsEarned,
      maximum: existing.maximum + result.weight,
    });
  }

  // Preserve insertion order for consistent output
  return Array.from(map.entries()).map(([category, scores]) => ({
    category,
    earned:  scores.earned,
    maximum: scores.maximum,
  }));
}

// ─── Public API ───────────────────────────────

/**
 * Scores a completed encounter.
 *
 * @param context ScoringContext containing HospitalState, Disease, and PatientCase.
 * @returns       PerformanceScore — immutable, suitable for display and Reflection Engine.
 *
 * Note: This function is intended for post-case use only.
 * Calling it on an incomplete encounter will produce a score
 * based on partial data — valid but not meaningful for feedback.
 */
export function scoreEncounter(context: ScoringContext): PerformanceScore {
  const { disease } = context;
  const hooks = disease.reflectionHooks;
  const maximum = disease.scoring.totalPoints;

  // ── Evaluate each hook ──────────────────────
  const hookResults: HookResult[] = hooks.map(hook => {
    const evaluator  = getTriggerEvaluator(hook.trigger);
    const triggered  = evaluator(context);
    return {
      hookId:        hook.id,
      trigger:       hook.trigger,
      triggered,
      pointsEarned:  triggered ? 0 : hook.weight,
      category:      hook.category,
      weight:        hook.weight,
      message:       hook.message,
    };
  });

  // ── Aggregate ───────────────────────────────
  const total       = hookResults.reduce((sum, r) => sum + r.pointsEarned, 0);
  const safeMax     = maximum > 0 ? maximum : 1; // prevent division by zero
  const percentage  = Math.min(100, Math.round((total / safeMax) * 100));
  const byCategory  = buildCategoryScores(hookResults);

  return {
    total,
    maximum,
    percentage,
    grade:       deriveGrade(percentage),
    byCategory,
    hookResults,
  };
}
