'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { useRouter } from 'next/navigation';

// ─── Landing cinematics (module-scope, side-effecting) ───
// Kept outside the component so the React purity/compiler
// rules do not treat these timer/audio helpers as render logic.

type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };

// Self-scheduling physiological ECG beat. Randomised interval
// gives a natural rhythm with subtle jitter.
function scheduleEcgBeat(
  pulseRef:         RefObject<SVGPathElement | null>,
  timeoutRef:       RefObject<NodeJS.Timeout | null>,
  transitioningRef: RefObject<boolean>,
  isStrongBeat = false,
): void {
  if (transitioningRef.current) return;

  const line = pulseRef.current;
  if (line) {
    line.classList.remove('pulse-sweep', 'pulse-strong');
    void (line as unknown as HTMLElement).offsetWidth; // Force reflow
    line.classList.add(isStrongBeat ? 'pulse-strong' : 'pulse-sweep');
  }

  const physiologicalJitter = (Math.random() * 120) - 60;
  const nextInterval = 1010 + physiologicalJitter;

  if (timeoutRef.current) clearTimeout(timeoutRef.current);
  timeoutRef.current = setTimeout(() => {
    scheduleEcgBeat(pulseRef, timeoutRef, transitioningRef, false);
  }, nextInterval);
}

// Short 880Hz clinical monitor beep. Reuses a single AudioContext
// so repeated beeps never leak new contexts.
function emitClinicalMonitorBeep(audioCtxRef: RefObject<AudioContext | null>): void {
  try {
    if (!audioCtxRef.current) {
      const Ctor = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
      if (!Ctor) return;
      audioCtxRef.current = new Ctor();
    }
    const audioCtx = audioCtxRef.current;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880.0, audioCtx.currentTime);

    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.03, audioCtx.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.6);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.75);
  } catch {
    console.warn('Audio permissions deferred context creation.');
  }
}

