// ─────────────────────────────────────────────
// KAIROS — Ambient Engine · Queue
//
// Pure model of the waiting room around the student:
// arrivals, waiting, priority ordering, triage changes,
// and deterioration while waiting.
//
// Deterministic: same (config, rng stream, tick) → same
// queue. No React, no I/O, no mutation of inputs.
//
// These are AMBIENT patients. The one case the student
// assesses comes from the Patient Engine at admit time.
// ─────────────────────────────────────────────

import { AmbientConfig } from "../config";
import { CursorRng } from "../rng";
import {
  AMBIENT_MALE_NAMES,
  AMBIENT_FEMALE_NAMES,
  AMBIENT_SURNAMES,
  AMBIENT_COMPLAINTS,
  AMBIENT_DEPARTMENTS,
} from "./data";

export type AmbientTriage = "red" | "orange" | "yellow" | "green";

export interface WaitingPatient {
  readonly id:          string;
  readonly name:        string;
  readonly age:         number;
  readonly sex:         "male" | "female";
  readonly complaint:   string;
  readonly baseTriage:  AmbientTriage;
  /** Effective triage after deterioration (>= baseTriage). */
  readonly triage:      AmbientTriage;
  /** 0..100, rises the longer a patient waits. */
  readonly acuity:      number;
  readonly arrivedTick: number;
  readonly department:  string;
}

export interface QueueState {
  readonly waiting:         readonly WaitingPatient[];
  /** Tick at which the next arrival is due. */
  readonly nextArrivalTick: number;
  /** Monotonic counter feeding stable patient ids. */
  readonly serial:          number;
}

// ─── Triage helpers ───────────────────────────

const TRIAGE_RANK: Readonly<Record<AmbientTriage, number>> = {
  green: 0,
  yellow: 1,
  orange: 2,
  red: 3,
};

const RANK_TRIAGE: readonly AmbientTriage[] = ["green", "yellow", "orange", "red"];

/** Maps an acuity score to the triage band it implies. */
function acuityBand(acuity: number): AmbientTriage {
  if (acuity >= 80) return "red";
  if (acuity >= 60) return "orange";
  if (acuity >= 35) return "yellow";
  return "green";
}

/** Effective triage never drops below the presenting complaint's band. */
function effectiveTriage(base: AmbientTriage, acuity: number): AmbientTriage {
  const rank = Math.max(TRIAGE_RANK[base], TRIAGE_RANK[acuityBand(acuity)]);
  return RANK_TRIAGE[rank];
}

/** Baseline acuity for a presenting triage band. */
function baselineAcuity(triage: AmbientTriage, rng: CursorRng): number {
  switch (triage) {
    case "red":    return rng.nextInt(72, 85);
    case "orange": return rng.nextInt(50, 66);
    case "yellow": return rng.nextInt(28, 42);
    case "green":  return rng.nextInt(8, 22);
  }
}

// ─── Spawning ─────────────────────────────────

function spawnPatient(
  rng:    CursorRng,
  tick:   number,
  serial: number
): WaitingPatient {
  const sex   = rng.chance(0.55) ? "male" : "female";
  const first = rng.pick(sex === "male" ? AMBIENT_MALE_NAMES : AMBIENT_FEMALE_NAMES);
  const last  = rng.pick(AMBIENT_SURNAMES);
  const comp  = rng.pick(AMBIENT_COMPLAINTS);
  const acuity = baselineAcuity(comp.triage, rng);
  return {
    id:          `wp-${serial}`,
    name:        `${first} ${last}`,
    age:         rng.nextInt(19, 84),
    sex,
    complaint:   comp.text,
    baseTriage:  comp.triage,
    triage:      effectiveTriage(comp.triage, acuity),
    acuity,
    arrivedTick: tick,
    department:  rng.pick(AMBIENT_DEPARTMENTS),
  };
}

// ─── Ordering ─────────────────────────────────

