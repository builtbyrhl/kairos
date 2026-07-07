// ─────────────────────────────────────────────
// KAIROS — Medicine Registry
//
// Single authoritative source of all registered
// medicines. Follows the same pattern as
// DiseaseRegistry in lib/data/diseases/index.ts.
//
// Engines never import individual medicine files
// directly. All medicine access goes through this
// registry.
//
// To add a medicine:
//   1. Create lib/data/medicines/<name>.ts
//   2. Export from lib/data/medicines/index.ts
//   3. Add to the medicines array below.
//   Three steps. Nothing else changes.
// ─────────────────────────────────────────────

import { Medicine } from "../../engines/medicine/types";

import {
  aspirin,
  clopidogrel,
  heparin,
  morphine,
  oxygen,
} from "./index";

const medicines: readonly Medicine[] = [
  aspirin,
  clopidogrel,
  heparin,
  morphine,
  oxygen,
];

const byId = new Map<string, Medicine>(
  medicines.map(m => [m.id, m])
);

export const MedicineRegistry = {

  getAll(): readonly Medicine[] {
    return medicines;
  },

  /** O(1) lookup by medicine ID. Returns undefined if not registered. */
  getById(id: string): Medicine | undefined {
    return byId.get(id);
  },

  has(id: string): boolean {
    return byId.has(id);
  },

  /** All registered medicine IDs. Used by validators. */
  getIds(): ReadonlySet<string> {
    return new Set(byId.keys());
  },

} as const;
