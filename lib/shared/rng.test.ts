import { describe, it, expect } from "vitest";
import { SeededRNG } from "@/lib/shared/rng";

describe("SeededRNG", () => {
  describe("determinism", () => {
    it("produces the same sequence for the same seed", () => {
      const a = new SeededRNG(42);
      const b = new SeededRNG(42);
      const seqA = [a.nextFloat(), a.nextFloat(), a.nextFloat()];
      const seqB = [b.nextFloat(), b.nextFloat(), b.nextFloat()];
      expect(seqA).toEqual(seqB);
    });

    it("produces different sequences for different seeds", () => {
      const a = new SeededRNG(1);
      const b = new SeededRNG(2);
      expect(a.nextFloat()).not.toBe(b.nextFloat());
    });

    it("treats a zero seed as 1 (avoids the degenerate zero state)", () => {
      const zero = new SeededRNG(0);
      const one  = new SeededRNG(1);
      expect(zero.nextFloat()).toBe(one.nextFloat());
    });

    it("coerces negative seeds to unsigned 32-bit", () => {
      const neg = new SeededRNG(-1);
      const eq  = new SeededRNG(0xffffffff);
      expect(neg.nextFloat()).toBe(eq.nextFloat());
    });
  });

  describe("nextFloat", () => {
    it("always returns a value in [0, 1)", () => {
      const rng = new SeededRNG(7);
      for (let i = 0; i < 1000; i++) {
        const v = rng.nextFloat();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });
  });

  describe("nextInt", () => {
    it("returns integers within [min, max] inclusive", () => {
      const rng = new SeededRNG(99);
      for (let i = 0; i < 1000; i++) {
        const v = rng.nextInt(3, 8);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(3);
        expect(v).toBeLessThanOrEqual(8);
      }
    });

    it("returns the single value when min === max", () => {
      const rng = new SeededRNG(5);
      expect(rng.nextInt(4, 4)).toBe(4);
    });

    it("throws when max < min", () => {
      const rng = new SeededRNG(5);
      expect(() => rng.nextInt(10, 1)).toThrow(/max must be >= min/);
    });
  });

  describe("nextFloatRange", () => {
    it("returns a value within [min, max]", () => {
      const rng = new SeededRNG(11);
      for (let i = 0; i < 500; i++) {
        const v = rng.nextFloatRange(1, 2, 2);
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(2);
      }
    });

    it("rounds to the requested number of decimals", () => {
      const rng = new SeededRNG(11);
      const v = rng.nextFloatRange(0, 10, 1);
      expect(v).toBe(Math.round(v * 10) / 10);
    });

    it("defaults to zero decimals (integer output)", () => {
      const rng = new SeededRNG(11);
      const v = rng.nextFloatRange(0, 100);
      expect(Number.isInteger(v)).toBe(true);
    });
  });

  describe("pick", () => {
    it("returns an element from the array", () => {
      const rng = new SeededRNG(3);
      const arr = ["a", "b", "c"] as const;
      for (let i = 0; i < 100; i++) {
        expect(arr).toContain(rng.pick(arr));
      }
    });

    it("is deterministic for the same seed", () => {
      const arr = [10, 20, 30, 40];
      expect(new SeededRNG(8).pick(arr)).toBe(new SeededRNG(8).pick(arr));
    });

    it("throws on an empty array", () => {
      const rng = new SeededRNG(3);
      expect(() => rng.pick([])).toThrow(/cannot pick from an empty array/);
    });
  });

  describe("chance", () => {
    it("always returns false for probability 0", () => {
      const rng = new SeededRNG(21);
      for (let i = 0; i < 200; i++) expect(rng.chance(0)).toBe(false);
    });

    it("always returns true for probability 1", () => {
      const rng = new SeededRNG(21);
      for (let i = 0; i < 200; i++) expect(rng.chance(1)).toBe(true);
    });

    it("produces roughly the requested proportion of trues", () => {
      const rng = new SeededRNG(123);
      let trues = 0;
      const n = 5000;
      for (let i = 0; i < n; i++) if (rng.chance(0.3)) trues++;
      expect(trues / n).toBeGreaterThan(0.25);
      expect(trues / n).toBeLessThan(0.35);
    });

    it("throws when probability is out of bounds", () => {
      const rng = new SeededRNG(1);
      expect(() => rng.chance(-0.1)).toThrow(/between 0 and 1/);
      expect(() => rng.chance(1.1)).toThrow(/between 0 and 1/);
    });
  });
});
