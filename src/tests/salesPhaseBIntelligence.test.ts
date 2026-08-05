/**
 * Project      : SMRITI Retail OS
 * Test Suite   : Sales Phase B — POS & Sales Intelligence Tests
 * Standard     : AUD-006 / SALES-B01 to SALES-B06
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 1.0.0
 *
 * Covers:
 *   SALES-B01  buildSalesAnalytics: calculates total revenue, excluding Cancelled invoices
 *   SALES-B02  buildSalesAnalytics: counts Paid, Credit, and Cancelled invoices accurately
 *   SALES-B03  buildSalesAnalytics: calculates Average Order Value (AOV = totalRevenue / validCount)
 *   SALES-B04  buildSalesAnalytics: aggregates payment channel volume and percentages (UPI, Cash, Card, Credit)
 *   SALES-B05  buildSalesAnalytics: aggregates top selling products by revenue sorted descending
 *   SALES-B06  buildSalesAnalytics: aggregates total GST tax collected
 */

import { describe, it, expect } from "vitest";
import { SalesInvoiceRecord } from "../kernel/public/ISalesService.js";

// ── Pure analytics function extracted for testing ────────────────────────────

interface ProductSalesSummary {
  itemId: string;
  itemCode: string;
  itemName: string;
  totalQty: number;
  totalRevenue: number;
}

interface PaymentChannelSummary {
  channel: string;
  totalAmount: number;
  count: number;
  percentage: number;
}

interface SalesAnalyticsData {
  totalInvoices: number;
  paidInvoices: number;
  creditInvoices: number;
  cancelledInvoices: number;
  totalRevenue: number;
  totalTax: number;
  avgOrderValue: number;
  topProducts: ProductSalesSummary[];
  paymentChannels: PaymentChannelSummary[];
}

