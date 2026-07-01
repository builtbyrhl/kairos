export default function ReflectionPage() {
  return (
    <main className="min-h-screen bg-white flex flex-col px-6 py-10">
      <div className="max-w-md mx-auto w-full">
        <p className="text-xs tracking-widest text-slate-400 uppercase mb-2">
          Case Complete · ICU
        </p>
        <h1 className="font-[family-name:var(--font-instrument-serif)] text-4xl text-slate-900 mb-10">
          Clinical Reflection
        </h1>

        {/* Score */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center mb-8">
          <p className="font-[family-name:var(--font-instrument-serif)] text-7xl text-slate-900 leading-none mb-1">
            82
            <span className="text-2xl text-slate-400">/100</span>
          </p>
          <p className="text-xs tracking-widest text-slate-400 uppercase mt-2 mb-4">
            Clinical Performance
          </p>
          <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full w-4/5 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full" />
          </div>
        </div>

        {/* Timeline */}
        <p className="text-xs tracking-widest text-slate-400 uppercase mb-4">
          Your Decision Path
        </p>
        <div className="flex flex-col gap-4 mb-8">
          {[
            { icon: "✓", color: "emerald", action: "History Taking", note: "Good — identified cardiac risk factors and radiation pattern correctly." },
            { icon: "✓", color: "emerald", action: "Ordered ECG + Troponin", note: "Correct. ST elevation V1–V4. Troponin markedly elevated." },
            { icon: "!", color: "amber", action: "Ordered 2D Echo first", note: "Unnecessary delay. Echo must never delay Cath Lab activation in STEMI." },
            { icon: "✓", color: "emerald", action: "Dual Antiplatelet + Heparin", note: "Correct. Standard of care for STEMI." },
            { icon: "✓", color: "emerald", action: "Cath Lab Activated", note: "Primary PCI within 74 minutes. Target is 90 min. Well done." },
          ].map((item, i) => (
            <div key={i} className="flex gap-4">
              <div className={`h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                item.color === "emerald"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-600"
                  : "bg-amber-50 border border-amber-200 text-amber-600"
              }`}>
                {item.icon}
              </div>
              <div className="pt-1">
                <p className="text-sm font-semibold text-slate-900 mb-1">{item.action}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{item.note}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Ideal approach */}
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 mb-10">
          <p className="text-xs tracking-widest text-blue-400 uppercase mb-3">Ideal Approach</p>
          <p className="text-sm text-slate-600 leading-relaxed">
            In suspected STEMI —{" "}
            <strong className="text-slate-800">ECG within 10 minutes</strong> is mandatory. Once ST elevation confirmed,{" "}
            <strong className="text-slate-800">activate Cath Lab immediately.</strong> Start dual antiplatelet and anticoagulation simultaneously. 2D Echo must never delay reperfusion.
          </p>
        </div>

        <a
          href="/reception"
          className="block text-center px-10 py-4 rounded-2xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 mb-3"
        >
          Start Next Case →
        </a>
        <a
          href="/"
          className="block text-center px-10 py-4 rounded-2xl border border-slate-200 text-slate-400 text-sm font-medium hover:border-slate-300 hover:text-slate-600 transition-all"
        >
          Return to Home
        </a>
      </div>
    </main>
  );
}
