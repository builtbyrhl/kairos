import { describe, it, expect } from "vitest";
import {
  createSession,
  applyAction,
  recordInvestigationResult,
  recordTreatmentResult,
} from "@/lib/engines/hospital/state";
import { Severity } from "@/lib/types/enums";
import type {
  HospitalState,
  ResolvedInvestigation,
  ResolvedTreatment,
} from "@/lib/engines/hospital/types";
import { makeEncounter, makeHospitalState } from "@/lib/test-utils/fixtures";

describe("createSession", () => {
  it("creates an active session seeded from the encounter", () => {
    const session = createSession(makeEncounter());
    expect(session.state.status).toBe("active");
    expect(session.state.caseId).toBe("case-1");
    expect(session.sessionId).toBe(session.state.sessionId);
    expect(session.state.timeState.elapsedClinicalMinutes).toBe(0);
    expect(session.state.availableActions).toEqual(makeEncounter().availableActions);
  });

  it("records a single SESSION_STARTED event at time zero", () => {
    const { state } = createSession(makeEncounter());
    expect(state.events).toHaveLength(1);
    expect(state.events[0].type).toBe("SESSION_STARTED");
  });

  it("generates a session id prefixed with the case id", () => {
    const { sessionId } = createSession(makeEncounter({ caseId: "case-xyz" }));
    expect(sessionId.startsWith("case-xyz-")).toBe(true);
  });
});

describe("applyAction — COMPLETE_ACTION", () => {
  it("advances clinical time and appends a completed action + event", () => {
    const start = createSession(makeEncounter()).state;
    const next = applyAction(start, { type: "COMPLETE_ACTION", action: "Take History" });
    expect(next.timeState.elapsedClinicalMinutes).toBe(10);
    expect(next.completedActions).toHaveLength(1);
    expect(next.completedActions[0].action).toBe("Take History");
    expect(next.events.at(-1)?.type).toBe("ACTION_COMPLETED");
  });

  it("does not mutate the input state (immutability)", () => {
    const start = createSession(makeEncounter()).state;
    const before = start.timeState.elapsedClinicalMinutes;
    applyAction(start, { type: "COMPLETE_ACTION", action: "Take History" });
    expect(start.timeState.elapsedClinicalMinutes).toBe(before);
    expect(start.completedActions).toHaveLength(0);
  });
});

describe("applyAction — ORDER_INVESTIGATION", () => {
  it("appends a pending investigation order and event", () => {
    const start = createSession(makeEncounter()).state;
    const next = applyAction(start, { type: "ORDER_INVESTIGATION", investigationId: "ecg_12lead" });
    expect(next.orderedInvestigations).toHaveLength(1);
    expect(next.orderedInvestigations[0]).toMatchObject({ investigationId: "ecg_12lead", status: "pending" });
    expect(next.timeState.elapsedClinicalMinutes).toBe(5);
    expect(next.events.at(-1)?.type).toBe("INVESTIGATION_ORDERED");
  });
});

describe("applyAction — ADMINISTER_TREATMENT", () => {
  it("records the treatment with optional dose/route", () => {
    const start = createSession(makeEncounter()).state;
    const next = applyAction(start, { type: "ADMINISTER_TREATMENT", medicineId: "aspirin", dose: "300mg", route: "oral" });
    expect(next.administeredTreatments).toHaveLength(1);
    expect(next.administeredTreatments[0]).toMatchObject({ medicineId: "aspirin", dose: "300mg", route: "oral" });
  });

  it("omits dose/route when not supplied", () => {
    const start = createSession(makeEncounter()).state;
    const next = applyAction(start, { type: "ADMINISTER_TREATMENT", medicineId: "aspirin" });
    expect(next.administeredTreatments[0].dose).toBeUndefined();
    expect(next.administeredTreatments[0].route).toBeUndefined();
  });
});

describe("applyAction — RECORD_OBSERVATION", () => {
  it("appends an observation and event", () => {
    const start = createSession(makeEncounter()).state;
    const next = applyAction(start, { type: "RECORD_OBSERVATION", content: "Patient diaphoretic" });
    expect(next.observations).toHaveLength(1);
    expect(next.observations[0].content).toBe("Patient diaphoretic");
    expect(next.events.at(-1)?.type).toBe("OBSERVATION_RECORDED");
  });
});

describe("applyAction — terminal transitions", () => {
  it("completes an active encounter", () => {
    const start = createSession(makeEncounter()).state;
    const next = applyAction(start, { type: "COMPLETE_ENCOUNTER" });
    expect(next.status).toBe("completed");
    expect(next.events.at(-1)?.type).toBe("ENCOUNTER_COMPLETED");
  });

  it("abandons an active encounter", () => {
    const start = createSession(makeEncounter()).state;
    const next = applyAction(start, { type: "ABANDON_ENCOUNTER" });
    expect(next.status).toBe("abandoned");
    expect(next.events.at(-1)?.type).toBe("ENCOUNTER_ABANDONED");
  });

  it("ignores actions on a non-active encounter", () => {
    const completed: HospitalState = makeHospitalState({ status: "completed" });
    const next = applyAction(completed, { type: "COMPLETE_ACTION", action: "Take History" });
    expect(next).toBe(completed);
  });
});

describe("recordInvestigationResult", () => {
  const resolved: ResolvedInvestigation = {
    investigationId: "ecg_12lead",
    name:            "12-Lead ECG",
    resolvedAt:      6,
    hasRedFlags:     true,
    findingCount:    3,
    severityTier:    Severity.Severe,
  };

  it("transitions the first pending matching order to resulted", () => {
    let state = createSession(makeEncounter()).state;
    state = applyAction(state, { type: "ORDER_INVESTIGATION", investigationId: "ecg_12lead" });
    const next = recordInvestigationResult(state, resolved);
    expect(next.orderedInvestigations[0].status).toBe("resulted");
    expect(next.resolvedInvestigations).toContainEqual(resolved);
    expect(next.events.at(-1)?.type).toBe("INVESTIGATION_RESULTED");
  });

  it("only transitions the first matching pending order", () => {
    // Two identical pending orders (constructed directly) — only the first resolves.
    const twoPending = makeHospitalState({
      orderedInvestigations: [
        { investigationId: "ecg_12lead", orderedAt: 5, timestamp: "t", status: "pending", resultAvailableAt: 5 },
        { investigationId: "ecg_12lead", orderedAt: 9, timestamp: "t", status: "pending", resultAvailableAt: 9 },
      ],
    });
    const next = recordInvestigationResult(twoPending, resolved);
    const statuses = next.orderedInvestigations.map(o => o.status);
    expect(statuses).toEqual(["resulted", "pending"]);
  });
});

describe("recordTreatmentResult", () => {
  it("appends the resolved treatment and a TREATMENT_EVALUATED event", () => {
    const resolved: ResolvedTreatment = {
      medicineId:   "aspirin",
      medicineName: "Aspirin",
      evaluatedAt:  9,
      correctness:  "correct",
      hasIssues:    false,
      issueCount:   0,
    };
    const state = createSession(makeEncounter()).state;
    const next = recordTreatmentResult(state, resolved);
    expect(next.resolvedTreatments).toContainEqual(resolved);
    expect(next.events.at(-1)?.type).toBe("TREATMENT_EVALUATED");
  });
});
