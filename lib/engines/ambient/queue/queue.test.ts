import { describe, it, expect } from "vitest";
import {
  createQueue,
  tickQueue,
  sortQueue,
  criticalCount,
  waitingCount,
  activeDepartments,
  WaitingPatient,
} from "./queue";
import { CursorRng } from "../rng";
import { DEFAULT_AMBIENT_CONFIG } from "../config";

const cfg = DEFAULT_AMBIENT_CONFIG;

function mkQueue(seed = 1) {
  return createQueue(cfg, new CursorRng(seed, 0), 0);
}

describe("createQueue", () => {
  it("seeds the configured number of waiting patients", () => {
    const q = mkQueue();
    expect(q.waiting.length).toBe(cfg.queue.initialWaiting);
    expect(q.serial).toBe(cfg.queue.initialWaiting);
  });

  it("is deterministic for the same seed", () => {
    expect(mkQueue(7)).toEqual(mkQueue(7));
  });

  it("differs across seeds", () => {
    const a = mkQueue(1).waiting.map(p => p.name).join();
    const b = mkQueue(999).waiting.map(p => p.name).join();
    expect(a).not.toBe(b);
  });

  it("assigns stable unique ids", () => {
    const ids = mkQueue().waiting.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("sortQueue", () => {
  it("orders sickest first (triage rank, then acuity)", () => {
    const base: WaitingPatient = {
      id: "x", name: "N", age: 40, sex: "male", complaint: "c",
      baseTriage: "green", triage: "green", acuity: 10, arrivedTick: 0, department: "Emergency",
    };
    const patients: WaitingPatient[] = [
      { ...base, id: "a", triage: "green",  acuity: 10 },
      { ...base, id: "b", triage: "red",    acuity: 90 },
      { ...base, id: "c", triage: "yellow", acuity: 40 },
      { ...base, id: "d", triage: "red",    acuity: 95 },
    ];
    expect(sortQueue(patients).map(p => p.id)).toEqual(["d", "b", "c", "a"]);
  });
});

describe("tickQueue · deterioration", () => {
  it("raises acuity while patients wait", () => {
    const q0 = mkQueue(5);
    const rng = new CursorRng(5, 100);
    let q = q0;
    for (let t = 1; t <= 50; t++) q = tickQueue(q, cfg, rng, t);
    const avg0 = q0.waiting.reduce((s, p) => s + p.acuity, 0) / q0.waiting.length;
    const avg1 = q.waiting.reduce((s, p) => s + p.acuity, 0) / q.waiting.length;
    expect(avg1).toBeGreaterThan(avg0);
  });

  it("never exceeds acuity 100", () => {
    const rng = new CursorRng(3, 100);
    let q = mkQueue(3);
    for (let t = 1; t <= 2000; t++) q = tickQueue(q, cfg, rng, t);
    expect(q.waiting.every(p => p.acuity <= 100)).toBe(true);
  });
});

describe("tickQueue · arrivals", () => {
  it("adds a patient when an arrival is due", () => {
    const q0 = mkQueue(2);
    const rng = new CursorRng(2, 100);
    const dueTick = q0.nextArrivalTick;
    let q = q0;
    for (let t = 1; t <= dueTick; t++) q = tickQueue(q, cfg, rng, t);
    expect(q.serial).toBeGreaterThan(q0.serial);
  });

  it("respects the max-waiting cap", () => {
    const rng = new CursorRng(4, 100);
    let q = mkQueue(4);
    for (let t = 1; t <= 5000; t++) q = tickQueue(q, cfg, rng, t);
    expect(q.waiting.length).toBeLessThanOrEqual(cfg.queue.maxWaiting);
  });
});

describe("selectors", () => {
  it("counts critical (red) patients", () => {
    const rng = new CursorRng(8, 100);
    let q = mkQueue(8);
    for (let t = 1; t <= 300; t++) q = tickQueue(q, cfg, rng, t);
    expect(criticalCount(q)).toBe(q.waiting.filter(p => p.triage === "red").length);
  });

  it("reports waiting count and active departments", () => {
    const q = mkQueue();
    expect(waitingCount(q)).toBe(q.waiting.length);
    expect(activeDepartments(q).length).toBeGreaterThan(0);
  });
});
