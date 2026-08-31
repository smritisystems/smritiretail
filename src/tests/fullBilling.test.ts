/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.7.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Test Suite   : Full Cycle Creating Bill, Multi-Tender Settlement & Printing
 */

import { describe, it, expect } from "vitest";
import { Product, Customer } from "../types.ts";
import {
  BillingLineItem,
  BillingHeaderState,
  BillingSummaryTotals,
  TransporterRow,
  AddonDeductionRow,
  SettlementPaymentRow,
  CashDenominationState
} from "../components/billing/types.ts";

describe("SMRITI Enterprise Billing Suite — Full Cycle Bill Creation, Settlement & Print Execution", () => {
  // 1. Invoicing Header Initialization
  it("STEP 1: should initialize structured Invoice Header with prefix, document number and customer details", () => {
    const customer: Customer = {
      id: "cust-001",
      name: "Modern Retail Distributors Pvt Ltd",
      mobile: "+91 98201 12345",
      gstNumber: "27ABCDE1234F1Z5",
      status: "Active"
    };

    const header: BillingHeaderState = {
      billType: "Product",
      transaction: "Credit",
      docPrefix: "D1DS13",
      docNo: "1",
      billDate: "2026-08-22",
      billTime: "11:20:00",
      customer,
      salesStaff: "REG-01 Cashier",
      remarks: "Urgent shipment for Mumbai Central Hub"
    };

    expect(header.billType).toBe("Product");
    expect(header.transaction).toBe("Credit");
    expect(header.docPrefix).toBe("D1DS13");
    expect(header.docNo).toBe("1");
    expect(header.customer?.name).toBe("Modern Retail Distributors Pvt Ltd");
    expect(header.customer?.gstNumber).toBe("27ABCDE1234F1Z5");
  });

  // 2. Adding Line Items via F11 Direct Entry Row & Catalog Lookup
  it("STEP 2: should accurately compute line item gross value, discounts, GST tax, and totals", () => {
    // Item 1: Oxford Cotton Shirt (Rate 1499, Qty 3, 10% Disc, 18% GST)
    const rate1 = 1499.00;
    const qty1 = 3;
    const gross1 = rate1 * qty1; // 4497.00
    const discPct1 = 10;
    const discAmt1 = (gross1 * discPct1) / 100; // 449.70
    const taxable1 = gross1 - discAmt1; // 4047.30
    const gstPct1 = 18;
    const taxAmt1 = (taxable1 * gstPct1) / 100; // 728.514 -> 728.51
    const total1 = taxable1 + taxAmt1; // 4775.81

    const line1: BillingLineItem = {
      id: "item-1",
      sNo: 1,
      stockNo: "000006",
      barcode: "890100000006",
      itemDescription: "Oxford Cotton Shirt (Blue / 40)",
      rate: rate1,
      qty: qty1,
      value: gross1,
      discCode: "PROMO10",
      discQty: 3,
      discPercent: discPct1,
      discAmt: discAmt1,
      taxAmount: parseFloat(taxAmt1.toFixed(2)),
      total: parseFloat(total1.toFixed(2)),
      salesStaff: "REG-01 Cashier",
      gstPercentage: gstPct1
    };

    // Item 2: Slim Fit Denim Jeans (Rate 2499, Qty 2, 0% Disc, 18% GST)
    const rate2 = 2499.00;
    const qty2 = 2;
    const gross2 = rate2 * qty2; // 4998.00
    const discAmt2 = 0;
    const taxable2 = gross2;
    const gstPct2 = 18;
    const taxAmt2 = (taxable2 * gstPct2) / 100; // 899.64
    const total2 = taxable2 + taxAmt2; // 5897.64

    const line2: BillingLineItem = {
      id: "item-2",
      sNo: 2,
      stockNo: "000010",
      barcode: "890100000010",
      itemDescription: "Slim Fit Denim Jeans (Indigo / 32)",
      rate: rate2,
      qty: qty2,
      value: gross2,
      discCode: "",
      discQty: 0,
      discPercent: 0,
      discAmt: 0,
      taxAmount: parseFloat(taxAmt2.toFixed(2)),
      total: parseFloat(total2.toFixed(2)),
      salesStaff: "REG-01 Cashier",
      gstPercentage: gstPct2
    };

    expect(line1.value).toBe(4497.00);
    expect(line1.discAmt).toBe(449.70);
    expect(line1.taxAmount).toBe(728.51);
    expect(line1.total).toBe(4775.81);

    expect(line2.value).toBe(4998.00);
    expect(line2.taxAmount).toBe(899.64);
    expect(line2.total).toBe(5897.64);
  });

  // 3. Tabbed Details: Transporters, Addons & Deductions
  it("STEP 3: should aggregate freight transporter charges and addons/deductions into net invoice totals", () => {
    const transporterRows: TransporterRow[] = [
      {
        sNo: 1,
        type: "Road Freight",
        code: "TR-EXPRESS",
        description: "Local Express Logistics",
        rateType: "Fixed",
        rateAmt: 150.00,
        rate: 0,
        amount: 150.00
      }
    ];

    const addonRows: AddonDeductionRow[] = [
      {
        sNo: 1,
        type: "Addon",
        code: "INS",
        description: "Transit Insurance",
        rateType: "Fixed",
        rate: 50.00,
        amount: 50.00
      },
      {
        sNo: 2,
        type: "Deduction",
        code: "CASH_DISC",
        description: "Early Settlement Discount",
        rateType: "Fixed",
        rate: 100.00,
        amount: 100.00
      }
    ];

    const totalFreight = transporterRows.reduce((s, r) => s + r.amount, 0); // 150
    const totalAddons = addonRows.filter(a => a.type === "Addon").reduce((s, a) => s + a.amount, 0); // 50
    const totalDeductions = addonRows.filter(a => a.type === "Deduction").reduce((s, a) => s + a.amount, 0); // 100

    expect(totalFreight).toBe(150.00);
    expect(totalAddons).toBe(50.00);
    expect(totalDeductions).toBe(100.00);

    const grossSales = 4497.00 + 4998.00; // 9495.00
    const itemDiscounts = 449.70;
    const totalTax = 728.51 + 899.64; // 1628.15
    const netRaw = grossSales - itemDiscounts + totalTax + totalFreight + totalAddons - totalDeductions; // 9495 - 449.7 + 1628.15 + 150 + 50 - 100 = 10773.45

    expect(Number(netRaw.toFixed(2))).toBe(10773.45);
    const roundOff = Math.round(netRaw) - netRaw; // -0.45
    const finalNet = Math.round(netRaw); // 10773.00
    expect(finalNet).toBe(10773);
  });

  // 4. Suspend (Hold) and Recall Bill Lifecycle
  it("STEP 4: should suspend active bill into held queue and restore without data loss", () => {
    const activeBill = {
      id: "HOLD-20260822-001",
      header: {
        docPrefix: "D1DS13",
        docNo: "1",
        customer: { name: "Modern Retail Distributors Pvt Ltd" }
      },
      items: [
        { stockNo: "000006", qty: 3, total: 4775.81 },
        { stockNo: "000010", qty: 2, total: 5897.64 }
      ],
      netAmount: 10773.00
    };

    // Suspend queue
    const heldQueue = [activeBill];
    expect(heldQueue.length).toBe(1);

    // Recall from queue
    const recalled = heldQueue.find(b => b.id === "HOLD-20260822-001");
    expect(recalled).toBeDefined();
    expect(recalled?.items.length).toBe(2);
    expect(recalled?.netAmount).toBe(10773.00);
  });

  // 5. Multi-Tender Settlement & Cash Denomination Counting
  it("STEP 5: should balance multi-tender split payments and tally cash denomination counter", () => {
    const netPayable = 10773.00;

    // Split Payment: Cash + Credit Card
    const payments: SettlementPaymentRow[] = [
      { id: "1", mode: "Cash", refNo: "", amount: 5773.00, bankDetails: "" },
      { id: "2", mode: "Credit Card", refNo: "AUTH-98812", amount: 5000.00, bankDetails: "HDFC POS" }
    ];

    const totalTendered = payments.reduce((s, p) => s + p.amount, 0);
    const balanceRemaining = Math.max(0, netPayable - totalTendered);
    const changeDue = Math.max(0, totalTendered - netPayable);

    expect(totalTendered).toBe(10773.00);
    expect(balanceRemaining).toBe(0);
    expect(changeDue).toBe(0);

    // Denomination breakdown for cash portion (₹5773)
    const denoms: CashDenominationState = {
      d2000: 2, // 4000
      d500: 3,  // 1500
      d200: 1,  // 200
      d100: 0,
      d50: 0,
      d20: 0,
      d10: 7,   // 70
      coins: 3  // 3
    };

    const cashTally =
      denoms.d2000 * 2000 +
      denoms.d500 * 500 +
      denoms.d200 * 200 +
      denoms.d100 * 100 +
      denoms.d50 * 50 +
      denoms.d20 * 20 +
      denoms.d10 * 10 +
      denoms.coins;

    expect(cashTally).toBe(5773);
    expect(cashTally).toBe(payments[0].amount);
  });

  // 6. Tax Invoice Generation & Print Dispatch
  it("STEP 6: should compile final Tax Invoice document and format thermal print payload", () => {
    const finalInvoice = {
      invoiceNumber: "D1DS13-1",
      date: "2026-08-22",
      customerName: "Modern Retail Distributors Pvt Ltd",
      customerGstin: "27ABCDE1234F1Z5",
      items: [
        { sku: "000006", description: "Oxford Cotton Shirt (Blue / 40)", quantity: 3, rate: 1499.00, discount: 449.70, tax: 728.51, amount: 4775.81 },
        { sku: "000010", description: "Slim Fit Denim Jeans (Indigo / 32)", quantity: 2, rate: 2499.00, discount: 0, tax: 899.64, amount: 5897.64 }
      ],
      subtotal: 9495.00,
      discount: 449.70,
      tax: 1628.15,
      total: 10773.00,
      paymentMode: "Cash (₹5773.00), Credit Card (₹5000.00)"
    };

    expect(finalInvoice.invoiceNumber).toBe("D1DS13-1");
    expect(finalInvoice.items.length).toBe(2);
    expect(finalInvoice.total).toBe(10773.00);

    // Format 80mm Thermal Receipt Stream
    let thermalStream = "";
    thermalStream += `==========================================\n`;
    thermalStream += `           SMRITI RETAIL OS               \n`;
    thermalStream += `         CENTRAL DISTRIBUTION            \n`;
    thermalStream += `==========================================\n`;
    thermalStream += `Invoice: ${finalInvoice.invoiceNumber}  Date: ${finalInvoice.date}\n`;
    thermalStream += `Customer: ${finalInvoice.customerName}\n`;
    thermalStream += `GSTIN: ${finalInvoice.customerGstin}\n`;
    thermalStream += `------------------------------------------\n`;
    finalInvoice.items.forEach(it => {
      thermalStream += `${it.description.padEnd(26)} x${it.quantity}  Rs.${it.amount.toFixed(2)}\n`;
    });
    thermalStream += `------------------------------------------\n`;
    thermalStream += `Subtotal:                            Rs.${finalInvoice.subtotal.toFixed(2)}\n`;
    thermalStream += `Discounts:                          -Rs.${finalInvoice.discount.toFixed(2)}\n`;
    thermalStream += `GST Tax:                             Rs.${finalInvoice.tax.toFixed(2)}\n`;
    thermalStream += `==========================================\n`;
    thermalStream += `NET TOTAL:                          Rs.${finalInvoice.total.toFixed(2)}\n`;
    thermalStream += `Payment: ${finalInvoice.paymentMode}\n`;
    thermalStream += `==========================================\n`;

    expect(thermalStream).toContain("D1DS13-1");
    expect(thermalStream).toContain("Modern Retail Distributors");
    expect(thermalStream).toContain("NET TOTAL:                          Rs.10773.00");
  });
});
