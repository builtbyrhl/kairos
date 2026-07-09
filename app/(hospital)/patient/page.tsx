// ─────────────────────────────────────────────
// KAIROS — Patient Page
//
// The heart of the simulation.
//
// Progressive disclosure rules:
//   Vitals          → always visible (nursing triage data)
//   Medical history → Unknown until Take History completed
//   Examination     → Unknown until Physical Examination completed
//   Investigations  → Always orderable; results earned through action
//   Treatments      → Always prescribable; consequences follow
//
// Architecture:
//   All clinical logic lives in engines.
//   This component presents engine state and
//   triggers engine actions. Zero medical logic here.
// ─────────────────────────────────────────────

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter }                        from 'next/navigation';
import { useSession }                       from '../../../lib/context/SessionContext';
import { applyAction }                      from '../../../lib/engines/hospital';
import type { VisibleVital, TriagePriority, EncounterAction }
                                            from '../../../lib/engines/encounter';
import type { StudentSession }              from '../../../lib/engines/hospital';
import type { InvestigationContext }        from '../../../lib/engines/investigation';
import type { TreatmentContext }            from '../../../lib/engines/treatment';
import {
  resolveOrderedInvestigation,
  resolveAdministeredTreatment,
}                                           from '../../../lib/controllers/simulation';
import type { StudentFacingReport, TreatmentFacingResult }
                                            from '../../../lib/controllers/simulation';
import { MedicineRegistry }                from '../../../lib/data/medicines/registry';
import {
  InvestigationPriority,
  TreatmentPriority,
  TreatmentTiming,
}                                           from '../../../lib/types/enums';
import HistoryConversation                  from '../../../components/kairos/HistoryConversation';
import ExaminationFlow                      from '../../../components/kairos/ExaminationFlow';

// ─── Constants ────────────────────────────────

type TriageInfo = { label: string; dot: string; };

const TRIAGE_CONFIG: Record<TriagePriority, TriageInfo> = {
  red:    { label: 'IMMEDIATE',   dot: 'bg-red-500'    },
  orange: { label: 'URGENT',      dot: 'bg-orange-400' },
  yellow: { label: 'LESS URGENT', dot: 'bg-yellow-400' },
  green:  { label: 'NON-URGENT',  dot: 'bg-green-500'  },
};

const ACTION_COSTS: Record<EncounterAction, number> = {
  'Take History':         10,
  'Physical Examination':  8,
  'View Vital Signs':      2,
  'Order Investigation':   3,
  'Administer Treatment':  5,
  'Observe':              15,
};

type Tab = 'overview' | 'history' | 'investigations' | 'treatment' | 'timeline';

// ─── Sub-components ───────────────────────────

function VitalsRow({ vital }: { vital: VisibleVital }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <span className="text-sm text-slate-600">{vital.parameter}</span>
      <div className="flex items-center gap-2.5">
        <span className={`font-mono text-sm font-semibold ${
          vital.isRedFlag ? 'text-red-600' : vital.isAbnormal ? 'text-amber-600' : 'text-slate-900'
        }`}>
          {vital.value}
        </span>
        <span className="text-xs text-slate-400 w-12 text-right">{vital.unit}</span>
        {vital.isRedFlag && (
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" title="Red flag" />
        )}
        {vital.isAbnormal && !vital.isRedFlag && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" title="Abnormal" />
        )}
      </div>
    </div>
  );
}

function UnknownField({ label }: { label: string }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-xs text-slate-300 italic">Not assessed</span>
    </div>
  );
}

