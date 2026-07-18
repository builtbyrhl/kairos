import { describe, it, expect } from "vitest";
import { getTriggerEvaluator, getRegisteredTriggers } from "@/lib/engines/scoring/triggers";
import type { ScoringContext } from "@/lib/engines/scoring/types";
import { DiseaseRegistry } from "@/lib/data/diseases";
import {
  makeHospitalState,
  makePatientCase,
  makeHospitalEvent,
  makeGeneratedVital,
  makeTreatmentRecord,
} from "@/lib/test-utils/fixtures";

const disease = DiseaseRegistry.getById("stemi")!;

function ctx(overrides: {
  state?: Parameters<typeof makeHospitalState>[0];
  patientCase?: Parameters<typeof makePatientCase>[0];
} = {}): ScoringContext {
  return {
    state:       makeHospitalState(overrides.state),
    disease,
    patientCase: makePatientCase(overrides.patientCase),
  };
}

function evaluate(trigger: string, context: ScoringContext): boolean {
  return getTriggerEvaluator(trigger)(context);
}

describe("getRegisteredTriggers", () => {
  it("exposes exactly the known v1 STEMI evaluator keys", () => {
    const registered = getRegisteredTriggers();
    expect([...registered].sort()).toEqual(
      [
        "antiplatelet_incomplete_or_missing",
        "atypical_presentation_not_recognised",
        "cath_lab_not_activated_within_30_clinical_minutes",
        "echo_ordered_before_cath_lab_activation",
        "ecg_not_ordered_within_10_clinical_minutes",
        "nitrate_given_with_sbp_below_90",
        "oxygen_given_with_spo2_above_94",
      ].sort()
    );
  });
});

describe("getTriggerEvaluator", () => {
  it("returns a permissive (false) evaluator for unknown triggers", () => {
    expect(evaluate("no_such_trigger", ctx())).toBe(false);
  });

  it("falls back to the permissive default for triggers not in the registry", () => {
    // Regression guard: the active STEMI data (stemi.ts) uses trigger strings
    // that are NOT in the evaluator registry, so these fall back to false.
    for (const t of [
      "antiplatelet_incomplete",
      "cath_lab_not_activated_early",
      "echo_ordered_before_pci_activation",
      "nitrate_given_with_hypotension",
    ]) {
      expect(getRegisteredTriggers().has(t)).toBe(false);
      expect(evaluate(t, ctx())).toBe(false);
    }
  });
});

describe("ecg_not_ordered_within_10_clinical_minutes", () => {
  const trigger = "ecg_not_ordered_within_10_clinical_minutes";

  it("triggers when the ECG was never ordered", () => {
    expect(evaluate(trigger, ctx())).toBe(true);
  });

  it("triggers when the ECG was ordered after 10 minutes", () => {
    const state = makeHospitalState({
      events: [makeHospitalEvent({ type: "INVESTIGATION_ORDERED", clinicalMinutes: 15, payload: { investigationId: "ecg_12lead" } })],
    });
    expect(evaluate(trigger, { state, disease, patientCase: makePatientCase() })).toBe(true);
  });

  it("does not trigger when the ECG was ordered within 10 minutes", () => {
    const state = makeHospitalState({
      events: [makeHospitalEvent({ type: "INVESTIGATION_ORDERED", clinicalMinutes: 8, payload: { investigationId: "ecg_12lead" } })],
    });
    expect(evaluate(trigger, { state, disease, patientCase: makePatientCase() })).toBe(false);
  });
});

describe("cath_lab_not_activated_within_30_clinical_minutes", () => {
  const trigger = "cath_lab_not_activated_within_30_clinical_minutes";

  it("triggers when fewer than 2 meaningful early events occurred", () => {
    const state = makeHospitalState({
      events: [makeHospitalEvent({ type: "INVESTIGATION_ORDERED", clinicalMinutes: 5, payload: { investigationId: "ecg_12lead" } })],
    });
    expect(evaluate(trigger, { state, disease, patientCase: makePatientCase() })).toBe(true);
  });

  it("does not trigger with 2+ early investigation/treatment events", () => {
    const state = makeHospitalState({
      events: [
        makeHospitalEvent({ type: "INVESTIGATION_ORDERED", clinicalMinutes: 5, payload: { investigationId: "ecg_12lead" } }),
        makeHospitalEvent({ type: "TREATMENT_ADMINISTERED", clinicalMinutes: 10, payload: { medicineId: "aspirin" } }),
      ],
    });
    expect(evaluate(trigger, { state, disease, patientCase: makePatientCase() })).toBe(false);
  });

  it("ignores events after 30 minutes", () => {
    const state = makeHospitalState({
      events: [
        makeHospitalEvent({ type: "INVESTIGATION_ORDERED", clinicalMinutes: 31, payload: { investigationId: "ecg_12lead" } }),
        makeHospitalEvent({ type: "TREATMENT_ADMINISTERED", clinicalMinutes: 40, payload: { medicineId: "aspirin" } }),
      ],
    });
    expect(evaluate(trigger, { state, disease, patientCase: makePatientCase() })).toBe(true);
  });
});

