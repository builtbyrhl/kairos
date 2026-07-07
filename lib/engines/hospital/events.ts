// ─────────────────────────────────────────────
// KAIROS — Hospital Engine Event Factories
//
// Internal to Hospital Engine.
// Not exported from index.ts.
// ─────────────────────────────────────────────

import { HospitalEvent, HospitalEventType } from "./types";
import { EncounterAction }                  from "../encounter";

function generateEventId(): string {
  const time = Date.now().toString(16);
  const rand = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0");
  return `evt-${time}-${rand}`;
}

function buildEvent(
  type:            HospitalEventType,
  clinicalMinutes: number,
  payload:         Record<string, unknown>
): HospitalEvent {
  return {
    id:              generateEventId(),
    type,
    clinicalMinutes,
    timestamp:       new Date().toISOString(),
    payload:         Object.freeze(payload),
  };
}

export function buildSessionStartedEvent(clinicalMinutes: number): HospitalEvent {
  return buildEvent("SESSION_STARTED", clinicalMinutes, {});
}

export function buildActionCompletedEvent(
  action:          EncounterAction,
  clinicalMinutes: number
): HospitalEvent {
  return buildEvent("ACTION_COMPLETED", clinicalMinutes, { action });
}

export function buildInvestigationOrderedEvent(
  investigationId: string,
  clinicalMinutes: number
): HospitalEvent {
  return buildEvent("INVESTIGATION_ORDERED", clinicalMinutes, { investigationId });
}

export function buildInvestigationResultedEvent(
  investigationId: string,
  resolvedAt:      number,
  severityTier:    string,
  clinicalMinutes: number
): HospitalEvent {
  return buildEvent("INVESTIGATION_RESULTED", clinicalMinutes, {
    investigationId,
    resolvedAt,
    severityTier,
  });
}

export function buildTreatmentAdministeredEvent(
  medicineId:      string,
  dose:            string | undefined,
  route:           string | undefined,
  clinicalMinutes: number
): HospitalEvent {
  const payload: Record<string, unknown> = { medicineId };
  if (dose  !== undefined) payload["dose"]  = dose;
  if (route !== undefined) payload["route"] = route;
  return buildEvent("TREATMENT_ADMINISTERED", clinicalMinutes, payload);
}

/**
 * TREATMENT_EVALUATED — emitted when a treatment evaluation
 * result is recorded into HospitalState.
 *
 * payload.medicineId:  string  — which medicine was evaluated
 * payload.correctness: string  — TreatmentCorrectness value
 * payload.hasIssues:   boolean — quick signal for Scoring Engine
 * payload.issueCount:  number  — detail for Scoring Engine
 *
 * educationalNotes deliberately absent from payload —
 * they are held by the Simulation Controller and
 * released post-case via the Reflection Engine.
 */
export function buildTreatmentEvaluatedEvent(
  medicineId:      string,
  correctness:     string,
  hasIssues:       boolean,
  issueCount:      number,
  clinicalMinutes: number
): HospitalEvent {
  return buildEvent("TREATMENT_EVALUATED", clinicalMinutes, {
    medicineId,
    correctness,
    hasIssues,
    issueCount,
  });
}

export function buildObservationRecordedEvent(
  content:         string,
  clinicalMinutes: number
): HospitalEvent {
  return buildEvent("OBSERVATION_RECORDED", clinicalMinutes, { content });
}

export function buildEncounterCompletedEvent(clinicalMinutes: number): HospitalEvent {
  return buildEvent("ENCOUNTER_COMPLETED", clinicalMinutes, {});
}

export function buildEncounterAbandonedEvent(clinicalMinutes: number): HospitalEvent {
  return buildEvent("ENCOUNTER_ABANDONED", clinicalMinutes, {});
}
