import { Disease } from "../../../../engines/disease/types";
import {
  Severity,
  InvestigationType,
  InvestigationPriority,
  InvestigationTiming,
  UnlockMethod,
  Reliability,
  ClinicalImportance,
  Interpretation,
  InfarctLocation,
} from "../../../../types/enums";

export const investigations: Disease["investigations"] = [

  // ─── 1. 12-Lead ECG ────────────────────────
  {
    id:           "ecg_12lead",
    name:         "12-Lead ECG",
    type:         InvestigationType.Bedside,
    priority:     InvestigationPriority.Mandatory,
    timing:       InvestigationTiming.Immediate,
    unlockMethod: UnlockMethod.Always,
    reliability:  Reliability.High,
    probability:  1.0,
    falsePositives: [
      "Left bundle branch block — may mimic or mask STEMI",
      "Early repolarisation pattern in young patients",
      "Pericarditis — diffuse saddle-shaped ST elevation",
      "Takotsubo cardiomyopathy",
      "Hyperkalaemia — may cause ST changes",
    ],
    results: {
      normal: {
        severity:         "normal",
        findings:         [],
        ecgFindings: [
          {
            leads:              ["all"],
            finding:            "Normal sinus rhythm. No ST deviation. No Q waves.",
            interpretation:     Interpretation.Normal,
            probability:        0.95,
            severity:           [],
            clinicalImportance: ClinicalImportance.High,
          },
        ],
        educationalNotes:
          "A normal ECG in the first 30 minutes does not exclude STEMI. Repeat at 15–30 minute intervals if clinical suspicion remains high.",
      },
      mild: {
        severity:         Severity.Mild,
        findings:         [],
        ecgFindings: [
          {
            leads:              ["V1", "V2", "V3", "V4"],
            finding:            "Hyperacute T waves. ST elevation 1–2mm.",
            interpretation:     Interpretation.Elevated,
            probability:        0.80,
            severity:           [Severity.Mild],
            clinicalImportance: ClinicalImportance.Critical,
          },
        ],
        educationalNotes:
          "Hyperacute T waves may precede classical ST elevation. Do not wait for more pronounced changes before activating the Cath Lab.",
      },
      moderate: {
        severity:         Severity.Moderate,
        findings:         [],
        ecgFindings: [
          {
            leads:              ["V1", "V2", "V3", "V4"],
            finding:            "ST elevation >2mm in contiguous precordial leads.",
            interpretation:     Interpretation.Critical,
            probability:        0.95,
            severity:           [Severity.Moderate],
            clinicalImportance: ClinicalImportance.Critical,
          },
          {
            leads:              ["II", "III", "aVF"],
            finding:            "Reciprocal ST depression in inferior leads.",
            interpretation:     Interpretation.Reduced,
            probability:        0.80,
            severity:           [Severity.Moderate],
            clinicalImportance: ClinicalImportance.High,
          },
        ],
        educationalNotes:
          "Classical anterior STEMI pattern. Reciprocal changes in inferior leads confirm the diagnosis. Immediate Cath Lab activation is required.",
      },
      severe: {
        severity:         Severity.Severe,
        findings:         [],
        ecgFindings: [
          {
            leads:              ["V1", "V2", "V3", "V4"],
            finding:            "Marked ST elevation with pathological Q waves developing.",
            interpretation:     Interpretation.Critical,
            probability:        0.90,
            severity:           [Severity.Severe],
            clinicalImportance: ClinicalImportance.Critical,
          },
          {
            leads:              ["all"],
            finding:            "Ventricular arrhythmia.",
            interpretation:     Interpretation.Present,
            probability:        0.40,
            severity:           [Severity.Severe],
            clinicalImportance: ClinicalImportance.Critical,
          },
          {
            leads:              ["II", "III", "aVF"],
            finding:            "Complete AV block in inferior territory infarction.",
            interpretation:     Interpretation.Present,
            probability:        0.25,
            severity:           [Severity.Severe],
            clinicalImportance: ClinicalImportance.Critical,
            locationDependency: [InfarctLocation.Inferior],
          },
        ],
        educationalNotes:
          "Extensive infarction with electrical instability. Q waves indicate irreversible myocardial necrosis. Defibrillator must be immediately available.",
      },
    },
    redFlagFindings: [
      "ST elevation in two or more contiguous leads",
      "New ventricular tachycardia or fibrillation",
      "Complete AV block",
      "New left bundle branch block with chest pain",
    ],
    specialNotes: [
      "Must be obtained and interpreted within 10 minutes of first medical contact.",
      "Infarct location is stored internally and used by engines — not revealed to student unless ECG is interpreted correctly.",
      "Serial ECGs increase diagnostic sensitivity in early presentations.",
      "Hospital Engine will render as an interactive ECG viewer in future versions.",
    ],
  },

  // ─── 2. Troponin I ──────────────────────────
  {
    id:           "troponin_i",
    name:         "Troponin I",
    type:         InvestigationType.Lab,
    priority:     InvestigationPriority.Mandatory,
    timing:       InvestigationTiming.Immediate,
    unlockMethod: UnlockMethod.Always,
    reliability:  Reliability.High,
    probability:  1.0,
    kineticProfile: {
      riseOnset:  { hoursAfterEvent: { min: 3,   max: 6   } },
      peak:       { hoursAfterEvent: { min: 12,  max: 24  } },
      normalises: { hoursAfterEvent: { min: 120, max: 240 } },
      note:
        "Engine re-evaluates troponin result based on clinical hours elapsed since symptom onset, not real time.",
    },
    falsePositives: [
      "Pulmonary embolism",
      "Myocarditis",
      "Sepsis with myocardial injury",
      "Renal failure",
      "Takotsubo cardiomyopathy",
      "Cardiac contusion",
    ],
    results: {
      normal: {
        severity: "normal",
        findings: [
          {
            parameter:      "Troponin I",
            range:          { min: 0.00, max: 0.04 },
            unit:           "ng/mL",
            interpretation: Interpretation.Normal,
          },
          {
            parameter:      "CK-MB",
            range:          { min: 0.00, max: 5.00 },
            unit:           "ng/mL",
            interpretation: Interpretation.Normal,
          },
        ],
        educationalNotes:
          "Normal troponin within 3 hours of symptom onset does not exclude STEMI. Repeat sampling at 3 and 6 hours is mandatory if suspicion remains.",
      },
      mild: {
        severity: Severity.Mild,
        findings: [
          {
            parameter:      "Troponin I",
            range:          { min: 0.04, max: 1.0 },
            unit:           "ng/mL",
            interpretation: Interpretation.Elevated,
          },
          {
            parameter:      "CK-MB",
            range:          { min: 5.0, max: 15.0 },
            unit:           "ng/mL",
            interpretation: Interpretation.Elevated,
          },
        ],
        educationalNotes:
          "Mild elevation consistent with early or small infarction. Do not delay primary PCI while awaiting serial troponin results.",
      },
      moderate: {
        severity: Severity.Moderate,
        findings: [
          {
            parameter:      "Troponin I",
            range:          { min: 1.0, max: 10.0 },
            unit:           "ng/mL",
            interpretation: Interpretation.Elevated,
          },
          {
            parameter:      "CK-MB",
            range:          { min: 15.0, max: 50.0 },
            unit:           "ng/mL",
            interpretation: Interpretation.Elevated,
          },
        ],
        educationalNotes:
          "Significant myocardial necrosis confirmed. Urgent reperfusion is indicated regardless of symptom duration.",
      },
      severe: {
        severity: Severity.Severe,
        findings: [
          {
            parameter:      "Troponin I",
            range:          { min: 10.0, max: 100.0 },
            unit:           "ng/mL",
            interpretation: Interpretation.Critical,
          },
          {
            parameter:      "CK-MB",
            range:          { min: 50.0, max: 500.0 },
            unit:           "ng/mL",
            interpretation: Interpretation.Critical,
          },
        ],
        educationalNotes:
          "Extensive myocardial necrosis. High risk of cardiogenic shock, arrhythmia, and mechanical complications.",
      },
    },
    redFlagFindings: [
      "Troponin I >10 ng/mL with haemodynamic instability",
      "Rising troponin with persistent ST elevation",
      "Troponin elevation with new ventricular arrhythmia",
    ],
    serialTestingRule: {
      required: true,
      repeatAt: [
        {
          hoursAfterFirst: 3,
          reason:
            "Confirm rise if first sample was drawn within 3 hours of symptom onset.",
        },
        {
          hoursAfterFirst: 6,
          reason:
            "Confirm peak and establish trajectory if diagnosis remains uncertain.",
        },
      ],
    },
    specialNotes: [
      "Never delay primary PCI in ECG-confirmed STEMI while awaiting troponin results.",
      "CK-MB normalises faster than Troponin I — useful for detecting reinfarction.",
      "High-sensitivity assays have lower cutoffs. Kairos uses conventional Troponin I reference ranges.",
      "Hospital Engine will render as a formatted laboratory report.",
    ],
  },

  // ─── 3. Chest X-Ray ─────────────────────────
  {
    id:           "chest_xray",
    name:         "Chest X-Ray",
    type:         InvestigationType.Imaging,
    priority:     InvestigationPriority.Mandatory,
    timing:       InvestigationTiming.Urgent,
    unlockMethod: UnlockMethod.Always,
    reliability:  Reliability.Moderate,
    probability:  1.0,
    falsePositives: [
      "Pulmonary oedema from non-cardiac causes",
      "Cardiomegaly from pre-existing cardiomyopathy",
      "Pleural effusion from hepatic or renal causes",
      "AP portable film overestimates cardiac size — account for this when assessing CTR",
    ],
    results: {
      normal: {
        severity: "normal",
        findings: [
          {
            parameter:      "Cardiothoracic Ratio",
            range:          { min: 0.40, max: 0.50 },
            unit:           "ratio",
            interpretation: Interpretation.Normal,
          },
          {
            parameter:      "Lung Fields",
            range:          { min: 0, max: 0 },
            unit:           "none",
            interpretation: Interpretation.Normal,
          },
          {
            parameter:      "Pleural Effusion",
            range:          { min: 0, max: 0 },
            unit:           "none",
            interpretation: Interpretation.Absent,
          },
        ],
        educationalNotes:
          "A normal CXR does not exclude STEMI. The heart may appear normal in the first hours. Never use CXR to delay Cath Lab activation.",
      },
      mild: {
        severity: Severity.Mild,
        findings: [
          {
            parameter:      "Cardiothoracic Ratio",
            range:          { min: 0.50, max: 0.55 },
            unit:           "ratio",
            interpretation: Interpretation.Elevated,
          },
          {
            parameter:      "Lung Fields",
            range:          { min: 0, max: 0 },
            unit:           "none",
            interpretation: Interpretation.Normal,
          },
          {
            parameter:      "Pleural Effusion",
            range:          { min: 0, max: 0 },
            unit:           "none",
            interpretation: Interpretation.Absent,
          },
        ],
        educationalNotes:
          "Mild cardiomegaly may be pre-existing. Compare with previous films where available.",
      },
      moderate: {
        severity: Severity.Moderate,
        findings: [
          {
            parameter:      "Cardiothoracic Ratio",
            range:          { min: 0.55, max: 0.60 },
            unit:           "ratio",
            interpretation: Interpretation.Elevated,
          },
          {
            parameter:      "Pulmonary Vasculature",
            range:          { min: 1, max: 1 },
            unit:           "none",
            interpretation: Interpretation.Elevated,
          },
          {
            parameter:      "Kerley B Lines",
            range:          { min: 1, max: 1 },
            unit:           "none",
            interpretation: Interpretation.Present,
          },
          {
            parameter:      "Pleural Effusion",
            range:          { min: 1, max: 1 },
            unit:           "none",
            interpretation: Interpretation.Present,
          },
        ],
        educationalNotes:
          "Pulmonary venous congestion and Kerley B lines indicate raised left atrial pressure. Consistent with early left ventricular failure.",
      },
      severe: {
        severity: Severity.Severe,
        findings: [
          {
            parameter:      "Cardiothoracic Ratio",
            range:          { min: 0.60, max: 0.75 },
            unit:           "ratio",
            interpretation: Interpretation.Critical,
          },
          {
            parameter:      "Pulmonary Oedema",
            range:          { min: 1, max: 1 },
            unit:           "none",
            interpretation: Interpretation.Present,
          },
          {
            parameter:      "Bat-Wing Shadowing",
            range:          { min: 1, max: 1 },
            unit:           "none",
            interpretation: Interpretation.Present,
          },
          {
            parameter:      "Upper Lobe Diversion",
            range:          { min: 1, max: 1 },
            unit:           "none",
            interpretation: Interpretation.Present,
          },
          {
            parameter:      "Pleural Effusion",
            range:          { min: 1, max: 1 },
            unit:           "none",
            interpretation: Interpretation.Present,
          },
        ],
        educationalNotes:
          "Frank pulmonary oedema with bat-wing shadowing indicates severe left ventricular failure. Immediate intervention required.",
      },
    },
    redFlagFindings: [
      "Widened mediastinum — exclude aortic dissection before administering thrombolytics",
      "Bilateral pulmonary oedema with haemodynamic instability",
      "Massive cardiomegaly in new-onset STEMI",
    ],
    specialNotes: [
      "Widened mediastinum is a critical red flag — aortic dissection must be excluded before thrombolysis.",
      "Must never delay primary PCI in ECG-confirmed STEMI.",
      "Hospital Engine will render as a radiology viewer, not a text report.",
    ],
  },

  // ─── 4. Complete Blood Count ────────────────
  {
    id:           "cbc",
    name:         "Complete Blood Count",
    type:         InvestigationType.Lab,
    priority:     InvestigationPriority.Mandatory,
    timing:       InvestigationTiming.Urgent,
    unlockMethod: UnlockMethod.Always,
    reliability:  Reliability.High,
    probability:  1.0,
    falsePositives: [
      "Leukocytosis from infection, stress response, or steroid use",
      "Anaemia from non-cardiac causes worsening oxygen delivery",
      "Thrombocytopenia from heparin-induced causes",
    ],
    results: {
      normal: {
        severity: "normal",
        findings: [
          {
            parameter:      "Haemoglobin",
            range:          { min: 12.0, max: 16.0 },
            unit:           "g/dL",
            interpretation: Interpretation.Normal,
          },
          {
            parameter:      "WBC",
            range:          { min: 4.0, max: 11.0 },
            unit:           "×10⁹/L",
            interpretation: Interpretation.Normal,
          },
          {
            parameter:      "Platelets",
            range:          { min: 150, max: 400 },
            unit:           "×10⁹/L",
            interpretation: Interpretation.Normal,
          },
          {
            parameter:      "Haematocrit",
            range:          { min: 36, max: 48 },
            unit:           "%",
            interpretation: Interpretation.Normal,
          },
        ],
        educationalNotes:
          "Baseline CBC is essential before antiplatelet and anticoagulation therapy. Normal values do not exclude STEMI.",
      },
      mild: {
        severity: Severity.Mild,
        findings: [
          {
            parameter:      "Haemoglobin",
            range:          { min: 11.0, max: 14.0 },
            unit:           "g/dL",
            interpretation: Interpretation.Normal,
          },
          {
            parameter:      "WBC",
            range:          { min: 10.0, max: 14.0 },
            unit:           "×10⁹/L",
            interpretation: Interpretation.Elevated,
          },
          {
            parameter:      "Platelets",
            range:          { min: 150, max: 400 },
            unit:           "×10⁹/L",
            interpretation: Interpretation.Normal,
          },
          {
            parameter:      "Haematocrit",
            range:          { min: 34, max: 44 },
            unit:           "%",
            interpretation: Interpretation.Normal,
          },
        ],
        educationalNotes:
          "Mild leukocytosis is a physiological stress response to myocardial infarction. Not indicative of infection at this stage.",
      },
      moderate: {
        severity: Severity.Moderate,
        findings: [
          {
            parameter:      "Haemoglobin",
            range:          { min: 10.0, max: 13.0 },
            unit:           "g/dL",
            interpretation: Interpretation.Reduced,
          },
          {
            parameter:      "WBC",
            range:          { min: 12.0, max: 18.0 },
            unit:           "×10⁹/L",
            interpretation: Interpretation.Elevated,
          },
          {
            parameter:      "Platelets",
            range:          { min: 150, max: 350 },
            unit:           "×10⁹/L",
            interpretation: Interpretation.Normal,
          },
          {
            parameter:      "Haematocrit",
            range:          { min: 30, max: 40 },
            unit:           "%",
            interpretation: Interpretation.Reduced,
          },
        ],
        educationalNotes:
          "Anaemia worsens myocardial oxygen supply-demand mismatch. Transfusion threshold in STEMI is Hb <8 g/dL.",
      },
      severe: {
        severity: Severity.Severe,
        findings: [
          {
            parameter:      "Haemoglobin",
            range:          { min: 7.0, max: 11.0 },
            unit:           "g/dL",
            interpretation: Interpretation.Critical,
          },
          {
            parameter:      "WBC",
            range:          { min: 15.0, max: 25.0 },
            unit:           "×10⁹/L",
            interpretation: Interpretation.Elevated,
          },
          {
            parameter:      "Platelets",
            range:          { min: 80, max: 200 },
            unit:           "×10⁹/L",
            interpretation: Interpretation.Reduced,
          },
          {
            parameter:      "Haematocrit",
            range:          { min: 22, max: 34 },
            unit:           "%",
            interpretation: Interpretation.Critical,
          },
        ],
        educationalNotes:
          "Severe anaemia significantly worsens prognosis in STEMI. Thrombocytopenia complicates dual antiplatelet therapy decisions.",
      },
    },
    redFlagFindings: [
      "Haemoglobin <8 g/dL — consider transfusion threshold",
      "WBC >20 ×10⁹/L — evaluate for concurrent infection",
      "Platelets <50 ×10⁹/L — antiplatelet therapy risk must be reassessed",
    ],
    specialNotes: [
      "Leukocytosis in STEMI is an independent predictor of worse outcomes.",
      "Baseline platelet count essential before antiplatelet loading dose.",
      "Hospital Engine will render as a formatted laboratory report.",
    ],
  },

  // ─── 5. Echocardiography ────────────────────
  {
    id:           "echo_2d",
    name:         "2D Echocardiography",
    type:         InvestigationType.Imaging,
    priority:     InvestigationPriority.Important,
    timing:       InvestigationTiming.Urgent,
    unlockMethod: UnlockMethod.Always,
    reliability:  Reliability.High,
    probability:  0.85,
    falsePositives: [
      "Pre-existing wall motion abnormality from old infarction",
      "Left bundle branch block causing pseudo-wall motion abnormality",
      "Takotsubo cardiomyopathy mimicking anterior STEMI pattern",
    ],
    results: {
      normal: {
        severity: "normal",
        findings: [
          {
            parameter:      "Ejection Fraction",
            range:          { min: 55, max: 70 },
            unit:           "%",
            interpretation: Interpretation.Normal,
          },
          {
            parameter:      "Wall Motion",
            range:          { min: 0, max: 0 },
            unit:           "none",
            interpretation: Interpretation.Normal,
          },
          {
            parameter:      "Pericardial Effusion",
            range:          { min: 0, max: 0 },
            unit:           "none",
            interpretation: Interpretation.Absent,
          },
          {
            parameter:      "Valve Function",
            range:          { min: 0, max: 0 },
            unit:           "none",
            interpretation: Interpretation.Normal,
          },
        ],
        educationalNotes:
          "Normal echo very early after symptom onset does not exclude STEMI. Wall motion abnormalities may not yet be apparent.",
      },
      mild: {
        severity: Severity.Mild,
        findings: [
          {
            parameter:      "Ejection Fraction",
            range:          { min: 45, max: 55 },
            unit:           "%",
            interpretation: Interpretation.Reduced,
          },
          {
            parameter:      "Regional Wall Motion Abnormality",
            range:          { min: 1, max: 1 },
            unit:           "none",
            interpretation: Interpretation.Present,
          },
          {
            parameter:      "Pericardial Effusion",
            range:          { min: 0, max: 0 },
            unit:           "none",
            interpretation: Interpretation.Absent,
          },
          {
            parameter:      "Valve Function",
            range:          { min: 0, max: 0 },
            unit:           "none",
            interpretation: Interpretation.Normal,
          },
        ],
        educationalNotes:
          "Mild reduction in EF with regional wall motion abnormality confirms myocardial ischaemia in the affected territory.",
      },
      moderate: {
        severity: Severity.Moderate,
        findings: [
          {
            parameter:      "Ejection Fraction",
            range:          { min: 35, max: 45 },
            unit:           "%",
            interpretation: Interpretation.Reduced,
          },
          {
            parameter:      "Regional Wall Motion Abnormality",
            range:          { min: 1, max: 1 },
            unit:           "none",
            interpretation: Interpretation.Present,
          },
          {
            parameter:      "Pericardial Effusion",
            range:          { min: 1, max: 1 },
            unit:           "none",
            interpretation: Interpretation.Present,
          },
          {
            parameter:      "Mitral Regurgitation",
            range:          { min: 1, max: 1 },
            unit:           "none",
            interpretation: Interpretation.Present,
          },
        ],
        educationalNotes:
          "Moderate LV dysfunction with papillary muscle involvement causing mitral regurgitation. Pericardial effusion may indicate early pericarditis.",
      },
      severe: {
        severity: Severity.Severe,
        findings: [
          {
            parameter:      "Ejection Fraction",
            range:          { min: 15, max: 35 },
            unit:           "%",
            interpretation: Interpretation.Critical,
          },
          {
            parameter:      "Regional Wall Motion Abnormality",
            range:          { min: 1, max: 1 },
            unit:           "none",
            interpretation: Interpretation.Present,
          },
          {
            parameter:      "Mitral Regurgitation",
            range:          { min: 1, max: 1 },
            unit:           "none",
            interpretation: Interpretation.Critical,
          },
          {
            parameter:      "RV Function",
            range:          { min: 1, max: 1 },
            unit:           "none",
            interpretation: Interpretation.Reduced,
          },
          {
            parameter:      "Pericardial Effusion",
            range:          { min: 1, max: 1 },
            unit:           "none",
            interpretation: Interpretation.Present,
          },
        ],
        educationalNotes:
          "Severely impaired LV function indicating extensive infarction. High risk of cardiogenic shock and mechanical complications.",
      },
    },
    redFlagFindings: [
      "EF <35% with haemodynamic instability — cardiogenic shock risk",
      "Pericardial effusion with tamponade physiology — free wall rupture",
      "Severe acute mitral regurgitation — papillary muscle rupture",
      "New ventricular septal defect — left-to-right shunt",
      "Dilated hypokinetic RV in inferior STEMI — RV infarction",
    ],
    specialNotes: [
      "Must never delay primary PCI. Perform after initial stabilisation.",
      "RV infarction changes management significantly — avoid nitrates, patient is preload dependent.",
      "Wall motion abnormality territory corresponds to the culprit coronary artery.",
      "Hospital Engine will render as an echocardiography viewer with wall motion animation in future versions.",
    ],
  },
];
