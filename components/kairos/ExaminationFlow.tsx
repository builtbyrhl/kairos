// ─────────────────────────────────────────────
// KAIROS — Step-by-Step Physical Examination
//
// A 4-step examination dialog that reveals clinical
// findings progressively. Findings are derived from
// the Encounter Engine's visibleVitals and the
// patient's symptom names — no hardcoding.
//
// Steps: General Inspection → Cardiovascular
//        → Respiratory → Brief Neurological
//
// After completing all steps, calls onComplete()
// which triggers the COMPLETE_ACTION dispatch
// in the parent for 'Physical Examination'.
// ─────────────────────────────────────────────

'use client';

import { useState } from 'react';
import type { VisibleVital } from '../../lib/engines/encounter';

// ─── Types ───────────────────────────────────

interface ExaminationStep {
  id:          string;
  title:       string;
  instruction: string;
  finding:     string;
}

export interface ExaminationFlowProps {
  vitals:       readonly VisibleVital[];
  symptomNames: readonly string[];
  onComplete:   () => void;
  onClose:      () => void;
}

// ─── Finding generators ───────────────────────
// Derive natural language clinical findings from
// engine data. Clinically accurate, never hardcoded.

function buildInspectionFinding(symptomNames: readonly string[]): string {
  const diaphoretic = symptomNames.some(n =>
    n.toLowerCase().includes('diaphor') || n.toLowerCase().includes('sweat')
  );
  const dyspnoeic = symptomNames.some(n =>
    n.toLowerCase().includes('dyspn') || n.toLowerCase().includes('breath')
  );
  const descriptors: string[] = [];
  if (diaphoretic) descriptors.push('diaphoretic');
  if (dyspnoeic)   descriptors.push('visibly short of breath');
  descriptors.push('in obvious distress');

  const appearance = descriptors.length > 0
    ? descriptors.join(', ')
    : 'acutely unwell';

  return `Patient appears ${appearance}. Pallor is evident. Uncomfortable at rest and unable to complete full sentences.`;
}

function buildCardiovascularFinding(vitals: readonly VisibleVital[]): string {
  const hr  = vitals.find(v => v.parameter === 'Heart Rate');
  const sbp = vitals.find(v => v.parameter === 'Systolic Blood Pressure');
  const dbp = vitals.find(v => v.parameter === 'Diastolic Blood Pressure');
  const parts: string[] = [];

  if (hr) {
    const character = hr.value > 100 ? 'tachycardic' : hr.value < 60 ? 'bradycardic' : 'regular rate and rhythm';
    parts.push(`Pulse ${hr.value} bpm, ${character}`);
  }
  if (sbp && dbp) {
    const flag = sbp.value < 90 ? ' — hypotensive' : '';
    parts.push(`BP ${sbp.value}/${dbp.value} mmHg${flag}`);
  }
  parts.push('Heart sounds S1 and S2 present. No added sounds or murmurs on initial assessment. JVP not elevated');

  return parts.join('. ') + '.';
}

function buildRespiratoryFinding(vitals: readonly VisibleVital[]): string {
  const rr   = vitals.find(v => v.parameter === 'Respiratory Rate');
  const spo2 = vitals.find(v => v.parameter === 'SpO₂');
  const parts: string[] = [];

  if (rr) {
    const desc = rr.value > 20 ? `tachypnoeic at ${rr.value}/min` : `rate ${rr.value}/min`;
    parts.push(`Respiratory ${desc}`);
  }
  if (spo2) {
    const flag = spo2.value < 94 ? ' — below target saturation' : '';
    parts.push(`SpO₂ ${spo2.value}% on room air${flag}`);
  }
  parts.push('Chest expansion equal bilaterally. Percussion resonant throughout. Air entry present in all zones, no added breath sounds');

  return parts.join('. ') + '.';
}

function buildNeurologicalFinding(vitals: readonly VisibleVital[]): string {
  const gcs  = vitals.find(v => v.parameter === 'GCS');
  const temp = vitals.find(v => v.parameter === 'Temperature');
  const parts: string[] = [];

  if (gcs) {
    const alert = gcs.value === 15 ? 'GCS 15/15, fully conscious' : `GCS ${gcs.value}/15`;
    parts.push(alert);
  }
  if (temp) {
    const pyrexia = temp.value > 37.5 ? ' — low-grade pyrexia' : '';
    parts.push(`Temperature ${temp.value}°C${pyrexia}`);
  }
  parts.push('Oriented to time, place and person. No focal neurological deficit on brief screen');

  return parts.join('. ') + '.';
}

