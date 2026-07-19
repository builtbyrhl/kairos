// ─────────────────────────────────────────────
// KAIROS — Ambient Engine · Clock
//
// Pure clock mathematics for the ambient world time.
// No React, no interval, no side effects.
//
// The ambient clock is distinct from the per-encounter
// Hospital Engine clock. It advances by config, not by
// student actions.
// ─────────────────────────────────────────────

import { AmbientClockConfig } from "../config";
import { AmbientClock, ShiftPhase, ShiftMilestone } from "../types";

const MINUTES_PER_DAY = 24 * 60;

// ─── Tick advancement ─────────────────────────

/**
 * Advances the clock by `deltaTicks`, converting ticks to
 * world minutes via config. Pure — returns a new AmbientClock.
 */
export function advanceClock(
  clock:      AmbientClock,
  config:     AmbientClockConfig,
  deltaTicks: number
): AmbientClock {
  if (deltaTicks <= 0) return clock;
  return {
    tick:                clock.tick + deltaTicks,
    elapsedWorldMinutes:
      clock.elapsedWorldMinutes + deltaTicks * config.worldMinutesPerTick,
  };
}

// ─── Formatting ───────────────────────────────

/** Wraps a minute-of-day into [0, 1439]. */
export function minuteOfDay(
  clock:  AmbientClock,
  config: AmbientClockConfig
): number {
  const raw = config.shiftStartMinuteOfDay + clock.elapsedWorldMinutes;
  return ((raw % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** Formats a minute-of-day as a 12-hour clock label, e.g. "07:42 AM". */
export function formatClockLabel(minutes: number): string {
  const total   = ((Math.floor(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours24 = Math.floor(total / 60);
  const mins    = total % 60;
  const period  = hours24 < 12 ? "AM" : "PM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const hh      = String(hours12).padStart(2, "0");
  const mm      = String(mins).padStart(2, "0");
  return `${hh}:${mm} ${period}`;
}

// ─── Shift phase ──────────────────────────────

/** Fraction of the shift completed, clamped to [0, 1]. */
export function shiftProgress(
  clock:  AmbientClock,
  config: AmbientClockConfig
): number {
  if (config.shiftDurationMinutes <= 0) return 1;
  const raw = clock.elapsedWorldMinutes / config.shiftDurationMinutes;
  return Math.max(0, Math.min(1, raw));
}

/** Full derived shift-phase view for the UI. */
export function shiftPhase(
  clock:  AmbientClock,
  config: AmbientClockConfig
): ShiftPhase {
  const mod = minuteOfDay(clock, config);
  return {
    progress:    shiftProgress(clock, config),
    minuteOfDay: mod,
    label:       formatClockLabel(mod),
  };
}

// ─── Milestone detection ──────────────────────

const MILESTONE_FRACTIONS: ReadonlyArray<{ at: number; milestone: ShiftMilestone }> = [
  { at: 0.25, milestone: "quarter_shift" },
  { at: 0.50, milestone: "half_shift" },
  { at: 0.75, milestone: "three_quarter_shift" },
  { at: 1.00, milestone: "handover" },
];

/**
 * Returns the shift milestones crossed when advancing from
 * `prevMinutes` to `nextMinutes`. Used by later phases to fire
 * shift announcements. Pure and inclusive of the upper bound.
 */
export function milestonesCrossed(
  prevMinutes: number,
  nextMinutes: number,
  config:      AmbientClockConfig
): readonly ShiftMilestone[] {
  if (config.shiftDurationMinutes <= 0) return [];
  const prevFrac = prevMinutes / config.shiftDurationMinutes;
  const nextFrac = nextMinutes / config.shiftDurationMinutes;
  const crossed: ShiftMilestone[] = [];
  for (const { at, milestone } of MILESTONE_FRACTIONS) {
    if (prevFrac < at && nextFrac >= at) crossed.push(milestone);
  }
  return crossed;
}
