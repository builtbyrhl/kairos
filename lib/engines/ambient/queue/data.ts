// ─────────────────────────────────────────────
// KAIROS — Ambient Engine · Waiting-Room Data
//
// Decorative, DISEASE-AGNOSTIC presentations for the
// ambient waiting queue. These patients populate the
// living department around the student; they are NOT
// clinical cases.
//
// The one case the student actually assesses is still
// produced by the Patient Engine (STEMI MVP) at admit
// time — never from this file.
//
// Names mirror the Patient Engine's Indian adult pool
// for tonal consistency, kept local so the queue does
// not reach into patient-engine internals.
// ─────────────────────────────────────────────

export const AMBIENT_MALE_NAMES: readonly string[] = [
  "Ramesh", "Suresh", "Vikram", "Rajesh", "Sanjay", "Deepak", "Ravi",
  "Mohan", "Sunil", "Amit", "Ajay", "Vinod", "Prakash", "Dinesh",
  "Manoj", "Ashok", "Pradeep", "Rakesh", "Ganesh", "Satish",
];

export const AMBIENT_FEMALE_NAMES: readonly string[] = [
  "Sunita", "Meena", "Kavita", "Anita", "Rekha", "Seema", "Preeti",
  "Shobha", "Pushpa", "Lata", "Usha", "Deepa", "Asha", "Savita",
  "Vandana", "Sangita", "Poonam", "Kiran", "Lalita", "Indira",
];

export const AMBIENT_SURNAMES: readonly string[] = [
  "Kumar", "Sharma", "Patel", "Singh", "Gupta", "Joshi", "Mehta",
  "Shah", "Verma", "Mishra", "Pandey", "Yadav", "Chauhan", "Agarwal",
  "Malhotra", "Saxena", "Tiwari",
];

// Ambient complaints tagged with a baseline triage band.
// Deliberately varied so the waiting room feels real.
export interface AmbientComplaint {
  readonly text:  string;
  readonly triage: "red" | "orange" | "yellow" | "green";
}

export const AMBIENT_COMPLAINTS: readonly AmbientComplaint[] = [
  { text: "Chest discomfort",            triage: "orange" },
  { text: "Shortness of breath",         triage: "orange" },
  { text: "Severe abdominal pain",       triage: "orange" },
  { text: "High-grade fever",            triage: "yellow" },
  { text: "Head injury after a fall",    triage: "orange" },
  { text: "Palpitations",                triage: "yellow" },
  { text: "Dizziness and weakness",      triage: "yellow" },
  { text: "Laceration to the forearm",   triage: "green"  },
  { text: "Persistent vomiting",         triage: "yellow" },
  { text: "Ankle injury",                triage: "green"  },
  { text: "Cough and cold",              triage: "green"  },
  { text: "Back pain",                   triage: "green"  },
  { text: "Allergic reaction",           triage: "orange" },
  { text: "Renal colic",                 triage: "yellow" },
];

export const AMBIENT_DEPARTMENTS: readonly string[] = [
  "Emergency",
  "Cardiology",
  "Trauma",
  "General Medicine",
  "Radiology",
  "ICU",
];
