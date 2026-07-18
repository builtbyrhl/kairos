import { describe, it, expect } from "vitest";
import { evaluateTreatment, evaluateAllTreatments } from "@/lib/engines/treatment/evaluate";
import type { TreatmentContext } from "@/lib/engines/treatment/types";
import { DiseaseRegistry } from "@/lib/data/diseases";
import {
  makePatientCase,
  makeGeneratedVital,
  makeTreatmentRecord,
  mutableClone,
} from "@/lib/test-utils/fixtures";

const disease = DiseaseRegistry.getById("stemi")!;

function context(overrides: Partial<TreatmentContext> = {}): TreatmentContext {
  return {
    patientCase:     makePatientCase(),
    disease,
    clinicalMinutes: 5,
    allRecords:      [],
    ...overrides,
  };
}

function patientWithSBP(value: number) {
  const pc = makePatientCase();
  return {
    ...pc,
    hidden: { ...pc.hidden, generatedVitals: [makeGeneratedVital({ parameter: "Systolic Blood Pressure", value })] },
  };
}

describe("evaluateTreatment", () => {
  it("returns MEDICINE_NOT_FOUND for an unregistered medicine", () => {
    const record = makeTreatmentRecord({ medicineId: "not_a_medicine" });
    const result = evaluateTreatment(record, context({ allRecords: [record] }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("MEDICINE_NOT_FOUND");
      expect(result.error.medicineId).toBe("not_a_medicine");
    }
  });

  it("rates a correctly-dosed, on-time indicated medicine as 'correct'", () => {
    const record = makeTreatmentRecord({ medicineId: "aspirin", dose: "300mg", route: "oral", orderedAt: 5 });
    const result = evaluateTreatment(record, context({ allRecords: [record] }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.evaluation.correctness).toBe("correct");
      expect(result.evaluation.issues).toEqual([]);
      expect(result.evaluation.medicineName).toBe("Aspirin");
    }
  });

  it("downgrades an indicated medicine with a dose problem to 'acceptable'", () => {
    const record = makeTreatmentRecord({ medicineId: "aspirin", dose: "50mg", route: "oral", orderedAt: 5 });
    const result = evaluateTreatment(record, context({ allRecords: [record] }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.evaluation.correctness).toBe("acceptable");
      expect(result.evaluation.issues.some(i => i.kind === "dose")).toBe(true);
    }
  });

  it("rates a registered but non-indicated medicine as 'unnecessary'", () => {
    // Remove oxygen from the correct list so it is registered but not indicated.
    const narrowed = mutableClone(disease);
    narrowed.treatments.correct = narrowed.treatments.correct.filter(t => t.medicineId !== "oxygen");
    const record = makeTreatmentRecord({ medicineId: "oxygen", orderedAt: 5 });
    const result = evaluateTreatment(record, context({ disease: narrowed, allRecords: [record] }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.evaluation.correctness).toBe("unnecessary");
  });

  it("rates a contraindicated medicine as 'contraindicated'", () => {
    const record = makeTreatmentRecord({ medicineId: "morphine", dose: "4mg", route: "iv", orderedAt: 5 });
    const result = evaluateTreatment(record, context({ patientCase: patientWithSBP(80), allRecords: [record] }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.evaluation.correctness).toBe("contraindicated");
      expect(result.evaluation.issues.some(i => i.kind === "contraindication")).toBe(true);
    }
  });

  it("assembles educational notes for an indicated medicine", () => {
    const record = makeTreatmentRecord({ medicineId: "aspirin", dose: "300mg", route: "oral", orderedAt: 5 });
    const result = evaluateTreatment(record, context({ allRecords: [record] }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.evaluation.educationalNotes.length).toBeGreaterThan(0);
  });
});

describe("evaluateAllTreatments", () => {
  it("evaluates every record in the context", () => {
    const records = [
      makeTreatmentRecord({ medicineId: "aspirin", dose: "300mg", route: "oral", orderedAt: 5 }),
      makeTreatmentRecord({ medicineId: "not_a_medicine", orderedAt: 6 }),
    ];
    const results = evaluateAllTreatments(context({ allRecords: records }));
    expect(results).toHaveLength(2);
    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(false);
  });

  it("returns an empty array when there are no records", () => {
    expect(evaluateAllTreatments(context())).toEqual([]);
  });
});