/** Sorts sickest-first: triage rank desc, then acuity desc, then longest wait. */
export function sortQueue(patients: readonly WaitingPatient[]): readonly WaitingPatient[] {
  return [...patients].sort((a, b) => {
    const t = TRIAGE_RANK[b.triage] - TRIAGE_RANK[a.triage];
    if (t !== 0) return t;
    if (b.acuity !== a.acuity) return b.acuity - a.acuity;
    return a.arrivedTick - b.arrivedTick;
  });
}

// ─── Construction ─────────────────────────────

export function createQueue(
  config: AmbientConfig,
  rng:    CursorRng,
  startTick: number = 0
): QueueState {
  const count = config.queue.initialWaiting;
  const patients: WaitingPatient[] = [];
  // Cap initial waits to a believable window (~2h of world time),
  // derived from config so it scales with the clock's pace.
  const maxInitialWaitTicks = Math.max(
    1,
    Math.round(120 / Math.max(1, config.clock.worldMinutesPerTick)),
  );
  for (let i = 0; i < count; i++) {
    // Stagger arrival ticks into the recent past so waits look organic.
    const arrivedTick = startTick - rng.nextInt(1, maxInitialWaitTicks);
    const p = spawnPatient(rng, arrivedTick, i);
    patients.push(p);
  }
  return {
    waiting:         sortQueue(patients),
    nextArrivalTick: startTick + config.queue.patientArrivalRateTicks,
    serial:          count,
  };
}

// ─── Deterioration ────────────────────────────

function deteriorate(
  patient: WaitingPatient,
  config:  AmbientConfig,
  deltaTicks: number
): WaitingPatient {
  // Sicker presentations deteriorate faster.
  const factor = 1 + TRIAGE_RANK[patient.baseTriage] * 0.5;
  const acuity = Math.min(
    100,
    patient.acuity + config.queue.deteriorationRatePerTick * factor * deltaTicks
  );
  const triage = effectiveTriage(patient.baseTriage, acuity);
  if (acuity === patient.acuity && triage === patient.triage) return patient;
  return { ...patient, acuity, triage };
}

// ─── Tick ─────────────────────────────────────

/**
 * Advances the queue by `deltaTicks`: deterioration, then due
 * arrivals (respecting the max-waiting cap and mood multiplier),
 * then re-sorts sickest-first. Pure.
 */
export function tickQueue(
  state:           QueueState,
  config:          AmbientConfig,
  rng:             CursorRng,
  tick:            number,
  arrivalMultiplier: number = 1
): QueueState {
  const deltaTicks = 1;

  // 1) Deterioration of everyone waiting.
  let waiting = state.waiting.map(p => deteriorate(p, config, deltaTicks));

  // 2) Arrivals due at this tick.
  let serial          = state.serial;
  let nextArrivalTick = state.nextArrivalTick;
  while (tick >= nextArrivalTick) {
    if (waiting.length < config.queue.maxWaiting) {
      waiting = [...waiting, spawnPatient(rng, tick, serial)];
      serial += 1;
    }
    // Schedule the next arrival; faster when the department is busier.
    const base   = config.queue.patientArrivalRateTicks;
    const jitter = rng.nextInt(-Math.floor(base / 3), Math.floor(base / 3));
    const gap    = Math.max(1, Math.round((base + jitter) / Math.max(0.1, arrivalMultiplier)));
    nextArrivalTick += gap;
  }

  return {
    waiting: sortQueue(waiting),
    nextArrivalTick,
    serial,
  };
}

// ─── Selectors ────────────────────────────────

export function criticalCount(state: QueueState): number {
  return state.waiting.filter(p => p.triage === "red").length;
}

export function waitingCount(state: QueueState): number {
  return state.waiting.length;
}

/** Distinct departments currently represented in the queue. */
export function activeDepartments(state: QueueState): readonly string[] {
  return [...new Set(state.waiting.map(p => p.department))];
}
