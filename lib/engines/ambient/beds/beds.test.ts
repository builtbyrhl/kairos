import { describe, it, expect } from "vitest";
import {
  createBeds,
  occupyBed,
  freeBed,
  unitLoad,
  available,
  hospitalLoad,
  loadLabel,
} from "./beds";
import { CursorRng } from "../rng";
import { DEFAULT_AMBIENT_CONFIG } from "../config";

const cfg = DEFAULT_AMBIENT_CONFIG;

function mkBeds(seed = 1) {
  return createBeds(cfg, new CursorRng(seed, 0));
}

describe("createBeds", () => {
  it("uses configured capacities", () => {
    const b = mkBeds();
    expect(b.er.total).toBe(cfg.beds.erBeds);
    expect(b.icu.total).toBe(cfg.beds.icuBeds);
    expect(b.ward.total).toBe(cfg.beds.wardBeds);
  });

  it("never over-occupies a unit", () => {
    const b = mkBeds(42);
    expect(b.er.occupied).toBeLessThanOrEqual(b.er.total);
    expect(b.icu.occupied).toBeLessThanOrEqual(b.icu.total);
    expect(b.ward.occupied).toBeLessThanOrEqual(b.ward.total);
  });

  it("is deterministic for the same seed", () => {
    expect(mkBeds(7)).toEqual(mkBeds(7));
  });
});

describe("occupy / free", () => {
  it("occupies a bed up to capacity", () => {
    let b = createBeds(cfg, new CursorRng(1, 0));
    const before = b.icu.occupied;
    b = occupyBed(b, "icu");
    expect(b.icu.occupied).toBe(Math.min(b.icu.total, before + 1));
  });

  it("does not exceed capacity", () => {
    let b = mkBeds();
    for (let i = 0; i < 100; i++) b = occupyBed(b, "er");
    expect(b.er.occupied).toBe(b.er.total);
  });

  it("frees a bed and never goes negative", () => {
    let b = mkBeds();
    for (let i = 0; i < 100; i++) b = freeBed(b, "ward");
    expect(b.ward.occupied).toBe(0);
  });

  it("does not mutate the input", () => {
    const b = mkBeds();
    const before = b.er.occupied;
    occupyBed(b, "er");
    expect(b.er.occupied).toBe(before);
  });
});

describe("selectors", () => {
  it("computes unit load and availability", () => {
    const b = mkBeds();
    expect(unitLoad(b.er)).toBeCloseTo(b.er.occupied / b.er.total);
    expect(available(b.er)).toBe(b.er.total - b.er.occupied);
  });

  it("computes overall hospital load in [0,1]", () => {
    const load = hospitalLoad(mkBeds());
    expect(load).toBeGreaterThanOrEqual(0);
    expect(load).toBeLessThanOrEqual(1);
  });

  it("labels load bands", () => {
    expect(loadLabel(0.2)).toBe("Quiet");
    expect(loadLabel(0.5)).toBe("Steady");
    expect(loadLabel(0.75)).toBe("Busy");
    expect(loadLabel(0.95)).toBe("At capacity");
  });
});
