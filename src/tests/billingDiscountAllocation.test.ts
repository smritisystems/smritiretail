import { describe, expect, it } from "vitest";
import { allocateProportionalDiscount } from "../components/billing/discountAllocation.ts";

describe("allocateProportionalDiscount", () => {
  it("allocates rounded cents proportionally and reconciles the header discount", () => {
    const allocations = allocateProportionalDiscount([10, 20, 30], 1);

    expect(allocations).toEqual([0.17, 0.33, 0.5]);
    expect(allocations.reduce((sum, amount) => sum + amount, 0)).toBe(1);
  });

  it("does not allocate more than the eligible line bases", () => {
    expect(allocateProportionalDiscount([0.01, 0.02], 1)).toEqual([0.01, 0.02]);
  });

  it("uses stable input order to reconcile equal remainders", () => {
    expect(allocateProportionalDiscount([1, 1, 1], 0.02)).toEqual([0.01, 0.01, 0]);
  });

  it("rejects invalid amounts rather than silently treating them as zero", () => {
    expect(() => allocateProportionalDiscount([1, Number.NaN], 0.1)).toThrow(RangeError);
    expect(() => allocateProportionalDiscount([1], -0.1)).toThrow(RangeError);
  });
});
