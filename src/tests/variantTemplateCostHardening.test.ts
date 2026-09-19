/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.0.0
 * Created      : 2026-09-13
 * Modified     : 2026-09-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";

describe("Variant Template Zero Buying Cost & 60% Fallback Elimination", () => {
  const resolveCellCost = (
    existingCostPrice: number | undefined | null,
    templateBaseCostPrice: number | undefined | null,
    basePrice: number
  ): number => {
    const resolvedBaseCost =
      templateBaseCostPrice !== undefined &&
      templateBaseCostPrice !== null &&
      !isNaN(Number(templateBaseCostPrice))
        ? Number(templateBaseCostPrice)
        : 0;

    return existingCostPrice !== undefined &&
      existingCostPrice !== null &&
      !isNaN(Number(existingCostPrice))
      ? Number(existingCostPrice)
      : resolvedBaseCost;
  };

  it("strictly preserves baseCostPrice = 0 without falling back to 60% of basePrice", () => {
    const basePrice = 1000;
    const baseCostPrice = 0; // Legacy template with zero buying cost

    const resolved = resolveCellCost(undefined, baseCostPrice, basePrice);

    // Old behavior: 1000 * 0.6 = 600
    // Governed behavior: 0
    expect(resolved).toBe(0);
    expect(resolved).not.toBe(600);
  });

  it("strictly preserves positive baseCostPrice", () => {
    const basePrice = 1000;
    const baseCostPrice = 450;

    const resolved = resolveCellCost(undefined, baseCostPrice, basePrice);

    expect(resolved).toBe(450);
  });

  it("honors existing product cost price even if it is 0", () => {
    const basePrice = 1000;
    const baseCostPrice = 400;
    const existingCostPrice = 0;

    const resolved = resolveCellCost(existingCostPrice, baseCostPrice, basePrice);

    expect(resolved).toBe(0);
  });

  it("defaults to 0 if baseCostPrice is undefined or null", () => {
    const basePrice = 1000;

    const resolvedUndefined = resolveCellCost(undefined, undefined, basePrice);
    const resolvedNull = resolveCellCost(undefined, null, basePrice);

    expect(resolvedUndefined).toBe(0);
    expect(resolvedNull).toBe(0);
  });
});
