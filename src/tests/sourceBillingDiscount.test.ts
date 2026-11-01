import { describe, expect, it } from "vitest";
import { calculateSourceDiscountAmount } from "../utils/sourceBillingDiscount.ts";

describe("calculateSourceDiscountAmount", () => {
  it("uses the source percentage on the selected partial quantity", () => {
    expect(calculateSourceDiscountAmount({
      unitPrice: 100,
      quantity: 2,
      discountPercent: 12.5,
    })).toBe(25);
  });

  it("allocates a fixed source discount without losing cents across partial bills", () => {
    const discount = [0, 1, 2].map(previouslyBilledQuantity =>
      calculateSourceDiscountAmount({
        unitPrice: 50,
        quantity: 1,
        discountAmount: 10,
        discountQuantityBasis: 3,
        previouslyBilledQuantity,
      })
    );

    expect(discount).toEqual([3.33, 3.34, 3.33]);
  });
});
