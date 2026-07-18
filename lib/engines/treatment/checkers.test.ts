import { describe, it, expect } from "vitest";
import {
  checkContraindications,
  checkDose,
  checkRoute,
  checkDuplication,
  checkTiming,
} from "@/lib/engines/treatment/checkers";
import { MedicineRegistry } from "@/lib/data/medicines/registry";
import type { Medicine } from "@/lib/engines/medicine/types";
import { RouteOfAdministration } from "@/lib/types/enums";
import {
  makePatientCase,
  makeGeneratedVital,
  makeTreatmentRecord,
  mutableClone,
} from "@/lib/test-utils/fixtures";

const aspirin = MedicineRegistry.getById("aspirin")!;

function patientWithSBP(value: number) {
  const pc = makePatientCase();
  return {
    ...pc,
    hidden: { ...pc.hidden, generatedVitals: [makeGeneratedVital({ parameter: "Systolic Blood Pressure", value })] },
  };
}

/** A minimal medicine with a hypotension contraindication for targeted tests. */
function hypotensionSensitiveMedicine(): Medicine {
  return {
    ...mutableClone(aspirin),
    id:                "nitroglycerin",
    genericName:       "Nitroglycerin",
    contraindications: ["Hypotension (SBP <90)"],
  };
}

describe("checkContraindications", () => {
  it("flags a hypotension contraindication when SBP < 90", () => {
    const issues = checkContraindications(hypotensionSensitiveMedicine(), patientWithSBP(80));
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe("contraindication");
  });

  it("does not flag a hypotension contraindication when SBP >= 90", () => {
    expect(checkContraindications(hypotensionSensitiveMedicine(), patientWithSBP(120))).toEqual([]);
  });

  it("returns no issues for a medicine without matching contraindications", () => {
    expect(checkContraindications(aspirin, patientWithSBP(80))).toEqual([]);
  });
});

describe("checkDose", () => {
  it("returns no issue for a dose within tolerance", () => {
    expect(checkDose(makeTreatmentRecord({ dose: "300mg" }), aspirin)).toEqual([]);
  });

  it("accepts a dose at the edge of the ±25% window", () => {
    // 300mg expected → min 225, max 375
    expect(checkDose(makeTreatmentRecord({ dose: "230mg" }), aspirin)).toEqual([]);
    expect(checkDose(makeTreatmentRecord({ dose: "370mg" }), aspirin)).toEqual([]);
  });

  it("flags a dose outside the acceptable range", () => {
    const issues = checkDose(makeTreatmentRecord({ dose: "50mg" }), aspirin);
    expect(issues[0].kind).toBe("dose");
    expect(issues[0].message).toContain("outside the acceptable range");
  });

  it("flags a missing dose when a numeric dose is expected", () => {
    const issues = checkDose(makeTreatmentRecord({ dose: undefined }), aspirin);
    expect(issues[0].message).toContain("No dose recorded");
  });

  it("flags an unparseable dose string", () => {
    const issues = checkDose(makeTreatmentRecord({ dose: "a lot" }), aspirin);
    expect(issues[0].message).toContain("Could not parse dose value");
  });

  it("does not dose-check a procedure (null dose value)", () => {
    const procedure = mutableClone(aspirin);
    procedure.doseRules[0].dose.value = null;
    expect(checkDose(makeTreatmentRecord({ dose: undefined }), procedure)).toEqual([]);
  });

  it("returns no issue when there is no adult dose rule", () => {
    const paediatricOnly = mutableClone(aspirin);
    paediatricOnly.doseRules[0].population = "paediatric";
    expect(checkDose(makeTreatmentRecord({ dose: "300mg" }), paediatricOnly)).toEqual([]);
  });

  it("flags a missing weight-based dose but cannot verify the value", () => {
    const weightBased = mutableClone(aspirin);
    weightBased.doseRules[0].dose.weightBased = true;
    const missing = checkDose(makeTreatmentRecord({ dose: undefined }), weightBased);
    expect(missing[0].message).toContain("weight-based dose");
    expect(checkDose(makeTreatmentRecord({ dose: "60 units/kg" }), weightBased)).toEqual([]);
  });
});

describe("checkRoute", () => {
  it("returns no issue when the route matches", () => {
    expect(checkRoute(makeTreatmentRecord({ route: "oral" }), aspirin)).toEqual([]);
  });

  it("matches routes case-insensitively", () => {
    expect(checkRoute(makeTreatmentRecord({ route: "ORAL" }), aspirin)).toEqual([]);
  });

  it("matches partial/abbreviated routes", () => {
    const ivMed = mutableClone(aspirin);
    ivMed.doseRules[0].route = RouteOfAdministration.IVBolus;
    expect(checkRoute(makeTreatmentRecord({ route: "iv" }), ivMed)).toEqual([]);
  });

  it("flags a mismatched route", () => {
    const issues = checkRoute(makeTreatmentRecord({ route: "im" }), aspirin);
    expect(issues[0].kind).toBe("route");
    expect(issues[0].message).toContain("does not match expected route");
  });

  it("flags a missing route", () => {
    const issues = checkRoute(makeTreatmentRecord({ route: undefined }), aspirin);
    expect(issues[0].message).toContain("No route recorded");
  });
});

describe("checkDuplication", () => {
  it("returns no issue for a single administration", () => {
    const record = makeTreatmentRecord({ medicineId: "morphine", orderedAt: 10 });
    expect(checkDuplication(record, [record])).toEqual([]);
  });

  it("flags a repeat administration of the same medicine", () => {
    const first  = makeTreatmentRecord({ medicineId: "morphine", orderedAt: 5 });
    const second = makeTreatmentRecord({ medicineId: "morphine", orderedAt: 20 });
    const issues = checkDuplication(second, [first, second]);
    expect(issues[0].kind).toBe("duplication");
    expect(issues[0].message).toContain("previously administered at clinical minute 5");
  });

  it("does not flag a different medicine given earlier", () => {
    const aspirinRec  = makeTreatmentRecord({ medicineId: "aspirin", orderedAt: 5 });
    const morphineRec = makeTreatmentRecord({ medicineId: "morphine", orderedAt: 20 });
    expect(checkDuplication(morphineRec, [aspirinRec, morphineRec])).toEqual([]);
  });
});

describe("checkTiming", () => {
  it("flags an immediate treatment given after 30 clinical minutes", () => {
    const issues = checkTiming(makeTreatmentRecord({ orderedAt: 45 }), "immediate");
    expect(issues[0].kind).toBe("timing");
  });

  it("does not flag an immediate treatment given within 30 minutes", () => {
    expect(checkTiming(makeTreatmentRecord({ orderedAt: 20 }), "immediate")).toEqual([]);
  });

  it("does not flag non-immediate treatments regardless of time", () => {
    expect(checkTiming(makeTreatmentRecord({ orderedAt: 120 }), "elective")).toEqual([]);
  });
});
