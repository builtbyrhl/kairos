// ─────────────────────────────────────────────
// KAIROS — Shared Test Fixtures
//
// Minimal, typed builders used across unit tests.
// Not a test file — excluded from coverage.
// ─────────────────────────────────────────────

import { Severity } from "@/lib/types/enums";
import type {
  HospitalState,
  HospitalEvent,
  TreatmentRecord,
} from "@/lib/engines/hospital/types";
import type {
  PatientCase,
  GeneratedVital,
} from "@/lib/engines/patient/types";
import type { Encounter } from "@/lib/engines/encounter/types";
import { ENCOUNTER_ACTIONS } from "@/lib/engines/encounter/types";

/** Recursively strips `readonly` so cloned domain fixtures can be mutated in tests. */
export type DeepWritable<T> = T extends readonly (infer U)[]
  ? DeepWritable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: DeepWritable<T[K]> }
    : T;

/** A deep, structurally-mutable copy of readonly domain data (diseases, medicines, …). */
export function mutableClone<T>(value: T): DeepWritable<T> {
  return structuredClone(value) as DeepWritable<T>;
}

export function makeEncounter(overrides: Partial<Encounter> = {}): Encounter {
  return {
    caseId:         "case-1",
    timestamp:      "2025-01-01T00:00:00.000Z",
    patientSummary: {
      fullName:        "Test Patient",
      age:             58,
      sex:             "male",
      occupation:      "Teacher",
      isSmoker:        true,
      hasDiabetes:     false,
      hasHypertension: true,
      hasPreviousMI:   false,
    },
    chiefComplaint:   "Central chest pain",
    history:          "2 hours of central chest pain radiating to the left arm.",
    visibleVitals:    [],
    triagePriority:   "red",
    availableActions: ENCOUNTER_ACTIONS,
    ...overrides,
  };
}

export function makeGeneratedVital(
  overrides: Partial<GeneratedVital> = {}
): GeneratedVital {
  return {
    parameter:  "Systolic Blood Pressure",
    value:      120,
    unit:       "mmHg",
    isAbnormal: false,
    isRedFlag:  false,
    ...overrides,
  };
}

export function makeTreatmentRecord(
  overrides: Partial<TreatmentRecord> = {}
): TreatmentRecord {
  return {
    medicineId: "aspirin",
    orderedAt:  5,
    timestamp:  "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeHospitalEvent(
  overrides: Partial<HospitalEvent> = {}
): HospitalEvent {
  return {
    id:              "evt-test-0001",
    type:            "INVESTIGATION_ORDERED",
    clinicalMinutes: 5,
    timestamp:       "2025-01-01T00:00:00.000Z",
    payload:         {},
    ...overrides,
  };
}

export function makeHospitalState(
  overrides: Partial<HospitalState> = {}
): HospitalState {
  return {
    sessionId:              "case-1-abc",
    caseId:                 "case-1",
    status:                 "active",
    triagePriority:         "red",
    startedAt:              "2025-01-01T00:00:00.000Z",
    timeState:              { wallClockStartedAt: "2025-01-01T00:00:00.000Z", elapsedClinicalMinutes: 0 },
    completedActions:       [],
    orderedInvestigations:  [],
    resolvedInvestigations: [],
    administeredTreatments: [],
    resolvedTreatments:     [],
    observations:           [],
    events:                 [],
    availableActions:       ["Take History", "Order Investigation", "Administer Treatment"],
    ...overrides,
  };
}

export function makePatientCase(
  overrides: Partial<PatientCase> = {}
): PatientCase {
  const vitals: readonly GeneratedVital[] = [
    makeGeneratedVital({ parameter: "Systolic Blood Pressure", value: 120, unit: "mmHg" }),
    makeGeneratedVital({ parameter: "SpO₂", value: 97, unit: "%" }),
  ];
  return {
    caseId:               "case-1",
    diseaseId:            "stemi",
    seed:                 12345,
    generatedAt:          "2025-01-01T00:00:00.000Z",
    profile: {
      fullName:   "Test Patient",
      age:        58,
      sex:        "male",
      occupation: "Teacher",
      comorbidities: {
        isSmoker:        true,
        hasDiabetes:     false,
        hasHypertension: true,
        hasPreviousMI:   false,
      },
    },
    severity:             Severity.Severe,
    symptomOnsetHours:    2,
    presentingComplaints: ["Central chest pain"],
    generatedVitals:      vitals,
    selectedSymptoms:     [],
    hidden: {
      chosenSeverity:          Severity.Severe,
      selectedInfarctLocation: undefined,
      elapsedClinicalMinutes:  0,
      generatedVitals:         vitals,
      selectedSymptomIds:      [],
      comorbidities: {
        isSmoker:        true,
        hasDiabetes:     false,
        hasHypertension: true,
        hasPreviousMI:   false,
      },
    },
    ...overrides,
  };
}
