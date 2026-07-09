// ─────────────────────────────────────────────
// KAIROS — Reception Page
//
// The student is arriving for a shift.
// Not opening a dashboard.
// Not launching an app.
// Beginning a hospital shift.
// ─────────────────────────────────────────────

'use client';

import { useEffect, useState }  from 'react';
import { useRouter }            from 'next/navigation';
import { useSession }           from '../../../lib/context/SessionContext';
import { DiseaseRegistry }      from '../../../lib/data/diseases';
import { generatePatientCase }  from '../../../lib/engines/patient';
import { generateEncounter }    from '../../../lib/engines/encounter';
import { createSession }        from '../../../lib/engines/hospital';
import { Severity }             from '../../../lib/types/enums';

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Good evening';
}

function formatTime(): string {
  return new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function ReceptionPage() {
  const router              = useRouter();
  const { state, dispatch } = useSession();
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [clockTime, setClockTime] = useState(formatTime);

  // If session already exists, go straight to patient room
  useEffect(() => {
    if (state.initialized && state.session) {
      router.replace('/patient');
    }
  }, [state.initialized, state.session, router]);

  // Live clock — subtle but alive
  useEffect(() => {
    const id = setInterval(() => setClockTime(formatTime()), 30_000);
    return () => clearInterval(id);
  }, []);

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

      dispatch({ type: 'INIT', session, patientCase, disease });
      router.push('/patient');
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

      <div className="flex-1 flex flex-col justify-center px-8 max-w-md mx-auto w-full relative z-10">

        {/* Department header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-8">
            <span className="text-sm font-mono text-slate-400">{clockTime}</span>
            <span className="w-px h-3.5 bg-slate-200" />
            <span className="text-sm text-slate-400">Emergency Department</span>
          </div>

          <h1
            className="text-4xl text-slate-950 tracking-tight font-light mb-3"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            {timeGreeting()}, Doctor.
          </h1>
          <p className="text-slate-500 text-base leading-relaxed">
            There is a patient waiting for your assessment.
          </p>
        </div>

        {/* Waiting patient indicator */}
        <div className="bg-slate-50 rounded-3xl p-6 mb-8 border border-slate-100">
          <div className="flex items-center justify-between">
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
              <p className="text-2xl font-light text-slate-950">1</p>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Patient</p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 text-sm text-red-700 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Primary action */}
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

        <p className="text-center text-xs text-slate-300 mt-5 tracking-wide uppercase">
          STEMI · Cardiology · Moderate acuity
        </p>

      </div>
    </main>
  );
}