describe("antiplatelet_incomplete_or_missing", () => {
  const trigger = "antiplatelet_incomplete_or_missing";

  it("triggers when neither antiplatelet was given", () => {
    expect(evaluate(trigger, ctx())).toBe(true);
  });

  it("triggers when only aspirin was given", () => {
    const state = makeHospitalState({ administeredTreatments: [makeTreatmentRecord({ medicineId: "aspirin" })] });
    expect(evaluate(trigger, { state, disease, patientCase: makePatientCase() })).toBe(true);
  });

  it("does not trigger when both aspirin and clopidogrel were given", () => {
    const state = makeHospitalState({
      administeredTreatments: [
        makeTreatmentRecord({ medicineId: "aspirin" }),
        makeTreatmentRecord({ medicineId: "clopidogrel" }),
      ],
    });
    expect(evaluate(trigger, { state, disease, patientCase: makePatientCase() })).toBe(false);
  });
});

describe("echo_ordered_before_cath_lab_activation", () => {
  const trigger = "echo_ordered_before_cath_lab_activation";

  it("does not trigger when echo was never ordered", () => {
    expect(evaluate(trigger, ctx())).toBe(false);
  });

  it("triggers when echo was ordered but ECG never was", () => {
    const state = makeHospitalState({
      events: [makeHospitalEvent({ type: "INVESTIGATION_ORDERED", clinicalMinutes: 5, payload: { investigationId: "echo_2d" } })],
    });
    expect(evaluate(trigger, { state, disease, patientCase: makePatientCase() })).toBe(true);
  });

  it("triggers when echo preceded the ECG order", () => {
    const state = makeHospitalState({
      events: [
        makeHospitalEvent({ type: "INVESTIGATION_ORDERED", clinicalMinutes: 3, payload: { investigationId: "echo_2d" } }),
        makeHospitalEvent({ type: "INVESTIGATION_ORDERED", clinicalMinutes: 6, payload: { investigationId: "ecg_12lead" } }),
      ],
    });
    expect(evaluate(trigger, { state, disease, patientCase: makePatientCase() })).toBe(true);
  });

  it("does not trigger when ECG preceded the echo order", () => {
    const state = makeHospitalState({
      events: [
        makeHospitalEvent({ type: "INVESTIGATION_ORDERED", clinicalMinutes: 4, payload: { investigationId: "ecg_12lead" } }),
        makeHospitalEvent({ type: "INVESTIGATION_ORDERED", clinicalMinutes: 9, payload: { investigationId: "echo_2d" } }),
      ],
    });
    expect(evaluate(trigger, { state, disease, patientCase: makePatientCase() })).toBe(false);
  });
});

describe("nitrate_given_with_sbp_below_90", () => {
  const trigger = "nitrate_given_with_sbp_below_90";

  it("does not trigger when no nitrate was given", () => {
    expect(evaluate(trigger, ctx())).toBe(false);
  });

  it("triggers when a nitrate was given and SBP < 90", () => {
    const state = makeHospitalState({ administeredTreatments: [makeTreatmentRecord({ medicineId: "nitroglycerin" })] });
    const pc = makePatientCase();
    const lowBpCase = { ...pc, hidden: { ...pc.hidden, generatedVitals: [makeGeneratedVital({ parameter: "Systolic Blood Pressure", value: 80 })] } };
    expect(evaluate(trigger, { state, disease, patientCase: lowBpCase })).toBe(true);
  });

  it("does not trigger when SBP is >= 90", () => {
    const state = makeHospitalState({ administeredTreatments: [makeTreatmentRecord({ medicineId: "isosorbide" })] });
    const pc = makePatientCase();
    const normalBpCase = { ...pc, hidden: { ...pc.hidden, generatedVitals: [makeGeneratedVital({ parameter: "Systolic Blood Pressure", value: 110 })] } };
    expect(evaluate(trigger, { state, disease, patientCase: normalBpCase })).toBe(false);
  });
});

describe("oxygen_given_with_spo2_above_94", () => {
  const trigger = "oxygen_given_with_spo2_above_94";

  it("does not trigger when oxygen was not given", () => {
    expect(evaluate(trigger, ctx())).toBe(false);
  });

  it("triggers when oxygen was given and SpO2 >= 94", () => {
    const state = makeHospitalState({ administeredTreatments: [makeTreatmentRecord({ medicineId: "oxygen" })] });
    const pc = makePatientCase();
    const normoxic = { ...pc, hidden: { ...pc.hidden, generatedVitals: [makeGeneratedVital({ parameter: "SpO₂", value: 98 })] } };
    expect(evaluate(trigger, { state, disease, patientCase: normoxic })).toBe(true);
  });

  it("does not trigger when oxygen was given but SpO2 < 94 (hypoxic)", () => {
    const state = makeHospitalState({ administeredTreatments: [makeTreatmentRecord({ medicineId: "oxygen" })] });
    const pc = makePatientCase();
    const hypoxic = { ...pc, hidden: { ...pc.hidden, generatedVitals: [makeGeneratedVital({ parameter: "SpO₂", value: 88 })] } };
    expect(evaluate(trigger, { state, disease, patientCase: hypoxic })).toBe(false);
  });
});

describe("atypical_presentation_not_recognised", () => {
  it("always returns false in v1 (benefit of the doubt)", () => {
    expect(evaluate("atypical_presentation_not_recognised", ctx())).toBe(false);
  });
});
