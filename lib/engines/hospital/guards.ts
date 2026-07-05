// ─────────────────────────────────────────────
// KAIROS — Hospital Engine Guards
//
// Pure predicate functions for validating action
// eligibility before submission to applyAction.
//
// Guards are defence-in-depth — applyAction also
// checks encounter status internally. Guards
// provide structured feedback to the UI layer
// before an action is even attempted.
//
// Ownership: Hospital Engine exclusively.
// No imports from Disease, Patient, or Medicine engines.
//
// Duplicate treatments are intentionally permitted.
// PRN dosing is valid clinical practice. The future
// Treatment Engine evaluates appropriateness.
//
// Action gating (e.g. treatment unavailable before
// history) is not implemented in v1. All actions
// in state.availableActions are accessible while
// the encounter is active. Future Hospital Engine
// phases will gate based on completedActions.
// ─────────────────────────────────────────────

import { HospitalState } from "./types";
import { EncounterAction } from "../encounter";

// ─── Result Type ──────────────────────────────
// Structured validation result returned by every
// guard function. The UI uses `reason` to display
// an appropriate message when `allowed` is false.

export interface GuardResult {
  readonly allowed: boolean;
  readonly reason?: string;
}

// ─── Private Helpers ──────────────────────────

function allowed(): GuardResult {
  return { allowed: true };
}

function denied(reason: string): GuardResult {
  return { allowed: false, reason };
}

function isEncounterActive(state: HospitalState): boolean {
  return state.status === "active";
}

function hasInvestigationBeenOrdered(
  state:           HospitalState,
  investigationId: string
): boolean {
  return state.orderedInvestigations.some(
    o => o.investigationId === investigationId
  );
}

// ─── Public Guards ────────────────────────────

/**
 * Validates that a high-level EncounterAction may be performed.
 *
 * In v1 all actions remain in availableActions throughout
 * the encounter. This guard becomes meaningful when future
 * Hospital Engine phases gate actions based on clinical
 * progress (e.g. treatment unavailable before history).
 */
export function canPerformAction(
  state:  HospitalState,
  action: EncounterAction
): GuardResult {
  if (!isEncounterActive(state)) {
    return denied(
      `Encounter status is "${state.status}". ` +
      `Only active encounters accept actions.`
    );
  }
  if (!(state.availableActions as readonly string[]).includes(action)) {
    return denied(
      `Action "${action}" is not available in this encounter.`
    );
  }
  return allowed();
}

/**
 * Validates that a specific investigation may be ordered.
 * Blocks empty IDs and duplicate orders.
 *
 * Serial investigations (e.g. repeat troponin) require
 * the student to order the same investigation ID again.
 * This guard blocks exact duplicates — the serial testing
 * workflow will be managed by future Investigation Engine.
 */
export function canOrderInvestigation(
  state:           HospitalState,
  investigationId: string
): GuardResult {
  if (!isEncounterActive(state)) {
    return denied(
      `Encounter status is "${state.status}". ` +
      `Only active encounters accept investigation orders.`
    );
  }
  if (!investigationId.trim()) {
    return denied("Investigation ID must not be empty.");
  }
  if (hasInvestigationBeenOrdered(state, investigationId)) {
    return denied(
      `Investigation "${investigationId}" has already been ordered. ` +
      `Serial testing will be managed by the Investigation Engine.`
    );
  }
  return allowed();
}

/**
 * Validates that a treatment may be administered.
 * Duplicate treatments are permitted — PRN dosing and
 * repeat doses are valid clinical practice.
 * Correctness evaluation belongs to the Treatment Engine.
 */
export function canAdministerTreatment(
  state:      HospitalState,
  medicineId: string
): GuardResult {
  if (!isEncounterActive(state)) {
    return denied(
      `Encounter status is "${state.status}". ` +
      `Only active encounters accept treatment orders.`
    );
  }
  if (!medicineId.trim()) {
    return denied("Medicine ID must not be empty.");
  }
  return allowed();
}

/**
 * Validates that a clinical observation may be recorded.
 * Blocks empty content.
 */
export function canRecordObservation(
  state:   HospitalState,
  content: string
): GuardResult {
  if (!isEncounterActive(state)) {
    return denied(
      `Encounter status is "${state.status}". ` +
      `Only active encounters accept observations.`
    );
  }
  if (!content.trim()) {
    return denied("Observation content must not be empty.");
  }
  return allowed();
}

/**
 * Validates that the encounter may be completed.
 *
 * Minimum requirement: at least one meaningful clinical
 * action has been taken. Quality is evaluated by the
 * future Scoring Engine — this guard only prevents
 * completely empty submissions.
 */
export function canCompleteEncounter(state: HospitalState): GuardResult {
  if (!isEncounterActive(state)) {
    return denied(
      `Encounter status is "${state.status}". ` +
      `Only active encounters can be completed.`
    );
  }

  const hasAnyMeaningfulAction =
    state.completedActions.length       > 0 ||
    state.orderedInvestigations.length  > 0 ||
    state.administeredTreatments.length > 0;

  if (!hasAnyMeaningfulAction) {
    return denied(
      "No clinical actions have been taken. " +
      "Take history, order an investigation, or administer " +
      "treatment before completing the encounter."
    );
  }

  return allowed();
}

/**
 * Validates that the encounter may be abandoned.
 * Terminal states (completed, abandoned) cannot be abandoned.
 * All other states (not_started, active, paused) allow abandonment.
 */
export function canAbandonEncounter(state: HospitalState): GuardResult {
  if (state.status === "completed") {
    return denied("A completed encounter cannot be abandoned.");
  }
  if (state.status === "abandoned") {
    return denied("This encounter has already been abandoned.");
  }
  return allowed();
}
