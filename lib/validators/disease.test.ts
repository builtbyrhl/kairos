import { describe, it, expect } from "vitest";
import { validateDisease } from "@/lib/validators/disease";
import { DiseaseRegistry } from "@/lib/data/diseases";
import { MedicineRegistry } from "@/lib/data/medicines/registry";
import { DataStatus } from "@/lib/types/enums";
import { mutableClone } from "@/lib/test-utils/fixtures";

const stemi = DiseaseRegistry.getById("stemi")!;

/** A deep, mutable copy of the (valid) STEMI disease for building invalid variants. */
function cloneStemi() {
  return mutableClone(stemi);
}

const context = { availableMedicineIds: MedicineRegistry.getIds() };

describe("validateDisease — valid data", () => {
  it("accepts the real STEMI disease (structural only)", () => {
    const result = validateDisease(stemi);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("accepts the real STEMI disease with semantic context", () => {
    const result = validateDisease(stemi, context);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

describe("validateDisease — warnings", () => {
  it("warns when no ValidationContext is supplied", () => {
    const result = validateDisease(stemi);
    expect(result.warnings.some(w => w.includes("without ValidationContext"))).toBe(true);
  });

  it("does not emit the missing-context warning when context is supplied", () => {
    const result = validateDisease(stemi, context);
    expect(result.warnings.some(w => w.includes("without ValidationContext"))).toBe(false);
  });

  it("warns (but stays valid) when status is Draft", () => {
    const d = cloneStemi();
    d.status = DataStatus.Draft;
    const result = validateDisease(d, context);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes("status Draft"))).toBe(true);
  });
});

describe("validateDisease — base field errors", () => {
  it("flags a missing id", () => {
    const d = cloneStemi();
    d.id = "";
    const result = validateDisease(d);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing field: id");
  });

  it("flags an empty references array", () => {
    const d = cloneStemi();
    d.references = [];
    expect(validateDisease(d).errors).toContain("Disease must have at least one reference");
  });
});

describe("validateDisease — symptom errors", () => {
  it("flags a disease with no symptoms", () => {
    const d = cloneStemi();
    d.symptoms = [];
    expect(validateDisease(d).errors).toContain("Disease must have at least one symptom");
  });

  it("flags a duplicate symptom id", () => {
    const d = cloneStemi();
    d.symptoms = [d.symptoms[0], { ...d.symptoms[0] }];
    expect(validateDisease(d).errors.some(e => e.includes("Duplicate symptom id"))).toBe(true);
  });

  it("flags a symptom with no patient phrases", () => {
    const d = cloneStemi();
    d.symptoms[0] = { ...d.symptoms[0], patientPhrases: [] };
    expect(validateDisease(d).errors.some(e => e.includes("patientPhrase"))).toBe(true);
  });
});

describe("validateDisease — vital sign errors", () => {
  it("flags an inverted range (min > max)", () => {
    const d = cloneStemi();
    const v = d.vitalSigns[0];
    v.normal = { ...v.normal, range: { min: 200, max: 100 } };
    expect(validateDisease(d).errors.some(e => e.includes("min > max"))).toBe(true);
  });
});

describe("validateDisease — investigation errors", () => {
  it("flags an out-of-bounds probability", () => {
    const d = cloneStemi();
    d.investigations[0].probability = 1.5;
    expect(
      validateDisease(d).errors.some(e => e.includes("probability must be between 0 and 1"))
    ).toBe(true);
  });

  it("flags a duplicate investigation id", () => {
    const d = cloneStemi();
    d.investigations = [d.investigations[0], { ...d.investigations[0] }];
    expect(
      validateDisease(d).errors.some(e => e.includes("Duplicate investigation id"))
    ).toBe(true);
  });
});

describe("validateDisease — treatment errors", () => {
  it("flags the absence of any correct treatment", () => {
    const d = cloneStemi();
    d.treatments.correct = [];
    expect(
      validateDisease(d).errors.some(e => e.includes("at least one correct treatment"))
    ).toBe(true);
  });
});

describe("validateDisease — cross-field consistency", () => {
  it("flags reflection hook weights that do not sum to totalPoints", () => {
    const d = cloneStemi();
    d.reflectionHooks[0].weight += 5;
    expect(
      validateDisease(d).errors.some(e => e.includes("hook weights sum to"))
    ).toBe(true);
  });

  it("flags outcome scenario probabilities that do not sum to 1", () => {
    const d = cloneStemi();
    d.outcome.scenarios[0].baseProbability += 0.5;
    expect(
      validateDisease(d).errors.some(e => e.includes("baseProbability values sum to"))
    ).toBe(true);
  });
});

describe("validateDisease — semantic medicine references", () => {
  it("flags a treatment referencing an unknown medicine id", () => {
    const d = cloneStemi();
    d.treatments.correct[0].medicineId = "not_a_real_medicine";
    const result = validateDisease(d, context);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("unknown medicineId"))).toBe(true);
  });

  it("does not run semantic checks when no context is provided", () => {
    const d = cloneStemi();
    d.treatments.correct[0].medicineId = "not_a_real_medicine";
    // Without context, the unknown-medicine error is not produced.
    expect(validateDisease(d).errors.some(e => e.includes("unknown medicineId"))).toBe(false);
  });
});
