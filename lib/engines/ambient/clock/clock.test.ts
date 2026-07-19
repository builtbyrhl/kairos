import { describe, it, expect } from "vitest";
import {
  advanceClock,
  minuteOfDay,
  formatClockLabel,
  shiftProgress,
  shiftPhase,
  milestonesCrossed,
} from "./clock";
import { AmbientClockConfig } from "../config";
import { AmbientClock } from "../types";

const config: AmbientClockConfig = {
  tickIntervalMs:        1000,
  worldMinutesPerTick:   4,
  shiftStartMinuteOfDay: 7 * 60 + 42, // 07:42
  shiftDurationMinutes:  8 * 60,       // 480
};

const zero: AmbientClock = { tick: 0, elapsedWorldMinutes: 0 };

describe("advanceClock", () => {
  it("advances tick and world minutes by config", () => {
    const next = advanceClock(zero, config, 3);
    expect(next.tick).toBe(3);
    expect(next.elapsedWorldMinutes).toBe(12); // 3 * 4
  });

  it("is a no-op for non-positive deltas", () => {
    expect(advanceClock(zero, config, 0)).toBe(zero);
    expect(advanceClock(zero, config, -5)).toBe(zero);
  });

  it("does not mutate the input", () => {
    advanceClock(zero, config, 10);
    expect(zero.tick).toBe(0);
    expect(zero.elapsedWorldMinutes).toBe(0);
  });
});

describe("minuteOfDay", () => {
  it("adds elapsed minutes to shift start", () => {
    const c = advanceClock(zero, config, 3); // +12 min → 07:54
    expect(minuteOfDay(c, config)).toBe(7 * 60 + 54);
  });

  it("wraps past midnight", () => {
    const c: AmbientClock = { tick: 0, elapsedWorldMinutes: 20 * 60 }; // 07:42 + 20h
    // 462 + 1200 = 1662 → 1662 - 1440 = 222 = 03:42
    expect(minuteOfDay(c, config)).toBe(222);
  });
});

describe("formatClockLabel", () => {
  it("formats morning time", () => {
    expect(formatClockLabel(7 * 60 + 42)).toBe("07:42 AM");
  });
  it("formats noon and midnight", () => {
    expect(formatClockLabel(12 * 60)).toBe("12:00 PM");
    expect(formatClockLabel(0)).toBe("12:00 AM");
  });
  it("formats afternoon", () => {
    expect(formatClockLabel(15 * 60 + 5)).toBe("03:05 PM");
  });
});

describe("shiftProgress", () => {
  it("is 0 at start and 0.5 at half shift", () => {
    expect(shiftProgress(zero, config)).toBe(0);
    const half: AmbientClock = { tick: 0, elapsedWorldMinutes: 240 };
    expect(shiftProgress(half, config)).toBe(0.5);
  });
  it("clamps to 1 past the shift end", () => {
    const over: AmbientClock = { tick: 0, elapsedWorldMinutes: 1000 };
    expect(shiftProgress(over, config)).toBe(1);
  });
});

describe("shiftPhase", () => {
  it("returns derived label, progress, and minuteOfDay", () => {
    const p = shiftPhase(zero, config);
    expect(p.label).toBe("07:42 AM");
    expect(p.progress).toBe(0);
    expect(p.minuteOfDay).toBe(7 * 60 + 42);
  });
});

describe("milestonesCrossed", () => {
  it("detects the quarter-shift boundary", () => {
    // quarter = 120 min. Cross from 118 → 122.
    expect(milestonesCrossed(118, 122, config)).toEqual(["quarter_shift"]);
  });
  it("detects multiple milestones in one jump", () => {
    // 0 → 480 crosses all four.
    expect(milestonesCrossed(0, 480, config)).toEqual([
      "quarter_shift",
      "half_shift",
      "three_quarter_shift",
      "handover",
    ]);
  });
  it("returns nothing when no boundary is crossed", () => {
    expect(milestonesCrossed(10, 20, config)).toEqual([]);
  });
});
