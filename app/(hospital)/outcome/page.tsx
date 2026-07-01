export default function OutcomePage() {
  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-8">💚</div>
      <h1 className="font-[family-name:var(--font-instrument-serif)] text-4xl text-slate-900 mb-4">
        Ramesh Kumar is stable.
      </h1>
      <p className="text-slate-500 max-w-xs leading-relaxed mb-6">
        Your decisions were timely. He has been transferred to the Cath Lab. Primary PCI is underway.
      </p>
      <div className="grid grid-cols-3 gap-4 w-full max-w-xs mb-12">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
          <p className="text-lg font-bold text-emerald-500">88</p>
          <p className="text-xs text-slate-400 uppercase tracking-wide mt-1">HR</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
          <p className="text-lg font-bold text-emerald-500">112/74</p>
          <p className="text-xs text-slate-400 uppercase tracking-wide mt-1">BP</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
          <p className="text-lg font-bold text-emerald-500">97%</p>
          <p className="text-xs text-slate-400 uppercase tracking-wide mt-1">SpO₂</p>
        </div>
      </div>
      <a
        href="/reflection"
        className="px-10 py-4 rounded-2xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
      >
        Clinical Reflection →
      </a>
    </main>
  );
}
