import { describe, expect, it } from "vitest";
import {
  isReportBuilderCategoryLive,
  resolveReportBuilderFieldSelection,
} from "../components/reports/reportBuilderDomain.ts";

describe("Report Builder live field domains", () => {
  it("switches the query domain and removes fields from the previous domain", () => {
    expect(
      resolveReportBuilderFieldSelection(
        "Purchase",
        ["supplier", "po_date", "quantity"],
        { category: "Sales", key: "sale_invoice_no" },
      ),
    ).toEqual({
      category: "Sales",
      selectedKeys: ["sale_invoice_no"],
    });
  });

  it("adds fields within the active query domain", () => {
    expect(
      resolveReportBuilderFieldSelection(
        "Sales",
        ["sale_invoice_no"],
        { category: "Sales", key: "payment_mode" },
      ),
    ).toEqual({
      category: "Sales",
      selectedKeys: ["sale_invoice_no", "payment_mode"],
    });
  });

  it("allows live inventory and item fields and rejects unsupported finance fields", () => {
    for (const category of ["Inventory", "Items"]) {
      expect(isReportBuilderCategoryLive(category)).toBe(true);
      expect(
        resolveReportBuilderFieldSelection(
          "Purchase",
          ["supplier", "po_date"],
          { category, key: "item_code" },
        ),
      ).toEqual({ category, selectedKeys: ["item_code"] });
    }

    for (const category of ["Finance"]) {
      expect(isReportBuilderCategoryLive(category)).toBe(false);
      expect(
        resolveReportBuilderFieldSelection(
          "Purchase",
          ["supplier", "po_date"],
          { category, key: "unsupported_field" },
        ),
      ).toBeNull();
    }
  });
});
