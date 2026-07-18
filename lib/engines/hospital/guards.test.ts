import { describe, it, expect } from "vitest";
import {
  canPerformAction,
  canOrderInvestigation,
  canAdministerTreatment,
  canRecordObservation,
  canCompleteEncounter,
  canAbandonEncounter,
} from "@/lib/engines/hospital/guards";
import { makeHospitalState } from "@/lib/test-utils/fixtures";

describe("canPerformAction", () => {
  it("allows an available action while active", () => {
    const state = makeHospitalState({ availableActions: ["Take History"] });
    expect(canPerformAction(state, "Take History")).toEqual({ allowed: true });
  });

  it("denies an action that is not available", () => {
    const state = makeHospitalState({ availableActions: ["Take History"] });
    const result = canPerformAction(state, "Observe");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not available");
  });

  it("denies any action when the encounter is not active", () => {
    const state = makeHospitalState({ status: "completed", availableActions: ["Take History"] });
    const result = canPerformAction(state, "Take History");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("completed");
  });
});

describe("canOrderInvestigation", () => {
  it("allows a fresh investigation while active", () => {
    expect(canOrderInvestigation(makeHospitalState(), "ecg_12lead").allowed).toBe(true);
  });

  it("denies an empty investigation id", () => {
    const result = canOrderInvestigation(makeHospitalState(), "   ");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("must not be empty");
  });

  it("denies a duplicate investigation order", () => {
    const state = makeHospitalState({
      orderedInvestigations: [
        { investigationId: "ecg_12lead", orderedAt: 5, timestamp: "t", status: "pending", resultAvailableAt: 5 },
      ],
    });
    const result = canOrderInvestigation(state, "ecg_12lead");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("already been ordered");
  });

  it("denies ordering when not active", () => {
    const state = makeHospitalState({ status: "abandoned" });
    expect(canOrderInvestigation(state, "ecg_12lead").allowed).toBe(false);
  });
});

describe("canAdministerTreatment", () => {
  it("allows a valid medicine while active", () => {
    expect(canAdministerTreatment(makeHospitalState(), "aspirin").allowed).toBe(true);
  });

  it("permits duplicate treatments (PRN dosing is valid)", () => {
    const state = makeHospitalState({
      administeredTreatments: [{ medicineId: "morphine", orderedAt: 5, timestamp: "t" }],
    });
    expect(canAdministerTreatment(state, "morphine").allowed).toBe(true);
  });

  it("denies an empty medicine id", () => {
    const result = canAdministerTreatment(makeHospitalState(), "");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("must not be empty");
  });

  it("denies administering when not active", () => {
    expect(canAdministerTreatment(makeHospitalState({ status: "completed" }), "aspirin").allowed).toBe(false);
  });
});

describe("canRecordObservation", () => {
  it("allows non-empty content while active", () => {
    expect(canRecordObservation(makeHospitalState(), "Patient stable").allowed).toBe(true);
  });

  it("denies empty content", () => {
    expect(canRecordObservation(makeHospitalState(), "  ").allowed).toBe(false);
  });

  it("denies recording when not active", () => {
    expect(canRecordObservation(makeHospitalState({ status: "paused" }), "note").allowed).toBe(false);
  });
});

describe("canCompleteEncounter", () => {
  it("denies completion with no clinical actions taken", () => {
    const result = canCompleteEncounter(makeHospitalState());
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("No clinical actions");
  });

  it("allows completion after any meaningful action", () => {
    const state = makeHospitalState({
      administeredTreatments: [{ medicineId: "aspirin", orderedAt: 5, timestamp: "t" }],
    });
    expect(canCompleteEncounter(state).allowed).toBe(true);
  });

  it("denies completion when not active", () => {
    expect(canCompleteEncounter(makeHospitalState({ status: "completed" })).allowed).toBe(false);
  });
});

describe("canAbandonEncounter", () => {
  it("allows abandoning an active encounter", () => {
    expect(canAbandonEncounter(makeHospitalState()).allowed).toBe(true);
  });

  it("allows abandoning a not_started encounter", () => {
    expect(canAbandonEncounter(makeHospitalState({ status: "not_started" })).allowed).toBe(true);
  });

  it("denies abandoning a completed encounter", () => {
    const result = canAbandonEncounter(makeHospitalState({ status: "completed" }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("completed encounter cannot be abandoned");
  });

  it("denies abandoning an already-abandoned encounter", () => {
    const result = canAbandonEncounter(makeHospitalState({ status: "abandoned" }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("already been abandoned");
  });
});
