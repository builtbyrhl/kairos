'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter }                        from 'next/navigation';

import { useSession }             from '../../../lib/context/SessionContext';
import { applyAction }            from '../../../lib/engines/hospital';
import type { VisibleVital, TriagePriority, EncounterAction }
                                  from '../../../lib/engines/encounter';
import type { StudentSession }    from '../../../lib/engines/hospital';
import type { InvestigationContext }
                                  from '../../../lib/engines/investigation';
import type { TreatmentContext }  from '../../../lib/engines/treatment';
import {
  resolveOrderedInvestigation,
  resolveAdministeredTreatment,
}                                 from '../../../lib/controllers/simulation';
import type { StudentFacingReport, TreatmentFacingResult }
                                  from '../../../lib/controllers/simulation';
import { MedicineRegistry }       from '../../../lib/data/medicines/registry';
import {
  InvestigationPriority,
  TreatmentPriority,
  TreatmentTiming,
}                                 from '../../../lib/types/enums';

// ─── Triage display config ────────────────────

type TriageInfo = { label: string; bg: string; text: string };

const TRIAGE_CONFIG: Record<TriagePriority, TriageInfo> = {
  red:    { label: 'IMMEDIATE',   bg: 'bg-red-500',    text: 'text-white'      },
  orange: { label: 'URGENT',      bg: 'bg-orange-400', text: 'text-white'      },
  yellow: { label: 'LESS URGENT', bg: 'bg-yellow-400', text: 'text-yellow-900' },
  green:  { label: 'NON-URGENT',  bg: 'bg-green-500',  text: 'text-white'      },
};

const ACTION_COSTS: Record<EncounterAction, number> = {
  'Take History':         10,
  'Physical Examination':  8,
  'View Vital Signs':      2,
  'Order Investigation':   3,
  'Administer Treatment':  5,
  'Observe':              15,
};

type Tab = 'overview' | 'history' | 'investigations' | 'treatments' | 'events';

// ─── Sub-components ───────────────────────────

function Badge({ label, color }: { label: string; color: TriagePriority }) {
  const cfg = TRIAGE_CONFIG[color];
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold tracking-widest ${cfg.bg} ${cfg.text}`}>
      {label}
    </span>
  );
}

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      {title && (
        <h3 className="text-xs font-semibold text-gray-400 tracking-widest uppercase mb-4">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

function TabButton({ active, label, onClick }: {
  active: boolean; label: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        pb-3 text-sm font-medium transition-colors duration-150 border-b-2 whitespace-nowrap
        ${active
          ? 'border-blue-950 text-blue-950'
          : 'border-transparent text-gray-400 hover:text-gray-600'}
      `}
    >
      {label}
    </button>
  );
}

