import { describe, expect, it } from "vitest";
import {
  DEFAULT_BILLING_GRID_LAYOUT,
  getVisibleBillingGridColumns,
  normalizeBillingGridLayout,
} from "../components/billing/billingGridPreferences.ts";

describe("billing grid layout preferences", () => {
  it("uses every column in the sensible default layouts", () => {
    const layout = normalizeBillingGridLayout(undefined);

    expect(layout.invoice.visible).toContain("barcode");
    expect(layout.invoice.visible).toContain("rate");
    expect(layout.invoice.visible).toContain("gst");
    expect(layout.salesOrder.visible).toContain("soQty");
    expect(layout.salesOrder.visible).toContain("fulfilledQty");
    expect(layout.salesOrder.visible).toContain("pendingQty");
    expect(layout.salesOrder.visible).toContain("billQty");
    expect(layout.salesOrder.visible).toContain("total");
  });

  it("keeps required columns and drops unknown or duplicate saved keys", () => {
    const layout = normalizeBillingGridLayout({
      invoice: { order: ["total", "total", "unknown"], visible: ["total", "unknown"] },
      salesOrder: { order: ["billQty"], visible: [] },
    });

    expect(layout.invoice.order).toContain("description");
    expect(layout.invoice.visible).toEqual(expect.arrayContaining(["description", "qty", "total"]));
    expect(layout.invoice.order).not.toContain("unknown");
    expect(layout.invoice.order.filter(key => key === "total")).toHaveLength(1);
    expect(layout.salesOrder.visible).toEqual(expect.arrayContaining(["billQty", "status"]));
  });

  it("migrates prior Sales Order layouts to expose the new amount breakdown and item name", () => {
    const layout = normalizeBillingGridLayout({
      version: 1,
      salesOrder: {
        order: ["select", "row", "barcode", "discount"],
        visible: ["select", "row", "barcode", "discount"],
      },
    });

    expect(layout.version).toBe(2);
    expect(layout.salesOrder.visible).toEqual(expect.arrayContaining([
      "description", "discountPercent", "discountAmount", "taxable", "gstAmount",
    ]));
  });

  it("returns columns in the saved order, independently for each grid", () => {
    const layout = normalizeBillingGridLayout({
      ...DEFAULT_BILLING_GRID_LAYOUT,
      invoice: {
        order: ["total", "description", "qty"],
        visible: ["total", "description", "qty"],
      },
    });

    expect(getVisibleBillingGridColumns("invoice", layout).map(column => column.key).slice(0, 3))
      .toEqual(["total", "description", "qty"]);
    expect(getVisibleBillingGridColumns("salesOrder", layout)[0].key).toBe("select");
  });
});
