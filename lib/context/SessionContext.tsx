// ─────────────────────────────────────────────
// KAIROS — Session Context
//
// Central React state for an active hospital encounter.
// Holds the StudentSession, PatientCase, Disease, and
// accumulated post-case data that engines produce.
//
// Architecture rules:
//   • This file may import from engines and controllers.
//   • Engines must NEVER import from this file.
//   • HiddenState is stored (in PatientCase) but never
//     passed to UI components directly.
//   • correctness and educationalNotes remain in
//     postCase arrays — not in session state.
// ─────────────────────────────────────────────

'use client';

import {
  createContext,
  useContext,
  useReducer,
  ReactNode,
} from 'react';

import type { StudentSession } from '../engines/hospital';
import type { PatientCase }    from '../engines/patient';
import type { Disease }        from '../engines/disease/types';
import type {
  StudentFacingReport,
  TreatmentFacingResult,
  PostCaseInvestigationData,
  PostCaseTreatmentData,
} from '../controllers/simulation';

// ─── State ────────────────────────────────────

export interface SessionState {
  readonly session:                StudentSession | null;
  readonly patientCase:            PatientCase    | null;
  readonly disease:                Disease        | null;
  readonly investigationReports:   readonly StudentFacingReport[];
  readonly treatmentResults:       readonly TreatmentFacingResult[];
  readonly postCaseInvestigations: readonly PostCaseInvestigationData[];
  readonly postCaseTreatments:     readonly PostCaseTreatmentData[];
  readonly initialized:            boolean;
}

const initialState: SessionState = {
  session:                null,
  patientCase:            null,
  disease:                null,
  investigationReports:   [],
  treatmentResults:       [],
  postCaseInvestigations: [],
  postCaseTreatments:     [],
  initialized:            false,
};

// ─── Actions ──────────────────────────────────
// Actions use explicit fields to avoid complex
// intersection types (SimulationResult & { ok: true }).
// Each action carries exactly what the reducer needs.

export type SessionAction =
  | {
      readonly type:        'INIT';
      readonly session:     StudentSession;
      readonly patientCase: PatientCase;
      readonly disease:     Disease;
    }
  | {
      readonly type:        'UPDATE_SESSION';
      readonly session:     StudentSession;
    }
  | {
      readonly type:        'INVESTIGATION_RESOLVED';
      readonly session:     StudentSession;
      readonly report:      StudentFacingReport;
      readonly postCaseData: PostCaseInvestigationData;
    }
  | {
      readonly type:          'TREATMENT_RESOLVED';
      readonly session:       StudentSession;
      readonly treatmentResult: TreatmentFacingResult;
      readonly postCaseData:  PostCaseTreatmentData;
    }
  | { readonly type: 'RESET' };

// ─── Reducer ──────────────────────────────────

function sessionReducer(
  state:  SessionState,
  action: SessionAction
): SessionState {
  switch (action.type) {
    case 'INIT':
      return {
        ...initialState,
        session:     action.session,
        patientCase: action.patientCase,
        disease:     action.disease,
        initialized: true,
      };

    case 'UPDATE_SESSION':
      return { ...state, session: action.session };

    case 'INVESTIGATION_RESOLVED':
      return {
        ...state,
        session:                action.session,
        investigationReports:   [...state.investigationReports,   action.report],
        postCaseInvestigations: [...state.postCaseInvestigations, action.postCaseData],
      };

    case 'TREATMENT_RESOLVED':
      return {
        ...state,
        session:            action.session,
        treatmentResults:   [...state.treatmentResults,   action.treatmentResult],
        postCaseTreatments: [...state.postCaseTreatments, action.postCaseData],
      };

    case 'RESET':
      return initialState;
  }
}

// ─── Context ──────────────────────────────────

interface SessionContextValue {
  readonly state:    SessionState;
  readonly dispatch: React.Dispatch<SessionAction>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, initialState);
  return (
    <SessionContext.Provider value={{ state, dispatch }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be called inside <SessionProvider>');
  }
  return ctx;
}
