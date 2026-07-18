import { describe, it, expect } from "vitest";
import {
  buildSessionStartedEvent,
  buildActionCompletedEvent,
  buildInvestigationOrderedEvent,
  buildInvestigationResultedEvent,
  buildTreatmentAdministeredEvent,
  buildTreatmentEvaluatedEvent,
  buildObservationRecordedEvent,
  buildEncounterCompletedEvent,
  buildEncounterAbandonedEvent,
} from "@/lib/engines/hospital/events";

describe("hospital event factories", () => {
  it("builds a SESSION_STARTED event with an empty payload", () => {
    const e = buildSessionStartedEvent(0);
    expect(e.type).toBe("SESSION_STARTED");
    expect(e.clinicalMinutes).toBe(0);
    expect(e.payload).toEqual({});
    expect(e.id).toMatch(/^evt-/);
    expect(typeof e.timestamp).toBe("string");
  });

  it("builds an ACTION_COMPLETED event carrying the action", () => {
    const e = buildActionCompletedEvent("Take History", 10);
    expect(e.type).toBe("ACTION_COMPLETED");
    expect(e.payload).toEqual({ action: "Take History" });
    expect(e.clinicalMinutes).toBe(10);
  });

  it("builds an INVESTIGATION_ORDERED event", () => {
    const e = buildInvestigationOrderedEvent("ecg_12lead", 5);
    expect(e.type).toBe("INVESTIGATION_ORDERED");
    expect(e.payload).toEqual({ investigationId: "ecg_12lead" });
  });

  it("builds an INVESTIGATION_RESULTED event with full payload", () => {
    const e = buildInvestigationResultedEvent("troponin_i", 20, "severe", 22);
    expect(e.type).toBe("INVESTIGATION_RESULTED");
    expect(e.payload).toEqual({ investigationId: "troponin_i", resolvedAt: 20, severityTier: "severe" });
    expect(e.clinicalMinutes).toBe(22);
  });

  it("omits dose/route from a TREATMENT_ADMINISTERED event when undefined", () => {
    const e = buildTreatmentAdministeredEvent("aspirin", undefined, undefined, 8);
    expect(e.payload).toEqual({ medicineId: "aspirin" });
  });

  it("includes dose/route in a TREATMENT_ADMINISTERED event when provided", () => {
    const e = buildTreatmentAdministeredEvent("aspirin", "300mg", "oral", 8);
    expect(e.payload).toEqual({ medicineId: "aspirin", dose: "300mg", route: "oral" });
  });

  it("builds a TREATMENT_EVALUATED event", () => {
    const e = buildTreatmentEvaluatedEvent("aspirin", "correct", false, 0, 9);
    expect(e.type).toBe("TREATMENT_EVALUATED");
    expect(e.payload).toEqual({ medicineId: "aspirin", correctness: "correct", hasIssues: false, issueCount: 0 });
  });

  it("builds an OBSERVATION_RECORDED event", () => {
    const e = buildObservationRecordedEvent("Patient stable", 12);
    expect(e.payload).toEqual({ content: "Patient stable" });
  });

  it("builds terminal encounter events with empty payloads", () => {
    expect(buildEncounterCompletedEvent(30).type).toBe("ENCOUNTER_COMPLETED");
    expect(buildEncounterCompletedEvent(30).payload).toEqual({});
    expect(buildEncounterAbandonedEvent(30).type).toBe("ENCOUNTER_ABANDONED");
    expect(buildEncounterAbandonedEvent(30).payload).toEqual({});
  });

  it("freezes the event payload", () => {
    const e = buildInvestigationOrderedEvent("ecg_12lead", 5);
    expect(Object.isFrozen(e.payload)).toBe(true);
  });
});
