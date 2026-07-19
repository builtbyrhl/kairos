// ─────────────────────────────────────────────
// KAIROS — Conversational History Taking
//
// A data-driven patient interview component.
// Questions are derived from Disease Engine data.
// Patient responses use actual patientPhrase fields.
// Comorbidity responses are generated from PatientSummary.
//
// Architecture note:
// This component accepts props — it never imports
// from SessionContext directly. This keeps it
// reusable across any disease and ready for
// AI response injection when Gemini integrates.
// ─────────────────────────────────────────────

'use client';

import { useState } from 'react';
import type { SelectedSymptom } from '../../lib/engines/patient';
import type { PatientSummary }   from '../../lib/engines/encounter';

// ─── Internal types ───────────────────────────

interface HistoryQuestion {
  id:             string;
  doctorQuestion: string;
  patientResponse: string;
  category:       'presenting' | 'background';
  isRedFlag:      boolean;
}

export interface HistoryConversationProps {
  patientName:    string;
  symptoms:       readonly SelectedSymptom[];
  patientSummary: PatientSummary;
  onComplete:     () => void;
  onClose:        () => void;
}

// ─── Question generation ──────────────────────
// Maps symptom names to natural doctor questions.
// Extendable as new diseases are added.

const SYMPTOM_QUESTION_MAP: Readonly<Record<string, string>> = {
  'Chest Pain':       'Can you describe this chest pain for me?',
  'Dyspnoea':         'Are you having any difficulty breathing?',
  'Diaphoresis':      'Are you sweating more than usual?',
  'Nausea':           'Are you feeling sick to your stomach?',
  'Vomiting':         'Have you been vomiting?',
  'Jaw Pain':         'Do you have any pain spreading to your jaw or neck?',
  'Arm Pain':         'Is the pain radiating to your arm?',
  'Palpitations':     'Have you noticed your heart racing or beating irregularly?',
  'Syncope':          'Have you fainted or felt like you were going to faint?',
  'Fatigue':          'Have you been unusually tired today?',
  'Epigastric Pain':  'Any pain in your stomach area?',
};

function buildPMHResponse(s: PatientSummary): string {
  const conditions: string[] = [];
  if (s.hasDiabetes)     conditions.push('diabetes');
  if (s.hasHypertension) conditions.push('high blood pressure');
  if (s.hasPreviousMI)   conditions.push('a heart attack some years ago');
  if (conditions.length === 0) return "Nothing significant — I've been quite healthy until now.";
  if (conditions.length === 1) return `Yes, I have ${conditions[0]}.`;
  return `Yes — ${conditions.slice(0, -1).join(', ')} and ${conditions[conditions.length - 1]}.`;
}

function buildMedicationResponse(s: PatientSummary): string {
  const meds: string[] = [];
  if (s.hasDiabetes)     meds.push('metformin for my diabetes');
  if (s.hasHypertension) meds.push('amlodipine for blood pressure');
  if (meds.length === 0) return "No, nothing regular.";
  return `I take ${meds.join(' and ')}.`;
}

function buildAllQuestions(
  symptoms: readonly SelectedSymptom[],
  summary:  PatientSummary,
): HistoryQuestion[] {
  const presenting: HistoryQuestion[] = symptoms.map(s => ({
    id:             `sym_${s.id}`,
    doctorQuestion: SYMPTOM_QUESTION_MAP[s.name] ?? `Tell me more about your ${s.name.toLowerCase()}.`,
    patientResponse: s.patientPhrase,
    category:       'presenting',
    isRedFlag:      s.isRedFlag,
  }));

  const background: HistoryQuestion[] = [
    {
      id: 'q_smoke',
      doctorQuestion: 'Do you smoke?',
      patientResponse: summary.isSmoker
        ? 'Yes... about a pack a day for the last twenty years or so.'
        : "No, never smoked.",
      category: 'background', isRedFlag: false,
    },
    {
      id: 'q_pmh',
      doctorQuestion: 'Any existing medical conditions?',
      patientResponse: buildPMHResponse(summary),
      category: 'background', isRedFlag: false,
    },
    {
      id: 'q_meds',
      doctorQuestion: 'Are you on any regular medications?',
      patientResponse: buildMedicationResponse(summary),
      category: 'background', isRedFlag: false,
    },
    {
      id: 'q_family',
      doctorQuestion: 'Any family history of heart problems?',
      patientResponse: "My father had a heart attack in his early fifties. It's always been on my mind.",
      category: 'background', isRedFlag: false,
    },
    {
      id: 'q_allergies',
      doctorQuestion: 'Any known drug allergies?',
      patientResponse: "Not that I know of.",
      category: 'background', isRedFlag: false,
    },
  ];

  return [...presenting, ...background];
}

