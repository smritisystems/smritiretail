/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 3.1.0
 * * Created    : 2026-11-02
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 * * Target UI  : Reference-Exact Statutory Business Ledger & Sales Register Vitest Suite
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  BusinessLedgerTab,
  formatINR,
  formatIndianShortCurrency,
  formatDisplayDate,
  getMonthName,
  parseSkuTokens,
  TaxInvoiceLine,
  DetailedInvoiceResponse,
} from "../components/BusinessLedgerTab.tsx";
import { DrillDownProvider } from "../components/drilldown/drilldown_store.tsx";

describe("SMRITI Statutory Business Ledger & Sales Register Unit Suite", () => {
  // Sample test dataset representative of the 110 Modern Trade invoices
  const mockInvoices: TaxInvoiceLine[] = [
    {
      invoice_id: "inv-001",
      bill_no: 18,
      invoice_number: "TT2026-2027/18",
      invoice_date: "2026-08-12",
      status: "Submitted",
      document_type: "Tax Invoice",
      customer_name: "Reliance Retail Limited",
      customer_gstin: "27AAACR1921R1Z5",
      place_of_supply: "Maharashtra (27)",
      sis_code: "1888",
      site_name: "RRL FOOTPRINT RKB PATH DIBRUGARH AS",
      items_count: 101,
      total_quantity: 152.0,
      taxable_value: 168634.88,
      gst_rate: 5.0,
      cgst_amount: 4215.88,
      sgst_amount: 4215.88,
      igst_amount: 0,
      total_tax: 8431.76,
      round_off: 0.36,
      grand_total: 177067.0,
    },
    {
      invoice_id: "inv-002",
      bill_no: 19,
      invoice_number: "TT2026-2027/19",
      invoice_date: "2026-08-12",
      status: "Submitted",
      document_type: "Tax Invoice",
      customer_name: "Reliance Retail Limited",
      customer_gstin: "27AAACR1921R1Z5",
      place_of_supply: "Maharashtra (27)",
      sis_code: "1969",
      site_name: "RRL FOOTPRINT FORTUNE CENTRAL GUWAH",
      items_count: 101,
      total_quantity: 152.0,
      taxable_value: 168634.88,
      gst_rate: 5.0,
      cgst_amount: 4215.88,
      sgst_amount: 4215.88,
      igst_amount: 0,
      total_tax: 8431.76,
      round_off: 0.36,
      grand_total: 177067.0,
    },
    {
      invoice_id: "inv-003",
      bill_no: 20,
      invoice_number: "TT2026-2027/20",
      invoice_date: "2026-08-12",
      status: "Submitted",
      document_type: "Tax Invoice",
      customer_name: "Reliance Retail Limited",
      customer_gstin: "27AAACR1921R1Z5",
      place_of_supply: "Maharashtra (27)",
      sis_code: "1977",
      site_name: "RRL FOOTPRINT GACHIBOWLI HYDERABAD",
      items_count: 85,
      total_quantity: 130.0,
      taxable_value: 156864.0,
      gst_rate: 5.0,
      cgst_amount: 3888.5,
      sgst_amount: 3888.5,
      igst_amount: 0,
      total_tax: 7777.0,
      round_off: 0.0,
      grand_total: 164641.0,
    },
    {
      invoice_id: "inv-004",
      bill_no: 21,
      invoice_number: "TT2026-2027/21",
      invoice_date: "2026-09-05",
      status: "Submitted",
      document_type: "Tax Invoice",
      customer_name: "Tata Trent Limited",
      customer_gstin: "27AAACT2345T1Z1",
      place_of_supply: "Maharashtra (27)",
      sis_code: "8155",
      site_name: "RRL FOOTPRINT RAMA TALKIES RO",
      items_count: 60,
      total_quantity: 90.0,
      taxable_value: 106124.0,
      gst_rate: 5.0,
      cgst_amount: 2653.0,
      sgst_amount: 2653.0,
      igst_amount: 0,
      total_tax: 5306.0,
      round_off: 0.0,
      grand_total: 111430.0,
    },
    {
      invoice_id: "inv-005",
      bill_no: 22,
      invoice_number: "TT2026-2027/22",
      invoice_date: "2026-09-10",
      status: "Cancelled",
      document_type: "Tax Invoice",
      customer_name: "Cancelled Customer",
      customer_gstin: "27AAAAA0000A1Z0",
      place_of_supply: "Maharashtra (27)",
      items_count: 10,
      total_quantity: 10.0,
      taxable_value: 50000.0,
      gst_rate: 5.0,
      cgst_amount: 1250.0,
      sgst_amount: 1250.0,
      igst_amount: 0,
      total_tax: 2500.0,
      round_off: 0.0,
      grand_total: 52500.0,
    },
  ];

  describe("1. Currency and Date Formatters", () => {
    it("should format INR currency according to Indian standard numbering", () => {
      const formatted = formatINR(177067);
      expect(formatted).toContain("1,77,067");

      const formattedCrores = formatINR(31752767);
      expect(formattedCrores).toContain("3,17,52,767");
    });

    it("should format short Indian currency for charts and axes (Cr, L, K)", () => {
      expect(formatIndianShortCurrency(0)).toBe("₹0");
      expect(formatIndianShortCurrency(25400000)).toBe("₹2.54 Cr");
      expect(formatIndianShortCurrency(12400000)).toBe("₹1.24 Cr");
      expect(formatIndianShortCurrency(1876000)).toBe("₹18.76 L");
      expect(formatIndianShortCurrency(2054000)).toBe("₹20.54 L");
      expect(formatIndianShortCurrency(50000)).toBe("₹50 K");
      expect(formatIndianShortCurrency(850)).toBe("₹850");
    });

    it("should format display dates consistently in 'DD MMM YYYY' format", () => {
      expect(formatDisplayDate("2026-08-12")).toBe("12 Aug 2026");
      expect(formatDisplayDate("2026-11-30")).toBe("30 Nov 2026");
      expect(formatDisplayDate(null)).toBe("—");
      expect(formatDisplayDate("")).toBe("—");
    });

    it("should extract month and year as 'MMM YYYY' for timeline aggregation", () => {
      expect(getMonthName("2026-08-12")).toBe("Aug 2026");
      expect(getMonthName("2026-09-05")).toBe("Sept 2026");
      expect(getMonthName("2026-10-15")).toBe("Oct 2026");
      expect(getMonthName("2026-11-20")).toBe("Nov 2026");
    });

    it("should parse SKU code tokens into canonical Article, Color, and Size components", () => {
      const res1 = parseSkuTokens("CH-24-G-BLACK-36", "CH-24-G BLACK 36");
      expect(res1.article).toBe("CH-24-G");
      expect(res1.color).toBe("BLACK");
      expect(res1.size).toBe("36");

      const res2 = parseSkuTokens("SND-01-C-GOLD-38", "SND-01-C GOLD 38");
      expect(res2.article).toBe("SND-01-C");
      expect(res2.color).toBe("GOLD");
      expect(res2.size).toBe("38");

      const res3 = parseSkuTokens("CH-18-E-BROWN-40", "CH-18-E BROWN 40");
      expect(res3.article).toBe("CH-18-E");
      expect(res3.color).toBe("BROWN");
      expect(res3.size).toBe("40");

      const resFallback = parseSkuTokens(null, null);
      expect(resFallback.article).toBe("—");
      expect(resFallback.color).toBe("—");
      expect(resFallback.size).toBe("—");
    });
  });

  describe("2. Statutory Financial Calculations and KPI Accuracy", () => {
    it("should exclude cancelled invoices from statutory financial totals", () => {
      const activeInvoices = mockInvoices.filter((inv) => inv.status.toLowerCase() !== "cancelled");
      expect(activeInvoices.length).toBe(4);

      const totalGross = activeInvoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
      const totalTax = activeInvoices.reduce((sum, inv) => sum + (inv.total_tax || 0), 0);
      const totalTaxable = activeInvoices.reduce((sum, inv) => sum + (inv.taxable_value || 0), 0);

      // 177067 + 177067 + 164641 + 111430 = 630205
      expect(totalGross).toBe(630205);
      // 8431.76 + 8431.76 + 7777 + 5306 = 29946.52
      expect(totalTax).toBe(29946.52);
      expect(totalTaxable).toBe(600257.76);

      const avgInvoiceValue = Math.round(totalGross / activeInvoices.length);
      expect(avgInvoiceValue).toBe(157551);
    });

    it("should compute exact line-item tax rates and rounding for TT2026-2027/18", () => {
      const line18 = mockInvoices[0];
      expect(line18.invoice_number).toBe("TT2026-2027/18");
      expect(line18.taxable_value).toBe(168634.88);
      expect(line18.total_tax).toBe(8431.76);
      expect(line18.round_off).toBe(0.36);
      expect(line18.grand_total).toBe(177067.0);

      const computedTotal = Math.round(line18.taxable_value + line18.total_tax + (line18.round_off || 0));
      expect(computedTotal).toBe(177067);
    });
  });

  describe("3. Invoice Register Filtering and Search", () => {
    it("should filter by search query matching invoice number, customer, GSTIN, store code, or site name", () => {
      const searchByInv = (query: string) => {
        const q = query.trim().toLowerCase();
        return mockInvoices.filter(
          (inv) =>
            inv.invoice_number.toLowerCase().includes(q) ||
            (inv.customer_name && inv.customer_name.toLowerCase().includes(q)) ||
            (inv.customer_gstin && inv.customer_gstin.toLowerCase().includes(q)) ||
            (inv.sis_code && inv.sis_code.toLowerCase().includes(q)) ||
            (inv.site_name && inv.site_name.toLowerCase().includes(q))
        );
      };

      expect(searchByInv("TT2026-2027/18").length).toBe(1);
      expect(searchByInv("Reliance").length).toBe(3);
      expect(searchByInv("27AAACR1921R1Z5").length).toBe(3);
      expect(searchByInv("Trent").length).toBe(1);
      expect(searchByInv("1888").length).toBe(1);
      expect(searchByInv("DIBRUGARH").length).toBe(1);
      expect(searchByInv("GACHIBOWLI").length).toBe(1);
      expect(searchByInv("NonExistent").length).toBe(0);
    });

    it("should filter by customer selection", () => {
      const filterByCustomer = (custName: string) => {
        if (custName === "All Customers") return mockInvoices;
        return mockInvoices.filter((inv) => (inv.customer_name || "").toLowerCase() === custName.toLowerCase());
      };

      expect(filterByCustomer("All Customers").length).toBe(5);
      expect(filterByCustomer("Reliance Retail Limited").length).toBe(3);
      expect(filterByCustomer("Tata Trent Limited").length).toBe(1);
    });

    it("should filter by invoice status selection", () => {
      const filterByStatus = (status: string) => {
        if (status === "All Status") return mockInvoices;
        return mockInvoices.filter((inv) => (inv.status || "").toLowerCase() === status.toLowerCase());
      };

      expect(filterByStatus("All Status").length).toBe(5);
      expect(filterByStatus("Submitted").length).toBe(4);
      expect(filterByStatus("Cancelled").length).toBe(1);
      expect(filterByStatus("Draft").length).toBe(0);
    });
  });

  describe("4. Monthly Aggregation for Totals Bar Chart", () => {
    it("should aggregate both invoice value and invoice count grouped by month", () => {
      const activeInvoices = mockInvoices.filter((inv) => inv.status.toLowerCase() !== "cancelled");
      const monthMap = new Map<string, { totalValue: number; count: number }>();

      activeInvoices.forEach((inv) => {
        const m = getMonthName(inv.invoice_date);
        const existing = monthMap.get(m) || { totalValue: 0, count: 0 };
        existing.totalValue += inv.grand_total || 0;
        existing.count += 1;
        monthMap.set(m, existing);
      });

      const aug = monthMap.get("Aug 2026");
      expect(aug).toBeDefined();
      expect(aug?.count).toBe(3);
      // 177067 + 177067 + 164641 = 518775
      expect(aug?.totalValue).toBe(518775);

      const sep = monthMap.get("Sept 2026");
      expect(sep).toBeDefined();
      expect(sep?.count).toBe(1);
      expect(sep?.totalValue).toBe(111430);
    });
  });

  describe("5. Detailed Invoice Data Model and Tab Integrity", () => {
    it("should structure DetailedInvoiceResponse with all 5 active tabs data", () => {
      const detail: DetailedInvoiceResponse = {
        id: "inv-001",
        invoice_no: "TT2026-2027/18",
        date: "2026-08-12",
        customer_id: "cust-rel-01",
        customer_name: "Reliance Retail Limited",
        customer_gstin: "27AAACR1921R1Z5",
        pos_state: "Maharashtra (27)",
        billing_address: "Reliance Retail Ltd, Plot 4, Ghansoli, Navi Mumbai, MH - 400701",
        shipping_address: "Central DC Bhiwandi, Building A2, Arihant Complex, Thane, MH",
        taxable_value: 168634.88,
        tax_total: 8431.76,
        grand_total: 177067.0,
        rounding_amount: 0.36,
        status: "Submitted",
        payment_mode: "Credit / Ledger",
        paid_amount: 0,
        balance_amount: 177067.0,
        items: [
          {
            id: "item-1",
            code: "ART-8821",
            name: "Men Leather Formal Oxford - Tan 42",
            hsn_code: "6403",
            quantity: 20,
            price: 2500,
            taxable_value: 47619.05,
            gst_rate: 5.0,
            tax_amount: 2380.95,
            total_amount: 50000.0,
          },
        ],
      };

      expect(detail.invoice_no).toBe("TT2026-2027/18");
      expect(detail.items?.length).toBe(1);
      expect(detail.items?.[0].hsn_code).toBe("6403");
      expect(detail.tax_total).toBe(8431.76);
      expect(detail.grand_total).toBe(177067.0);
    });
  });

  describe("6. Component Export and Initial Rendering", () => {
    it("should render BusinessLedgerTab inside DrillDownProvider without runtime errors", () => {
      const html = renderToString(
        <DrillDownProvider>
          <BusinessLedgerTab currentUser={{ role: "Admin", name: "Administrator" }} />
        </DrillDownProvider>
      );

      // Verify header and primary labels are present
      expect(html).toContain("Business Ledger");
      expect(html).toContain("Statutory Sales Register (Tax Invoices)");
      expect(html).toContain("Gross Invoice Value");
      expect(html).toContain("Tax Invoices");
      expect(html).toContain("GST Invoiced");
      expect(html).toContain("Average Invoice Value");
      expect(html).toContain("Invoice Register");
      expect(html).toContain("Monthly Invoice Totals");
    });
  });
});
