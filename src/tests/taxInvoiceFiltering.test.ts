/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.0.0
 * Created      : 2026-08-19
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { describe, it, expect } from "vitest";

describe("Tax Invoice Transaction-Based Filtering", () => {
  const filterActiveInvoices = (rawInvoices: any[]) => {
    return rawInvoices.filter((inv: any) => {
      const hasItems = Array.isArray(inv.items) && inv.items.length > 0;
      const itemsCount = Number(inv.items_count || inv.item_count || 0);
      const grandTotal = parseFloat(inv.grand_total || inv.total_amount || 0);
      const totalQty = Number(inv.total_quantity || inv.quantity || 0);
      return hasItems || itemsCount > 0 || grandTotal > 0 || totalQty > 0;
    });
  };

  it("should keep invoices with line items and transaction values", () => {
    const invoices = [
      {
        id: "inv-001",
        invoice_number: "TT2026-2027/18",
        items: [{ id: "item-1", name: "Shoe A", quantity: 2, price: 500 }],
        grand_total: 1000,
        total_quantity: 2
      },
      {
        id: "inv-002",
        invoice_number: "TT2026-2027/19",
        items_count: 3,
        grand_total: 2500,
        total_quantity: 3
      }
    ];

    const result = filterActiveInvoices(invoices);
    expect(result).toHaveLength(2);
    expect(result.map(i => i.id)).toEqual(["inv-001", "inv-002"]);
  });

  it("should remove invoices that have no transactions (0 items and 0 amount)", () => {
    const invoices = [
      {
        id: "inv-valid",
        invoice_number: "TT2026-2027/20",
        items: [{ id: "item-1", name: "Shoe B", quantity: 1, price: 799 }],
        grand_total: 799
      },
      {
        id: "inv-empty-1",
        invoice_number: "TT2026-2027/21",
        items: [],
        grand_total: 0,
        total_quantity: 0
      },
      {
        id: "inv-empty-2",
        invoice_number: "TT2026-2027/22",
        items: null,
        items_count: 0,
        grand_total: "0.00",
        total_quantity: 0
      },
      {
        id: "inv-empty-3",
        invoice_number: "TT2026-2027/23"
      }
    ];

    const result = filterActiveInvoices(invoices);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("inv-valid");
  });

  it("should sort active invoices sequentially by sequence number", () => {
    const invoices = [
      { id: "inv-71", invoice_number: "TT2026-2027/71", grand_total: 100 },
      { id: "inv-18", invoice_number: "TT2026-2027/18", grand_total: 200 },
      { id: "inv-35", invoice_number: "TT2026-2027/35", grand_total: 300 }
    ];

    const valid = filterActiveInvoices(invoices);
    const sorted = [...valid].sort((a, b) => {
      const getSeq = (inv: any) => {
        const no = inv.invoice_number || inv.invoiceNo || "";
        if (no.includes("/")) {
          try { return parseInt(no.split("/").pop() || "0", 10); } catch { }
        }
        return 99999;
      };
      return getSeq(a) - getSeq(b);
    });

    expect(sorted.map(i => i.id)).toEqual(["inv-18", "inv-35", "inv-71"]);
  });
});