export default function LandingPage() {
  const router = useRouter();
  const activePulseLineRef = useRef<SVGPathElement>(null);
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const initMetadataRef = useRef<HTMLDivElement>(null);
  const thresholdShroudRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  
  const isTransitioningRef = useRef(false);
  const ecgTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastHoverTimeRef = useRef<number>(0);

  // ECG rhythm + monitor audio live in the module-scope helpers above.

  // Update clocks
  const updateClocks = () => {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    const timestampEl = document.getElementById('timestamp');
    if (timestampEl) timestampEl.innerText = timeString;
  };

  // Handle button click (transition sequence)
  const handleBeginShift = () => {
    if (isTransitioningRef.current) return;

    isTransitioningRef.current = true;
    if (ecgTimeoutRef.current) clearTimeout(ecgTimeoutRef.current);

    const body = document.body;

    // Phase 1: Commitment (0.0s - 0.6s)
    body.classList.add('p1-commitment');

    // Phase 2: Environmental Dissolve (0.6s - 2.0s)
    setTimeout(() => {
      body.classList.remove('p1-commitment');
      body.classList.add('p2-environmental-shift');
    }, 600);

    // Phase 3: Single Diagnostic Cardiac Pulse (2.0s - 3.5s)
    setTimeout(() => {
      body.classList.add('p3-heartbeat');
      if (activePulseLineRef.current) {
        activePulseLineRef.current.classList.remove('pulse-sweep', 'pulse-strong');
        void (activePulseLineRef.current as unknown as HTMLElement).offsetWidth;
        activePulseLineRef.current.classList.add('pulse-active');
      }
      setTimeout(() => emitClinicalMonitorBeep(audioCtxRef), 400);
    }, 2000);

    // Phase 4: Clinical Systems Initialization (3.5s - 5.5s)
    setTimeout(() => {
      body.classList.remove('p3-heartbeat');
      body.classList.add('p4-systems-initialize');

      const lines = ['line1', 'line2', 'line3', 'line4', 'line5'];
      lines.forEach((id, index) => {
        setTimeout(() => {
          const lineEl = document.getElementById(id);
          if (lineEl) lineEl.classList.add('active');
        }, index * 450);
      });
    }, 3500);

    // Phase 5: Crossing The Threshold (5.5s - 6.5s)
    setTimeout(() => {
      body.classList.add('p5-threshold');
    }, 5500);

    // Phase 6: Cross the threshold into the live shift.
    // The white threshold shroud (Phase 5) is fully up here, so the
    // route change is visually masked. Reception generates the case
    // through the engines and hands off to the patient room.
    setTimeout(() => {
      body.classList.remove(
        'p1-commitment',
        'p2-environmental-shift',
        'p3-heartbeat',
        'p4-systems-initialize',
        'p5-threshold',
      );
      router.push('/reception');
    }, 6300);
  };

  // Handle hover on button
  const handleButtonHover = () => {
    if (isTransitioningRef.current) return;
    const now = Date.now();

    if (now - lastHoverTimeRef.current < 950) return;
    lastHoverTimeRef.current = now;

    if (ecgTimeoutRef.current) clearTimeout(ecgTimeoutRef.current);
    scheduleEcgBeat(activePulseLineRef, ecgTimeoutRef, isTransitioningRef, true);
  };

  // Initialize on mount
  useEffect(() => {
    const ecgTimeout = ecgTimeoutRef;
    scheduleEcgBeat(activePulseLineRef, ecgTimeout, isTransitioningRef, false);
    const clockInterval = setInterval(updateClocks, 1000);
    updateClocks();

    return () => {
      clearInterval(clockInterval);
      if (ecgTimeout.current) clearTimeout(ecgTimeout.current);
    };
  }, []);

  return (
    <>
      {/* Solid White Gatekeeping Screen (Phase 5) */}
      <div className="threshold-shroud" ref={thresholdShroudRef} id="thresholdShroud" />

      {/* Active Environment Blueprint Layer */}
      <div className="ambient-environment" id="ambientEnv">
        <svg
          className="blueprint-overlay"
          id="blueprint"
          viewBox="0 0 1920 1080"
          preserveAspectRatio="none"
        >
          <path
            d="M 80,40 L 80,1040 M 1840,40 L 1840,1040 M 80,160 L 1840,160 M 80,920 L 1840,920"
            stroke="rgba(10, 17, 40, 0.01)"
            strokeWidth="0.5"
            fill="none"
          />
          <path
            d="M 960,140 L 960,180 M 940,160 L 980,160"
            stroke="rgba(0, 102, 255, 0.012)"
            strokeWidth="0.75"
          />
          <path
            d="M 400,540 L 420,540 M 410,530 L 410,550"
            stroke="rgba(10, 17, 40, 0.008)"
            strokeWidth="0.5"
          />
          <path
            d="M 1520,540 L 1540,540 M 1530,530 L 1530,550"
            stroke="rgba(10, 17, 40, 0.008)"
            strokeWidth="0.5"
          />
          <rect
            x="120"
            y="200"
            width="1680"
            height="680"
            rx="6"
            stroke="rgba(10, 17, 40, 0.004)"
            strokeWidth="0.5"
            fill="none"
          />
          <text
            x="140"
            y="230"
            fill="rgba(10, 17, 40, 0.012)"
            fontSize="9"
            fontFamily="monospace"
            letterSpacing="0.1em"
          >
            CLINICAL BAY SEGMENT 04B
          </text>
          <text
            x="1780"
            y="230"
            fill="rgba(10, 17, 40, 0.012)"
            fontSize="9"
            fontFamily="monospace"
            letterSpacing="0.1em"
            textAnchor="end"
          >
            SYS_KAIROS_RECEPTION
          </text>
        </svg>
        <div className="ambient-glow-primary" />
      </div>

      {/* Master Landing Page Layout */}
      <header id="landingHeader">
        <a href="https://kairosdx.vercel.app" className="nav-brand">
          Kairos
        </a>
        <nav className="nav-links-capsule">
          <a href="https://kairosdx.vercel.app" className="capsule-link">
            Guide
          </a>
          <a href="https://kairosdx.vercel.app" className="capsule-link">
            Feedback
          </a>
        </nav>
      </header>

      <main id="landingMain">
        <section className="brand-axis" id="brandAxis">
          <div className="title-group" id="titleGroup">
            <h1 className="hero-title" id="heroTitle">
              Kairos
              <div className="brand-vertex" id="brandVertex" />
            </h1>
            <div className="ecg-signature-container" id="ecgWrapper">
              <svg className="ecg-svg" viewBox="0 0 600 40" preserveAspectRatio="none">
                <path
                  className="ecg-line-static"
                  d="M 0,20 L 240,20 C 243,20 245,17 247,17 C 249,17 251,20 254,20 L 264,20 L 267,23 L 273,2 L 279,38 L 283,20 L 295,20 C 298,20 301,14 305,14 C 309,14 312,20 315,20 L 600,20"
                />
                <path
                  className="ecg-line-active"
                  ref={activePulseLineRef}
                  id="activePulseLine"
                  d="M 0,20 L 240,20 C 243,20 245,17 247,17 C 249,17 251,20 254,20 L 264,20 L 267,23 L 273,2 L 279,38 L 283,20 L 295,20 C 298,20 301,14 305,14 C 309,14 312,20 315,20 L 600,20"
                />
              </svg>
            </div>
          </div>
          <p className="tagline">Every decision shapes an outcome.</p>
          <div className="action-space">
            <button
              className="btn-action"
              id="actionTrigger"
              ref={triggerRef}
              onClick={handleBeginShift}
              onMouseEnter={handleButtonHover}
            >
              Begin Shift
            </button>
          </div>
        </section>

        {/* Dynamic Secondary Ambient Patient Dossier Card */}
        <section className="atmospheric-peripheral" id="dynamicPeripheral">
          <div className="patient-ghost-card">
            <div className="card-row-top">
              <span className="meta-label">Incoming Case</span>
              <div className="triage-indicator-ambient">
                <span className="triage-pulse-dot" />
                Classified
              </div>
            </div>
            <div className="demographics-container">
              <h3 className="demographics-primary">Awaiting Assignment</h3>
              <span className="demographics-sub">Authorization Required</span>
            </div>
            <div className="complaint-block">
              <span className="meta-label">Dossier Integrity</span>
              <span className="complaint-val">Encrypted // Hash 8F-991X</span>
            </div>
          </div>
        </section>
      </main>

      <footer id="landingFooter">
        <span className="footer-text">Omniscia Initiative</span>
        <span className="footer-text">© 2026</span>
      </footer>

      {/* System Terminal Overlay (Phase 4) */}
      <div className="terminal-container" ref={terminalContainerRef} id="terminalContainer">
        <div className="terminal-content">
          <div className="terminal-line" id="line1">
            <span className="terminal-dot" />
            Initializing Shift...
          </div>
          <div className="terminal-line" id="line2">
            <span className="terminal-dot" />
            Loading Hospital Engine...
          </div>
          <div className="terminal-line" id="line3">
            <span className="terminal-dot" />
            Connecting to Emergency Department...
          </div>
          <div className="terminal-line" id="line4">
            <span className="terminal-dot" />
            Retrieving Patient Queue...
          </div>
          <div className="terminal-line ready" id="line5">
            <span className="terminal-dot" />
            Shift Ready.
          </div>
        </div>
      </div>

      {/* Initialization Metadata */}
      <div className="init-metadata-container" ref={initMetadataRef} id="initMetadata">
        <div className="metadata-column">
          <span>LOCATION COORDINATES</span>
          <span className="metadata-val">BAY 04 — SECTOR B // METRO</span>
        </div>
        <div className="metadata-column" style={{ textAlign: 'right' }}>
          <span>OPERATIONAL SHIFT TIME</span>
          <span className="metadata-val" id="timestamp">
            08:42:11 AM
          </span>
        </div>
      </div>
    </>
  );
}
