// ─────────────────────────────────────────────
// KAIROS — Ambient Engine · Beds
//
// Pure model of hospital capacity: ER, ICU, and ward
// occupancy, plus an overall hospital-load figure that
// drives ambient atmosphere.
//
// Phase 1 establishes capacity + load. Phase 2 wires
// admit/discharge to occupy and free beds. No React,
// no I/O, no mutation of inputs.
// ─────────────────────────────────────────────

import { AmbientConfig } from "../config";
import { CursorRng } from "../rng";

export type BedUnit = "er" | "icu" | "ward";

export interface UnitBeds {
  readonly total:    number;
  readonly occupied: number;
}

export interface BedState {
  readonly er:   UnitBeds;
  readonly icu:  UnitBeds;
  readonly ward: UnitBeds;
}

// ─── Construction ─────────────────────────────

function seedUnit(total: number, occupancy: number, rng: CursorRng): UnitBeds {
  // Jitter each unit around the target occupancy so the
  // hospital doesn't look uniformly full.
  const jittered = Math.min(1, Math.max(0, occupancy + rng.nextFloatRange(-0.1, 0.1, 2)));
  const occupied = Math.min(total, Math.round(total * jittered));
  return { total, occupied };
}

export function createBeds(config: AmbientConfig, rng: CursorRng): BedState {
  const { erBeds, icuBeds, wardBeds, initialOccupancy } = config.beds;
  return {
    er:   seedUnit(erBeds,   initialOccupancy, rng),
    icu:  seedUnit(icuBeds,  initialOccupancy, rng),
    ward: seedUnit(wardBeds, initialOccupancy, rng),
  };
}

// ─── Mutation (pure) ──────────────────────────

function withUnit(unit: UnitBeds, delta: number): UnitBeds {
  const occupied = Math.min(unit.total, Math.max(0, unit.occupied + delta));
  return occupied === unit.occupied ? unit : { ...unit, occupied };
}

/** Occupies one bed in a unit if capacity allows. */
export function occupyBed(state: BedState, unit: BedUnit): BedState {
  return { ...state, [unit]: withUnit(state[unit], +1) };
}

/** Frees one bed in a unit. */
export function freeBed(state: BedState, unit: BedUnit): BedState {
  return { ...state, [unit]: withUnit(state[unit], -1) };
}

// ─── Selectors ────────────────────────────────

export function unitLoad(unit: UnitBeds): number {
  return unit.total <= 0 ? 1 : unit.occupied / unit.total;
}

export function available(unit: UnitBeds): number {
  return Math.max(0, unit.total - unit.occupied);
}

/** Overall occupancy across all units, [0..1]. */
export function hospitalLoad(state: BedState): number {
  const total    = state.er.total + state.icu.total + state.ward.total;
  const occupied = state.er.occupied + state.icu.occupied + state.ward.occupied;
  return total <= 0 ? 1 : occupied / total;
}

export type LoadLabel = "Quiet" | "Steady" | "Busy" | "At capacity";

export function loadLabel(load: number): LoadLabel {
  if (load >= 0.9)  return "At capacity";
  if (load >= 0.7)  return "Busy";
  if (load >= 0.45) return "Steady";
  return "Quiet";
}
