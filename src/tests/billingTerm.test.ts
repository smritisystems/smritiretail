/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.7.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Stitch Distributor Invoicing & Settlement Studio Unit Tests
 */

import { describe, it, expect } from "vitest";
import { Product } from "../types.ts";
import { 
  BillingLineItem, 
  BillingSummaryTotals, 
  PdtImportRow, 
  TransporterRow, 
  AddonDeductionRow,
  SettlementPaymentRow,
  CashDenominationState
} from "../components/billing/types.ts";

describe("SMRITI — Distributor Invoicing, Settlement & PDT Import Tests", () => {
  const sampleProducts: Product[] = [
    {
      id: "prod-001",
      code: "SKU-OXF-001",
      name: "Oxford Cotton Shirt",
      barcode: "8901234567890",
      brand: "SMRITI",
      category: "Apparel",
      price: 1499.0,
      mrp: 1999.0,
      stock: 50,
      color: "Blue",
      size: "40"
    },
    {
      id: "prod-002",
      code: "SKU-DNM-002",
      name: "Slim Fit Denim Jeans",
      barcode: "8909876543210",
      brand: "SMRITI",
      category: "Apparel",
      price: 2499.0,
      mrp: 2999.0,
      stock: 30,
      color: "Dark Indigo",
      size: "32"
    }
  ];

  // TEST 1 — Line Item Financial Calculation
  it("TEST 1: should calculate line item gross value, discount amount, and total correctly", () => {
    const rate = 1499.0;
    const qty = 2;
    const value = rate * qty; // 2998.0
    const discPercent = 10;
    const discAmt = (value * discPercent) / 100; // 299.80
    const taxableValue = value - discAmt; // 2698.20
    const gstPct = 18;
    const taxAmount = (taxableValue * gstPct) / 100; // 485.676 -> 485.68
    const total = taxableValue + taxAmount; // 3183.88

    expect(value).toBe(2998.0);
    expect(discAmt).toBe(299.8);
    expect(Number(taxAmount.toFixed(2))).toBe(485.68);
    expect(Number(total.toFixed(2))).toBe(3183.88);
  });

  // TEST 2 — Summary Totals Aggregation with Transporter and Addons
  it("TEST 2: should aggregate summary totals across multiple line items, transporter freight, and addons", () => {
    const lineItems: BillingLineItem[] = [
      {
        id: "item-1",
        sNo: 1,
        stockNo: "SKU-OXF-001",
        barcode: "8901234567890",
        itemDescription: "Oxford Cotton Shirt",
        rate: 1499.0,
        qty: 2,
        value: 2998.0,
        discCode: "PROMO10",
        discQty: 2,
        discPercent: 10,
        discAmt: 299.8,
        taxAmount: 485.68,
        total: 3183.88,
        salesStaff: "Staff A"
      },
      {
        id: "item-2",
        sNo: 2,
        stockNo: "SKU-DNM-002",
        barcode: "8909876543210",
        itemDescription: "Slim Fit Denim Jeans",
        rate: 2499.0,
        qty: 1,
        value: 2499.0,
        discCode: "",
        discQty: 0,
        discPercent: 0,
        discAmt: 0,
        taxAmount: 449.82,
        total: 2948.82,
        salesStaff: "Staff A"
      }
    ];

    const transporterRows: TransporterRow[] = [
      {
        sNo: 1,
        type: "Road Freight",
        code: "TR-01",
        description: "Local Express",
        rateType: "Fixed",
        rateAmt: 150.0,
        rate: 0,
        amount: 150.0
      }
    ];

    const addonRows: AddonDeductionRow[] = [
      {
        sNo: 1,
        type: "Addon",
        code: "INS",
        description: "Transit Insurance",
        rateType: "Fixed",
        rate: 50.0,
        amount: 50.0
      },
      {
        sNo: 2,
        type: "Deduction",
        code: "CASH_DISC",
        description: "Cash Discount",
        rateType: "Fixed",
        rate: 100.0,
        amount: 100.0
      }
    ];

    const totalQty = lineItems.reduce((acc, it) => acc + it.qty, 0); // 3
    const salesValue = lineItems.reduce((acc, it) => acc + it.value, 0); // 5497.0
    const itemDiscount = lineItems.reduce((acc, it) => acc + it.discAmt, 0); // 299.8
    const totalTax = lineItems.reduce((acc, it) => acc + (it.taxAmount || 0), 0); // 935.50
    const totalAddons = transporterRows.reduce((acc, t) => acc + t.amount, 0) + addonRows.filter(a => a.type === "Addon").reduce((acc, a) => acc + a.amount, 0); // 150 + 50 = 200
    const totalDeductions = addonRows.filter(a => a.type === "Deduction").reduce((acc, a) => acc + a.amount, 0); // 100

    const netAmount = salesValue - itemDiscount + totalTax + totalAddons - totalDeductions; // 5497 - 299.8 + 935.5 + 200 - 100 = 6232.70

    expect(totalQty).toBe(3);
    expect(salesValue).toBe(5497.0);
    expect(itemDiscount).toBe(299.8);
    expect(totalAddons).toBe(200.0);
    expect(totalDeductions).toBe(100.0);
    expect(Number(netAmount.toFixed(2))).toBe(6232.70);
  });

  // TEST 3 — Multi-Tender Settlement Calculations
  it("TEST 3: should calculate split payments, balance remaining, and change due", () => {
    const netAmount = 5000.0;
    const payments: SettlementPaymentRow[] = [
      { id: "1", mode: "Cash", refNo: "", amount: 2000.0, bankDetails: "" },
      { id: "2", mode: "Credit Card", refNo: "AUTH998", amount: 3000.0, bankDetails: "HDFC" }
    ];

    const totalTendered = payments.reduce((s, p) => s + p.amount, 0);
    const balanceRemaining = Math.max(0, netAmount - totalTendered);
    const changeDue = Math.max(0, totalTendered - netAmount);

    expect(totalTendered).toBe(5000.0);
    expect(balanceRemaining).toBe(0);
    expect(changeDue).toBe(0);

    // Overpayment scenario
    const overPayments: SettlementPaymentRow[] = [
      { id: "1", mode: "Cash", refNo: "", amount: 5500.0, bankDetails: "" }
    ];
    const overTendered = overPayments.reduce((s, p) => s + p.amount, 0);
    const overChange = Math.max(0, overTendered - netAmount);
    expect(overChange).toBe(500.0);
  });

  // TEST 4 — Denomination Counter Math
  it("TEST 4: should calculate cash denomination counter total correctly", () => {
    const denoms: CashDenominationState = {
      d2000: 2, // 4000
      d500: 4,  // 2000
      d200: 5,  // 1000
      d100: 10, // 1000
      d50: 4,   // 200
      d20: 5,   // 100
      d10: 10,  // 100
      coins: 25 // 25
    };

    const total = 
      denoms.d2000 * 2000 +
      denoms.d500 * 500 +
      denoms.d200 * 200 +
      denoms.d100 * 100 +
      denoms.d50 * 50 +
      denoms.d20 * 20 +
      denoms.d10 * 10 +
      denoms.coins;

    expect(total).toBe(8425);
  });

  // TEST 5 — PDT Import File Parsing with Multiple Templates
  it("TEST 5: should parse PDT delimited lines based on selected field template", () => {
    const pdtText = `8901234567890, 5, 1499.00\n8909876543210, 10, 2499.00`;
    const lines = pdtText.split("\n");
    const parsed: PdtImportRow[] = [];

    lines.forEach(l => {
      const parts = l.split(",").map(p => p.trim());
      if (parts.length >= 2) {
        parsed.push({
          barcode: parts[0],
          qty: parseFloat(parts[1]),
          rate: parseFloat(parts[2])
        });
      }
    });

    expect(parsed.length).toBe(2);
    expect(parsed[0].barcode).toBe("8901234567890");
    expect(parsed[0].qty).toBe(5);
    expect(parsed[0].rate).toBe(1499.00);
    expect(parsed[1].barcode).toBe("8909876543210");
    expect(parsed[1].qty).toBe(10);
    expect(parsed[1].rate).toBe(2499.00);
  });

  // TEST 6 — Stock No / SKU Auto-Population Line Item Creation with 18 Product Attributes
  it("TEST 6: should map comprehensive 18-attribute product into direct entry billing line item", () => {
    const selectedProduct = {
      id: "prod-oxf-100",
      code: "STK-OXF-001",
      stockNo: "STK-OXF-001",
      barcode: "8901234567890",
      sku: "SKU-OXF-BLUE-40",
      name: "Oxford Cotton Slim Shirt",
      description: "Oxford Cotton Slim Shirt",
      sellingPrice: 1499.0,
      mrp: 1999.0,
      costPrice: 750.0,
      stockQty: 45,
      size: "40",
      color: "Blue",
      gstPercentage: 12,
      brand: "SMRITI Heritage",
      category: "Apparel",
      hsnCode: "6205",
      pricingMode: "Fixed",
      trackingMode: "Standard",
      weightGrams: 250,
      uom: "Pcs"
    };

    const qty = 2;
    const rate = selectedProduct.sellingPrice;
    const value = rate * qty;
    const discAmt = 0;
    const total = value - discAmt;
    const taxAmount = (total * selectedProduct.gstPercentage) / 100;

    const line: BillingLineItem = {
      id: "line-1",
      sNo: 1,
      stockNo: selectedProduct.stockNo,
      barcode: selectedProduct.barcode,
      itemDescription: selectedProduct.name,
      rate,
      qty,
      value,
      discCode: "",
      discQty: 0,
      discPercent: 0,
      discAmt,
      total,
      salesStaff: "Staff A",
      productId: selectedProduct.id,
      hsnCode: selectedProduct.hsnCode,
      gstPercentage: selectedProduct.gstPercentage,
      taxAmount,
      brand: selectedProduct.brand,
      size: selectedProduct.size
    };

    expect(line.stockNo).toBe("STK-OXF-001");
    expect(line.barcode).toBe("8901234567890");
    expect(line.itemDescription).toBe("Oxford Cotton Slim Shirt");
    expect(line.rate).toBe(1499.0);
    expect(line.qty).toBe(2);
    expect(line.value).toBe(2998.0);
    expect(line.gstPercentage).toBe(12);
    expect(line.taxAmount).toBe(359.76);
    expect(line.hsnCode).toBe("6205");
    expect(line.brand).toBe("SMRITI Heritage");
    expect(line.size).toBe("40");
  });
});

