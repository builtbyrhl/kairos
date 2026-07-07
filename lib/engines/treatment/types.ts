// ─────────────────────────────────────────────
// KAIROS — Treatment Engine Types
//
// Ownership: Treatment Engine exclusively.
//
// Treatment Engine evaluates whether a medicine
// administered by the student was correct, safe,
// and appropriately dosed for this patient.
//
// It consumes:
//   MedicineRegistry  — medicine definitions
//   PatientCase       — hidden comorbidities + vitals
//   Disease           — treatments.correct/incorrect
//   TreatmentRecord   — what the student administered
//
// It never imports from:
//   Encounter Engine  — student-facing layer
//   Scoring Engine    — future, sits above this engine
//   Investigation Engine — unrelated domain
//   Simulation Controller — caller, not a dependency
//
// educationalNotes are stored in TreatmentEvaluation
// but must only be surfaced post-case by the
// Simulation Controller, via the Reflection Engine.
//
// v1 limitations (documented, not hidden):
//   1. TreatmentReference.condition not evaluated.
//      Requires Time Engine + condition evaluator.
//   2. IncorrectChoice matching by medicine ID absent.
//      Requires Disease Engine schema update:
//      IncorrectChoice.medicineIds?: string[]
//   3. Timing scoring deferred. Time Engine needed.
//   4. Drug interactions not checked (future phase).
//   5. Paediatric/elderly dose rules not applied.
//      v1 evaluates adult rules only.
// ─────────────────────────────────────────────

import { PatientCase }    from "../patient";
import { Disease }        from "../disease/types";
import { TreatmentRecord } from "../hospital";

// ─── Correctness Scale ────────────────────────
// Ordered from best to worst for Scoring Engine.
//
// correct        — right medicine, dose and route acceptable
// acceptable     — right medicine, minor dose or route concern
// unnecessary    — not on incorrect list but not indicated
// incorrect      — explicitly wrong per Disease Engine protocol
// contraindicated — wrong for this specific patient

export type TreatmentCorrectness =
  | "correct"
  | "acceptable"
  | "unnecessary"
  | "incorrect"
  | "contraindicated";

// ─── Issue Kinds ──────────────────────────────

export type TreatmentIssueKind =
  | "dose"
  | "route"
  | "contraindication"
  | "duplication"
  | "timing";

// ─── Treatment Issue ──────────────────────────
// A single identified problem with a treatment decision.
// Multiple issues may exist for one TreatmentRecord.
// Scoring Engine weights issue kinds differently.

export interface TreatmentIssue {
  readonly kind:    TreatmentIssueKind;
  readonly message: string;
}

// ─── Treatment Context ────────────────────────
// Everything required to evaluate one treatment record.
// allRecords enables duplication detection across the session.

export interface TreatmentContext {
  readonly patientCase:     PatientCase;
  readonly disease:         Disease;
  readonly clinicalMinutes: number;
  readonly allRecords:      readonly TreatmentRecord[];
}

// ─── Treatment Evaluation ─────────────────────
// The complete result of evaluating one TreatmentRecord.
//
// educationalNotes: combined from Disease Engine's
// TreatmentReference.educationalNotes and Medicine
// Engine's Medicine.educationalNotes. Must NOT be
// shown to the student during an active encounter.
// Released post-case via Reflection Engine only.

export interface TreatmentEvaluation {
  readonly medicineId:       string;
  readonly medicineName:     string;
  readonly correctness:      TreatmentCorrectness;
  readonly issues:           readonly TreatmentIssue[];
  readonly educationalNotes: readonly string[];
}

// ─── Treatment Errors ─────────────────────────
// All variants are genuine runtime conditions.
//
// MEDICINE_NOT_FOUND:    medicineId not in MedicineRegistry.
//                        Indicates unregistered medicine used.
// RECORD_NOT_IN_CONTEXT: medicineId not found in context.allRecords.
//                        Should not occur if caller is correct.

export type TreatmentError =
  | {
      readonly kind:      "MEDICINE_NOT_FOUND";
      readonly medicineId: string;
      readonly message:    string;
    }
  | {
      readonly kind:       "RECORD_NOT_IN_CONTEXT";
      readonly medicineId: string;
      readonly message:    string;
    };

// ─── Treatment Result ─────────────────────────
// Discriminated union returned by evaluateTreatment.
// Callers must handle both branches.

export type TreatmentResult =
  | { readonly ok: true;  readonly evaluation: TreatmentEvaluation }
  | { readonly ok: false; readonly error:      TreatmentError       };