// ─── Component ────────────────────────────────

export default function HistoryConversation({
  patientName,
  symptoms,
  patientSummary,
  onComplete,
  onClose,
}: HistoryConversationProps) {
  const questions = buildAllQuestions(symptoms, patientSummary);

  const [asked, setAsked]             = useState<ReadonlySet<string>>(new Set());
  const [activeId, setActiveId]       = useState<string | null>(null);

  function askQuestion(q: HistoryQuestion) {
    setAsked(prev => new Set([...prev, q.id]));
    setActiveId(q.id);
  }

  const presenting   = questions.filter(q => q.category === 'presenting');
  const background   = questions.filter(q => q.category === 'background');
  const activeQuestion = questions.find(q => q.id === activeId);
  const minRequired  = Math.min(2, presenting.length);
  const askedPresenting = presenting.filter(q => asked.has(q.id)).length;
  const canComplete  = askedPresenting >= minRequired;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-50 flex-shrink-0">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              History Taking
            </p>
            <h2 className="text-xl text-gray-950 mt-1" style={{ fontFamily: 'Georgia, serif' }}>
              {patientName}
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

        {/* Active patient response */}
        {activeQuestion && (
          <div className="flex-shrink-0 px-6 py-4 bg-blue-50/70 border-b border-blue-100/60">
            <p className="text-xs font-medium text-blue-400 mb-1.5">
              You: <span className="italic text-blue-600">&ldquo;{activeQuestion.doctorQuestion}&rdquo;</span>
            </p>
            <p className="text-sm text-blue-900 leading-relaxed italic">
              &ldquo;{activeQuestion.patientResponse}&rdquo;
            </p>
          </div>
        )}

        {/* Question list */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Presenting Complaint
            </p>
            <div className="space-y-2">
              {presenting.map(q => {
                const isAsked = asked.has(q.id);
                const isActive = activeId === q.id;
                return (
                  <button
                    key={q.id}
                    onClick={() => askQuestion(q)}
                    className={`w-full text-left px-4 py-3 rounded-2xl text-sm transition-all duration-150 border ${
                      isAsked
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                        : isActive
                        ? 'bg-blue-50 border-blue-100 text-blue-900'
                        : 'bg-gray-50 border-transparent text-gray-700 hover:bg-gray-100 active:scale-[0.99]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isAsked
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-gray-300'
                      }`}>
                        {isAsked && <span className="text-xs leading-none">✓</span>}
                      </span>
                      <span className={q.isRedFlag && !isAsked ? 'font-medium' : ''}>
                        {q.doctorQuestion}
                      </span>
                      {q.isRedFlag && !isAsked && (
                        <span className="ml-auto text-xs text-red-400 flex-shrink-0 font-medium">
                          Key
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Background History
            </p>
            <div className="space-y-2">
              {background.map(q => {
                const isAsked = asked.has(q.id);
                return (
                  <button
                    key={q.id}
                    onClick={() => askQuestion(q)}
                    className={`w-full text-left px-4 py-3 rounded-2xl text-sm transition-all duration-150 border ${
                      isAsked
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                        : 'bg-gray-50 border-transparent text-gray-700 hover:bg-gray-100 active:scale-[0.99]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        isAsked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300'
                      }`}>
                        {isAsked && <span className="text-xs leading-none">✓</span>}
                      </span>
                      {q.doctorQuestion}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 pt-4 pb-6 border-t border-gray-50 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {asked.size} of {questions.length} questions asked
            </p>
            {!canComplete && (
              <p className="text-xs text-gray-400">
                Ask about the presenting complaint first
              </p>
            )}
          </div>
          <button
            onClick={onComplete}
            disabled={!canComplete}
            className="w-full py-3.5 bg-slate-950 text-white rounded-2xl text-sm font-semibold
              hover:bg-slate-800 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-150"
          >
            Complete History Taking
          </button>
        </div>

      </div>
    </div>
  );
}
