// ─────────────────────────────────────────────
// KAIROS — Patient Profile Generator
//
// Generates a believable Indian patient identity.
// Names, occupations, and comorbidity rates reflect
// the Indian adult population presenting with
// cardiovascular symptoms.
//
// This generator is disease-agnostic.
// It produces a human being, not a disease case.
// ─────────────────────────────────────────────

import { SeededRNG }                      from "../rng";
import { ComorbidityProfile, PatientProfile, PatientSex } from "../types";

// ─── Name Data ────────────────────────────────

const MALE_FIRST_NAMES: readonly string[] = [
  "Ramesh", "Suresh", "Mahesh", "Vikram", "Rajesh", "Anil",   "Sanjay",
  "Deepak", "Ravi",   "Mohan",  "Sunil",  "Amit",   "Ajay",  "Vinod",
  "Prakash","Dinesh", "Naresh", "Manoj",  "Ashok",  "Pradeep","Yogesh",
  "Rakesh", "Ganesh", "Satish", "Girish", "Nilesh", "Hitesh", "Paresh",
  "Harish", "Mukesh",
];

const FEMALE_FIRST_NAMES: readonly string[] = [
  "Sunita", "Meena",   "Geeta",   "Priya",   "Kavita", "Anita",   "Nita",
  "Rekha",  "Seema",   "Preeti",  "Shobha",  "Pushpa", "Lata",    "Hema",
  "Usha",   "Sushma",  "Deepa",   "Asha",    "Nirmala","Savita",  "Vandana",
  "Sangita","Sudha",   "Poonam",  "Kiran",   "Shanta", "Lalita",  "Sarla",
  "Indira", "Vimla",
];

const SURNAMES: readonly string[] = [
  "Kumar",   "Sharma",     "Patel",      "Singh",   "Gupta",
  "Joshi",   "Mehta",      "Shah",       "Verma",   "Mishra",
  "Pandey",  "Yadav",      "Chauhan",    "Agarwal", "Bansal",
  "Malhotra","Chaudhary",  "Saxena",     "Srivastava","Tiwari",
];

// ─── Occupation Data ──────────────────────────

const MALE_OCCUPATIONS: readonly string[] = [
  "Farmer",                   "School teacher",
  "Shopkeeper",               "Auto rickshaw driver",
  "Government clerk",         "Retired government officer",
  "Daily wage worker",        "Small business owner",
  "Factory worker",           "Security guard",
  "Tailor",                   "Carpenter",
  "Accountant",               "Bank employee",
  "Vegetable vendor",         "Retired soldier",
  "Electrician",              "Plumber",
  "Office clerk",             "Construction worker",
];

const FEMALE_OCCUPATIONS: readonly string[] = [
  "Housewife",                "School teacher",
  "Anganwadi worker",         "Domestic helper",
  "Tailoring work from home", "Small business owner",
  "Government employee",      "Vegetable vendor",
  "Daily wage worker",        "Nurse",
];

// ─── Comorbidity Base Rates ───────────────────
// Population-level rates for Indian adults.
// Not disease-specific. Disease-specific risk
// modifiers are applied by the Outcome Engine.

const BASE_RATES = {
  smokingMale:  0.28,  // 28% of Indian adult males smoke
  smokingFemale: 0.06, // 6% of Indian adult females smoke
  diabetes:     0.18,  // India has high T2DM burden
  hypertension: 0.32,  // Common cardiovascular risk factor
  previousMI:   0.08,  // Prior cardiac history
} as const;

// ─── Generator ────────────────────────────────

export function generateProfile(rng: SeededRNG): PatientProfile {
  const sex: PatientSex = rng.chance(0.62) ? "male" : "female";

  const firstName = sex === "male"
    ? rng.pick(MALE_FIRST_NAMES)
    : rng.pick(FEMALE_FIRST_NAMES);

  const fullName  = `${firstName} ${rng.pick(SURNAMES)}`;
  const age       = rng.nextInt(35, 78);
  const occupation = sex === "male"
    ? rng.pick(MALE_OCCUPATIONS)
    : rng.pick(FEMALE_OCCUPATIONS);

  const comorbidities: ComorbidityProfile = {
    isSmoker:        rng.chance(sex === "male"
                       ? BASE_RATES.smokingMale
                       : BASE_RATES.smokingFemale),
    hasDiabetes:     rng.chance(BASE_RATES.diabetes),
    hasHypertension: rng.chance(BASE_RATES.hypertension),
    hasPreviousMI:   rng.chance(BASE_RATES.previousMI),
  };

  return { fullName, age, sex, occupation, comorbidities };
}