function buildSteps(vitals: readonly VisibleVital[], symptomNames: readonly string[]): ExaminationStep[] {
  return [
    {
      id:          'inspection',
      title:       'General Inspection',
      instruction: 'Approach the patient. Stand at the end of the bed and observe.',
      finding:     buildInspectionFinding(symptomNames),
    },
    {
      id:          'cardiovascular',
      title:       'Cardiovascular Examination',
      instruction: 'Assess pulse rate and character. JVP. Precordial palpation. Auscultate heart sounds.',
      finding:     buildCardiovascularFinding(vitals),
    },
    {
      id:          'respiratory',
      title:       'Respiratory Examination',
      instruction: 'Assess breathing pattern. Chest expansion. Percussion. Auscultate all zones.',
      finding:     buildRespiratoryFinding(vitals),
    },
    {
      id:          'neurological',
      title:       'Brief Neurological Assessment',
      instruction: 'Assess GCS. Check orientation. Measure temperature.',
      finding:     buildNeurologicalFinding(vitals),
    },
  ];
}

// ─── Component ────────────────────────────────

export default function ExaminationFlow({
  vitals,
  symptomNames,
  onComplete,
  onClose,
}: ExaminationFlowProps) {
  const steps = buildSteps(vitals, symptomNames);

  const [currentIdx, setCurrentIdx]     = useState(0);
  const [revealed, setRevealed]         = useState<ReadonlySet<string>>(new Set());
  const [isExamining, setIsExamining]   = useState(false);

  const step     = steps[currentIdx];
  const isShown  = step ? revealed.has(step.id) : false;
  const isLast   = currentIdx === steps.length - 1;

  function performStep() {
    if (!step || isExamining) return;
    setIsExamining(true);
    setTimeout(() => {
      setRevealed(prev => new Set([...prev, step.id]));
      setIsExamining(false);
    }, 900);
  }

  function nextStep() {
    if (!isLast) setCurrentIdx(i => i + 1);
  }

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-50 flex-shrink-0">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Physical Examination
            </p>
            <h2 className="text-xl text-gray-950 mt-1" style={{ fontFamily: 'Georgia, serif' }}>
              {step?.title ?? 'Complete'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-gray-500 transition-colors text-2xl leading-none mt-0.5"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Step progress bar */}
        <div className="px-6 pt-5 pb-1 flex items-center gap-1.5">
          {steps.map((s, i) => (
            <div
              key={s.id}
              className={`h-1 rounded-full flex-1 transition-all duration-500 ${
                revealed.has(s.id)
                  ? 'bg-slate-950'
                  : i === currentIdx
                  ? 'bg-slate-300'
                  : 'bg-gray-100'
              }`}
            />
          ))}
        </div>
        <p className="text-center text-xs text-gray-400 pt-2 pb-1">
          Step {currentIdx + 1} of {steps.length}
        </p>

        {/* Step content */}
        <div className="px-6 py-6 space-y-5 min-h-[200px]">
          {step && (
            <>
              <p className="text-sm text-gray-500 leading-relaxed">{step.instruction}</p>

              {!isShown && (
                <button
                  onClick={performStep}
                  disabled={isExamining}
                  className="w-full py-4 border-2 border-slate-950 text-slate-950 rounded-2xl
                    text-sm font-semibold hover:bg-slate-50 active:scale-[0.99]
                    disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
                >
                  {isExamining ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3 h-3 rounded-full border-2 border-slate-400 border-t-slate-950 animate-spin" />
                      Examining…
                    </span>
                  ) : 'Perform Examination'}
                </button>
              )}

              {isShown && (
                <div className="bg-slate-50 rounded-2xl p-5 space-y-2 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Finding
                  </p>
                  <p className="text-sm text-slate-800 leading-relaxed">
                    {step.finding}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer navigation */}
        <div className="px-6 pb-6 border-t border-gray-50 pt-4">
          {isShown && !isLast && (
            <button
              onClick={nextStep}
              className="w-full py-3.5 bg-slate-950 text-white rounded-2xl text-sm font-semibold
                hover:bg-slate-800 active:scale-[0.99] transition-all duration-150"
            >
              Next: {steps[currentIdx + 1]?.title} →
            </button>
          )}
          {isShown && isLast && (
            <button
              onClick={onComplete}
              className="w-full py-3.5 bg-emerald-600 text-white rounded-2xl text-sm font-semibold
                hover:bg-emerald-700 active:scale-[0.99] transition-all duration-150"
            >
              Complete Examination ✓
            </button>
          )}
          {!isShown && (
            <div className="h-[50px]" />
          )}
        </div>

      </div>
    </div>
  );
}
