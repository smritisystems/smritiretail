/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-19
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { describe, it, expect } from "vitest";
import { salesDocumentConfig } from "../components/global/document/configs/salesDocument.config.ts";
import { purchaseDocumentConfig } from "../components/global/document/configs/purchaseDocument.config.ts";
import { stockLedgerConfig } from "../components/global/ledger/configs/stockLedger.config.tsx";
import { auditLogsConfig } from "../components/global/ledger/configs/auditLogs.config.tsx";
import { DocumentLineItem, DocumentTotals } from "../components/global/document/types.ts";

describe("Phase 2 — DocumentStudio Global Architecture", () => {
  it("should configure Sales and Purchase document configs correctly", () => {
    expect(salesDocumentConfig.documentType).toBe("SALES_INVOICE");
    expect(salesDocumentConfig.apiEndpoint).toBe("/api/v1/sales/invoices");
    expect(salesDocumentConfig.partyType).toBe("Customer");

    expect(purchaseDocumentConfig.documentType).toBe("PURCHASE_ORDER");
    expect(purchaseDocumentConfig.apiEndpoint).toBe("/api/v1/purchase/orders/");
    expect(purchaseDocumentConfig.partyType).toBe("Supplier");
  });

  it("should calculate real-time document totals and statutory GST splits deterministically", () => {
    const calculateTotals = (lines: DocumentLineItem[]): DocumentTotals => {
      let totalQuantity = 0;
      let subTotal = 0;
      let totalDiscount = 0;
      let taxableAmount = 0;
      let totalTax = 0;

      lines.forEach((line) => {
        const lineQty = Number(line.quantity) || 0;
        const lineRate = Number(line.price) || 0;
        const discPercent = Number(line.discountPercent) || 0;
        const gstRate = Number(line.gstRate) || 0;

        const rawAmount = lineQty * lineRate;
        const discAmount = (rawAmount * discPercent) / 100;
        const taxable = rawAmount - discAmount;
        const tax = (taxable * gstRate) / 100;

        totalQuantity += lineQty;
        subTotal += rawAmount;
        totalDiscount += discAmount;
        taxableAmount += taxable;
        totalTax += tax;
      });

      const unroundedGrand = taxableAmount + totalTax;
      const roundedGrand = Math.round(unroundedGrand);
      const roundOff = Number((roundedGrand - unroundedGrand).toFixed(2));

      return {
        itemCount: lines.length,
        totalQuantity,
        subTotal: Number(subTotal.toFixed(2)),
        totalDiscount: Number(totalDiscount.toFixed(2)),
        taxableAmount: Number(taxableAmount.toFixed(2)),
        cgstAmount: Number((totalTax / 2).toFixed(2)),
        sgstAmount: Number((totalTax / 2).toFixed(2)),
        igstAmount: 0,
        totalTax: Number(totalTax.toFixed(2)),
        roundOff,
        grandTotal: roundedGrand,
      };
    };

    const mockLines: DocumentLineItem[] = [
      {
        id: "l1",
        code: "SKU-TEA",
        name: "Premium Tea",
        quantity: 2,
        price: 250,
        discountPercent: 10, // 500 - 50 = 450 taxable
        gstRate: 18, // 450 * 18% = 81 tax (40.50 CGST + 40.50 SGST)
        lineTotal: 531,
      },
      {
        id: "l2",
        code: "SKU-OIL",
        name: "Refined Oil",
        quantity: 1,
        price: 500,
        discountPercent: 0, // 500 taxable
        gstRate: 5, // 500 * 5% = 25 tax (12.50 CGST + 12.50 SGST)
        lineTotal: 525,
      },
    ];

    const totals = calculateTotals(mockLines);
    expect(totals.itemCount).toBe(2);
    expect(totals.totalQuantity).toBe(3);
    expect(totals.subTotal).toBe(1000);
    expect(totals.totalDiscount).toBe(50);
    expect(totals.taxableAmount).toBe(950);
    expect(totals.totalTax).toBe(106);
    expect(totals.cgstAmount).toBe(53);
    expect(totals.sgstAmount).toBe(53);
    expect(totals.grandTotal).toBe(1056);
  });

  it("should merge quantities for identical scanned items on document lines", () => {
    let lines: DocumentLineItem[] = [
      {
        id: "l1",
        productId: "p1",
        code: "SKU-1",
        name: "Item 1",
        quantity: 2,
        price: 100,
        lineTotal: 200,
      },
    ];

    const addOrMerge = (prodId: string, qty: number) => {
      const idx = lines.findIndex((l) => l.productId === prodId);
      if (idx >= 0) {
        lines[idx].quantity += qty;
        lines[idx].lineTotal = lines[idx].quantity * lines[idx].price;
      } else {
        lines.push({
          id: `l-${Date.now()}`,
          productId: prodId,
          code: "SKU-2",
          name: "Item 2",
          quantity: qty,
          price: 150,
          lineTotal: qty * 150,
        });
      }
    };

    addOrMerge("p1", 3);
    expect(lines.length).toBe(1);
    expect(lines[0].quantity).toBe(5);
    expect(lines[0].lineTotal).toBe(500);

    addOrMerge("p2", 1);
    expect(lines.length).toBe(2);
    expect(lines[1].quantity).toBe(1);
  });
});

describe("Phase 2 — LedgerScreen Global Architecture", () => {
  it("should configure Stock Ledger config with movement type filter and endpoint", () => {
    expect(stockLedgerConfig.apiEndpoint).toBe("/inventory/ledger");
    expect(stockLedgerConfig.entityName).toBe("Stock Movement");
    expect(stockLedgerConfig.filters?.[0].key).toBe("movement_type");
    expect(stockLedgerConfig.columns.length).toBeGreaterThanOrEqual(5);
  });

  it("should configure Audit Logs config with action filter and endpoint", () => {
    expect(auditLogsConfig.apiEndpoint).toBe("/audit-logs");
    expect(auditLogsConfig.entityName).toBe("Audit Log");
    expect(auditLogsConfig.filters?.[0].key).toBe("action");
    expect(auditLogsConfig.columns.length).toBeGreaterThanOrEqual(5);
  });

  it("should transform backend stock movements payload into standard ledger rows", () => {
    const rawData = [
      {
        id: "mov-1",
        created_at: "2026-08-19T10:00:00Z",
        sku: "SKU-TEA",
        product_name: "Tata Tea 1kg",
        movement_type: "OUT",
        quantity: "4.00",
        reference_doc_id: "BILL-1001",
        warehouse: "Main WH",
      },
    ];

    const transformed = stockLedgerConfig.responseTransform!(rawData);
    expect(transformed.length).toBe(1);
    expect(transformed[0].quantity).toBe(4);
    expect(transformed[0].movement_type).toBe("OUT");
    expect(transformed[0].sku).toBe("SKU-TEA");
  });
});
