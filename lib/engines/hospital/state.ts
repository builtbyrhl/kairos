// ─────────────────────────────────────────────
// KAIROS — Hospital Engine State Management
//
// Public student-facing functions:
//   createSession(encounter)     → StudentSession
//   applyAction(state, action)   → HospitalState
//
// Engine-to-engine functions (called by Simulation Controller):
//   recordInvestigationResult(state, resolved) → HospitalState
//   recordTreatmentResult(state, resolved)     → HospitalState
//
// These are NOT HospitalActions — routing them through
// applyAction would require new variants and break all
// exhaustive switches.
// ─────────────────────────────────────────────

import { Encounter, EncounterAction } from "../encounter";

import {
  HospitalState,
  HospitalAction,
  HospitalEvent,
  StudentSession,
  TimeState,
  CompletedAction,
  InvestigationOrder,
  TreatmentRecord,
  ObservationRecord,
  ResolvedInvestigation,
  ResolvedTreatment,
} from "./types";

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
} from "./events";

const ENCOUNTER_ACTION_COSTS: Record<EncounterAction, number> = {
  "Take History":         10,
  "Physical Examination":  8,
  "View Vital Signs":      2,
  "Order Investigation":   3,
  "Administer Treatment":  5,
  "Observe":              15,
};

const INVESTIGATION_ORDER_COST = 5;
const TREATMENT_ADMIN_COST      = 5;
const OBSERVATION_RECORD_COST   = 2;

function generateSessionId(caseId: string): string {
  const time = Date.now().toString(16);
  const rand = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0");
  return `${caseId}-${time}-${rand}`;
}

function advanceClinicalTime(timeState: TimeState, minutes: number): TimeState {
  return { ...timeState, elapsedClinicalMinutes: timeState.elapsedClinicalMinutes + minutes };
}

function isActive(state: HospitalState): boolean {
  return state.status === "active";
}

function assertNever(value: never): never {
  throw new Error(`Unhandled HospitalAction type: ${JSON.stringify(value)}`);
}

// ─── Action Handlers ──────────────────────────

function handleCompleteAction(
  state:  HospitalState,
  action: Extract<HospitalAction, { type: "COMPLETE_ACTION" }>
): HospitalState {
  if (!isActive(state)) return state;
  const cost         = ENCOUNTER_ACTION_COSTS[action.action];
  const newTimeState = advanceClinicalTime(state.timeState, cost);
  const completed: CompletedAction = {
    action:          action.action,
    clinicalMinutes: newTimeState.elapsedClinicalMinutes,
    timestamp:       new Date().toISOString(),
  };
  return {
    ...state,
    timeState:        newTimeState,
    completedActions: [...state.completedActions, completed],
    events:           [...state.events, buildActionCompletedEvent(action.action, newTimeState.elapsedClinicalMinutes)],
  };
}

function handleOrderInvestigation(
  state:  HospitalState,
  action: Extract<HospitalAction, { type: "ORDER_INVESTIGATION" }>
): HospitalState {
  if (!isActive(state)) return state;
  const newTimeState = advanceClinicalTime(state.timeState, INVESTIGATION_ORDER_COST);
  const order: InvestigationOrder = {
    investigationId:   action.investigationId,
    orderedAt:         newTimeState.elapsedClinicalMinutes,
    timestamp:         new Date().toISOString(),
    status:            "pending",
    resultAvailableAt: newTimeState.elapsedClinicalMinutes,
  };
  return {
    ...state,
    timeState:             newTimeState,
    orderedInvestigations: [...state.orderedInvestigations, order],
    events:                [...state.events, buildInvestigationOrderedEvent(action.investigationId, newTimeState.elapsedClinicalMinutes)],
  };
}

function handleAdministerTreatment(
  state:  HospitalState,
  action: Extract<HospitalAction, { type: "ADMINISTER_TREATMENT" }>
): HospitalState {
  if (!isActive(state)) return state;
  const newTimeState = advanceClinicalTime(state.timeState, TREATMENT_ADMIN_COST);
  const record: TreatmentRecord = {
    medicineId: action.medicineId,
    orderedAt:  newTimeState.elapsedClinicalMinutes,
    timestamp:  new Date().toISOString(),
    ...(action.dose  !== undefined ? { dose:  action.dose  } : {}),
    ...(action.route !== undefined ? { route: action.route } : {}),
  };
  return {
    ...state,
    timeState:               newTimeState,
    administeredTreatments:  [...state.administeredTreatments, record],
    events:                  [...state.events, buildTreatmentAdministeredEvent(action.medicineId, action.dose, action.route, newTimeState.elapsedClinicalMinutes)],
  };
}

