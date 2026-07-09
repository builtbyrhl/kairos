// ─────────────────────────────────────────────
// KAIROS — Landing Page
//
// One purpose: curiosity.
// Not marketing. Not features. Not explanation.
// Just the feeling that this is different.
// ─────────────────────────────────────────────

import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white flex flex-col">

      {/* Ambient gradient — barely visible, intentional */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none select-none"
        style={{
          background:
            'radial-gradient(ellipse 130% 70% at 50% -5%, rgba(15,23,42,0.055) 0%, transparent 62%)',
        }}
      />

      {/* Core content — centred, nothing else */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center relative z-10">

        {/* Wordmark */}
        <h1
          className="text-[4.5rem] sm:text-[6.5rem] md:text-[8rem] leading-none
            text-slate-950 tracking-[-0.04em] select-none mb-6"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 300 }}
        >
          Kairos
        </h1>

        {/* Tagline */}
        <p
          className="text-lg sm:text-xl md:text-2xl text-slate-400 font-light leading-relaxed
            mb-14 max-w-xs sm:max-w-sm"
        >
          Become the doctor<br />
          patients believe you are.
        </p>

        {/* Single CTA */}
        <Link
          href="/reception"
          className="inline-flex items-center gap-3 px-8 py-4 bg-slate-950 text-white
            rounded-2xl text-[0.9rem] font-medium tracking-wide
            hover:bg-slate-800 active:scale-[0.99]
            transition-all duration-200 shadow-xl shadow-slate-950/15"
        >
          Enter Hospital
          <span className="opacity-50 text-sm">→</span>
        </Link>

      </div>

      {/* Manifesto — bottom, small, confident */}
      <footer className="relative z-10 text-center pb-8 pt-6">
        <p className="text-[0.65rem] text-slate-200 tracking-[0.25em] uppercase select-none">
          Free to kill. Free to learn.
        </p>
      </footer>

    </main>
  );
}
