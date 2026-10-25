import { describe, expect, it } from "vitest";
import type { BillingLineItem } from "../components/billing/types.ts";
import {
  buildBillingPreviewRequest,
  prepareBillingPostingLines,
} from "../components/billing/billingPreview.ts";

const item = (overrides: Partial<BillingLineItem> = {}): BillingLineItem => ({
  id: "line-1",
  sNo: 1,
  stockNo: "SKU-1",
  barcode: "8900001",
  itemDescription: "Item",
  rate: 100,
  qty: 1,
  value: 100,
  discCode: "",
  discQty: 0,
  discPercent: 0,
  discAmt: 0,
  total: 100,
  salesStaff: "Cashier",
  productId: "product-1",
  gstPercentage: 18,
  ...overrides,
});

describe("canonical billing preview request", () => {
  it("allocates pre-tax bill discounts identically to posting lines", () => {
    const items = [
      item({ qty: 2, rate: 100 }),
      item({ id: "line-2", productId: "product-2", rate: 50, qty: 2 }),
    ];
    const postingLines = prepareBillingPostingLines(items, 30);

    expect(postingLines.map((line) => line.discountAmount)).toEqual([20, 10]);
    expect(postingLines.reduce((sum, line) => sum + line.discountAmount, 0)).toBe(30);
  });

  it("sends the same fixed discounts and tax inclusivity metadata as final posting", () => {
    const items = [item({ discAmt: 5, isTaxInclusive: false })];
    const postingLines = prepareBillingPostingLines(items, 10);
    const request = buildBillingPreviewRequest({
      items,
      postingLines,
      companyId: "COMP-001",
      branchId: "MAIN",
      salesChannel: "B2B_WHOLESALE",
      customer: { id: "customer-1", gstNumber: "27ABCDE1234F1Z5" },
      poReference: "PO-1",
    });

    expect(request.context).toEqual({
      company_id: "COMP-001",
      branch_id: "MAIN",
      source_channel: "B2B_WHOLESALE",
      sales_channel: "B2B_WHOLESALE",
    });
    expect(request.items[0]).toMatchObject({
      code: "SKU-1",
      product_id: "product-1",
      quantity: 1,
      unit_price: 100,
      disc_pct: 0,
      disc_amt: 15,
      gst_rate: 18,
      is_tax_inclusive: false,
    });
    expect(request).toMatchObject({
      customer_id: "customer-1",
      customer_gstin: "27ABCDE1234F1Z5",
      po_reference_no: "PO-1",
    });
  });
});