function handleRecordObservation(
  state:  HospitalState,
  action: Extract<HospitalAction, { type: "RECORD_OBSERVATION" }>
): HospitalState {
  if (!isActive(state)) return state;
  const newTimeState = advanceClinicalTime(state.timeState, OBSERVATION_RECORD_COST);
  const observation: ObservationRecord = {
    content:    action.content,
    recordedAt: newTimeState.elapsedClinicalMinutes,
    timestamp:  new Date().toISOString(),
  };
  return {
    ...state,
    timeState:    newTimeState,
    observations: [...state.observations, observation],
    events:       [...state.events, buildObservationRecordedEvent(action.content, newTimeState.elapsedClinicalMinutes)],
  };
}

function handleCompleteEncounter(state: HospitalState): HospitalState {
  if (!isActive(state)) return state;
  return { ...state, status: "completed", events: [...state.events, buildEncounterCompletedEvent(state.timeState.elapsedClinicalMinutes)] };
}

function handleAbandonEncounter(state: HospitalState): HospitalState {
  if (!isActive(state)) return state;
  return { ...state, status: "abandoned", events: [...state.events, buildEncounterAbandonedEvent(state.timeState.elapsedClinicalMinutes)] };
}

// ─── Public API ───────────────────────────────

export function createSession(encounter: Encounter): StudentSession {
  const now       = new Date().toISOString();
  const sessionId = generateSessionId(encounter.caseId);
  const timeState: TimeState = { wallClockStartedAt: now, elapsedClinicalMinutes: 0 };
  const state: HospitalState = {
    sessionId,
    caseId:                  encounter.caseId,
    status:                  "active",
    triagePriority:          encounter.triagePriority,
    startedAt:               now,
    timeState,
    completedActions:        [],
    orderedInvestigations:   [],
    resolvedInvestigations:  [],
    administeredTreatments:  [],
    resolvedTreatments:      [],
    observations:            [],
    events:                  [buildSessionStartedEvent(0)],
    availableActions:        encounter.availableActions,
  };
  return { sessionId, encounter, state };
}

export function applyAction(state: HospitalState, action: HospitalAction): HospitalState {
  switch (action.type) {
    case "COMPLETE_ACTION":      return handleCompleteAction(state, action);
    case "ORDER_INVESTIGATION":  return handleOrderInvestigation(state, action);
    case "ADMINISTER_TREATMENT": return handleAdministerTreatment(state, action);
    case "RECORD_OBSERVATION":   return handleRecordObservation(state, action);
    case "COMPLETE_ENCOUNTER":   return handleCompleteEncounter(state);
    case "ABANDON_ENCOUNTER":    return handleAbandonEncounter(state);
    default:                     return assertNever(action);
  }
}

/**
 * Records a resolved investigation result into HospitalState.
 * Called by the Simulation Controller — not a student action.
 * First matching "pending" order transitions to "resulted".
 */
export function recordInvestigationResult(
  state:    HospitalState,
  resolved: ResolvedInvestigation
): HospitalState {
  let firstPendingUpdated = false;
  const updatedOrders = state.orderedInvestigations.map(order => {
    if (!firstPendingUpdated && order.investigationId === resolved.investigationId && order.status === "pending") {
      firstPendingUpdated = true;
      return { ...order, status: "resulted" as const };
    }
    return order;
  });
  const event = buildInvestigationResultedEvent(
    resolved.investigationId,
    resolved.resolvedAt,
    resolved.severityTier,
    state.timeState.elapsedClinicalMinutes
  );
  return {
    ...state,
    orderedInvestigations:   updatedOrders,
    resolvedInvestigations:  [...state.resolvedInvestigations, resolved],
    events:                  [...state.events, event],
  };
}

/**
 * Records a treatment evaluation result into HospitalState.
 * Called by the Simulation Controller — not a student action.
 *
 * Does not check encounter status — the Simulation Controller
 * is responsible for status gating.
 */
export function recordTreatmentResult(
  state:    HospitalState,
  resolved: ResolvedTreatment
): HospitalState {
  const event = buildTreatmentEvaluatedEvent(
    resolved.medicineId,
    resolved.correctness,
    resolved.hasIssues,
    resolved.issueCount,
    state.timeState.elapsedClinicalMinutes
  );
  return {
    ...state,
    resolvedTreatments: [...state.resolvedTreatments, resolved],
    events:             [...state.events, event],
  };
}
