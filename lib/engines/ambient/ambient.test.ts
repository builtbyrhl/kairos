import { describe, it, expect } from "vitest";
import { createAmbient, advanceAmbient } from "./ambient";
import { DEFAULT_AMBIENT_CONFIG } from "./config";
import { HospitalMood } from "./types";

describe("createAmbient", () => {
  it("starts at shift start, running, quiet", () => {
    const s = createAmbient();
    expect(s.clock).toEqual({ tick: 0, elapsedWorldMinutes: 0 });
    expect(s.status).toBe("running");
    expect(s.mood).toBe(HospitalMood.Quiet);
    // Queue + beds seeding consumes the RNG stream at creation.
    expect(s.rngCursor).toBeGreaterThan(0);
    expect(s.queue.waiting.length).toBe(DEFAULT_AMBIENT_CONFIG.queue.initialWaiting);
    expect(s.config).toBe(DEFAULT_AMBIENT_CONFIG);
  });

  it("coerces a zero seed to a safe non-zero value", () => {
    expect(createAmbient(DEFAULT_AMBIENT_CONFIG, 0).seed).toBe(1);
  });

  it("is deterministic for the same seed", () => {
    expect(createAmbient(DEFAULT_AMBIENT_CONFIG, 42))
      .toEqual(createAmbient(DEFAULT_AMBIENT_CONFIG, 42));
  });
});

describe("advanceAmbient · TICK", () => {
  it("advances the clock by config while running", () => {
    const s0 = createAmbient();
    const s1 = advanceAmbient(s0, { type: "TICK" });
    expect(s1.clock.tick).toBe(1);
    expect(s1.clock.elapsedWorldMinutes).toBe(DEFAULT_AMBIENT_CONFIG.clock.worldMinutesPerTick);
  });

  it("supports multi-tick deltas", () => {
    const s = advanceAmbient(createAmbient(), { type: "TICK", deltaTicks: 5 });
    expect(s.clock.tick).toBe(5);
  });

  it("does not tick while paused", () => {
    const paused = advanceAmbient(createAmbient(), { type: "PAUSE" });
    const same   = advanceAmbient(paused, { type: "TICK" });
    expect(same.clock.tick).toBe(0);
    expect(same).toBe(paused);
  });

  it("is a deterministic function of tick count", () => {
    let a = createAmbient(DEFAULT_AMBIENT_CONFIG, 7);
    let b = createAmbient(DEFAULT_AMBIENT_CONFIG, 7);
    for (let i = 0; i < 10; i++) a = advanceAmbient(a, { type: "TICK" });
    b = advanceAmbient(b, { type: "TICK", deltaTicks: 10 });
    expect(a.clock).toEqual(b.clock);
  });
});

describe("advanceAmbient · control actions", () => {
  it("pauses and resumes", () => {
    const s = createAmbient();
    expect(advanceAmbient(s, { type: "PAUSE" }).status).toBe("paused");
    const paused = advanceAmbient(s, { type: "PAUSE" });
    expect(advanceAmbient(paused, { type: "RESUME" }).status).toBe("running");
  });

  it("sets mood", () => {
    const s = advanceAmbient(createAmbient(), { type: "SET_MOOD", mood: HospitalMood.Busy });
    expect(s.mood).toBe(HospitalMood.Busy);
  });

  it("reconfigures without losing clock position", () => {
    const ticked = advanceAmbient(createAmbient(), { type: "TICK", deltaTicks: 3 });
    const faster = {
      ...DEFAULT_AMBIENT_CONFIG,
      clock: { ...DEFAULT_AMBIENT_CONFIG.clock, worldMinutesPerTick: 10 },
    };
    const reconfigured = advanceAmbient(ticked, { type: "RECONFIGURE", config: faster });
    expect(reconfigured.clock.tick).toBe(3);
    expect(reconfigured.config.clock.worldMinutesPerTick).toBe(10);
  });

  it("resets to shift start", () => {
    const ticked = advanceAmbient(createAmbient(), { type: "TICK", deltaTicks: 9 });
    const reset  = advanceAmbient(ticked, { type: "RESET" });
    expect(reset.clock).toEqual({ tick: 0, elapsedWorldMinutes: 0 });
  });

  it("does not mutate the input state on tick", () => {
    const s0 = createAmbient();
    advanceAmbient(s0, { type: "TICK" });
    expect(s0.clock.tick).toBe(0);
  });
});
