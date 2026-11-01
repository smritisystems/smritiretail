import { describe, expect, it } from "vitest";
import { buildSalesOrderPayload, createSalesOrderNumber } from "../utils/salesOrderPayload";
import type { SalesOrderFormData } from "../components/sales/SalesOrderFormPremium";

const formData: SalesOrderFormData = {
  docPrefix: "SO",
  docNumber: "Auto",
  docDate: "2026-11-02",
  docTime: "10:30",
  referenceNo: "RRL-PO-123",
  deliveryTerms: "Door Delivery",
  paymentTerms: "Net 30",
  orderStatus: "Open",
  customerId: "customer-db-id",
  customerCode: "RRL-001",
  customerName: "Reliance Retail",
  salesStaff: "",
  remarks: "",
  items: [{
    id: "ui-row-1",
    productId: "product-db-id",
    itemId: "item-db-id",
    variantId: "variant-db-id",
    stockNo: "SKU-100",
    barcode: "890100",
    description: "Product 100",
    rate: 100,
    quantity: 2,
    value: 200,
    discPercent: 10,
    discAmount: 20,
    taxPercent: 18,
    taxAmount: 32.4,
    total: 212.4,
  }],
  totalSalesValue: 200,
  totalDiscount: 20,
  totalTax: 32.4,
  netAmount: 212.4,
};

describe("Sales order create payload", () => {
  it("uses resolved database IDs and persists the customer PO reference", () => {
    const payload = buildSalesOrderPayload(formData, "SO-ORDER-1");

    expect(payload.order_no).toBe("SO-ORDER-1");
    expect(payload.customer_id).toBe("customer-db-id");
    expect(payload.po_number).toBe("RRL-PO-123");
    expect(payload.grand_total).toBe(212.4);
    expect(payload.items[0]).toMatchObject({
      product_id: "product-db-id",
      item_id: "item-db-id",
      variant_id: "variant-db-id",
      code: "SKU-100",
      ean: "890100",
      quantity: 2,
      discount_percent: 10,
      discount_amount: 20,
    });
    expect(payload.items[0].product_id).not.toBe("ui-row-1");
  });

  it("generates a real order number when the form displays Auto", () => {
    expect(createSalesOrderNumber("SO", 1)).toMatch(/^SO-[A-Z0-9]+-[A-Z0-9]{6}$/);
    expect(createSalesOrderNumber("SO", 1)).not.toBe("SO-Auto");
  });
});
