// ─────────────────────────────────────────────
// KAIROS — Medicine Engine (RESERVED)
//
// Status: intentionally reserved. Not yet implemented.
// Do not delete — kept as a stable architectural seam.
//
// Note: ./types.ts is already populated and IS used by
// the Treatment Engine (it imports the Medicine type).
// This index is the reserved home for medicine-level
// behaviour that is not yet built.
//
// Intended responsibility:
//   Medicine-centric logic that is independent of a
//   specific treatment decision — e.g. dose-range and
//   route validation, interaction checks, and formulary
//   lookups — so the Treatment Engine can delegate rather
//   than re-implement drug rules per disease.
//
// Contract (to be defined when implemented):
//   validateDose(medicine, dose, route) -> DoseCheck
//
// Until then, import medicine data via
//   "@/lib/data/medicines/registry" and types via
//   "@/lib/engines/medicine/types".
// ─────────────────────────────────────────────

export {};
