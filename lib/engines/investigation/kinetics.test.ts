import { describe, it, expect } from "vitest";
import {
  computeHoursAfterEvent,
  resolveSeverityTier,
  hasResulted,
  isQualitativeFinding,
  extractNormalRange,
} from "@/lib/engines/investigation/kinetics";
import { DiseaseRegistry } from "@/lib/data/diseases";
import { Severity } from "@/lib/types/enums";
import type { Investigation } from "@/lib/engines/disease/types";

const stemi = DiseaseRegistry.getById("stemi")!;

function investigation(id: string): Investigation {
  const inv = stemi.investigations.find(i => i.id === id);
  if (!inv) throw new Error(`fixture investigation not found: ${id}`);
  return inv;
}

const troponin = investigation("troponin_i");   // has a kinetic profile
const ecg      = investigation("ecg_12lead");    // no kinetic profile

describe("computeHoursAfterEvent", () => {
  it("adds elapsed clinical minutes (as hours) to symptom onset", () => {
    expect(computeHoursAfterEvent(2, 60)).toBe(3);
  });

  it("returns the onset directly when no clinical time has elapsed", () => {
    expect(computeHoursAfterEvent(4, 0)).toBe(4);
  });
});

describe("resolveSeverityTier", () => {
  it("returns the base severity when the investigation has no kinetic profile", () => {
    expect(ecg.kineticProfile).toBeUndefined();
    expect(resolveSeverityTier(ecg, 0, Severity.Severe)).toBe(Severity.Severe);
    expect(resolveSeverityTier(ecg, 999, Severity.Moderate)).toBe(Severity.Moderate);
  });

  it("returns 'normal' before the biomarker rise onset", () => {
    const riseStart = troponin.kineticProfile!.riseOnset.hoursAfterEvent.min;
    expect(resolveSeverityTier(troponin, riseStart - 0.1, Severity.Severe)).toBe("normal");
  });

  it("returns the base severity while the biomarker is elevated", () => {
    const { riseOnset, normalises } = troponin.kineticProfile!;
    const mid = (riseOnset.hoursAfterEvent.min + normalises.hoursAfterEvent.min) / 2;
    expect(resolveSeverityTier(troponin, mid, Severity.Severe)).toBe(Severity.Severe);
  });

  it("returns 'normal' after the biomarker has normalised", () => {
    const normalisesAt = troponin.kineticProfile!.normalises.hoursAfterEvent.min;
    expect(resolveSeverityTier(troponin, normalisesAt + 1, Severity.Severe)).toBe("normal");
  });

  it("treats the rise onset boundary as elevated (inclusive)", () => {
    const riseStart = troponin.kineticProfile!.riseOnset.hoursAfterEvent.min;
    expect(resolveSeverityTier(troponin, riseStart, Severity.Severe)).toBe(Severity.Severe);
  });
});

describe("hasResulted", () => {
  it("is true once the current time reaches result availability", () => {
    expect(hasResulted(10, 10)).toBe(true);
    expect(hasResulted(10, 15)).toBe(true);
  });

  it("is false before the result is available", () => {
    expect(hasResulted(10, 9)).toBe(false);
  });
});

describe("isQualitativeFinding", () => {
  it("recognises presence/absence ranges as qualitative", () => {
    expect(isQualitativeFinding({ min: 0, max: 0 })).toBe(true);
    expect(isQualitativeFinding({ min: 1, max: 1 })).toBe(true);
  });

  it("recognises a spanning range as quantitative", () => {
    expect(isQualitativeFinding({ min: 0, max: 5 })).toBe(false);
  });
});

describe("extractNormalRange", () => {
  it("returns the reference range for a known normal-tier parameter", () => {
    const parameter = troponin.results.normal.findings[0].parameter;
    const range = extractNormalRange(troponin, parameter);
    expect(range).toBeDefined();
    expect(range).toEqual(troponin.results.normal.findings[0].range);
  });

  it("returns undefined for a parameter not present in the normal tier", () => {
    expect(extractNormalRange(troponin, "not_a_real_parameter")).toBeUndefined();
  });
});