function Btn({ label, onClick, disabled = false, variant = 'primary' }: {
  label: string; onClick: () => void;
  disabled?: boolean; variant?: 'primary' | 'secondary';
}) {
  const styles = {
    primary:   'bg-blue-950 text-white hover:bg-blue-900 shadow-sm shadow-blue-950/20',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium
        transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed
        ${styles[variant]}`}
    >
      {label}
    </button>
  );
}

function VitalsTable({ vitals }: { vitals: readonly VisibleVital[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-100">
          <th className="text-left py-2 pr-6 text-xs font-semibold text-gray-400 uppercase tracking-wider">Parameter</th>
          <th className="text-right py-2 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Value</th>
          <th className="text-left py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Unit</th>
        </tr>
      </thead>
      <tbody>
        {vitals.map((v, i) => (
          <tr key={i} className="border-b border-gray-50 last:border-0">
            <td className="py-3 pr-6 text-gray-700 font-medium">{v.parameter}</td>
            <td className={`py-3 pr-4 text-right font-mono font-semibold ${
              v.isRedFlag ? 'text-red-600' : v.isAbnormal ? 'text-amber-600' : 'text-gray-900'
            }`}>
              {v.value}{v.isRedFlag && <span className="ml-1 text-xs">🚩</span>}
            </td>
            <td className="py-3 text-gray-400">{v.unit}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function InvestigationResultCard({ report }: { report: StudentFacingReport }) {
  return (
    <div className="mt-3 bg-gray-50 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Result</span>
        <span className="text-xs text-gray-400">{report.resolvedAt} min</span>
      </div>

      {report.findings.length > 0 && (
        <div className="space-y-1">
          {report.findings.map((f, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-gray-600">{f.parameter}</span>
              <span className={`font-mono font-medium ${
                f.kind === 'quantitative' && f.isAbnormal ? 'text-red-600' : 'text-gray-900'
              }`}>
                {f.kind === 'quantitative'
                  ? `${f.value} ${f.unit}`
                  : f.interpretation}
              </span>
            </div>
          ))}
        </div>
      )}

      {report.ecgFindings.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-gray-200">
          {report.ecgFindings.map((f, i) => (
            <div key={i} className="text-sm">
              <span className="text-gray-400 text-xs">[{f.leads.join(', ')}] </span>
              <span className="text-gray-800">{f.finding}</span>
            </div>
          ))}
        </div>
      )}

      {report.redFlagFindings.length > 0 && (
        <div className="pt-2 border-t border-red-100 space-y-0.5">
          {report.redFlagFindings.map((r, i) => (
            <p key={i} className="text-xs text-red-600">⚠ {r}</p>
          ))}
        </div>
      )}

      {report.serialTestingAdvisory?.required && (
        <div className="pt-2 border-t border-blue-100">
          <p className="text-xs font-semibold text-blue-800 mb-1">Serial testing required:</p>
          {report.serialTestingAdvisory.reasons.map((r, i) => (
            <p key={i} className="text-xs text-blue-600">{r}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function TreatmentResultCard({ result }: { result: TreatmentFacingResult }) {
  if (result.issues.length === 0) {
    return (
      <p className="mt-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
        Administered at {result.evaluatedAt} min — no clinical concerns.
      </p>
    );
  }
  return (
    <div className="mt-2 bg-amber-50 rounded-xl p-3 space-y-1">
      {result.issues.map((issue, i) => (
        <p key={i} className="text-xs text-amber-800">
          <span className="font-semibold uppercase">[{issue.kind}]</span>{' '}
          {issue.message}
        </p>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────

export default function PatientPage() {
  const router              = useRouter();
  const { state, dispatch } = useSession();
  const [activeTab, setActiveTab]           = useState<Tab>('overview');
  const [doseInput, setDoseInput]           = useState<Record<string, string>>({});
  const [routeInput, setRouteInput]         = useState<Record<string, string>>({});
  const [toast, setToast]                   = useState<string | null>(null);

  useEffect(() => {
    if (!state.initialized || !state.session) {
      router.replace('/reception');
    }
  }, [state.initialized, state.session, router]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Guard: redirect if uninitialized
  if (!state.session || !state.disease || !state.patientCase) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-gray-400 text-sm">Loading…</span>
      </div>
    );
  }

  // TypeScript narrows these to non-null after the early return above
  const session     = state.session;
  const disease     = state.disease;
  const patientCase = state.patientCase;
  const { encounter }  = session;
  const hospitalState  = session.state;
  const isCompleted    = hospitalState.status === 'completed';
  const clinicalTime   = hospitalState.timeState.elapsedClinicalMinutes;
  const triage         = TRIAGE_CONFIG[encounter.triagePriority];

  // ─── Derived lookup maps ──────────────────────

  const reportsByInvId = new Map<string, StudentFacingReport>(
    state.investigationReports.map(r => [r.investigationId, r])
  );
  const resultsByMedId = new Map<string, TreatmentFacingResult>(
    state.treatmentResults.map(r => [r.medicineId, r])
  );

  // ─── Action handlers ──────────────────────────

  function doCompleteAction(action: EncounterAction) {
    const newState = applyAction(hospitalState, { type: 'COMPLETE_ACTION', action });
    const newSession: StudentSession = { ...session, state: newState };
    dispatch({ type: 'UPDATE_SESSION', session: newSession });
    showToast(`✓ ${action} (+${ACTION_COSTS[action]} min)`);
  }

  function doOrderInvestigation(investigationId: string) {
    const stateAfterOrder = applyAction(hospitalState, {
      type: 'ORDER_INVESTIGATION',
      investigationId,
    });
    const sessionAfterOrder: StudentSession = { ...session, state: stateAfterOrder };

    const context: InvestigationContext = {
      patientCase,
      clinicalMinutes: stateAfterOrder.timeState.elapsedClinicalMinutes,
      disease,
    };

    const result = resolveOrderedInvestigation(sessionAfterOrder, context, investigationId);

    if (!result.ok) {
      dispatch({ type: 'UPDATE_SESSION', session: sessionAfterOrder });
      showToast(`✗ ${result.error.kind}`);
      return;
    }

    dispatch({
      type:        'INVESTIGATION_RESOLVED',
      session:     result.session,
      report:      result.report,
      postCaseData: result.postCaseData,
    });
    showToast(`✓ ${investigationId} resulted`);
  }

  function doAdministerTreatment(medicineId: string) {
    const dose  = doseInput[medicineId]?.trim()  ?? '';
    const route = routeInput[medicineId]?.trim() ?? '';

    const stateAfterAdmin = applyAction(hospitalState, {
      type: 'ADMINISTER_TREATMENT',
      medicineId,
      ...(dose  ? { dose  } : {}),
      ...(route ? { route } : {}),
    });
    const sessionAfterAdmin: StudentSession = { ...session, state: stateAfterAdmin };

    const context: TreatmentContext = {
      patientCase,
      disease,
      clinicalMinutes: stateAfterAdmin.timeState.elapsedClinicalMinutes,
      allRecords:      stateAfterAdmin.administeredTreatments,
    };

    const result = resolveAdministeredTreatment(sessionAfterAdmin, context, medicineId);

    if (!result.ok) {
      dispatch({ type: 'UPDATE_SESSION', session: sessionAfterAdmin });
      showToast(`✗ ${result.error.kind}`);
      return;
    }

    dispatch({
      type:            'TREATMENT_RESOLVED',
      session:         result.session,
      treatmentResult: result.result,
      postCaseData:    result.postCaseData,
    });
    showToast(`✓ ${medicineId} administered`);
  }

  function doCompleteEncounter() {
    const newState = applyAction(hospitalState, { type: 'COMPLETE_ENCOUNTER' });
    dispatch({ type: 'UPDATE_SESSION', session: { ...session, state: newState } });
    showToast('Encounter completed');
  }

  // ─── Comorbidity rows (explicitly typed) ──────

  const comorbidityRows: Array<{ label: string; value: boolean }> = [
    { label: 'Smoker',       value: encounter.patientSummary.isSmoker        },
    { label: 'Diabetes',     value: encounter.patientSummary.hasDiabetes      },
    { label: 'Hypertension', value: encounter.patientSummary.hasHypertension  },
    { label: 'Previous MI',  value: encounter.patientSummary.hasPreviousMI    },
  ];

  const sessionRows: Array<{ label: string; value: number }> = [
    { label: 'Actions',        value: hospitalState.completedActions.length       },
    { label: 'Investigations', value: hospitalState.orderedInvestigations.length  },
    { label: 'Treatments',     value: hospitalState.administeredTreatments.length },
    { label: 'Observations',   value: hospitalState.observations.length           },
    { label: 'Events logged',  value: hospitalState.events.length                 },
  ];

  // ─── Render ───────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50
          bg-gray-950 text-white text-sm px-5 py-3 rounded-2xl shadow-xl pointer-events-none">
          {toast}
        </div>
      )}

      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl text-blue-950 font-semibold"
              style={{ fontFamily: 'Georgia, serif' }}>
              Kairos
            </span>
            <span className="text-gray-200 select-none">|</span>
            <span className="text-sm text-gray-500">Emergency Department</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              <span className="font-mono text-gray-700 font-semibold">{clinicalTime}</span>
              {' '}min elapsed
            </span>
            <Badge label={triage.label} color={encounter.triagePriority} />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Patient header card */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-3xl text-gray-950 tracking-tight"
                style={{ fontFamily: 'Georgia, serif' }}>
                {encounter.patientSummary.fullName}
              </h1>
              <p className="text-gray-500 text-sm">
                {encounter.patientSummary.age} yrs ·{' '}
                {encounter.patientSummary.sex === 'male' ? 'Male' : 'Female'} ·{' '}
                {encounter.patientSummary.occupation}
              </p>
            </div>
            <div className="text-right text-xs text-gray-400 space-y-1 flex-shrink-0">
              <p className="font-mono uppercase">{hospitalState.status}</p>
              <p className="font-mono text-gray-300">{hospitalState.sessionId.slice(-8)}</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50">
            <p className="text-sm text-gray-600 italic leading-relaxed">
              &ldquo;{encounter.chiefComplaint}&rdquo;
            </p>
          </div>
        </div>

        {/* Completion banner */}
        {isCompleted && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-center space-y-1">
            <p className="text-blue-900 font-semibold text-sm">
              Encounter complete — {clinicalTime} clinical minutes
            </p>
            <p className="text-blue-400 text-xs">
              Navigate to /reflection for your performance score.
            </p>
          </div>
        )}

        {/* Tab nav */}
        <div className="flex gap-6 border-b border-gray-100 overflow-x-auto">
          {(['overview', 'history', 'investigations', 'treatments', 'events'] as Tab[]).map(t => (
            <TabButton
              key={t}
              active={activeTab === t}
              label={t.charAt(0).toUpperCase() + t.slice(1)}
              onClick={() => setActiveTab(t)}
            />
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SectionCard title="Vital Signs">
              <VitalsTable vitals={encounter.visibleVitals} />
            </SectionCard>

            <div className="space-y-4">
              <SectionCard title="Comorbidities">
                <div className="divide-y divide-gray-50">
                  {comorbidityRows.map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center py-2.5">
                      <span className="text-sm text-gray-600">{label}</span>
                      <span className={`text-xs font-semibold ${
                        value ? 'text-amber-600' : 'text-gray-300'
                      }`}>
                        {value ? 'YES' : 'NO'}
                      </span>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Session">
                <div className="divide-y divide-gray-50">
                  {sessionRows.map(({ label, value }) => (
                    <div key={label} className="flex justify-between py-2.5">
                      <span className="text-sm text-gray-500">{label}</span>
                      <span className="font-mono text-sm font-semibold text-gray-900">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </SectionCard>

              {!isCompleted && (
                <Btn
                  label="Complete Encounter →"
                  onClick={doCompleteEncounter}
                  variant="secondary"
                />
              )}
            </div>
          </div>
        )}

        {/* ── HISTORY ── */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <SectionCard title="History of Present Illness">
              <p className="text-gray-700 text-base leading-relaxed">
                {encounter.history}
              </p>
            </SectionCard>

            {!isCompleted && (
              <SectionCard title="Available Clinical Actions">
                <div className="flex flex-wrap gap-2">
                  {encounter.availableActions.map(action => (
                    <Btn
                      key={action}
                      label={action}
                      onClick={() => doCompleteAction(action)}
                      variant="secondary"
                    />
                  ))}
                </div>
              </SectionCard>
            )}
          </div>
        )}

        {/* ── INVESTIGATIONS ── */}
        {activeTab === 'investigations' && (
          <div className="space-y-4">
            {disease.investigations.map(inv => {
              const order  = hospitalState.orderedInvestigations
                .find(o => o.investigationId === inv.id);
              const report = reportsByInvId.get(inv.id);

              return (
                <SectionCard key={inv.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-gray-900">{inv.name}</h4>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {inv.type}
                        </span>
                        {inv.priority === InvestigationPriority.Mandatory && (
                          <span className="text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                            Mandatory
                          </span>
                        )}
                      </div>
                      {order && !report && (
                        <p className="text-xs text-amber-500 mt-1">Pending…</p>
                      )}
                    </div>

                    {!order && !isCompleted && (
                      <Btn
                        label="Order"
                        onClick={() => doOrderInvestigation(inv.id)}
                        variant="primary"
                      />
                    )}
                    {report && (
                      <span className="text-xs text-green-700 bg-green-50 px-2 py-1
                        rounded-full whitespace-nowrap flex-shrink-0">
                        Resulted ✓
                      </span>
                    )}
                  </div>

                  {report && <InvestigationResultCard report={report} />}
                </SectionCard>
              );
            })}
          </div>
        )}

        {/* ── TREATMENTS ── */}
        {activeTab === 'treatments' && (
          <div className="space-y-4">
            <SectionCard title="Indicated Treatments">
              <div className="space-y-6 divide-y divide-gray-50">
                {disease.treatments.correct.map(ref => {
                  const medicine   = MedicineRegistry.getById(ref.medicineId);
                  const rule       = medicine?.doseRules.find(r => r.population === 'adult');
                  const isAdminned = hospitalState.administeredTreatments
                    .some(t => t.medicineId === ref.medicineId);
                  const evalResult = resultsByMedId.get(ref.medicineId);

                  // Dose hint string — only when rule and numeric dose exist
                  const doseHint = rule && rule.dose.value !== null
                    ? `e.g. ${rule.dose.value}${rule.dose.unit}${rule.dose.weightBased ? '/kg' : ''}`
                    : 'Dose';

                  const routeHint = rule ? `e.g. ${rule.route}` : 'Route';

                  return (
                    <div key={ref.medicineId} className="pt-6 first:pt-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-semibold text-gray-900">
                              {medicine?.genericName ?? ref.medicineId}
                            </h4>
                            {ref.priority === TreatmentPriority.Mandatory && (
                              <span className="text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                                Mandatory
                              </span>
                            )}
                            {ref.timing === TreatmentTiming.Immediate && (
                              <span className="text-xs text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">
                                Immediate
                              </span>
                            )}
                          </div>
                          {rule && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {doseHint} · {rule.route}
                            </p>
                          )}
                        </div>
                      </div>

                      {!isCompleted && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            placeholder={doseHint}
                            value={doseInput[ref.medicineId] ?? ''}
                            onChange={e => setDoseInput(p => ({
                              ...p, [ref.medicineId]: e.target.value,
                            }))}
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-44
                              focus:outline-none focus:ring-2 focus:ring-blue-950/20"
                          />
                          <input
                            type="text"
                            placeholder={routeHint}
                            value={routeInput[ref.medicineId] ?? ''}
                            onChange={e => setRouteInput(p => ({
                              ...p, [ref.medicineId]: e.target.value,
                            }))}
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-36
                              focus:outline-none focus:ring-2 focus:ring-blue-950/20"
                          />
                          <Btn
                            label={isAdminned ? 'Re-administer' : 'Administer'}
                            onClick={() => doAdministerTreatment(ref.medicineId)}
                            variant={isAdminned ? 'secondary' : 'primary'}
                          />
                        </div>
                      )}

                      {evalResult && <TreatmentResultCard result={evalResult} />}
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </div>
        )}

        {/* ── EVENTS ── */}
        {activeTab === 'events' && (
          <SectionCard title="Audit Event Log">
            <div className="divide-y divide-gray-50">
              {hospitalState.events.map((event, i) => (
                <div key={i} className="flex items-start gap-4 py-3">
                  <span className="font-mono text-xs text-gray-400 w-10 flex-shrink-0 pt-0.5">
                    {event.clinicalMinutes}m
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-blue-950 bg-blue-50
                      px-2 py-0.5 rounded-md">
                      {event.type}
                    </span>
                    {Object.keys(event.payload).length > 0 && (
                      <p className="text-xs text-gray-400 mt-1 font-mono truncate">
                        {JSON.stringify(event.payload)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

      </main>
    </div>
  );
}
