// ─────────────────────────────────────────────
// KAIROS — Ambient Context
//
// The ONLY impure part of the Ambient Engine: a single
// interval that dispatches TICK actions into the pure
// reducer. Everything else is deterministic.
//
// Architecture rules (mirror SessionContext):
//   • This file may import from engines.
//   • Engines must NEVER import from this file.
//   • The interval cadence comes from config, never hardcoded.
//   • Ticking pauses when the tab is hidden and resumes on focus.
// ─────────────────────────────────────────────

'use client';

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
} from 'react';

import {
  createAmbient,
  advanceAmbient,
  DEFAULT_AMBIENT_CONFIG,
} from '../engines/ambient';
import type {
  AmbientState,
  AmbientAction,
  AmbientConfig,
} from '../engines/ambient';

// ─── Context value ────────────────────────────

interface AmbientContextValue {
  readonly state:    AmbientState;
  readonly dispatch: React.Dispatch<AmbientAction>;
}

const AmbientContext = createContext<AmbientContextValue | null>(null);

// ─── Provider ─────────────────────────────────

interface AmbientProviderProps {
  readonly children: ReactNode;
  /** Optional override for tests / custom balance. */
  readonly config?: AmbientConfig;
  /** Optional deterministic seed. */
  readonly seed?:   number;
}

export function AmbientProvider({
  children,
  config = DEFAULT_AMBIENT_CONFIG,
  seed   = 1,
}: AmbientProviderProps) {
  const [state, dispatch] = useReducer(
    advanceAmbient,
    undefined,
    () => createAmbient(config, seed),
  );

  // Single ambient interval — the one impurity of the engine.
  // Re-subscribes only when the configured cadence changes.
  const cadenceMs = state.config.clock.tickIntervalMs;
  useEffect(() => {
    if (cadenceMs <= 0) return;

    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      dispatch({ type: 'TICK' });
    }, cadenceMs);

    return () => clearInterval(id);
  }, [cadenceMs]);

  // Pause/resume around tab visibility so the world doesn't
  // silently race ahead while the student is away.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    function onVisibility() {
      dispatch({ type: document.hidden ? 'PAUSE' : 'RESUME' });
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return (
    <AmbientContext.Provider value={{ state, dispatch }}>
      {children}
    </AmbientContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────

export function useAmbient(): AmbientContextValue {
  const ctx = useContext(AmbientContext);
  if (!ctx) {
    throw new Error('useAmbient must be called inside <AmbientProvider>');
  }
  return ctx;
}
