// ─────────────────────────────────────────────
// KAIROS — Ambient Engine Public API
//
// The Ambient Engine makes the hospital feel alive
// without becoming the simulation. It runs on its own
// configurable clock, independent of student actions.
//
// Consumers (AmbientContext, Reception dashboard) import
// from here only. Engine internals stay private.
// ─────────────────────────────────────────────

export { createAmbient, advanceAmbient } from "./ambient";

export {
  advanceClock,
  minuteOfDay,
  formatClockLabel,
  shiftProgress,
  shiftPhase,
  milestonesCrossed,
} from "./clock/clock";

export {
  createQueue,
  tickQueue,
  sortQueue,
  criticalCount,
  waitingCount,
  activeDepartments,
} from "./queue/queue";

export {
  createBeds,
  occupyBed,
  freeBed,
  unitLoad,
  available,
  hospitalLoad,
  loadLabel,
} from "./beds/beds";

export { CursorRng } from "./rng";

export {
  DEFAULT_AMBIENT_CONFIG,
} from "./config";

export type {
  AmbientConfig,
  AmbientClockConfig,
  AmbientQueueConfig,
  AmbientBedsConfig,
  AmbientEventsConfig,
  AmbientNurseConfig,
  AmbientMoodConfig,
} from "./config";

export { HospitalMood } from "./types";

export type {
  AmbientState,
  AmbientAction,
  AmbientClock,
  AmbientStatus,
  ShiftPhase,
  ShiftMilestone,
} from "./types";

export type {
  WaitingPatient,
  QueueState,
  AmbientTriage,
} from "./queue/queue";

export type {
  BedState,
  UnitBeds,
  BedUnit,
  LoadLabel,
} from "./beds/beds";
