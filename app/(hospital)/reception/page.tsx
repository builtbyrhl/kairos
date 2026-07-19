// ─────────────────────────────────────────────
// KAIROS — Reception (Living Dashboard)
//
// The student arrives into a department that is already
// running: a live shift clock, a waiting room that fills
// and deteriorates on its own, and one patient who needs
// them now.
//
// Cinematic, not administrative. Calm status lines first,
// then the queue beneath — all driven by the Ambient
// Engine. The featured immediate patient is still the
// STEMI case produced by the Patient Engine on admit.
// ─────────────────────────────────────────────

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter }            from 'next/navigation';
import { useSession }           from '../../../lib/context/SessionContext';
import { useAmbient }           from '../../../lib/context/AmbientContext';
import {
  shiftPhase,
  criticalCount,
  hospitalLoad,
  loadLabel,
}                               from '../../../lib/engines/ambient';
import type { WaitingPatient }  from '../../../lib/engines/ambient';
import { DiseaseRegistry }      from '../../../lib/data/diseases';
import { generatePatientCase }  from '../../../lib/engines/patient';
import { generateEncounter }    from '../../../lib/engines/encounter';
import { createSession }        from '../../../lib/engines/hospital';
import { Severity }             from '../../../lib/types/enums';

function greetingForMinute(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60);
  if (h >= 5  && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  return 'Good evening';
}

const TRIAGE_DOT: Record<WaitingPatient['triage'], string> = {
  red:    'bg-red-500',
  orange: 'bg-orange-500',
  yellow: 'bg-amber-500',
  green:  'bg-emerald-500',
};

const TRIAGE_LABEL: Record<WaitingPatient['triage'], string> = {
  red:    'Immediate',
  orange: 'Urgent',
  yellow: 'Standard',
  green:  'Minor',
};

function waitMinutes(arrivedTick: number, tick: number, worldMinutesPerTick: number): number {
  return Math.max(0, Math.round((tick - arrivedTick) * worldMinutesPerTick));
}

function QueueRow({
  patient,
  waited,
}: {
  patient: WaitingPatient;
  waited:  number;
}) {
  return (
    <div className="flex items-center gap-4 py-3.5 px-1 border-b border-slate-100 last:border-0">
      <span className={`w-2 h-2 rounded-full shrink-0 ${TRIAGE_DOT[patient.triage]}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-800 truncate">
          {patient.name}
          <span className="text-slate-400"> · {patient.age}{patient.sex === 'male' ? 'M' : 'F'}</span>
        </p>
        <p className="text-xs text-slate-400 truncate">{patient.complaint}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-slate-500">{TRIAGE_LABEL[patient.triage]}</p>
        <p className="text-xs text-slate-300 font-mono">{waited}m</p>
      </div>
    </div>
  );
}

export default function ReceptionPage() {
  const router              = useRouter();
  const { state, dispatch } = useSession();
  const { state: ambient }  = useAmbient();
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Live ambient world — the hospital keeps time and fills on its own.
  const phase    = shiftPhase(ambient.clock, ambient.config.clock);
  const waiting  = ambient.queue.waiting;
  const critical = criticalCount(ambient.queue);
  const load     = hospitalLoad(ambient.beds);
  const wpm      = ambient.config.clock.worldMinutesPerTick;

  // Set when the student starts a fresh case here, so the guard below
  // doesn't hijack the intended reception → nurse-briefing navigation.
  const startingHere = useRef(false);

  // A session that already existed on arrival (e.g. returning mid-encounter)
  // skips the reception screen and resumes in the patient room. A case just
  // generated here is exempt — it continues to the nurse briefing.
  useEffect(() => {
    if (startingHere.current) return;
    if (state.initialized && state.session) {
      router.replace('/patient');
    }
  }, [state.initialized, state.session, router]);

  function startCase() {
    setLoading(true);
    setError(null);
    try {
      const disease = DiseaseRegistry.getById('stemi');
      if (!disease) throw new Error('Disease data unavailable.');

      const seed        = Math.floor(Math.random() * 9_999_999);
      const patientCase = generatePatientCase(disease, Severity.Moderate, seed);
      const encounter   = generateEncounter(patientCase);
      const session     = createSession(encounter);

      startingHere.current = true;
      dispatch({ type: 'INIT', session, patientCase, disease });
      router.push('/nurse-briefing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate case.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white flex flex-col">

      {/* Ambient gradient */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 110% 60% at 50% 0%, rgba(15,23,42,0.04) 0%, transparent 65%)',
        }}
      />

      <div className="flex-1 flex flex-col justify-center px-8 py-16 max-w-lg mx-auto w-full relative z-10">

        {/* Department header */}
        <div className="mb-9">
          <div className="flex items-center gap-3 mb-8">
            <span className="text-sm font-mono text-slate-400 tabular-nums">{phase.label}</span>
            <span className="w-px h-3.5 bg-slate-200" />
            <span className="text-sm text-slate-400">Emergency Department</span>
            <span className="w-px h-3.5 bg-slate-200" />
            <span className="text-sm text-slate-400">{loadLabel(load)}</span>
          </div>

          <h1
            className="text-4xl text-slate-950 tracking-tight font-light mb-4"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            {greetingForMinute(phase.minuteOfDay)}, Doctor.
          </h1>

          {/* Cinematic status lines */}
          <div className="space-y-1 text-lg text-slate-500 font-light" style={{ fontFamily: 'Georgia, serif' }}>
            <p>{waiting.length} patients waiting.</p>
            {critical > 0 && (
              <p className="text-red-600/90">{critical} critical.</p>
            )}
            <p className="text-slate-400">One needs you now.</p>
          </div>
        </div>

        {/* Featured immediate patient → the case the student assesses */}
        <div className="bg-slate-50 rounded-3xl p-6 mb-4 border border-slate-100">
          <div className="flex items-center justify-between mb-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <p className="text-sm font-semibold text-slate-700">Immediate</p>
              </div>
              <p className="text-xs text-slate-500">
                Emergency bay · Awaiting assessment
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 uppercase tracking-wider">Chest pain</p>
              <p className="text-xs text-slate-300">Cardiology</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            onClick={startCase}
            disabled={loading}
            className="w-full py-4 bg-slate-950 text-white rounded-2xl text-base font-semibold
              hover:bg-slate-800 active:scale-[0.99]
              transition-all duration-200 shadow-lg shadow-slate-950/10
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2.5">
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Preparing patient…
              </span>
            ) : 'Begin Assessment →'}
          </button>
        </div>

        {/* The waiting room, alive and beneath */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-1 px-1">
            <p className="text-xs text-slate-400 uppercase tracking-wider">Waiting Room</p>
            <p className="text-xs text-slate-300">{waiting.length} in queue</p>
          </div>
          <div className="max-h-72 overflow-y-auto pr-1">
            {waiting.map(p => (
              <QueueRow
                key={p.id}
                patient={p}
                waited={waitMinutes(p.arrivedTick, ambient.clock.tick, wpm)}
              />
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
