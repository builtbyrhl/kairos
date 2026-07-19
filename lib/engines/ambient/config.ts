// ─────────────────────────────────────────────
// KAIROS — Ambient Engine Configuration
//
// SINGLE SOURCE OF BALANCE for the Ambient Engine.
//
// Every tunable that controls how "alive" the hospital
// feels lives here. Engine logic must read these values
// and never hardcode timing, rates, or frequencies.
//
// Rebalancing the simulation = editing this file only.
// No engine code changes required.
//
// Phases 1–5 read additional groups below (queue, events,
// mood). They are defined now so the config contract is
// stable, even though some are not consumed until later
// milestones. Unused-for-now fields are marked (Phase N).
// ─────────────────────────────────────────────

// ─── Clock ────────────────────────────────────

export interface AmbientClockConfig {
  /** Real milliseconds between ambient ticks (drives the provider interval). */
  readonly tickIntervalMs: number;
  /** World minutes advanced per tick. */
  readonly worldMinutesPerTick: number;
  /** Minute-of-day the shift begins (e.g. 7*60+42 = 07:42). */
  readonly shiftStartMinuteOfDay: number;
  /** Total length of a shift, in world minutes. */
  readonly shiftDurationMinutes: number;
}

// ─── Queue (Phase 1) ──────────────────────────

export interface AmbientQueueConfig {
  /** Number of patients already waiting when the shift starts. */
  readonly initialWaiting: number;
  /** Average ticks between new patient arrivals. (Phase 1) */
  readonly patientArrivalRateTicks: number;
  /** Acuity increase applied to a waiting patient per tick. (Phase 1) */
  readonly deteriorationRatePerTick: number;
  /** Maximum patients the waiting queue will hold. (Phase 1) */
  readonly maxWaiting: number;
}

// ─── Beds (Phase 1) ───────────────────────────

export interface AmbientBedsConfig {
  readonly erBeds: number;
  readonly icuBeds: number;
  readonly wardBeds: number;
  /** Bed occupancy [0..1] at shift start. (Phase 1) */
  readonly initialOccupancy: number;
}

// ─── Events (Phase 3) ─────────────────────────

export interface AmbientEventsConfig {
  /** Average ticks between ambient (non-arrival) events. (Phase 3) */
  readonly eventFrequencyTicks: number;
  /** Cap on the retained event log (ring buffer). */
  readonly maxEventLog: number;
}

// ─── Nurse / notifications (Phase 4) ──────────

export interface AmbientNurseConfig {
  /** Cap on retained nurse notifications (ring buffer). */
  readonly maxNotifications: number;
}

// ─── Mood (Phase 5) ───────────────────────────

export interface AmbientMoodConfig {
  /** Multiplier applied to arrival rate per mood. (Phase 5) */
  readonly arrivalMultiplier: Readonly<Record<string, number>>;
  /** Multiplier applied to event frequency per mood. (Phase 5) */
  readonly eventMultiplier: Readonly<Record<string, number>>;
}

// ─── Root Config ──────────────────────────────

export interface AmbientConfig {
  readonly clock: AmbientClockConfig;
  readonly queue: AmbientQueueConfig;
  readonly beds:  AmbientBedsConfig;
  readonly events: AmbientEventsConfig;
  readonly nurse: AmbientNurseConfig;
  readonly mood:  AmbientMoodConfig;
}

// ─── Default Balance ──────────────────────────
// Tuned for a calm, premium "morning shift" feel:
// world time moves ~4× real time; a full shift is 8h.

export const DEFAULT_AMBIENT_CONFIG: AmbientConfig = {
  clock: {
    tickIntervalMs:        1000,        // 1 tick / real second
    worldMinutesPerTick:   4,           // → ~4 world minutes / real second
    shiftStartMinuteOfDay: 7 * 60 + 42, // 07:42
    shiftDurationMinutes:  8 * 60,       // 8-hour shift
  },
  queue: {
    initialWaiting:           12,
    patientArrivalRateTicks:  45,
    deteriorationRatePerTick: 0.4,
    maxWaiting:               24,
  },
  beds: {
    erBeds:           12,
    icuBeds:          6,
    wardBeds:         20,
    initialOccupancy: 0.55,
  },
  events: {
    eventFrequencyTicks: 60,
    maxEventLog:         50,
  },
  nurse: {
    maxNotifications: 12,
  },
  mood: {
    arrivalMultiplier: {
      quiet:        0.5,
      busy:         1.0,
      overwhelmed:  1.8,
      night_shift:  0.4,
      mass_casualty: 3.0,
    },
    eventMultiplier: {
      quiet:        0.5,
      busy:         1.0,
      overwhelmed:  1.6,
      night_shift:  0.6,
      mass_casualty: 2.5,
    },
  },
};