function InvestigationResultPanel({ report }: { report: StudentFacingReport }) {
  return (
    <div className="mt-4 bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-100">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Result</p>
        <p className="text-xs text-slate-400 font-mono">{report.resolvedAt} min</p>
      </div>

      {report.findings.length > 0 && (
        <div className="space-y-2">
          {report.findings.map((f, i) => (
            <div key={i} className="flex justify-between items-center">
              <span className="text-sm text-slate-500">{f.parameter}</span>
              <span className={`font-mono text-sm font-semibold ${
                f.kind === 'quantitative' && f.isAbnormal ? 'text-red-600' : 'text-slate-900'
              }`}>
                {f.kind === 'quantitative' ? `${f.value} ${f.unit}` : f.interpretation}
              </span>
            </div>
          ))}
        </div>
      )}

      {report.ecgFindings.length > 0 && (
        <div className="pt-3 border-t border-slate-100 space-y-2">
          {report.ecgFindings.map((f, i) => (
            <div key={i} className="text-sm">
              <span className="text-slate-400 font-mono text-xs">[{f.leads.join(', ')}] </span>
              <span className="text-slate-800">{f.finding}</span>
            </div>
          ))}
        </div>
      )}

      {report.redFlagFindings.length > 0 && (
        <div className="pt-2 border-t border-red-100 space-y-1">
          {report.redFlagFindings.map((r, i) => (
            <p key={i} className="text-xs text-red-700 flex items-start gap-1.5">
              <span className="flex-shrink-0 mt-0.5">⚠</span>
              <span>{r}</span>
            </p>
          ))}
        </div>
      )}

      {report.serialTestingAdvisory?.required && (
        <div className="pt-2 border-t border-blue-100 space-y-0.5">
          <p className="text-xs font-semibold text-blue-700">Serial testing required:</p>
          {report.serialTestingAdvisory.reasons.map((r, i) => (
            <p key={i} className="text-xs text-blue-600">· {r}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function TreatmentResultPanel({ result }: { result: TreatmentFacingResult }) {
  if (result.issues.length === 0) {
    return (
      <div className="mt-3 flex items-center gap-2 bg-emerald-50 rounded-xl px-4 py-2.5 text-xs text-emerald-800">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
        Administered at {result.evaluatedAt} min — no clinical concerns.
      </div>
    );
  }
  return (
    <div className="mt-3 bg-amber-50 rounded-xl p-3 space-y-1.5">
      {result.issues.map((issue, i) => (
        <div key={i} className="text-xs text-amber-900">
          <span className="font-semibold text-amber-700 uppercase">[{issue.kind}]</span>
          {' '}{issue.message}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────

export default function PatientPage() {
  const router              = useRouter();
  const { state, dispatch } = useSession();

  const [activeTab, setActiveTab]     = useState<Tab>('overview');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [examOpen, setExamOpen]       = useState(false);
  const [doseInput, setDoseInput]     = useState<Record<string, string>>({});
  const [routeInput, setRouteInput]   = useState<Record<string, string>>({});
  const [toast, setToast]             = useState<string | null>(null);

  useEffect(() => {
    if (!state.initialized || !state.session) {
      router.replace('/reception');
    }
  }, [state.initialized, state.session, router]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  if (!state.session || !state.disease || !state.patientCase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <span className="text-slate-400 text-sm">Loading…</span>
      </div>
    );
  }

  const session     = state.session;
  const disease     = state.disease;
  const patientCase = state.patientCase;
  const { encounter } = session;
  const hs = session.state;

  const isCompleted    = hs.status === 'completed';
  const clinicalTime   = hs.timeState.elapsedClinicalMinutes;
  const triageInfo     = TRIAGE_CONFIG[encounter.triagePriority];

  // Progressive disclosure flags
  const hasTakenHistory = hs.completedActions.some(a => a.action === 'Take History');
  const hasExamined     = hs.completedActions.some(a => a.action === 'Physical Examination');

  // Lookup maps
  const reportsByInvId = new Map<string, StudentFacingReport>(
    state.investigationReports.map(r => [r.investigationId, r])
  );
  const resultsByMedId = new Map<string, TreatmentFacingResult>(
    state.treatmentResults.map(r => [r.medicineId, r])
  );

  // ─── Handlers ─────────────────────────────────

  function advanceTime(action: EncounterAction) {
    const newState = applyAction(hs, { type: 'COMPLETE_ACTION', action });
    dispatch({ type: 'UPDATE_SESSION', session: { ...session, state: newState } });
    showToast(`${action} · +${ACTION_COSTS[action]} min`);
  }

  function completeHistory() {
    const newState = applyAction(hs, { type: 'COMPLETE_ACTION', action: 'Take History' });
    dispatch({ type: 'UPDATE_SESSION', session: { ...session, state: newState } });
    setHistoryOpen(false);
    showToast('History taken · +10 min');
  }

  function completeExamination() {
    const newState = applyAction(hs, { type: 'COMPLETE_ACTION', action: 'Physical Examination' });
    dispatch({ type: 'UPDATE_SESSION', session: { ...session, state: newState } });
    setExamOpen(false);
    showToast('Examination complete · +8 min');
  }

  function doOrderInvestigation(investigationId: string) {
    const s1 = applyAction(hs, { type: 'ORDER_INVESTIGATION', investigationId });
    const sess1: StudentSession = { ...session, state: s1 };
    const context: InvestigationContext = {
      patientCase,
      clinicalMinutes: s1.timeState.elapsedClinicalMinutes,
      disease,
    };
    const result = resolveOrderedInvestigation(sess1, context, investigationId);
    if (!result.ok) {
      dispatch({ type: 'UPDATE_SESSION', session: sess1 });
      showToast(`Could not resolve: ${result.error.kind}`);
      return;
    }
    dispatch({
      type: 'INVESTIGATION_RESOLVED',
      session: result.session,
      report: result.report,
      postCaseData: result.postCaseData,
    });
    showToast(`${investigationId} resulted`);
  }

  function doAdministerTreatment(medicineId: string) {
    const dose  = doseInput[medicineId]?.trim()  ?? '';
    const route = routeInput[medicineId]?.trim() ?? '';
    const s1 = applyAction(hs, {
      type: 'ADMINISTER_TREATMENT',
      medicineId,
      ...(dose  ? { dose  } : {}),
      ...(route ? { route } : {}),
    });
    const sess1: StudentSession = { ...session, state: s1 };
    const context: TreatmentContext = {
      patientCase, disease,
      clinicalMinutes: s1.timeState.elapsedClinicalMinutes,
      allRecords: s1.administeredTreatments,
    };
    const result = resolveAdministeredTreatment(sess1, context, medicineId);
    if (!result.ok) {
      dispatch({ type: 'UPDATE_SESSION', session: sess1 });
      showToast(`Error: ${result.error.kind}`);
      return;
    }
    dispatch({
      type: 'TREATMENT_RESOLVED',
      session: result.session,
      treatmentResult: result.result,
      postCaseData: result.postCaseData,
    });
    showToast(`${medicineId} administered`);
  }

  function doCompleteEncounter() {
    const newState = applyAction(hs, { type: 'COMPLETE_ENCOUNTER' });
    dispatch({ type: 'UPDATE_SESSION', session: { ...session, state: newState } });
  }

  // ─── Render ───────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Dialogs */}
      {historyOpen && (
        <HistoryConversation
          patientName={encounter.patientSummary.fullName}
          symptoms={patientCase.selectedSymptoms}
          patientSummary={encounter.patientSummary}
          onComplete={completeHistory}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {examOpen && (
        <ExaminationFlow
          vitals={encounter.visibleVitals}
          symptomNames={patientCase.selectedSymptoms.map(s => s.name)}
          onComplete={completeExamination}
          onClose={() => setExamOpen(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-slate-950/95 backdrop-blur text-white text-sm px-5 py-2.5
            rounded-2xl shadow-2xl font-medium">
            {toast}
          </div>
        </div>
      )}

      {/* Sticky header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between">

          {/* Left: logo + dept */}
          <div className="flex items-center gap-3">
            <span className="text-base text-slate-950 font-semibold tracking-tight"
              style={{ fontFamily: 'Georgia, serif' }}>
              Kairos
            </span>
            <span className="text-slate-200 select-none">·</span>
            <span className="text-sm text-slate-400 hidden sm:block">Emergency</span>
          </div>

          {/* Right: time + triage + pulse */}
          <div className="flex items-center gap-4">
            {/* Persistent mini vitals — ECG pulse indicator */}
            {!isCompleted && (() => {
              const hrVital = encounter.visibleVitals.find(v => v.parameter === 'Heart Rate');
              const spo2Vital = encounter.visibleVitals.find(v => v.parameter === 'SpO₂');
              return hrVital || spo2Vital ? (
                <div className="hidden sm:flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-1.5 border border-slate-100">
                  {hrVital && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                      <span className={`font-mono text-xs font-semibold ${hrVital.isRedFlag ? 'text-red-600' : 'text-slate-700'}`}>
                        {hrVital.value}
                      </span>
                      <span className="text-xs text-slate-400">bpm</span>
                    </div>
                  )}
                  {hrVital && spo2Vital && (
                    <span className="w-px h-3 bg-slate-200" />
                  )}
                  {spo2Vital && (
                    <div className="flex items-center gap-1">
                      <span className={`font-mono text-xs font-semibold ${spo2Vital.isRedFlag ? 'text-red-600' : spo2Vital.isAbnormal ? 'text-amber-600' : 'text-slate-700'}`}>
                        {spo2Vital.value}%
                      </span>
                      <span className="text-xs text-slate-400">SpO₂</span>
                    </div>
                  )}
                </div>
              ) : null;
            })()}

            {/* Clinical time */}
            <div className={`flex items-center gap-1.5 text-sm ${clinicalTime > 30 ? 'text-amber-600' : 'text-slate-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                isCompleted ? 'bg-slate-300' : clinicalTime > 30 ? 'bg-amber-400' : 'bg-emerald-400'
              }`} />
              <span className="font-mono font-semibold text-slate-900">{clinicalTime}</span>
              <span className="text-slate-400 text-xs">min</span>
            </div>

            {/* Triage badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50
              border border-slate-100 text-xs font-semibold text-slate-600 tracking-wide">
              <span className={`w-1.5 h-1.5 rounded-full ${triageInfo.dot}`} />
              {triageInfo.label}
            </div>
          </div>

        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-6 space-y-5">

        {/* Patient identity card */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm relative overflow-hidden">
          {/* Triage accent line */}
          <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-3xl ${
            encounter.triagePriority === 'red' ? 'bg-red-500' :
            encounter.triagePriority === 'orange' ? 'bg-orange-400' :
            encounter.triagePriority === 'yellow' ? 'bg-yellow-400' : 'bg-green-500'
          }`} />

          <div className="pl-4 flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <h1
                className="text-2xl sm:text-3xl text-slate-950 tracking-tight font-normal truncate"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                {encounter.patientSummary.fullName}
              </h1>
              <p className="text-slate-400 text-sm">
                {encounter.patientSummary.age} years ·{' '}
                {encounter.patientSummary.sex === 'male' ? 'Male' : 'Female'} ·{' '}
                {encounter.patientSummary.occupation}
              </p>
            </div>
            <div className="flex-shrink-0 text-right space-y-1">
              <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold tracking-wide ${
                isCompleted ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'
              }`}>
                {isCompleted ? 'CLOSED' : 'ACTIVE'}
              </span>
            </div>
          </div>

          {/* Chief complaint — patient's own words */}
          <div className="pl-4 mt-4 pt-4 border-t border-slate-50">
            <p className="text-sm text-slate-500 italic leading-relaxed">
              &ldquo;{encounter.chiefComplaint}&rdquo;
            </p>
          </div>
        </div>

        {/* Completion → reflection gateway */}
        {isCompleted && (
          <div
            className="bg-slate-950 text-white rounded-3xl p-6 flex flex-col sm:flex-row
              items-start sm:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <p className="font-semibold">Encounter closed.</p>
              <p className="text-slate-400 text-sm">
                {clinicalTime} clinical minutes · {hs.events.length} events logged
              </p>
            </div>
            <button
              onClick={() => router.push('/reflection')}
              className="flex-shrink-0 bg-white text-slate-950 px-5 py-2.5 rounded-xl
                text-sm font-semibold hover:bg-slate-100 active:scale-[0.99]
                transition-all duration-150"
            >
              View Performance Report →
            </button>
          </div>
        )}

        {/* Tab navigation */}
        <div className="flex items-center gap-6 sm:gap-8 border-b border-slate-100 overflow-x-auto pb-px">
          {([
            { id: 'overview',       label: 'Overview'     },
            { id: 'history',        label: 'History',   count: hasTakenHistory ? undefined : 0 },
            { id: 'investigations', label: 'Investigations', count: hs.orderedInvestigations.length },
            { id: 'treatment',      label: 'Treatment',  count: hs.administeredTreatments.length },
            { id: 'timeline',       label: 'Timeline',   count: hs.events.length },
          ] as { id: Tab; label: string; count?: number }[]).map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`pb-3 text-sm font-medium whitespace-nowrap transition-all duration-150 border-b-2 flex items-center gap-2 ${
                activeTab === id
                  ? 'border-slate-950 text-slate-950'
                  : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
              }`}
            >
              {label}
              {count !== undefined && count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  activeTab === id ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ─────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vitals — always available from nursing triage */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                  Vital Signs
                </p>
                <p className="text-xs text-slate-300 italic">Nursing assessment</p>
              </div>
              {encounter.visibleVitals.map((v, i) => (
                <VitalsRow key={i} vital={v} />
              ))}
              <div className="mt-3 pt-3 border-t border-slate-50 flex items-center gap-4 text-xs text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Red flag
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Abnormal
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Examination findings — locked until examined */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                    Physical Examination
                  </p>
                  {hasExamined && (
                    <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                      Complete
                    </span>
                  )}
                </div>

                {!hasExamined ? (
                  <div className="text-center py-4 space-y-4">
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Examination findings not yet assessed.
                    </p>
                    {!isCompleted && (
                      <button
                        onClick={() => setExamOpen(true)}
                        className="w-full py-3 border-2 border-slate-200 text-slate-600 rounded-xl
                          text-sm font-medium hover:border-slate-950 hover:text-slate-950
                          transition-all duration-150"
                      >
                        Examine Patient →
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5 text-sm text-slate-700 leading-relaxed">
                    <p>✓ General inspection performed</p>
                    <p>✓ Cardiovascular assessment</p>
                    <p>✓ Respiratory assessment</p>
                    <p>✓ Neurological screen</p>
                    <button
                      onClick={() => setActiveTab('overview')}
                      className="text-xs text-slate-400 hover:text-slate-600 mt-1
                        underline underline-offset-2 transition-colors"
                    >
                      View detailed findings in History tab
                    </button>
                  </div>
                )}
              </div>

              {/* Session summary */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
                  Session
                </p>
                <div className="space-y-0">
                  {([
                    ['Clinical actions',  hs.completedActions.length],
                    ['Investigations',    hs.orderedInvestigations.length],
                    ['Treatments',        hs.administeredTreatments.length],
                  ] as [string, number][]).map(([label, val]) => (
                    <div key={label} className="flex justify-between items-center py-2.5 border-b border-slate-50 last:border-0">
                      <span className="text-sm text-slate-500">{label}</span>
                      <span className="font-mono text-sm font-semibold text-slate-900">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {!isCompleted && (
                <button
                  onClick={doCompleteEncounter}
                  className="w-full py-3 border border-slate-200 text-slate-500 rounded-2xl
                    text-sm font-medium hover:border-slate-400 hover:text-slate-700
                    transition-all duration-150"
                >
                  Complete Encounter →
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── HISTORY ──────────────────────────── */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {!hasTakenHistory && !isCompleted && (
              <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-sm text-center space-y-5">
                <div className="space-y-2">
                  <p className="text-lg text-slate-800 font-normal" style={{ fontFamily: 'Georgia, serif' }}>
                    {encounter.patientSummary.fullName} is waiting.
                  </p>
                  <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
                    Introduce yourself. Ask about the presenting complaint and background history.
                  </p>
                </div>
                <button
                  onClick={() => setHistoryOpen(true)}
                  className="px-8 py-3.5 bg-slate-950 text-white rounded-2xl text-sm font-semibold
                    hover:bg-slate-800 active:scale-[0.99] transition-all duration-150
                    shadow-lg shadow-slate-950/10"
                >
                  Take History →
                </button>
              </div>
            )}

            {hasTakenHistory && (
              <div className="space-y-4">
                {/* Gathered history */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
                    Medical Background
                  </p>
                  <div className="space-y-0">
                    {([
                      ['Smoking',       encounter.patientSummary.isSmoker ? 'Active smoker' : 'Non-smoker'],
                      ['Diabetes',      encounter.patientSummary.hasDiabetes ? 'Present' : 'None'],
                      ['Hypertension',  encounter.patientSummary.hasHypertension ? 'Present' : 'None'],
                      ['Previous MI',   encounter.patientSummary.hasPreviousMI ? 'Yes — previous cardiac history' : 'None'],
                    ] as [string, string][]).map(([label, value]) => (
                      <div key={label} className="flex justify-between items-center py-2.5 border-b border-slate-50 last:border-0">
                        <span className="text-sm text-slate-500">{label}</span>
                        <span className={`text-sm font-medium ${
                          value === 'None' || value === 'Non-smoker' ? 'text-slate-400' : 'text-slate-800'
                        }`}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Symptom summary from conversation */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
                    Presenting Symptoms
                  </p>
                  <div className="space-y-2">
                    {patientCase.selectedSymptoms.map((s) => (
                      <div key={s.id} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                        <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${
                          s.isRedFlag ? 'bg-red-500' : 'bg-slate-300'
                        }`} />
                        <div>
                          <p className="text-sm font-medium text-slate-700">{s.name}</p>
                          <p className="text-xs text-slate-400 italic mt-0.5">
                            &ldquo;{s.patientPhrase}&rdquo;
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Examination findings (shown in history tab after exam) */}
            {hasTakenHistory && hasExamined && (
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                    Examination Findings
                  </p>
                  <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Complete ✓
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Examination performed at {
                    hs.completedActions.find(a => a.action === 'Physical Examination')?.clinicalMinutes ?? '?'
                  } min. See Overview for vital sign details.
                </p>
              </div>
            )}

            {/* Additional bedside actions */}
            {!isCompleted && (
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                  Bedside Actions
                </p>
                <div className="flex flex-wrap gap-2">
                  {!hasExamined && (
                    <button
                      onClick={() => setExamOpen(true)}
                      className="px-4 py-2 rounded-xl text-sm font-medium border-2 border-slate-200
                        text-slate-600 hover:border-slate-950 hover:text-slate-950
                        transition-all duration-150"
                    >
                      Physical Examination
                    </button>
                  )}
                  <button
                    onClick={() => advanceTime('View Vital Signs')}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-50 text-slate-600
                      hover:bg-slate-100 transition-colors"
                  >
                    Review Vitals <span className="text-xs text-slate-400 ml-1">+2m</span>
                  </button>
                  <button
                    onClick={() => advanceTime('Observe')}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-50 text-slate-600
                      hover:bg-slate-100 transition-colors"
                  >
                    Observe Patient <span className="text-xs text-slate-400 ml-1">+15m</span>
                  </button>
                </div>
              </div>
            )}

            {/* History locked state (not yet taken, encounter completed) */}
            {!hasTakenHistory && isCompleted && (
              <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center">
                <p className="text-slate-400 text-sm">History was not taken during this encounter.</p>
              </div>
            )}
          </div>
        )}

        {/* ── INVESTIGATIONS ────────────────────── */}
        {activeTab === 'investigations' && (
          <div className="space-y-3">
            {disease.investigations.map(inv => {
              const order  = hs.orderedInvestigations.find(o => o.investigationId === inv.id);
              const report = reportsByInvId.get(inv.id);

              return (
                <div key={inv.id}
                  className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-slate-900">{inv.name}</h4>
                        <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">
                          {inv.type}
                        </span>
                        {inv.priority === InvestigationPriority.Mandatory && (
                          <span className="text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-md font-medium">
                            Mandatory
                          </span>
                        )}
                      </div>

                      {order && !report && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Processing…
                        </div>
                      )}
                    </div>

                    <div className="flex-shrink-0">
                      {!order && !isCompleted && (
                        <button
                          onClick={() => doOrderInvestigation(inv.id)}
                          className="px-4 py-2 bg-slate-950 text-white rounded-xl text-sm
                            font-medium hover:bg-slate-800 active:scale-[0.99] transition-all duration-150"
                        >
                          Order
                        </button>
                      )}
                      {report && (
                        <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1
                          rounded-full font-semibold">
                          Resulted
                        </span>
                      )}
                    </div>
                  </div>

                  {report && <InvestigationResultPanel report={report} />}
                </div>
              );
            })}
          </div>
        )}

        {/* ── TREATMENT ─────────────────────────── */}
        {activeTab === 'treatment' && (
          <div className="space-y-3">
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-5">
                Indicated Treatments
              </p>
              <div className="space-y-7 divide-y divide-slate-50">
                {disease.treatments.correct.map(ref => {
                  const medicine   = MedicineRegistry.getById(ref.medicineId);
                  const rule       = medicine?.doseRules.find(r => r.population === 'adult');
                  const isAdminned = hs.administeredTreatments.some(t => t.medicineId === ref.medicineId);
                  const evalResult = resultsByMedId.get(ref.medicineId);

                  const doseHint  = rule && rule.dose.value !== null
                    ? `${rule.dose.value}${rule.dose.unit}${rule.dose.weightBased ? '/kg' : ''}`
                    : 'Dose';
                  const routeHint = rule ? String(rule.route).replace(/_/g, ' ') : 'Route';

                  return (
                    <div key={ref.medicineId} className="pt-7 first:pt-0">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-semibold text-slate-900">
                              {medicine?.genericName ?? ref.medicineId}
                            </h4>
                            {ref.priority === TreatmentPriority.Mandatory && (
                              <span className="text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-md font-medium">
                                Mandatory
                              </span>
                            )}
                            {ref.timing === TreatmentTiming.Immediate && (
                              <span className="text-xs text-orange-700 bg-orange-50 px-2 py-0.5 rounded-md">
                                Immediate
                              </span>
                            )}
                          </div>
                          {rule && (
                            <p className="text-xs text-slate-400">
                              {doseHint} · {routeHint}
                              {rule.dose.titratable ? ' · titrate to effect' : ''}
                            </p>
                          )}
                        </div>
                        {isAdminned && !evalResult && (
                          <span className="text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full font-semibold flex-shrink-0">
                            Evaluating…
                          </span>
                        )}
                      </div>

                      {!isCompleted && (
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          <input
                            type="text"
                            placeholder={doseHint}
                            value={doseInput[ref.medicineId] ?? ''}
                            onChange={e => setDoseInput(p => ({ ...p, [ref.medicineId]: e.target.value }))}
                            className="border border-slate-200 rounded-xl px-3 py-2 text-sm w-44
                              focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200
                              placeholder:text-slate-300 transition-all duration-150"
                          />
                          <input
                            type="text"
                            placeholder={routeHint}
                            value={routeInput[ref.medicineId] ?? ''}
                            onChange={e => setRouteInput(p => ({ ...p, [ref.medicineId]: e.target.value }))}
                            className="border border-slate-200 rounded-xl px-3 py-2 text-sm w-36
                              focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200
                              placeholder:text-slate-300 transition-all duration-150"
                          />
                          <button
                            onClick={() => doAdministerTreatment(ref.medicineId)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                              isAdminned
                                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                : 'bg-slate-950 text-white hover:bg-slate-800 shadow-sm shadow-slate-950/10'
                            }`}
                          >
                            {isAdminned ? 'Re-administer' : 'Administer'}
                          </button>
                        </div>
                      )}

                      {evalResult && <TreatmentResultPanel result={evalResult} />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── TIMELINE ──────────────────────────── */}
        {activeTab === 'timeline' && (
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-5">
              Encounter Timeline
            </p>

            {hs.events.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-6">No events yet.</p>
            ) : (
              <div className="relative">
                {/* Connector line */}
                <div className="absolute left-[1.85rem] top-3 bottom-3 w-px bg-slate-100" />

                <div className="space-y-4">
                  {hs.events.map((event, i) => {
                    const isKey = ['INVESTIGATION_RESULTED', 'TREATMENT_EVALUATED',
                                   'ENCOUNTER_COMPLETED', 'SESSION_STARTED'].includes(event.type);
                    return (
                      <div key={i} className="flex gap-4">
                        {/* Time + dot */}
                        <div className="flex-shrink-0 flex flex-col items-center w-12 pt-0.5">
                          <span className="font-mono text-xs text-slate-400 mb-1.5">
                            {event.clinicalMinutes}m
                          </span>
                          <div className={`w-2.5 h-2.5 rounded-full border-2 z-10 ${
                            isKey
                              ? 'bg-slate-950 border-slate-950'
                              : 'bg-white border-slate-300'
                          }`} />
                        </div>

                        {/* Event content */}
                        <div className="flex-1 pb-4 last:pb-0">
                          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-md ${
                            isKey
                              ? 'bg-slate-950 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {event.type.replace(/_/g, ' ')}
                          </span>
                          {Object.keys(event.payload).length > 0 && (
                            <p className="text-xs text-slate-400 font-mono mt-1 leading-relaxed">
                              {Object.entries(event.payload)
                                .map(([k, v]) => `${k}: ${String(v)}`)
                                .join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
