// ─────────────────────────────────────────────
// KAIROS — Ambient Engine · Cursor RNG
//
// Wraps the shared SeededRNG so the Ambient Engine can
// stay a PURE reducer while still using randomness.
//
// Problem: SeededRNG is mutable and does not expose its
// internal state, so it can't be stored in immutable
// AmbientState directly.
//
// Solution: store only (seed, cursor) in AmbientState.
// Each tick we reconstruct the generator from `seed`,
// fast-forward by `cursor` draws, take the draws we need,
// then persist the new cursor. Every public SeededRNG
// method consumes exactly one advance(), so counting
// method calls faithfully tracks the stream position.
//
// Result: same (seed, cursor) → identical draws. Fully
// deterministic and unit-testable.
// ─────────────────────────────────────────────

import { SeededRNG } from "../../shared/rng";

export class CursorRng {
  private readonly rng: SeededRNG;
  private _cursor: number;

  constructor(seed: number, cursor: number) {
    this.rng = new SeededRNG(seed);
    // Fast-forward to the stored stream position.
    for (let i = 0; i < cursor; i++) this.rng.nextFloat();
    this._cursor = cursor;
  }

  /** Current stream position — persist this back into AmbientState. */
  get cursor(): number {
    return this._cursor;
  }

  nextInt(min: number, max: number): number {
    this._cursor++;
    return this.rng.nextInt(min, max);
  }

  nextFloat(): number {
    this._cursor++;
    return this.rng.nextFloat();
  }

  nextFloatRange(min: number, max: number, decimals: number = 0): number {
    this._cursor++;
    return this.rng.nextFloatRange(min, max, decimals);
  }

  pick<T>(arr: readonly T[]): T {
    this._cursor++;
    return this.rng.pick(arr);
  }

  chance(probability: number): boolean {
    this._cursor++;
    return this.rng.chance(probability);
  }
}
