// ─────────────────────────────────────────────
// KAIROS — Patient Engine Public API
//
// SeededRNG is intentionally not exported.
// It is an internal implementation detail.
// Callers should never construct an RNG directly.
// ─────────────────────────────────────────────

export { generatePatientCase } from "./generate";

export type {
  PatientCase,
  PatientProfile,
  PatientSex,
  ComorbidityProfile,
  GeneratedVital,
  SelectedSymptom,
  HiddenState,
} from "./types";
