// ─────────────────────────────────────────────
// KAIROS — Outcome
//
// The consequence screen: what happened to the patient
// as a result of the student's decisions.
//
// Rebuilt to consume the live session and the Scoring
// Engine instead of hardcoded data. Sits in the flow
// between the completed encounter and the reflection:
//   patient (completed) → outcome → reflection
//
// The outcome tier is derived from the Scoring Engine's
// performance percentage — the same computation the
// Reflection page uses — so the patient's fate is a
// direct consequence of the recorded clinical decisions.
// ─────────────────────────────────────────────

'use client';

import { useEffect, useMemo } from 'react';
import { useRouter }          from 'next/navigation';
import { useSession }         from '../../../lib/context/SessionContext';
import { scoreEncounter }     from '../../../lib/engines/scoring';
import type { ScoringContext } from '../../../lib/engines/scoring';

interface OutcomeView {
  readonly marker:    string;
  readonly headline:  (name: string) => string;
  readonly narrative: string;
  readonly accent:    string;   // text colour for the marker/headline accent
}

// Percentage → outcome tier. Kairos is "Free to Kill":
// clearly missed critical decisions cost the patient.
function outcomeFor(percentage: number): OutcomeView {
  if (percentage >= 80) {
    return {
      marker:    '💚',
      accent:    'text-emerald-600',
      headline:  (name) => `${name} is stable.`,
      narrative:
        'Your decisions were timely and correct. The infarct-related artery has been reperfused and the patient is on the way to the Cath Lab for primary PCI.',
    };
  }
  if (percentage >= 40) {
    return {
      marker:    '🫀',
      accent:    'text-amber-600',
      headline:  (name) => `${name} is critical but alive.`,
      narrative:
        'The patient survived, but delays and gaps in management have cost heart muscle. They are being stabilised in the ICU with a guarded prognosis.',
    };
  }
  return {
    marker:    '🕯️',
    accent:    'text-red-600',
    headline:  (name) => `${name} did not survive.`,
    narrative:
      'Critical actions were missed or came too late, and the patient arrested before reperfusion could be achieved. Every death here traces back to a specific decision — the reflection below shows which.',
  };
}

export default function OutcomePage() {
  const router    = useRouter();
  const { state } = useSession();

  // Guard: outcome is only meaningful once the encounter is complete.
  useEffect(() => {
    if (!state.initialized) return;
    if (!state.session) { router.replace('/reception'); return; }
    if (state.session.state.status !== 'completed') router.replace('/patient');
  }, [state.initialized, state.session, router]);

  const score = useMemo(() => {
    if (!state.session || !state.disease || !state.patientCase) return null;
    if (state.session.state.status !== 'completed') return null;
    try {
      const ctx: ScoringContext = {
        state:       state.session.state,
        disease:     state.disease,
        patientCase: state.patientCase,
      };
      return scoreEncounter(ctx);
    } catch {
      return null;
    }
  }, [state.session, state.disease, state.patientCase]);

  if (!state.session || !state.disease || !state.patientCase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <span className="text-slate-400 text-sm">Determining outcome…</span>
      </div>
    );
  }

  if (!score) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
        <p className="text-slate-500 text-sm">Unable to determine outcome.</p>
        <button
          onClick={() => router.push('/reflection')}
          className="text-sm text-slate-900 underline underline-offset-4"
        >
          Continue to reflection
        </button>
      </div>
    );
  }

  const { encounter } = state.session;
  const hs            = state.session.state;
  const name          = encounter.patientSummary.fullName;
  const view          = outcomeFor(score.percentage);

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className={`text-6xl mb-8 ${view.accent}`}>{view.marker}</div>

      <h1 className="font-[family-name:var(--font-instrument-serif)] text-4xl text-slate-900 mb-4">
        {view.headline(name)}
      </h1>

      <p className="text-slate-500 max-w-md leading-relaxed mb-10">
        {view.narrative}
      </p>

      {/* What actually happened — real recorded actions */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-sm mb-12">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
          <p className="text-lg font-bold text-slate-900">{hs.timeState.elapsedClinicalMinutes}</p>
          <p className="text-xs text-slate-400 uppercase tracking-wide mt-1">Clin. min</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
          <p className="text-lg font-bold text-slate-900">{hs.resolvedTreatments.length}</p>
          <p className="text-xs text-slate-400 uppercase tracking-wide mt-1">Treatments</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
          <p className="text-lg font-bold text-slate-900">{hs.resolvedInvestigations.length}</p>
          <p className="text-xs text-slate-400 uppercase tracking-wide mt-1">Tests</p>
        </div>
      </div>

      <button
        onClick={() => router.push('/reflection')}
        className="px-10 py-4 rounded-2xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
      >
        Clinical Reflection →
      </button>
    </main>
  );
}
