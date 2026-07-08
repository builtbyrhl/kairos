'use client';

import { useEffect, useState }    from 'react';
import { useRouter }              from 'next/navigation';
import { useSession }             from '../../../lib/context/SessionContext';
import { DiseaseRegistry }        from '../../../lib/data/diseases';
import { generatePatientCase }    from '../../../lib/engines/patient';
import { generateEncounter }      from '../../../lib/engines/encounter';
import { createSession }          from '../../../lib/engines/hospital';
import { Severity }               from '../../../lib/types/enums';

export default function ReceptionPage() {
  const router              = useRouter();
  const { state, dispatch } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Already initialized — skip to patient room
  useEffect(() => {
    if (state.initialized && state.session) {
      router.replace('/patient');
    }
  }, [state.initialized, state.session, router]);

  function startCase() {
    setLoading(true);
    setError(null);

    try {
      const disease = DiseaseRegistry.getById('stemi');
      if (!disease) {
        setError('Disease data unavailable. Check DiseaseRegistry.');
        setLoading(false);
        return;
      }

      const seed        = Math.floor(Math.random() * 2_000_000);
      const patientCase = generatePatientCase(disease, Severity.Moderate, seed);
      const encounter   = generateEncounter(patientCase);
      const session     = createSession(encounter);

      dispatch({ type: 'INIT', session, patientCase, disease });
      router.push('/patient');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unexpected error generating case.'
      );
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-6">

      {/* Ambient gradient */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(30,64,175,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 max-w-md w-full text-center space-y-10">

        {/* Wordmark */}
        <div className="space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-950 text-white text-2xl mb-1"
            style={{ fontFamily: 'Georgia, serif' }}>
            K
          </div>
          <h1 className="text-5xl text-gray-950 tracking-tight"
            style={{ fontFamily: 'Georgia, serif' }}>
            Kairos
          </h1>
          <p className="text-lg text-gray-400 font-light">
            The decisive moment.
          </p>
        </div>

        <div className="w-12 h-px bg-gray-100 mx-auto" />

        {/* Intro */}
        <div className="space-y-2 text-gray-500 text-sm">
          <p>A patient is waiting in the emergency department.</p>
          <p className="text-gray-400">Take history. Investigate. Treat.</p>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {/* CTA */}
        <button
          onClick={startCase}
          disabled={loading}
          className="
            w-full py-4 rounded-2xl bg-blue-950 text-white
            text-base font-medium tracking-wide
            hover:bg-blue-900 active:scale-[0.99]
            transition-all duration-150
            disabled:opacity-50 disabled:cursor-not-allowed
            shadow-lg shadow-blue-950/20
          "
        >
          {loading ? 'Preparing case…' : 'Enter Hospital →'}
        </button>

        <p className="text-xs text-gray-300">
          STEMI · Moderate severity · Randomised patient
        </p>
      </div>
    </main>
  );
}
