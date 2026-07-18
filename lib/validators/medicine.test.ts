import { describe, it, expect } from "vitest";
import { validateMedicine } from "@/lib/validators/medicine";
import { MedicineRegistry } from "@/lib/data/medicines/registry";
import { mutableClone } from "@/lib/test-utils/fixtures";

const aspirin = MedicineRegistry.getById("aspirin")!;

function cloneAspirin() {
  return mutableClone(aspirin);
}

describe("validateMedicine — valid data", () => {
  it("accepts every registered medicine", () => {
    for (const medicine of MedicineRegistry.getAll()) {
      const result = validateMedicine(medicine);
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    }
  });
});

describe("validateMedicine — required fields", () => {
  it("flags a missing id", () => {
    const m = cloneAspirin();
    m.id = "";
    const result = validateMedicine(m);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing id");
  });

  it("flags a missing generic name and mechanism", () => {
    const m = cloneAspirin();
    m.genericName = "";
    m.mechanism = "";
    const errors = validateMedicine(m).errors;
    expect(errors).toContain("Missing genericName");
    expect(errors).toContain("Missing mechanism");
  });

  it("flags a medicine with no references", () => {
    const m = cloneAspirin();
    m.references = [];
    expect(validateMedicine(m).errors).toContain("Medicine must have at least one reference");
  });

  it("flags a medicine with no dose rules", () => {
    const m = cloneAspirin();
    m.doseRules = [];
    expect(validateMedicine(m).errors).toContain("Medicine must have at least one dose rule");
  });

  it("flags a dose rule missing its unit", () => {
    const m = cloneAspirin();
    m.doseRules[0].dose.unit = "";
    expect(validateMedicine(m).errors.some(e => e.includes("missing unit"))).toBe(true);
  });
});

describe("validateMedicine — warnings", () => {
  it("warns when a dose has a null value without a condition", () => {
    const m = cloneAspirin();
    m.doseRules[0].dose.value = null;
    const result = validateMedicine(m);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes("null value without a condition"))).toBe(true);
  });

  it("does not warn about a null dose value when a condition is present", () => {
    const m = cloneAspirin();
    m.doseRules[0].dose.value = null;
    m.doseRules[0].dose.condition = "if SpO₂ < 94%";
    expect(
      validateMedicine(m).warnings.some(w => w.includes("null value without a condition"))
    ).toBe(false);
  });

  it("warns when no contraindications are listed", () => {
    const m = cloneAspirin();
    m.contraindications = [];
    expect(
      validateMedicine(m).warnings.some(w => w.includes("no contraindications listed"))
    ).toBe(true);
  });
});
