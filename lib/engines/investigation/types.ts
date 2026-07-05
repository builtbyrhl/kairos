// ─────────────────────────────────────────────
// KAIROS — Investigation Engine Types
//
// Ownership: Investigation Engine exclusively.
//
// Investigation Engine resolves InvestigationOrders
// from HospitalState into student-facing reports.
//
// It consumes:
//   • Disease Registry  — investigation definitions
//   • PatientCase       — HiddenState (severity, location)
//   • HospitalState     — clinical time and order records
//
// It never imports from:
//   • Encounter Engine  — student-facing sanitisation layer
//   • Scoring Engine    — future downward dependency
//   • Treatment Engine  — unrelated domain
//   • Time Engine       — receives time as a value, not a service
//
// HiddenState access is intentional.
// Investigation Engine operates as part of the case
// runtime, not the student UI surface. Medical accuracy
// requires the actual disease severity and infarct location.
//
// educationalNotes are stored in InvestigationReport
// but must only be surfaced post-case by the Simulation
// Controller. Investigation Engine stores; gating is not
// its responsibility.
// ─────────────────────────────────────────────

import { Severity, InvestigationType, ClinicalImportance } from "../../types/enums";
import { PatientCase }  from "../patient";
import { HospitalState } from "../hospital";
import { Disease }       from "../disease/types";

// ─── Resolution Context ───────────────────────
// Everything required to resolve one investigation.
// Passed as a single parameter to keep function
// signatures stable as engines evolve.
//
// PatientCase.hidden is accessed here intentionally.
// See file header.

export interface InvestigationContext {
  readonly patientCase:     PatientCase;
  readonly clinicalMinutes: number;       // HospitalState.timeState.elapsedClinicalMinutes
  readonly disease:         Disease;
}

// ─── Generated Finding ────────────────────────
// A resolved quantitative finding with an actual
// sampled value within the medically defined range.
//
// referenceMin and referenceMax come from the
// Disease Engine's "normal" result tier and give
// the student context for interpreting the value.

export interface GeneratedFinding {
  readonly parameter:      string;
  readonly value:          number;
  readonly unit:           string;
  readonly interpretation: string;    // Interpretation enum value
  readonly isAbnormal:     boolean;
  readonly referenceMin:   number;
  readonly referenceMax:   number;
}

// ─── Generated Qualitative Finding ───────────
// For findings where range: {min:0,max:0} or
// {min:1,max:1} — presence/absence semantics.
// No numeric sampling occurs.
// Hospital Engine renders these differently
// from quantitative findings.

export interface GeneratedQualitativeFinding {
  readonly parameter:      string;
  readonly interpretation: string;    // Interpretation enum value
  readonly unit:           "none";
}

// ─── Generated ECG Finding ────────────────────
// A single ECG finding that passed both severity
// and location filters and was included based on
// its probability. Hospital Engine renders these
// as part of an ECG viewer in future versions.

export interface GeneratedECGFinding {
  readonly leads:              readonly string[];
  readonly finding:            string;
  readonly interpretation:     string;   // Interpretation enum value
  readonly clinicalImportance: string;   // ClinicalImportance enum value
}

// ─── Resolved Finding Union ───────────────────
// Discriminated union used in InvestigationReport.
// Hospital Engine inspects the kind field to
// decide rendering strategy.

export type ResolvedFinding =
  | ({ readonly kind: "quantitative" } & GeneratedFinding)
  | ({ readonly kind: "qualitative"  } & GeneratedQualitativeFinding);

// ─── Serial Testing Advisory ──────────────────
// Informs the student that serial testing is
// required and why. Derived from SerialTestingRule.
// Does not include internal hoursAfterFirst values —
// those are implementation details for the Time Engine.

export interface SerialTestingAdvisory {
  readonly required: boolean;
  readonly reasons:  readonly string[];    // extracted from repeatAt[].reason
}

// ─── Investigation Report ─────────────────────
// The complete student-facing investigation result.
// This is the public output of resolveInvestigation.
//
// educationalNotes: store here, gate in Simulation
// Controller — only surface to student post-case.
//
// falsePositives: stored for Reflection Engine.
// Never shown during active case. The student must
// reason from findings, not be warned of alternatives.
//
// resolvedSeverityTier: intentionally included.
// The Scoring Engine reads this from Hospital Engine
// event payload (not directly from this report) to
// evaluate whether the student correctly interpreted
// the results. It is never shown to the student.
// The Simulation Controller strips it before display.

export interface InvestigationReport {
  readonly investigationId:        string;
  readonly name:                   string;
  readonly type:                   InvestigationType;
  readonly resolvedAt:             number;    // clinical minutes
  readonly timestamp:              string;    // ISO 8601
  readonly resolvedSeverityTier:   Severity | "normal";
  readonly findings:               readonly ResolvedFinding[];
  readonly ecgFindings:            readonly GeneratedECGFinding[];
  readonly redFlagFindings:        readonly string[];
  readonly educationalNotes:       string;
  readonly falsePositives:         readonly string[];
  readonly serialTestingAdvisory?: SerialTestingAdvisory;
}

// ─── Investigation Errors ─────────────────────
// Discriminated error union for failed resolution.
// All three variants are genuine runtime conditions,
// not programmer errors.

export type InvestigationError =
  | {
      readonly kind:            "INVESTIGATION_NOT_FOUND";
      readonly investigationId: string;
      readonly message:         string;
    }
  | {
      readonly kind:            "ORDER_NOT_FOUND";
      readonly investigationId: string;
      readonly message:         string;
    }
  | {
      readonly kind:             "NOT_YET_RESULTED";
      readonly investigationId:  string;
      readonly resultAvailableAt: number;
      readonly currentMinutes:   number;
      readonly message:          string;
    };

// ─── Resolution Result ────────────────────────
// Discriminated union returned by resolveInvestigation.
// Callers must handle both branches.

export type ResolutionResult =
  | { readonly ok: true;  readonly report: InvestigationReport }
  | { readonly ok: false; readonly error:  InvestigationError  };

// ─── Hospital Engine Integration ──────────────
// Hospital Engine cannot import Investigation Engine
// types directly (circular dependency). Instead,
// Hospital Engine defines ResolvedInvestigation using
// only primitives and strings. The Simulation Controller
// maps InvestigationReport → ResolvedInvestigation.
//
// This mapping type documents the contract:

export interface InvestigationReportMapping {
  readonly investigationId: string;
  readonly name:            string;
  readonly resolvedAt:      number;
  readonly hasRedFlags:     boolean;
  readonly findingCount:    number;
}

// Future: Simulation Controller converts
// InvestigationReport → Hospital Engine's
// ResolvedInvestigation using this mapping.
// Scoring Engine reads resolvedSeverityTier
// from the INVESTIGATION_RESULTED event payload.
