import { describe, it, expect } from "vitest";
import { scoreEncounter } from "@/lib/engines/scoring/evaluate";
import type { ScoringContext } from "@/lib/engines/scoring/types";
import { DiseaseRegistry } from "@/lib/data/diseases";
import {
  makeHospitalState,
  makePatientCase,
  makeHospitalEvent,
} from "@/lib/test-utils/fixtures";

const disease = DiseaseRegistry.getById("stemi")!;

/** ECG never ordered → the ecg-timing hook triggers (points lost). */
function ecgMissedContext(): ScoringContext {
  return { state: makeHospitalState(), disease, patientCase: makePatientCase() };
}

/** ECG ordered within 10 clinical minutes → the ecg-timing hook is avoided. */
function ecgOnTimeContext(): ScoringContext {
  const state = makeHospitalState({
    events: [
      makeHospitalEvent({
        type: "INVESTIGATION_ORDERED",
        clinicalMinutes: 5,
        payload: { investigationId: "ecg_12lead" },
      }),
    ],
  });
  return { state, disease, patientCase: makePatientCase() };
}

describe("scoreEncounter", () => {
  it("reports the disease's canonical maximum", () => {
    expect(scoreEncounter(ecgMissedContext()).maximum).toBe(disease.scoring.totalPoints);
  });

  it("produces one hook result per reflection hook", () => {
    expect(scoreEncounter(ecgMissedContext()).hookResults).toHaveLength(
      disease.reflectionHooks.length
    );
  });

  it("marks a hook as triggered exactly when it earns no points", () => {
    for (const r of scoreEncounter(ecgMissedContext()).hookResults) {
      expect(r.triggered).toBe(r.pointsEarned === 0);
      expect(r.pointsEarned).toBe(r.triggered ? 0 : r.weight);
    }
  });

  it("awards the ECG hook's weight when the ECG is ordered on time", () => {
    const missed  = scoreEncounter(ecgMissedContext());
    const onTime  = scoreEncounter(ecgOnTimeContext());
    const ecgHook = disease.reflectionHooks.find(
      h => h.trigger === "ecg_not_ordered_within_10_clinical_minutes"
    )!;
    expect(onTime.total - missed.total).toBe(ecgHook.weight);
  });

  it("clamps percentage into the 0–100 range and rounds it", () => {
    const score = scoreEncounter(ecgOnTimeContext());
    expect(score.percentage).toBeGreaterThanOrEqual(0);
    expect(score.percentage).toBeLessThanOrEqual(100);
    expect(Number.isInteger(score.percentage)).toBe(true);
  });

  it("keeps the per-category breakdown consistent with the hook results", () => {
    const score = scoreEncounter(ecgOnTimeContext());
    const earned  = score.byCategory.reduce((sum, c) => sum + c.earned, 0);
    const maximum = score.byCategory.reduce((sum, c) => sum + c.maximum, 0);
    expect(earned).toBe(score.total);
    expect(maximum).toBe(score.hookResults.reduce((sum, r) => sum + r.weight, 0));
  });

  it("derives a valid grade band from the percentage", () => {
    const score = scoreEncounter(ecgOnTimeContext());
    const bands: Array<[number, string]> = [
      [90, "A"],
      [75, "B"],
      [60, "C"],
      [45, "D"],
      [0, "F"],
    ];
    const expected = bands.find(([threshold]) => score.percentage >= threshold)![1];
    expect(score.grade).toBe(expected);
  });
});
