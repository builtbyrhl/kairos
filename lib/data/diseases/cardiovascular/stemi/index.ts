// ─────────────────────────────────────────────
// KAIROS — STEMI Disease Assembly
//
// This is the only file that satisfies the
// complete Disease interface. TypeScript
// enforces completeness here at compile time.
//
// Individual modules contain medical data.
// This file contains no medical data.
// Its only responsibility is assembly.
//
// Architecture note:
// metadata is spread rather than assigned
// field-by-field so that future additions
// to BaseEntity (e.g. evidenceBundleId)
// propagate automatically without requiring
// changes to this file.
// ─────────────────────────────────────────────

import { Disease } from "../../../../engines/disease/types";

import { metadata }                  from "./metadata";
import { symptoms }                  from "./symptoms";
import { vitalSigns }                from "./vitals";
import { investigations }            from "./investigations";
import { treatments }                from "./treatments";
import { complications }             from "./complications";
import { outcome }                   from "./outcomes";
import { reflectionHooks, scoring }  from "./reflection";
import { references }                from "./evidence";

export const stemi: Disease = {
  ...metadata,
  references,
  symptoms,
  vitalSigns,
  investigations,
  treatments,
  complications,
  outcome,
  reflectionHooks,
  scoring,
};