function buildSalesAnalytics(invoices: SalesInvoiceRecord[]): SalesAnalyticsData {
  const productMap = new Map<string, ProductSalesSummary>();
  const paymentMap = new Map<string, { totalAmount: number; count: number }>();

  let paidInvoices = 0;
  let creditInvoices = 0;
  let cancelledInvoices = 0;
  let totalRevenue = 0;
  let totalTax = 0;

  invoices.forEach((inv) => {
    if (inv.status === "Cancelled") {
      cancelledInvoices++;
      return;
    }

    if (inv.status === "Credit") creditInvoices++;
    else paidInvoices++;

    totalRevenue += inv.netPayable || 0;
    totalTax += inv.taxTotal || 0;

    const mode = inv.paymentMode || "Cash";
    const existingPayment = paymentMap.get(mode);
    if (existingPayment) {
      existingPayment.totalAmount += inv.netPayable || 0;
      existingPayment.count++;
    } else {
      paymentMap.set(mode, { totalAmount: inv.netPayable || 0, count: 1 });
    }

    (inv.lines || []).forEach((line) => {
      const key = line.itemId || line.itemCode;
      const existingProduct = productMap.get(key);
      if (existingProduct) {
        existingProduct.totalQty += line.qty || 1;
        existingProduct.totalRevenue += line.lineTotal || 0;
      } else {
        productMap.set(key, {
          itemId: key,
          itemCode: line.itemCode,
          itemName: line.itemName,
          totalQty: line.qty || 1,
          totalRevenue: line.lineTotal || 0,
        });
      }
    });
  });

  const validCount = paidInvoices + creditInvoices;
  const avgOrderValue = validCount > 0 ? totalRevenue / validCount : 0;

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5);

  const totalVol = totalRevenue || 1;
  const paymentChannels = Array.from(paymentMap.entries())
    .map(([channel, data]) => ({
      channel,
      totalAmount: data.totalAmount,
      count: data.count,
      percentage: Math.round((data.totalAmount / totalVol) * 100),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);

  return {
    totalInvoices: invoices.length,
    paidInvoices,
    creditInvoices,
    cancelledInvoices,
    totalRevenue,
    totalTax,
    avgOrderValue,
    topProducts,
    paymentChannels,
  };
}

// ── Fixture Builder ───────────────────────────────────────────────────────────

function makeInvoice(overrides: Partial<SalesInvoiceRecord>): SalesInvoiceRecord {
  return {
    id: `inv-${Math.random().toString(36).slice(2, 7)}`,
    invoiceNumber: "INV-2026-TEST",
    customerName: "Walk-in",
    customerMobile: "9876543210",
    invoiceDate: "2026-08-01",
    paymentMode: "Cash",
    cashierName: "Cashier",
    itemsTotal: 1000,
    discountTotal: 0,
    taxableTotal: 847.46,
    cgstTotal: 76.27,
    sgstTotal: 76.27,
    igstTotal: 0,
    taxTotal: 152.54,
    netPayable: 1000,
    roundedAmount: 1000,
    lines: [],
    status: "Paid",
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Sales Phase B — POS & Sales Intelligence Tests (SALES-B01 to SALES-B06)", () => {
  it("SALES-B01: buildSalesAnalytics calculates total revenue excluding Cancelled invoices", () => {
    const invoices = [
      makeInvoice({ netPayable: 2000, status: "Paid" }),
      makeInvoice({ netPayable: 3000, status: "Credit" }),
      makeInvoice({ netPayable: 5000, status: "Cancelled" }),
    ];
    const { totalRevenue } = buildSalesAnalytics(invoices);
    expect(totalRevenue).toBe(5000);
  });

  it("SALES-B02: buildSalesAnalytics counts Paid, Credit, and Cancelled invoices accurately", () => {
    const invoices = [
      makeInvoice({ status: "Paid" }),
      makeInvoice({ status: "Paid" }),
      makeInvoice({ status: "Credit" }),
      makeInvoice({ status: "Cancelled" }),
    ];
    const { totalInvoices, paidInvoices, creditInvoices, cancelledInvoices } = buildSalesAnalytics(invoices);
    expect(totalInvoices).toBe(4);
    expect(paidInvoices).toBe(2);
    expect(creditInvoices).toBe(1);
    expect(cancelledInvoices).toBe(1);
  });

  it("SALES-B03: buildSalesAnalytics calculates correct Average Order Value (AOV)", () => {
    const invoices = [
      makeInvoice({ netPayable: 2000, status: "Paid" }),
      makeInvoice({ netPayable: 4000, status: "Paid" }),
      makeInvoice({ netPayable: 9999, status: "Cancelled" }),
    ];
    const { avgOrderValue } = buildSalesAnalytics(invoices);
    expect(avgOrderValue).toBe(3000); // 6000 / 2
  });

  it("SALES-B04: buildSalesAnalytics aggregates payment channel breakdown with percentages", () => {
    const invoices = [
      makeInvoice({ paymentMode: "UPI", netPayable: 6000, status: "Paid" }),
      makeInvoice({ paymentMode: "Cash", netPayable: 4000, status: "Paid" }),
    ];
    const { paymentChannels } = buildSalesAnalytics(invoices);
    expect(paymentChannels[0].channel).toBe("UPI");
    expect(paymentChannels[0].totalAmount).toBe(6000);
    expect(paymentChannels[0].percentage).toBe(60);

    expect(paymentChannels[1].channel).toBe("Cash");
    expect(paymentChannels[1].totalAmount).toBe(4000);
    expect(paymentChannels[1].percentage).toBe(40);
  });

  it("SALES-B05: buildSalesAnalytics aggregates top products by revenue sorted descending", () => {
    const invoices = [
      makeInvoice({
        status: "Paid",
        lines: [
          { id: "1", itemId: "p1", itemCode: "SKU-1", itemName: "Shirt", hsnCode: "6109", qty: 2, uom: "Pcs", rate: 500, discountPct: 0, discountAmount: 0, taxableValue: 892, gstRate: 12, cgstAmount: 54, sgstAmount: 54, igstAmount: 0, totalTaxAmount: 108, lineTotal: 1000 },
          { id: "2", itemId: "p2", itemCode: "SKU-2", itemName: "Jeans", hsnCode: "6203", qty: 1, uom: "Pcs", rate: 2500, discountPct: 0, discountAmount: 0, taxableValue: 2232, gstRate: 12, cgstAmount: 134, sgstAmount: 134, igstAmount: 0, totalTaxAmount: 268, lineTotal: 2500 },
        ],
      }),
    ];

    const { topProducts } = buildSalesAnalytics(invoices);
    expect(topProducts[0].itemId).toBe("p2");
    expect(topProducts[0].totalRevenue).toBe(2500);

    expect(topProducts[1].itemId).toBe("p1");
    expect(topProducts[1].totalRevenue).toBe(1000);
  });

  it("SALES-B06: buildSalesAnalytics aggregates total GST tax collected", () => {
    const invoices = [
      makeInvoice({ taxTotal: 180, status: "Paid" }),
      makeInvoice({ taxTotal: 360, status: "Paid" }),
      makeInvoice({ taxTotal: 900, status: "Cancelled" }),
    ];
    const { totalTax } = buildSalesAnalytics(invoices);
    expect(totalTax).toBe(540);
  });
});
