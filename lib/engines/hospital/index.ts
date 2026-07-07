// ─────────────────────────────────────────────
// KAIROS — Hospital Engine Public API
// ─────────────────────────────────────────────

export {
  createSession,
  applyAction,
  recordInvestigationResult,
  recordTreatmentResult,
} from "./state";

export {
  canPerformAction,
  canOrderInvestigation,
  canAdministerTreatment,
  canRecordObservation,
  canCompleteEncounter,
  canAbandonEncounter,
} from "./guards";

export type { GuardResult } from "./guards";

export type {
  EncounterStatus,
  TimeState,
  CompletedAction,
  InvestigationOrder,
  ResolvedInvestigation,
  TreatmentRecord,
  ResolvedTreatment,
  ObservationRecord,
  HospitalEventType,
  HospitalEvent,
  HospitalAction,
  HospitalState,
  StudentSession,
} from "./types";
