// ─────────────────────────────────────────────
// KAIROS — Nurse Briefing
//
// The handover moment: the ward nurse briefs the
// student on the patient waiting in the bay.
//
// Rebuilt to consume the live simulation session
// (generated in Reception) instead of hardcoded data.
// Sits in the flow between Reception and the Patient room:
//   reception → nurse-briefing → patient
// ─────────────────────────────────────────────

'use client';

import { useEffect }   from 'react';
import { useRouter }   from 'next/navigation';
import { useSession }  from '../../../lib/context/SessionContext';
import type { VisibleVital } from '../../../lib/engines/encounter';

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12)  return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  return 'Good evening';
}

// Short labels for the compact vitals grid.
const VITAL_ABBR: Record<string, string> = {
  'Heart Rate':                'HR',
  'Systolic Blood Pressure':   'SBP',
  'Diastolic Blood Pressure':  'DBP',
  'Respiratory Rate':          'RR',
  'Temperature':               'Temp',
  'SpO₂':                      'SpO₂',
  'SpO2':                      'SpO₂',
};

function abbr(parameter: string): string {
  return VITAL_ABBR[parameter] ?? parameter;
}

function vitalColor(v: VisibleVital): string {
  if (v.isRedFlag)  return 'text-red-500';
  if (v.isAbnormal) return 'text-amber-500';
  return 'text-emerald-500';
}

export default function NurseBriefingPage() {
  const router      = useRouter();
  const { state }   = useSession();

  // Guard: this screen only makes sense with an active session.
  useEffect(() => {
    if (!state.initialized) return;
    if (!state.session) router.replace('/reception');
  }, [state.initialized, state.session, router]);

  if (!state.session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <span className="text-slate-400 text-sm">Preparing handover…</span>
      </div>
    );
  }

  const { encounter } = state.session;
  const ps            = encounter.patientSummary;
  const genderNoun    = ps.sex === 'male' ? 'man' : 'woman';
  const subjPronoun   = ps.sex === 'male' ? 'He' : 'She';
  const possPronoun   = ps.sex === 'male' ? 'His' : 'Her';
  const redFlagVital  = encounter.visibleVitals.find(v => v.isRedFlag);

  return (
    <main className="min-h-screen bg-white flex flex-col px-6 py-14">
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">

        {/* Nurse */}
        <div className="flex items-center gap-3 mb-10">
          <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-lg">
            👩‍⚕️
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-900">Sister Priya</p>
            <p className="text-xs text-slate-400 tracking-wide uppercase">Ward Nurse · Emergency</p>
          </div>
        </div>

        {/* Handover — built from the real encounter */}
        <p className="font-[family-name:var(--font-instrument-serif)] text-2xl sm:text-3xl text-slate-800 leading-relaxed text-left">
          {timeGreeting()}, Doctor.
          <br /><br />
          We&rsquo;ve just admitted a{' '}
          <span className="italic text-blue-600">
            {ps.age}-year-old {genderNoun}.
          </span>
          <br /><br />
          &ldquo;{encounter.chiefComplaint}&rdquo;
          {redFlagVital && (
            <>
              <br /><br />
              {possPronoun} {redFlagVital.parameter.toLowerCase()} is {redFlagVital.value}{redFlagVital.unit} — I&rsquo;m worried.
            </>
          )}
          <br /><br />
          {subjPronoun} is in the emergency bay, waiting for your assessment.
        </p>

        {/* Patient card — real demographics + real vitals */}
        <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left">
          <p className="text-xs tracking-widest text-slate-400 uppercase font-medium mb-3">
            Patient · Awaiting assessment
          </p>
          <p className="text-base font-semibold text-slate-900 mb-1">{ps.fullName}</p>
          <p className="text-xs text-slate-400 mb-4">
            {ps.age}Y · {ps.sex === 'male' ? 'Male' : 'Female'} · {ps.occupation}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 border-t border-slate-200">
            {encounter.visibleVitals.map((v, i) => (
              <div key={i} className="text-center">
                <p className={`text-sm font-bold ${vitalColor(v)}`}>{v.value}</p>
                <p className="text-xs text-slate-400 uppercase tracking-wide">{abbr(v.parameter)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Accept — client navigation preserves the session */}
      <div className="max-w-md mx-auto w-full">
        <button
          onClick={() => router.push('/patient')}
          className="block w-full text-center px-10 py-4 rounded-2xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-all hover:-translate-y-0.5 shadow-lg shadow-slate-900/20"
        >
          Accept Shift →
        </button>
        <p className="mt-3 text-center text-xs text-slate-400 italic">
          There is no going back once you accept.
        </p>
      </div>
    </main>
  );
}
