import { Disease } from "../../../../engines/disease/types";
import { OutcomeType } from "../../../../types/enums";

export const outcome: Disease["outcome"] = {

  scenarios: [
    {
      type:            OutcomeType.FullRecovery,
      baseProbability: 0.80,
      conditions: [
        "pci_achieved_within_90_minutes",
        "dual_antiplatelet_given",
        "heparin_given",
        "no_major_complication",
      ],
    },
    {
      type:            OutcomeType.PartialRecovery,
      baseProbability: 0.15,
      conditions: [
        "pci_performed",
        "incomplete_pharmacotherapy",
      ],
    },
    {
      type:            OutcomeType.Transfer,
      baseProbability: 0.02,
      conditions: [
        "cardiogenic_shock_requiring_mechanical_support",
        "cath_lab_unavailable",
      ],
    },
    {
      type:            OutcomeType.Death,
      baseProbability: 0.03,
      conditions: [
        "cardiogenic_shock",
        "no_reperfusion_attempted",
        "ventricular_fibrillation_untreated",
      ],
    },
  ],

  modifiers: [
    {
      factor:          "age_over_75",
      survivalPenalty: 0.10,
      note:
        "Elderly patients have higher mortality due to comorbidities, delayed presentation, and atypical symptoms.",
    },
    {
      factor:          "diabetes_mellitus",
      survivalPenalty: 0.05,
      note:
        "Diabetes worsens microvascular function and is associated with larger infarct size and impaired healing.",
    },
    {
      factor:          "anterior_stemi",
      survivalPenalty: 0.05,
      note:
        "Anterior STEMI involves a larger territory of myocardium than inferior STEMI and carries worse prognosis.",
    },
    {
      factor:          "cardiogenic_shock_present",
      survivalPenalty: 0.40,
      note:
        "Single largest predictor of in-hospital mortality in STEMI. Mortality exceeds 50% despite modern treatment.",
    },
    {
      factor:          "haemoglobin_below_8",
      survivalPenalty: 0.08,
      note:
        "Severe anaemia worsens myocardial oxygen delivery and significantly increases infarct size.",
    },
    {
      factor:          "renal_impairment",
      survivalPenalty: 0.07,
      note:
        "Chronic kidney disease increases bleeding risk, limits contrast volume during PCI, and worsens overall prognosis.",
    },
    {
      factor:         "correct_dual_antiplatelet",
      survivalBonus:  0.05,
      note:
        "Complete dual antiplatelet loading with aspirin and a P2Y12 inhibitor significantly reduces periprocedural thrombosis.",
    },
    {
      factor:         "early_heparin_administration",
      survivalBonus:  0.03,
      note:
        "Early anticoagulation prevents thrombus propagation in the infarct-related artery during transfer and PCI.",
    },
    {
      factor:         "pci_achieved_within_90_minutes",
      survivalBonus:  0.05,
      note:
        "Every 30-minute reduction in door-to-balloon time reduces one-year mortality by approximately 7.5%. Source: McNamara et al., JAMA 2006.",
    },
  ],

  deathIsAllowed: true,
  deathIsCommon:  false,
  deathNote:
    "Every death in Kairos must be traceable to a specific missed decision or delayed action. Death is never random, never punitive, and always teaches something clinically meaningful.",
};
