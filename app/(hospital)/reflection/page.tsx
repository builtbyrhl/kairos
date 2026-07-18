'use client';

import { useMemo, useEffect, useState } from 'react';
import { useRouter }                    from 'next/navigation';
import { useSession }                   from '../../../lib/context/SessionContext';
import { scoreEncounter }               from '../../../lib/engines/scoring';
import type { ScoringContext }           from '../../../lib/engines/scoring';
import { generateReflection }           from '../../../lib/engines/reflection';
import type { ReflectionContext }        from '../../../lib/engines/reflection';

// ─── Grade config ─────────────────────────────

type GradeKey = 'A' | 'B' | 'C' | 'D' | 'F';

const GRADE_CONFIG: Record<GradeKey, {
  text: string; bg: string; border: string; label: string;
}> = {
  A: { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Excellent'  },
  B: { text: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200',    label: 'Good'       },
  C: { text: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   label: 'Adequate'   },
  D: { text: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200',  label: 'Below avg'  },
  F: { text: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200',     label: 'Needs work' },
};

const CATEGORY_LABELS: Record<string, string> = {
  timing:               'Timing & Urgency',
  treatment_decision:   'Treatment Decisions',
  safety:               'Patient Safety',
  diagnostic_reasoning: 'Diagnostic Reasoning',
  investigation_choice: 'Investigation Choices',
};

const CORRECTNESS_CONFIG: Record<string, { label: string; color: string; positive: boolean }> = {
  correct:          { label: 'Correct',           color: 'text-emerald-700', positive: true  },
  acceptable:       { label: 'Acceptable',         color: 'text-blue-700',    positive: true  },
  unnecessary:      { label: 'Unnecessary',        color: 'text-amber-700',   positive: false },
  incorrect:        { label: 'Incorrect',          color: 'text-red-700',     positive: false },
  contraindicated:  { label: 'Contraindicated',    color: 'text-red-700',     positive: false },
};

// ─── Sub-components ───────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xs font-semibold text-gray-400 tracking-widest uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Divider() {
  return <div className="w-full h-px bg-gray-100 my-2" />;
}

// ─── Page ─────────────────────────────────────

export default function ReflectionPage() {
  const router              = useRouter();
  const { state, dispatch } = useSession();
  const [displayPct, setDisplayPct] = useState(0);

  // Guard: only accessible after completion
  useEffect(() => {
    if (!state.initialized) return;
    if (!state.session) { router.replace('/reception'); return; }
    if (state.session.state.status !== 'completed') { router.replace('/patient'); }
  }, [state.initialized, state.session, router]);

  // Score — computed once from completed state
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
    } catch (err) {
      console.error('Failed to score encounter:', err);
      return null;
    }
  }, [state.session, state.disease, state.patientCase]);

  // Reflection — computed from score + post-case data
  const reflection = useMemo(() => {
    if (!score || !state.disease) return null;
    try {
      const ctx: ReflectionContext = {
        score,
        postCaseInvestigations: state.postCaseInvestigations,
        postCaseTreatments:     state.postCaseTreatments,
        disease:                state.disease,
      };
      return generateReflection(ctx);
    } catch (err) {
      console.error('Failed to generate reflection:', err);
      return null;
    }
  }, [score, state.disease, state.postCaseInvestigations, state.postCaseTreatments]);

  // Animate percentage count-up
  useEffect(() => {
    if (!reflection) return;
    const target = reflection.score.percentage;
    let current  = 0;
    const step   = Math.max(1, Math.floor(target / 40));
    const id = setInterval(() => {
      current = Math.min(current + step, target);
      setDisplayPct(current);
      if (current >= target) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, [reflection]);

  function startNewCase() {
    dispatch({ type: 'RESET' });
    router.push('/reception');
  }

  // Loading / guard render
  if (!state.session || !state.disease || !state.patientCase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="text-gray-400 text-sm">Loading…</span>
      </div>
    );
  }

  if (!score || !reflection) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <p className="text-gray-500 text-sm">Unable to generate performance report.</p>
        <button onClick={() => router.push('/patient')}
          className="text-sm text-blue-950 underline underline-offset-4">
          Return to encounter
        </button>
      </div>
    );
  }

  const { encounter }  = state.session;
  const hs             = state.session.state;
  const disease        = state.disease;
  const gradeKey       = reflection.grade as GradeKey;
  const gradeCfg       = GRADE_CONFIG[gradeKey] ?? GRADE_CONFIG['F'];
  const triggeredHooks = reflection.hookResults.filter(h => h.triggered);
  const passedHooks    = reflection.hookResults.filter(h => !h.triggered);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Quiet header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-lg text-blue-950 font-semibold"
            style={{ fontFamily: 'Georgia, serif' }}>
            Kairos
          </span>
          <span className="text-sm text-gray-400">Performance Report</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-12">

        {/* Patient brief */}
        <div className="text-center space-y-2">
          <p className="text-xs font-semibold text-gray-400 tracking-widest uppercase">
            Case debrief
          </p>
          <h1 className="text-4xl text-gray-950 tracking-tight"
            style={{ fontFamily: 'Georgia, serif' }}>
            {encounter.patientSummary.fullName}
          </h1>
          <p className="text-gray-400 text-sm">
            {disease.name} · {encounter.patientSummary.age} years ·{' '}
            {hs.timeState.elapsedClinicalMinutes} clinical minutes
          </p>
        </div>

        <Divider />

        {/* Score display */}
        <Section title="Overall Performance">
          <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm">
            <div className="flex items-center justify-between gap-8">
              {/* Large score number */}
              <div className="space-y-1">
                <div className="text-8xl font-extralight text-gray-950 tabular-nums leading-none">
                  {displayPct}
                </div>
                <p className="text-sm text-gray-400 font-medium">out of 100</p>
              </div>

              {/* Grade */}
              <div className="text-right space-y-3">
                <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl
                  border-2 ${gradeCfg.bg} ${gradeCfg.border}`}>
                  <span className={`text-4xl font-bold ${gradeCfg.text}`}>
                    {reflection.grade}
                  </span>
                </div>
                <p className={`text-sm font-semibold ${gradeCfg.text}`}>
                  {gradeCfg.label}
                </p>
              </div>
            </div>

            {/* Summary */}
            <p className="mt-6 pt-6 border-t border-gray-50 text-gray-600 text-sm leading-relaxed">
              {reflection.summary}
            </p>
          </div>
        </Section>

        {/* Category breakdown */}
        <Section title="Performance by Category">
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            {reflection.byCategory.map(({ category, earned, maximum }, i) => {
              const pct   = maximum > 0 ? Math.round((earned / maximum) * 100) : 0;
              const label = CATEGORY_LABELS[String(category)] ?? String(category);
              return (
                <div key={i} className="px-6 py-5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold ${
                        pct >= 80 ? 'text-emerald-600' :
                        pct >= 60 ? 'text-amber-600'   : 'text-red-600'
                      }`}>
                        {earned}/{maximum} pts
                      </span>
                      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        pct >= 80 ? 'bg-emerald-500' :
                        pct >= 60 ? 'bg-amber-500'   : 'bg-red-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Clinical decisions */}
        <Section title="Clinical Decisions">
          <div className="space-y-3">

            {/* What went well */}
            {passedHooks.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Correct decisions
                  </span>
                </div>
                <div className="divide-y divide-gray-50">
                  {passedHooks.map(hook => (
                    <div key={hook.hookId} className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <span className="text-emerald-500 flex-shrink-0 mt-0.5 text-base">✓</span>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-700 font-medium">
                            {hook.trigger.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xs text-gray-500 leading-relaxed">{hook.message}</p>
                        </div>
                        <span className="ml-auto flex-shrink-0 text-xs font-semibold text-emerald-600
                          bg-emerald-50 px-2 py-0.5 rounded-full">
                          +{hook.weight}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Areas to improve */}
            {triggeredHooks.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Areas to improve
                  </span>
                </div>
                <div className="divide-y divide-gray-50">
                  {triggeredHooks.map(hook => (
                    <div key={hook.hookId} className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <span className="text-amber-500 flex-shrink-0 mt-0.5 text-base">○</span>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-700 font-medium">
                            {hook.trigger.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xs text-gray-500 leading-relaxed">{hook.message}</p>
                        </div>
                        <span className="ml-auto flex-shrink-0 text-xs font-semibold text-gray-400
                          bg-gray-100 px-2 py-0.5 rounded-full">
                          0/{hook.weight}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </Section>

        {/* Investigation notes — revealed post-case */}
        {reflection.investigations.length > 0 && (
          <Section title="Investigation Review">
            <div className="space-y-3">
              {reflection.investigations.map(inv => (
                <div key={inv.investigationId}
                  className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
                  <h3 className="font-semibold text-gray-900 text-base">{inv.name}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{inv.educationalNotes}</p>
                  {inv.falsePositives.length > 0 && (
                    <div className="pt-3 border-t border-gray-50">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Causes of false positives
                      </p>
                      <ul className="space-y-1">
                        {inv.falsePositives.map((fp, i) => (
                          <li key={i} className="text-xs text-gray-500 flex items-start gap-2">
                            <span className="text-gray-300 flex-shrink-0">·</span>
                            {fp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Treatment assessment — revealed post-case */}
        {reflection.treatments.length > 0 && (
          <Section title="Treatment Review">
            <div className="space-y-3">
              {reflection.treatments.map(t => {
                const cfg = CORRECTNESS_CONFIG[t.correctness] ?? {
                  label: t.correctness, color: 'text-gray-600', positive: false,
                };
                return (
                  <div key={t.medicineId}
                    className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="font-semibold text-gray-900 text-base">{t.medicineName}</h3>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        t.isPositive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      }`}>
                        {cfg.label}
                      </span>
                    </div>
                    {t.educationalNotes.length > 0 && (
                      <div className="space-y-1.5">
                        {t.educationalNotes.map((note, i) => (
                          <p key={i} className="text-sm text-gray-600 leading-relaxed flex items-start gap-2">
                            <span className="text-gray-300 flex-shrink-0 mt-0.5">·</span>
                            {note}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        <Divider />

        {/* Actions */}
        <div className="text-center space-y-4 pb-8">
          <button
            onClick={startNewCase}
            className="px-8 py-3.5 bg-blue-950 text-white rounded-2xl text-sm font-semibold
              hover:bg-blue-900 active:scale-[0.99] transition-all duration-150
              shadow-lg shadow-blue-950/20"
          >
            Start New Case →
          </button>
          <p className="text-xs text-gray-400">
            Score: {reflection.score.total}/{reflection.score.maximum} ·{' '}
            {reflection.score.hookResults.length} decisions evaluated
          </p>
        </div>

      </main>
    </div>
  );
}
