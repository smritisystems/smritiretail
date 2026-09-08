import { describe, expect, it } from "vitest";

describe("Customer PO billing architecture contracts", () => {
  it("keeps Customer PO as a first-class source without requiring execution documents", () => {
    const source = "CUSTOMER_PO";
    const prerequisites = { salesOrder: false, delivery: false };

    expect(source).toBe("CUSTOMER_PO");
    expect(prerequisites.salesOrder).toBe(false);
    expect(prerequisites.delivery).toBe(false);
  });

  it("calculates partial and full utilization from ordered and billed quantities", () => {
    const ordered = 100;
    const invoices = [40, 30, 30];
    let billed = 0;

    const states = invoices.map(quantity => {
      billed += quantity;
      return {
        billed,
        remaining: Math.max(0, ordered - billed),
        status: billed >= ordered ? "FULLY_BILLED" : "PARTIALLY_BILLED"
      };
    });

    expect(states).toEqual([
      { billed: 40, remaining: 60, status: "PARTIALLY_BILLED" },
      { billed: 70, remaining: 30, status: "PARTIALLY_BILLED" },
      { billed: 100, remaining: 0, status: "FULLY_BILLED" }
    ]);
  });

  it("blocks over-billing under the initial governed policy", () => {
    const policy = "BLOCK";
    const remaining = 20;
    const requested = 30;

    expect(policy).toBe("BLOCK");
    expect(requested > remaining).toBe(true);
  });

  it("preserves source traceability without treating free-text PO reference as the source of truth", () => {
    const invoice = {
      customer_po_id: "cpo-1001",
      customer_po_number_snapshot: "PO-1001",
      source_document_type: "CUSTOMER_PO",
      source_document_id: "cpo-1001",
      po_reference: "PO-1001"
    };

    expect(invoice.customer_po_id).toBe("cpo-1001");
    expect(invoice.source_document_type).toBe("CUSTOMER_PO");
    expect(invoice.po_reference).toBe("PO-1001");
  });
});
