// ─────────────────────────────────────────────
// KAIROS — Seeded Pseudo-Random Number Generator
//
// Algorithm: mulberry32
// Period:    2^32
// Properties: fast, good statistical distribution,
//             suitable for simulation use.
//
// This class is intentionally mutable internally.
// It is an implementation detail of the Patient
// Engine and is never exported from the public API.
//
// All public Patient Engine outputs are immutable.
// Same seed → same sequence → same PatientCase.
// ─────────────────────────────────────────────

export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    // Coerce to unsigned 32-bit integer. Avoid zero.
    this.state = (seed >>> 0) || 1;
  }

  private advance(): number {
    // mulberry32 — reference implementation
    this.state = (this.state + 0x6D2B79F5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns a float in [0, 1) */
  nextFloat(): number {
    return this.advance();
  }

  /** Returns an integer in [min, max] inclusive */
  nextInt(min: number, max: number): number {
    return Math.floor(this.advance() * (max - min + 1)) + min;
  }

  /**
   * Returns a float between min and max,
   * rounded to the specified decimal places.
   */
  nextFloatRange(min: number, max: number, decimals: number = 0): number {
    const raw    = min + this.advance() * (max - min);
    const factor = Math.pow(10, decimals);
    return Math.round(raw * factor) / factor;
  }

  /** Returns a random element from a non-empty readonly array */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) {
      throw new Error("SeededRNG.pick: cannot pick from an empty array");
    }
    return arr[Math.floor(this.advance() * arr.length)];
  }

  /** Returns true with the given probability [0.0, 1.0] */
  chance(probability: number): boolean {
    return this.advance() < probability;
  }
}
