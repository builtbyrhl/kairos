// ─────────────────────────────────────────────
// KAIROS — Hospital Engine Types
//
// Ownership: Hospital Engine exclusively.
//
// Hospital Engine records what the student did.
// It does not evaluate correctness — that belongs
// to future Treatment Engine and Scoring Engine.
//
// Encounter Engine types are consumed read-only.
// No Hospital Engine type ever re-wraps an
// Encounter Engine type. The original Encounter
// is stored whole in StudentSession.encounter.
//
// All interfaces are immutable by design.
// applyAction always returns a new HospitalState.
//
// ResolvedInvestigation uses only primitive types
// and lib/types/enums. It never imports from the
// Investigation Engine — that would create a
// circular dependency. The Simulation Controller
// maps InvestigationReport → ResolvedInvestigation.
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
// Minimal record stored in HospitalState after
// a successful resolveInvestigation() call.
//
// Wall-clock timestamp is intentionally absent.
// It is captured in HospitalState.events via the
// INVESTIGATION_RESULTED event. Storing it here
// would create two timestamps for the same event
// that may differ by milliseconds — an inconsistent
// audit trail.
//
// resolvedAt (clinical minutes) is the canonical
// time reference in Kairos.
//
// severityTier is stored for the Scoring Engine
// to evaluate result interpretation quality.
// The Simulation Controller strips this from
// any student-facing display.
//
// Multiple entries may exist for the same
// investigationId — serial testing produces one
// ResolvedInvestigation per resolution.

export interface ResolvedInvestigation {
  readonly investigationId: string;
  readonly name:            string;
  readonly resolvedAt:      number;        // clinical minutes
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
