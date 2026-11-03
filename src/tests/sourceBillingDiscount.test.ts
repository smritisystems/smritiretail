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
      product_id: "product-1",
      code: "SKU-1",
      barcodes: ["8901234567890"],
      remaining_quantity: 4,
      eligible: true,
    }];
    const once = applySourceBarcodeQuantityRows([["8901234567890", "1"]], lines, { "line-1": "0" });
    const twice = applySourceBarcodeQuantityRows([["SKU-1", "2"]], lines, once.quantities);

    expect(twice).toEqual({ quantities: { "line-1": "3" }, issues: [], rejectedRows: [] });
  });

  it("parses barcode-only and headered barcode quantity rows", () => {
    expect(parseSourceBarcodeQuantityCsv("Barcode,Qty\nSKU-1,2")).toEqual([["SKU-1", "2"]]);
    expect(parseSourceBarcodeQuantityCsv("Barcode\nSKU-1\nSKU-2,2")).toEqual([["SKU-1", "1"], ["SKU-2", "2"]]);
  });

  it("applies valid barcodes and reports unknown or over-pending rows without adding them", () => {
    const lines = [{ source_line_id: "line-1", product_id: "product-1", code: "SKU-1", remaining_quantity: 2, eligible: true }];
    const result = applySourceBarcodeQuantityRows(
      [["SKU-1", "1"], ["NOT-ON-SO", "1"], ["SKU-1", "2"]],
      lines,
      { "line-1": "0" },
    );

    expect(result.quantities).toEqual({ "line-1": "1" });
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0]).toContain("NOT-ON-SO");
    expect(result.issues[0]).toContain("not on the selected Sales Order");
    expect(result.issues[1]).toContain("SO Pending Qty");
  });

  it("distributes duplicate barcodes for the same item across consolidated Sales Order lines", () => {
    const lines = [
      { source_line_id: "line-1", product_id: "product-1", code: "SKU-1", barcodes: ["EAN-1"], remaining_quantity: 1, eligible: true },
      { source_line_id: "line-2", product_id: "product-1", code: "SKU-1", barcodes: ["EAN-1"], remaining_quantity: 2, eligible: true },
    ];
    const result = applySourceBarcodeQuantityRows([["EAN-1", "2"]], lines, {});

    expect(result).toEqual({ quantities: { "line-1": "1", "line-2": "1" }, issues: [], rejectedRows: [] });
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
