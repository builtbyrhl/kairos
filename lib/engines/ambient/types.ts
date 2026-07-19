// ─────────────────────────────────────────────
// KAIROS — Ambient Engine Types
//
// Ownership: Ambient Engine exclusively.
//
// The Ambient Engine makes the hospital feel alive
// WITHOUT being the simulation. It runs on its own
// ambient clock that advances independently of the
// student's actions.
//
// It NEVER conflates its clock with the per-encounter
// Hospital Engine's `elapsedClinicalMinutes` (which
// only advances when the student acts).
//
// Purity discipline (matches the rest of Kairos):
//   • Same seed + config + tick count → identical state
//   • No side effects, no I/O, no mutation of inputs
//   • React/interval lives only in AmbientContext
//
// Phase 0 introduces the clock + mood scaffolding.
// Later phases extend AmbientState with queue, beds,
// eventQueue, eventLog, and notifications.
// ─────────────────────────────────────────────

import { AmbientConfig } from "./config";
import { QueueState } from "./queue/queue";
import { BedState } from "./beds/beds";

// ─── Hospital Mood (Phase 5 drives it; declared now) ──
// The global emotional/operational tone of the department.
// Influences arrival frequency, event generation, and
// nurse behaviour — without any existing engine changing.

export enum HospitalMood {
  Quiet        = "quiet",
  Busy         = "busy",
  Overwhelmed  = "overwhelmed",
  NightShift   = "night_shift",
  MassCasualty = "mass_casualty",
}

// ─── Clock ────────────────────────────────────

export interface AmbientClock {
  /** Total ambient ticks elapsed since shift start. */
  readonly tick: number;
  /** World minutes elapsed since shift start. */
  readonly elapsedWorldMinutes: number;
}

// ─── Shift Phase ──────────────────────────────
// Derived view of where we are within the shift.

export type ShiftMilestone =
  | "shift_start"
  | "quarter_shift"
  | "half_shift"
  | "three_quarter_shift"
  | "handover";

export interface ShiftPhase {
  /** Fraction of the shift completed, clamped [0..1]. */
  readonly progress: number;
  /** World minute-of-day (0..1439). */
  readonly minuteOfDay: number;
  /** Formatted wall time, e.g. "07:42 AM". */
  readonly label: string;
}

// ─── Run Status ───────────────────────────────

export type AmbientStatus = "running" | "paused";

// ─── Ambient State ────────────────────────────
// The complete, immutable ambient world snapshot.
// Phase 0 fields only; later phases add collections.

export interface AmbientState {
  readonly config:    AmbientConfig;
  readonly seed:      number;
  /**
   * Number of RNG draws consumed so far. Lets the reducer
   * stay pure: a SeededRNG is reconstructed from `seed` and
   * fast-forwarded by `rngCursor` whenever randomness is
   * needed (Phase 1+), then the new cursor is stored back.
   */
  readonly rngCursor: number;
  readonly status:    AmbientStatus;
  readonly clock:     AmbientClock;
  readonly mood:      HospitalMood;
  readonly queue:     QueueState;
  readonly beds:      BedState;
}

// ─── Ambient Actions ──────────────────────────

export type AmbientAction =
  | { readonly type: "TICK"; readonly deltaTicks?: number }
  | { readonly type: "PAUSE" }
  | { readonly type: "RESUME" }
  | { readonly type: "SET_MOOD"; readonly mood: HospitalMood }
  | { readonly type: "RECONFIGURE"; readonly config: AmbientConfig }
  | { readonly type: "RESET"; readonly seed?: number };
