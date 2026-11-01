import { describe, expect, it } from "vitest";
import { calculateSourceDiscountAmount } from "../utils/sourceBillingDiscount.ts";
import {
  applySourceBarcodeQuantityRows,
  initialSourceBillingQuantities,
  parseSourceBarcodeQuantityCsv,
} from "../utils/sourceBillingQuantities.ts";

describe("calculateSourceDiscountAmount", () => {
  it("uses zero for Sales Order billing and remaining packed quantity for Packing Slip billing", () => {
    const lines = [
      { source_line_id: "eligible", code: "SKU-1", remaining_quantity: "4.5", eligible: true },
      { source_line_id: "empty", code: "SKU-2", remaining_quantity: "0", eligible: true },
      { source_line_id: "blocked", code: "SKU-3", remaining_quantity: "2", eligible: false },
    ];

    expect(initialSourceBillingQuantities("SALES_ORDER", lines)).toEqual({ eligible: "0" });
    expect(initialSourceBillingQuantities("PACKING_SLIP", lines)).toEqual({ eligible: "4.5" });
  });

  it("adds scanned barcode quantities against verified source lines", () => {
    const lines = [{
      source_line_id: "line-1",
      code: "SKU-1",
      barcodes: ["8901234567890"],
      remaining_quantity: 4,
      eligible: true,
    }];
    const once = applySourceBarcodeQuantityRows([["8901234567890", "1"]], lines, { "line-1": "0" });
    const twice = applySourceBarcodeQuantityRows([["SKU-1", "2"]], lines, once);

    expect(twice).toEqual({ "line-1": "3" });
  });

  it("parses headered barcode quantity CSV and rejects overbilling atomically", () => {
    expect(parseSourceBarcodeQuantityCsv("Barcode,Qty\nSKU-1,2")).toEqual([["SKU-1", "2"]]);
    const lines = [{ source_line_id: "line-1", code: "SKU-1", remaining_quantity: 2, eligible: true }];
    expect(() => applySourceBarcodeQuantityRows(
      [["SKU-1", "3"]],
      lines,
      { "line-1": "0" },
    )).toThrow(/exceeds remaining quantity/);
  });

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
