// ─────────────────────────────────────────────
// KAIROS — Ambient Engine · Core Reducer
//
// Public API:
//   createAmbient(config?, seed?)        → AmbientState
//   advanceAmbient(state, action)        → AmbientState
//
// advanceAmbient is a pure reducer over AmbientAction.
// The only impure driver (a setInterval) lives in
// AmbientContext and simply dispatches TICK actions.
//
// Same seed + config + action sequence → identical state.
//
// Phase 0 handles clock advancement, pause/resume, mood,
// reconfigure, and reset. Later phases extend the TICK
// branch with queue/beds/event/nurse passes — without
// changing this file's public shape.
// ─────────────────────────────────────────────

import { AmbientConfig, DEFAULT_AMBIENT_CONFIG } from "./config";
import {
  AmbientState,
  AmbientAction,
  HospitalMood,
} from "./types";
import { advanceClock } from "./clock/clock";
import { CursorRng } from "./rng";
import { createQueue, tickQueue } from "./queue/queue";
import { createBeds } from "./beds/beds";

/** Mood-driven arrival-rate multiplier, read from config. */
function moodArrivalMultiplier(config: AmbientConfig, mood: HospitalMood): number {
  return config.mood.arrivalMultiplier[mood] ?? 1;
}

// ─── Construction ─────────────────────────────

/**
 * Creates a fresh ambient world at shift start.
 * Deterministic: identical (config, seed) → identical state.
 */
export function createAmbient(
  config: AmbientConfig = DEFAULT_AMBIENT_CONFIG,
  seed:   number = 1
): AmbientState {
  const safeSeed = seed >>> 0 || 1;
  const rng   = new CursorRng(safeSeed, 0);
  const queue = createQueue(config, rng, 0);
  const beds  = createBeds(config, rng);
  return {
    config,
    seed:      safeSeed,
    rngCursor: rng.cursor,
    status:    "running",
    clock:     { tick: 0, elapsedWorldMinutes: 0 },
    mood:      HospitalMood.Quiet,
    queue,
    beds,
  };
}

// ─── Exhaustiveness guard ─────────────────────

function assertNever(value: never): never {
  throw new Error(`Unhandled AmbientAction: ${JSON.stringify(value)}`);
}

// ─── Reducer ──────────────────────────────────

export function advanceAmbient(
  state:  AmbientState,
  action: AmbientAction
): AmbientState {
  switch (action.type) {
    case "TICK": {
      if (state.status !== "running") return state;
      const delta = action.deltaTicks ?? 1;
      if (delta <= 0) return state;

      const arrivalMult = moodArrivalMultiplier(state.config, state.mood);
      const rng   = new CursorRng(state.seed, state.rngCursor);

      // Advance one tick at a time so arrivals/deterioration stay
      // deterministic regardless of how many ticks are batched.
      let clock = state.clock;
      let queue = state.queue;
      for (let i = 0; i < delta; i++) {
        clock = advanceClock(clock, state.config.clock, 1);
        queue = tickQueue(queue, state.config, rng, clock.tick, arrivalMult);
      }

      return {
        ...state,
        clock,
        queue,
        rngCursor: rng.cursor,
      };
    }

    case "PAUSE":
      return state.status === "paused" ? state : { ...state, status: "paused" };

    case "RESUME":
      return state.status === "running" ? state : { ...state, status: "running" };

    case "SET_MOOD":
      return state.mood === action.mood ? state : { ...state, mood: action.mood };

    case "RECONFIGURE":
      return { ...state, config: action.config };

    case "RESET":
      return createAmbient(state.config, action.seed ?? state.seed);

    default:
      return assertNever(action);
  }
}
