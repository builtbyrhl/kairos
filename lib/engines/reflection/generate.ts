// ─────────────────────────────────────────────
// KAIROS — Reflection Generator
//
// Single public function: generateReflection()
//
// Pure function. Same ReflectionContext → same ReflectionResult.
// No side effects. No I/O. No mutation.
//
// Combines:
//   • PerformanceScore (hook results, category scores)
//   • PostCase investigation data (educational notes)
//   • PostCase treatment data (correctness, notes)
//   • Disease (investigation names for display)
//
// Output is the complete post-case learning package.
// ─────────────────────────────────────────────

import {
  ReflectionContext,
  ReflectionResult,
  InvestigationReflection,
  TreatmentReflection,
} from "./types";

// ─── Private helpers ──────────────────────────

function buildInvestigationReflections(
  context: ReflectionContext
): readonly InvestigationReflection[] {
  return context.postCaseInvestigations.map(data => {
    const invDef = context.disease.investigations.find(
      i => i.id === data.investigationId
    );
    return {
      investigationId:  data.investigationId,
      name:             invDef?.name ?? data.investigationId,
      educationalNotes: data.educationalNotes,
      falsePositives:   data.falsePositives,
    };
  });
}

function buildTreatmentReflections(
  context: ReflectionContext
): readonly TreatmentReflection[] {
  return context.postCaseTreatments.map(data => ({
    medicineId:       data.medicineId,
    medicineName:     data.medicineName,
    correctness:      data.correctness,
    isPositive:       data.correctness === 'correct' || data.correctness === 'acceptable',
    educationalNotes: data.educationalNotes,
  }));
}

function buildSummary(percentage: number): string {
  if (percentage >= 90) {
    return 'Excellent clinical performance. All key decisions were timely and appropriate.';
  }
  if (percentage >= 75) {
    return 'Good performance with minor areas for improvement. Review the highlighted decisions below.';
  }
  if (percentage >= 60) {
    return 'Adequate performance. Several clinical decisions could be optimised.';
  }
  if (percentage >= 45) {
    return 'Important clinical decisions were delayed or missed. Detailed review recommended.';
  }
  return 'Critical decisions were missed in this case. Please carefully review all educational notes below.';
}

// ─── Public API ───────────────────────────────

/**
 * Generates a complete post-case reflection breakdown.
 *
 * @param context ReflectionContext with score, disease, and post-case data.
 * @returns       ReflectionResult — immutable, safe to display post-case.
 *
 * Never call during an active encounter.
 * Always call after encounterStatus === 'completed'
 * and scoreEncounter() has returned.
 */
export function generateReflection(context: ReflectionContext): ReflectionResult {
  return {
    score:          context.score,
    hookResults:    context.score.hookResults,
    byCategory:     context.score.byCategory,
    investigations: buildInvestigationReflections(context),
    treatments:     buildTreatmentReflections(context),
    summary:        buildSummary(context.score.percentage),
    grade:          context.score.grade,
  };
}
