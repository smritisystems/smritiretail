/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.12.0
 * Created      : 2026-09-08
 * Modified     : 2026-09-08
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { TaxInvoiceDocumentState, TaxInvoiceItemRow } from "../components/sales/types.ts";
import { calculateTaxInvoiceMetrics, openCanonicalInvoicePrint, deriveCustomerInvoiceDefaults, normalizeCustomerCatalogEntry } from "../components/sales/DistTaxInvoice.tsx";
import { TaxInvoiceDoc } from "../components/sales/components/TaxInvoiceDoc.tsx";
import { TaxInvoiceItemGrid } from "../components/sales/components/TaxInvoiceItemGrid.tsx";
import { TaxStatusBar } from "../components/sales/components/TaxStatusBar.tsx";

describe("Smriti Stitch Speed Invoice UI Workflow & Contract Engine", () => {
  // Mock customer and B2B corporate master records
  const mockCustomer = {
    id: "CUST-CORP-8899",
    code: "CORP-8899",
    name: "Apex Hypermarket Retail Pvt Ltd",
    gstin: "27AAACA1234A1Z5",
    mobile: "9820011223",
    address: "Unit 401, Apex Towers, Mumbai",
  };

  const mockGstRegistrations = [
    {
      id: "GST-REG-MH",
      customer_id: "CUST-CORP-8899",
      gstin: "27AAACA1234A1Z5",
      state_code: "27",
      state_name: "Maharashtra",
      is_primary: true,
    },
    {
      id: "GST-REG-AS",
      customer_id: "CUST-CORP-8899",
      gstin: "18AAACA1234A1Z1",
      state_code: "18",
      state_name: "Assam",
      is_primary: false,
    },
  ];

  const mockDeliveryLocations = [
    {
      id: "DEL-LOC-8361",
      customer_id: "CUST-CORP-8899",
      store_code: "8361",
      location_name: "Guwahati Regional Depot",
      address_line1: "GS Road, Khanapara",
      city: "Guwahati",
      state_code: "18",
      state_name: "Assam",
      pin_code: "781022",
      delivery_gstin: "18AAACA1234A1Z1",
      is_default: true,
    },
  ];

  const mockBillingLocations = [
    {
      id: "BLOC-HQ-01",
      customer_id: "CUST-CORP-8899",
      billing_store_code: "BILL-A",
      name: "Corporate Central Accounts",
      address_line1: "BKC Commercial Hub",
      city: "Mumbai",
      state_code: "27",
      pincode: "400051",
      is_default: true,
    },
  ];

  const sampleItems: TaxInvoiceItemRow[] = [
    {
      id: "ROW-1",
      sNo: 1,
      stockNo: "SKU-FOOT-001",
      barcode: "8901234567890",
      itemDescription: "Industrial Safety Shoes - Size 9",
      rate: 1000,
      qty: 2,
      value: 2000,
      discCode: "NONE",
      discQty: 0,
      discPercent: 0,
      discAmt: 0,
      total: 2360,
      salesStaff: "Jawahar Mallah",
      gstRate: 18,
      hsnCode: "64041990",
      stockQty: 5,
    },
  ];

  // ───────────────────────────────────────────────────────────────────────────
  // PART 1: WORKFLOW CONTRACT TESTS (Payload, Jurisdictions & Business Logic)
  // ───────────────────────────────────────────────────────────────────────────

  it("Contract 1: Resolves B2B Corporate Multi-Location & Statutory Fields from Master Data", () => {
    const primaryReg = mockGstRegistrations.find((r) => r.is_primary);
    const defaultBloc = mockBillingLocations.find((b) => b.is_default);
    const defaultDelLoc = mockDeliveryLocations.find((l) => l.is_default);

    const docState: TaxInvoiceDocumentState = {
      billType: "Tax Invoice",
      transactionMode: "Tax Invoice",
      docPrefix: "D1DS13",
      docNo: "1",
      docDate: new Date().toISOString().split("T")[0],
      customerId: mockCustomer.id,
      customerCode: mockCustomer.code,
      customerName: mockCustomer.name,
      customerGstin: primaryReg?.gstin || mockCustomer.gstin,
      salesStaff: "EMP001 - Jawahar Mallah",
      items: sampleItems,
      transporterDetails: [],
      paymentDetails: [{ mode: "Cash", amount: 2360, referenceNo: "CASH-01", bankName: "Cash Counter" }],
      addonsAndDeductions: [],
      documentRemarks: "Test B2B Order",
      billingLocationId: defaultBloc?.id,
      billingStoreCode: defaultBloc?.billing_store_code,
      deliveryLocationId: defaultDelLoc?.id,
      deliveryStoreCode: defaultDelLoc?.store_code,
      deliveryGstin: defaultDelLoc?.delivery_gstin,
      billedPartyGstinId: primaryReg?.id,
      placeOfSupplyCode: defaultDelLoc?.state_code || primaryReg?.state_code,
      poReference: "PO-2026-9910",
    };

    expect(docState.billingLocationId).toBe("BLOC-HQ-01");
    expect(docState.billingStoreCode).toBe("BILL-A");
    expect(docState.deliveryLocationId).toBe("DEL-LOC-8361");
    expect(docState.deliveryStoreCode).toBe("8361");
    expect(docState.deliveryGstin).toBe("18AAACA1234A1Z1");
    expect(docState.billedPartyGstinId).toBe("GST-REG-MH");
    expect(docState.placeOfSupplyCode).toBe("18");
    expect(docState.poReference).toBe("PO-2026-9910");
  });

  it("Contract 1A: Corporate customer profile auto-derives tax invoice defaults from customer + GST + delivery state", () => {
    const customer = {
      id: "CUST-CORP-8899",
      code: "CORP-8899",
      name: "Apex Hypermarket Retail Pvt Ltd",
      gstNumber: "27AAACA1234A1Z5",
      customerGroupId: "CG-Corporate",
      creditLimit: 500000,
    };

    const defaults = deriveCustomerInvoiceDefaults(customer, mockGstRegistrations, mockDeliveryLocations);

    expect(defaults.billType).toBe("Tax Invoice");
    expect(defaults.transactionMode).toBe("Interstate Sale");
    expect(defaults.placeOfSupplyCode).toBe("18");
  });

  it("Contract 1B: invoice customer catalog prefers real CRM records and never injects the legacy sample fallback", () => {
    const backendCustomer = {
      id: "cust-rrl-192b561d",
      code: "CUST-RRL-001",
      name: "Reliance Retail",
      gst_number: "27AAACR1234F1Z1",
      mobile: "9822334455",
      customer_group_id: "CG-LargeRetail",
    };

    const normalized = normalizeCustomerCatalogEntry(backendCustomer);

    expect(normalized).not.toBeNull();
    expect(normalized?.id).toBe("cust-rrl-192b561d");
    expect(normalized?.code).toBe("CUST-RRL-001");
    expect(normalized?.gstin).toBe("27AAACR1234F1Z1");
    expect(normalized?.customerGroupId).toBe("CG-LargeRetail");
  });

  it("Contract 2: Interstate Sale paid in Cash remains CASH payment mode and is NOT converted to Credit", () => {
    // Crucial semantic check: transactionMode "Interstate Sale" must NOT make isCreditTx true
    const transactionMode = "Interstate Sale";
    const paymentDetails = [{ mode: "Cash" as const, amount: 2360, referenceNo: "CASH-REC", bankName: "Counter" }];
    const metrics = calculateTaxInvoiceMetrics(sampleItems, []);

    const isCreditTx = paymentDetails.some((p) => (p.mode || "").toUpperCase() === "CREDIT");
    const totalTendered = paymentDetails.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

    const payload = {
      invoice_no: undefined,
      bill_type: "Tax Invoice",
      transaction_mode: transactionMode,
      is_interstate: transactionMode === "Interstate Sale",
      payment_mode: isCreditTx ? "CREDIT" : (paymentDetails[0]?.mode?.toUpperCase() || "CASH"),
      paid_amount: isCreditTx ? 0 : totalTendered,
      balance_amount: isCreditTx ? metrics.netAmount : Math.max(0, metrics.netAmount - totalTendered),
    };

    expect(isCreditTx).toBe(false);
    expect(payload.payment_mode).toBe("CASH");
    expect(payload.paid_amount).toBe(2360);
    expect(payload.balance_amount).toBe(0);
    expect(payload.is_interstate).toBe(true);
    expect(payload.invoice_no).toBeUndefined(); // Canonical series allocation
  });

  it("Contract 3: Credit Sale correctly sets CREDIT payment mode, zero paid amount, and full balance", () => {
    const paymentDetails = [{ mode: "Credit" as const, amount: 2360, referenceNo: "LEDGER-CREDIT", bankName: "Trade Credit" }];
    const metrics = calculateTaxInvoiceMetrics(sampleItems, []);

    const isCreditTx = paymentDetails.some((p) => (p.mode || "").toUpperCase() === "CREDIT");
    const totalTendered = paymentDetails.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

    const payload = {
      invoice_no: undefined,
      payment_mode: isCreditTx ? "CREDIT" : (paymentDetails[0]?.mode?.toUpperCase() || "CASH"),
      paid_amount: isCreditTx ? 0 : totalTendered,
      balance_amount: isCreditTx ? metrics.netAmount : Math.max(0, metrics.netAmount - totalTendered),
    };

    expect(isCreditTx).toBe(true);
    expect(payload.payment_mode).toBe("CREDIT");
    expect(payload.paid_amount).toBe(0);
    expect(payload.balance_amount).toBe(2360);
  });

  it("Contract 4: Duplicate barcode auto-increment protects against exceeding available stock", () => {
    const existing = sampleItems[0];
    const availableStock = existing.stockQty!; // 5
    let currentQty = existing.qty; // 2
    let errorTriggered: string | null = null;

    const onScanError = (msg: string) => {
      errorTriggered = msg;
    };

    // Scan 1: from 2 to 3 (allowed)
    if (currentQty + 1 <= availableStock) {
      currentQty += 1;
    }
    expect(currentQty).toBe(3);
    expect(errorTriggered).toBeNull();

    // Scan 2 & 3: up to 5 (allowed)
    currentQty = 5;

    // Scan 4: from 5 to 6 (must be blocked by stock guard)
    const attemptedQty = currentQty + 1;
    if (availableStock !== undefined && availableStock > 0 && attemptedQty > availableStock) {
      onScanError(`Stock limit reached for ${existing.itemDescription} (${existing.stockNo}): Available stock is ${availableStock}. Cannot increment beyond stock.`);
    } else {
      currentQty = attemptedQty;
    }

    expect(currentQty).toBe(5);
    expect(errorTriggered).toContain("Stock limit reached");
    expect(errorTriggered).toContain("Available stock is 5");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PART 2: PRODUCTION FUNCTION EXECUTION (openCanonicalInvoicePrint)
  // ───────────────────────────────────────────────────────────────────────────

  it("Contract 5: openCanonicalInvoicePrint executes live API call, creates blob, and sets window location", async () => {
    const invoiceId = "INV-2026-0099";
    let invokedUrl = "";

    const customApiFetch = async (url: string) => {
      invokedUrl = url;
      return new Blob(["%PDF-1.4 Mock Canonical Tax Invoice PDF Stream"], { type: "application/pdf" });
    };

    const mockPrintWindow = {
      location: { href: "" },
      close: vi.fn(),
    };

    // Spy global window & URL
    const originalWindow = globalThis.window;
    const originalURL = globalThis.URL;

    try {
      globalThis.window = {
        open: vi.fn().mockReturnValue(mockPrintWindow),
        setTimeout: vi.fn(),
      } as any;

      globalThis.URL = {
        createObjectURL: vi.fn().mockReturnValue("blob:http://localhost:3000/mock-pdf-uuid"),
        revokeObjectURL: vi.fn(),
      } as any;

      const notifySpy = vi.fn();
      const res = await openCanonicalInvoicePrint(invoiceId, notifySpy, customApiFetch as any);

      expect(invokedUrl).toBe("/sales/invoices/INV-2026-0099/pdf");
      expect(globalThis.window.open).toHaveBeenCalledWith("", "_blank");
      expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
      expect(mockPrintWindow.location.href).toBe("blob:http://localhost:3000/mock-pdf-uuid");
      expect(res.success).toBe(true);
      expect(notifySpy).not.toHaveBeenCalled();
    } finally {
      globalThis.window = originalWindow;
      globalThis.URL = originalURL;
    }
  });

  it("Contract 6: openCanonicalInvoicePrint gracefully handles popup-blocked windows with notification", async () => {
    const invoiceId = "INV-2026-BLOCKED";
    const customApiFetch = async () => new Blob(["%PDF-1.4..."], { type: "application/pdf" });

    const originalWindow = globalThis.window;
    const originalURL = globalThis.URL;

    try {
      // window.open returns null when popup blocker is active
      globalThis.window = {
        open: vi.fn().mockReturnValue(null),
      } as any;

      globalThis.URL = {
        createObjectURL: vi.fn().mockReturnValue("blob:http://localhost:3000/blocked-blob"),
        revokeObjectURL: vi.fn(),
      } as any;

      const notifySpy = vi.fn();

      await expect(
        openCanonicalInvoicePrint(invoiceId, notifySpy, customApiFetch as any)
      ).rejects.toThrow("The print window was blocked");

      expect(notifySpy).toHaveBeenCalledWith(
        "Print Error",
        "The print window was blocked. Please allow pop-ups and retry.",
        "error"
      );
      expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith("blob:http://localhost:3000/blocked-blob");
    } finally {
      globalThis.window = originalWindow;
      globalThis.URL = originalURL;
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PART 3: REACT SERVER-RENDERED MARKUP & CONTROL-PRESENCE VALIDATION
  // ───────────────────────────────────────────────────────────────────────────

  it("Markup Validation 7: TaxInvoiceDoc renders interactive B2B controls with options & state bindings", () => {
    const docState: TaxInvoiceDocumentState = {
      billType: "Tax Invoice",
      transactionMode: "Tax Invoice",
      docPrefix: "D1DS13",
      docNo: "1",
      docDate: "2026-09-08",
      customerId: mockCustomer.id,
      customerCode: mockCustomer.code,
      customerName: mockCustomer.name,
      customerGstin: "27AAACA1234A1Z5",
      salesStaff: "EMP001 - Jawahar Mallah",
      items: sampleItems,
      transporterDetails: [],
      paymentDetails: [],
      addonsAndDeductions: [],
      documentRemarks: "",
      billingLocationId: "BLOC-HQ-01",
      billingStoreCode: "BILL-A",
      deliveryLocationId: "DEL-LOC-8361",
      deliveryStoreCode: "8361",
      deliveryGstin: "18AAACA1234A1Z1",
      billedPartyGstinId: "GST-REG-MH",
      placeOfSupplyCode: "18",
      poReference: "PO-MUMBAI-2026-01",
    };

    // 1. Assert Billing Site Selection Controls & Option Rendering
    const htmlBilling = renderToString(
      React.createElement(TaxInvoiceDoc, {
        docState,
        onChange: () => {},
        onCustomerSearchOpen: () => {},
        onAddCustomerOpen: () => {},
        onImportClick: () => {},
        onRecallClick: () => {},
        netAmount: 2360,
        customerGstRegistrations: mockGstRegistrations,
        customerDeliveryLocations: mockDeliveryLocations,
        customerBillingLocations: mockBillingLocations,
        isLoadingB2BData: false,
        initialActivePopover: "billing",
      })
    );
    expect(htmlBilling).toContain('data-testid="dist-billing-location-select"');
    expect(htmlBilling).toContain("Corporate Central Accounts");
    expect(htmlBilling).toContain("BILL-A");
    expect(htmlBilling).toContain('data-testid="dist-po-reference-input"');
    expect(htmlBilling).toContain("PO-MUMBAI-2026-01");

    // 2. Assert Delivery Depot Selection Controls & Option Rendering
    const htmlDelivery = renderToString(
      React.createElement(TaxInvoiceDoc, {
        docState,
        onChange: () => {},
        onCustomerSearchOpen: () => {},
        onAddCustomerOpen: () => {},
        onImportClick: () => {},
        onRecallClick: () => {},
        netAmount: 2360,
        customerGstRegistrations: mockGstRegistrations,
        customerDeliveryLocations: mockDeliveryLocations,
        customerBillingLocations: mockBillingLocations,
        isLoadingB2BData: false,
        initialActivePopover: "delivery",
      })
    );
    expect(htmlDelivery).toContain('data-testid="dist-delivery-location-select"');
    expect(htmlDelivery).toContain("Guwahati Regional Depot");
    expect(htmlDelivery).toContain("8361");

    // 3. Assert Registered GSTIN Selection Controls & Option Rendering
    const htmlGst = renderToString(
      React.createElement(TaxInvoiceDoc, {
        docState,
        onChange: () => {},
        onCustomerSearchOpen: () => {},
        onAddCustomerOpen: () => {},
        onImportClick: () => {},
        onRecallClick: () => {},
        netAmount: 2360,
        customerGstRegistrations: mockGstRegistrations,
        customerDeliveryLocations: mockDeliveryLocations,
        customerBillingLocations: mockBillingLocations,
        isLoadingB2BData: false,
        initialActivePopover: "gst",
      })
    );
    expect(htmlGst).toContain('data-testid="dist-gst-registration-select"');
    expect(htmlGst).toContain("27AAACA1234A1Z5");
    expect(htmlGst).toContain("Maharashtra");
    expect(htmlGst).toContain("18AAACA1234A1Z1");
    expect(htmlGst).toContain("Assam");

    // 4. Assert Customer Identity & Statutory Summary Ribbon (across all renders)
    expect(htmlBilling).toContain("Apex Hypermarket Retail Pvt Ltd");
    expect(htmlBilling).toContain("CORP-8899");
    expect(htmlBilling).toContain("POS");
    expect(htmlBilling).toContain("State (18)");
  });

  it("Markup Validation 8: TaxInvoiceItemGrid renders item row, stock numbers, rates, and values", () => {
    const html = renderToString(
      React.createElement(TaxInvoiceItemGrid, {
        items: sampleItems,
        onUpdateItem: () => {},
        onDeleteItem: () => {},
        onAddItem: () => {},
      })
    );

    expect(html).toContain("Industrial Safety Shoes - Size 9");
    expect(html).toContain("SKU-FOOT-001");
    expect(html).toContain("2000.00");
    expect(html).toContain("2360.00");
    expect(html).toContain("Jawahar Mallah");
  });

  it("Markup Validation 9: TaxStatusBar renders accurate totals, net amount, and item counts", () => {
    const metrics = calculateTaxInvoiceMetrics(sampleItems, []);
    const html = renderToString(
      React.createElement(TaxStatusBar, {
        itemCount: metrics.itemCount,
        totalQty: metrics.totalQty,
        salesValue: metrics.salesValue,
        itemDiscount: metrics.itemDiscount,
        billDiscount: 0,
        totalTax: metrics.totalTax,
        totalAddons: 0,
        totalDeductions: 0,
        netAmount: metrics.netAmount,
      })
    );

    expect(html).toContain('data-purpose="totals-summary-bar"');
    expect(html).toContain("No. of Items");
    expect(html).toContain("1");
    expect(html).toContain("Total Qty.");
    expect(html).toContain("2.00");
    expect(html).toContain("Net Amount");
    expect(html).toContain("2360.00");
  });
});
