import { Disease } from "../../../../engines/disease/types";
import { TreatmentReference } from "../../../../engines/medicine/types";
import {
  TreatmentPriority,
  TreatmentTiming,
} from "../../../../types/enums";

const correct: TreatmentReference[] = [
  {
    medicineId:      "aspirin",
    priority:        TreatmentPriority.Mandatory,
    timing:          TreatmentTiming.Immediate,
    doseRuleTarget:  "adult",
    correctChoice:   true,
    educationalNotes: [
      "First drug given in any ACS. Never withhold unless true allergy is confirmed.",
      "Loading dose 300mg chewed — not swallowed whole — for faster absorption.",
    ],
  },
  {
    medicineId:      "clopidogrel",
    priority:        TreatmentPriority.Mandatory,
    timing:          TreatmentTiming.Immediate,
    doseRuleTarget:  "adult",
    correctChoice:   true,
    educationalNotes: [
      "600mg loading dose before primary PCI.",
      "Dual antiplatelet therapy with aspirin is the standard of care. Neither alone is sufficient.",
    ],
  },
  {
    medicineId:      "heparin_uf",
    priority:        TreatmentPriority.Mandatory,
    timing:          TreatmentTiming.Immediate,
    doseRuleTarget:  "adult",
    correctChoice:   true,
    educationalNotes: [
      "Weight-based IV bolus before and during primary PCI.",
      "Prevents thrombus propagation. Never give a flat dose.",
    ],
  },
  {
    medicineId:      "oxygen",
    priority:        TreatmentPriority.Important,
    timing:          TreatmentTiming.Immediate,
    doseRuleTarget:  "adult",
    condition:       "spo2 < 94",
    correctChoice:   true,
    educationalNotes: [
      "Only indicated if SpO₂ falls below 94%.",
      "Routine oxygen in normoxic STEMI is not recommended and may cause harm.",
    ],
  },
  {
    medicineId:      "morphine",
    priority:        TreatmentPriority.Important,
    timing:          TreatmentTiming.Immediate,
    doseRuleTarget:  "adult",
    condition:       "pain_severe AND sbp_above_90",
    correctChoice:   true,
    educationalNotes: [
      "Use cautiously. May delay oral antiplatelet absorption.",
      "Absolutely contraindicated if systolic BP is below 90 mmHg.",
    ],
  },
];

export const treatments: Disease["treatments"] = {
  correct,
  incorrect: [
    {
      id:       "nitrates_hypotension",
      name:     "Nitrates when SBP below 90 mmHg",
      reason:
        "Nitrates cause vasodilation and will precipitate cardiovascular collapse. Absolutely contraindicated when systolic BP is below 90 mmHg or when RV infarction is suspected.",
      severity: "critical",
    },
    {
      id:       "echo_before_pci_activation",
      name:     "Delaying Cath Lab activation for echocardiography",
      reason:
        "Every minute of delay causes irreversible myocardial necrosis. Echo must never delay reperfusion in confirmed STEMI.",
      severity: "critical",
    },
    {
      id:       "thrombolysis_when_pci_available",
      name:     "Thrombolysis when PCI available within 120 minutes",
      reason:
        "Primary PCI is superior to thrombolysis when available within 120 minutes. Thrombolysis should only be used when PCI is unavailable or would be significantly delayed.",
      severity: "high",
    },
    {
      id:       "iv_beta_blocker_with_lv_failure",
      name:     "IV beta-blocker in acute phase with LV failure",
      reason:
        "IV beta-blockers in acute STEMI complicated by heart failure increase mortality. Oral beta-blockers after stabilisation are indicated.",
      severity: "high",
    },
    {
      id:       "withholding_antiplatelet_for_allergy_unconfirmed",
      name:     "Withholding aspirin for unconfirmed allergy",
      reason:
        "Aspirin should not be withheld based on unconfirmed allergy history in a life-threatening STEMI. Confirm true allergy before withholding.",
      severity: "high",
    },
  ],
};
