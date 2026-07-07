// ─────────────────────────────────────────────
// KAIROS — Hospital Engine Types
//
// Ownership: Hospital Engine exclusively.
//
// Hospital Engine records what the student did.
// It does not evaluate correctness — that belongs
// to Treatment Engine and Scoring Engine.
//
// ResolvedInvestigation and ResolvedTreatment use
// only primitive types and lib/types/enums.
// They never import from Investigation Engine or
// Treatment Engine — that would create circular deps.
// The Simulation Controller maps engine output to
// these types.
// ─────────────────────────────────────────────

import { Encounter, EncounterAction, TriagePriority } from "../encounter";
import { Severity }                                   from "../../types/enums";

// ─── Encounter Lifecycle ──────────────────────

export type EncounterStatus =
  | "not_started"
  | "active"
  | "paused"
  | "completed"
  | "abandoned";

// ─── Time State ───────────────────────────────

export interface TimeState {
  readonly wallClockStartedAt:     string;
  readonly elapsedClinicalMinutes: number;
}

// ─── Completed Action ─────────────────────────

export interface CompletedAction {
  readonly action:          EncounterAction;
  readonly clinicalMinutes: number;
  readonly timestamp:       string;
}

// ─── Investigation Order ──────────────────────

export interface InvestigationOrder {
  readonly investigationId:   string;
  readonly orderedAt:         number;
  readonly timestamp:         string;
  readonly status:            "pending" | "resulted";
  readonly resultAvailableAt: number;
}

// ─── Resolved Investigation ───────────────────
// Wall-clock timestamp intentionally absent.
// Captured in HospitalState.events via INVESTIGATION_RESULTED.
// resolvedAt (clinical minutes) is the canonical time reference.

export interface ResolvedInvestigation {
  readonly investigationId: string;
  readonly name:            string;
  readonly resolvedAt:      number;
  readonly hasRedFlags:     boolean;
  readonly findingCount:    number;
  readonly severityTier:    Severity | "normal";
}

// ─── Treatment Record ─────────────────────────

export interface TreatmentRecord {
  readonly medicineId: string;
  readonly orderedAt:  number;
  readonly timestamp:  string;
  readonly dose?:      string;
  readonly route?:     string;
}

// ─── Resolved Treatment ───────────────────────
// Minimal record stored in HospitalState after a
// successful evaluateTreatment() call.
//
// correctness stored as string — Treatment Engine's
// TreatmentCorrectness type is not imported here to
// prevent circular dependency. The Simulation Controller
// maps TreatmentEvaluation → ResolvedTreatment.
//
// educationalNotes deliberately absent — they are held
// by the Simulation Controller and released post-case
// via the Reflection Engine.

export interface ResolvedTreatment {
  readonly medicineId:   string;
  readonly medicineName: string;
  readonly evaluatedAt:  number;    // clinical minutes
  readonly correctness:  string;    // TreatmentCorrectness as string
  readonly hasIssues:    boolean;
  readonly issueCount:   number;
}

// ─── Observation Record ───────────────────────

export interface ObservationRecord {
  readonly content:    string;
  readonly recordedAt: number;
  readonly timestamp:  string;
}

// ─── Hospital Event Type ──────────────────────

export type HospitalEventType =
  | "SESSION_STARTED"
  | "ACTION_COMPLETED"
  | "INVESTIGATION_ORDERED"
  | "INVESTIGATION_RESULTED"
  | "TREATMENT_ADMINISTERED"
  | "TREATMENT_EVALUATED"
  | "OBSERVATION_RECORDED"
  | "ENCOUNTER_COMPLETED"
  | "ENCOUNTER_ABANDONED";

// ─── Hospital Event ───────────────────────────

export interface HospitalEvent {
  readonly id:              string;
  readonly type:            HospitalEventType;
  readonly clinicalMinutes: number;
  readonly timestamp:       string;
  readonly payload:         Readonly<Record<string, unknown>>;
}

// ─── Hospital Action ──────────────────────────
// recordTreatmentResult is NOT a HospitalAction.
// It is engine-to-engine communication — not a
// student action. Routing it through applyAction
// would require a new variant and break exhaustive
// switches across the codebase.

export type HospitalAction =
  | { readonly type: "COMPLETE_ACTION";      readonly action: EncounterAction                                             }
  | { readonly type: "ORDER_INVESTIGATION";  readonly investigationId: string                                             }
  | { readonly type: "ADMINISTER_TREATMENT"; readonly medicineId: string; readonly dose?: string; readonly route?: string }
  | { readonly type: "RECORD_OBSERVATION";   readonly content: string                                                     }
  | { readonly type: "COMPLETE_ENCOUNTER"                                                                                 }
  | { readonly type: "ABANDON_ENCOUNTER"                                                                                  };

// ─── Hospital State ───────────────────────────

export interface HospitalState {
  readonly sessionId:              string;
  readonly caseId:                 string;
  readonly status:                 EncounterStatus;
  readonly triagePriority:         TriagePriority;
  readonly startedAt:              string;
  readonly timeState:              TimeState;
  readonly completedActions:       readonly CompletedAction[];
  readonly orderedInvestigations:  readonly InvestigationOrder[];
  readonly resolvedInvestigations: readonly ResolvedInvestigation[];
  readonly administeredTreatments: readonly TreatmentRecord[];
  readonly resolvedTreatments:     readonly ResolvedTreatment[];
  readonly observations:           readonly ObservationRecord[];
  readonly events:                 readonly HospitalEvent[];
  readonly availableActions:       readonly EncounterAction[];
}

// ─── Student Session ──────────────────────────

export interface StudentSession {
  readonly sessionId: string;
  readonly encounter: Encounter;
  readonly state:     HospitalState;
}
