/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.0
 * Created      : 2026-10-21
 * Modified     : 2026-10-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Target Test  : Procurement & Vendor Master Data Integrity & Dummy Elimination Verification Suite
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { POPrintPreviewModal } from "../components/purchase/POPrintPreviewModal.tsx";
import { SupplierScorecardModal } from "../components/purchase/SupplierScorecardModal.tsx";
import { VendorScorecardTab } from "../components/vendor/tabs/VendorScorecardTab.tsx";
import { VendorPayablesTab } from "../components/vendor/tabs/VendorPayablesTab.tsx";
import { VendorStatementOfAccountModal } from "../components/vendor/tabs/VendorStatementOfAccountModal.tsx";
import { PurchaseRequisitionWorkspace } from "../components/purchase/PurchaseRequisitionWorkspace.tsx";
import { SupplierRfqWorkspace } from "../components/purchase/SupplierRfqWorkspace.tsx";
import { VendorDetail } from "../types/vendor.ts";

describe("Procurement & Vendor Master Data Integrity & Dummy Elimination Audit", () => {
  const sampleVendor: VendorDetail = {
    id: "vend-test-001",
    code: "VEND-001",
    legalName: "Apex Footwear Manufacturers Ltd",
    tradeName: "Apex Footwear",
    vendorType: "DOMESTIC_MANUFACTURER",
    category: "Footwear",
    phone: "9876543210",
    email: "procurement@apexfootwear.example.com",
    addressLine1: "Industrial Area Phase 2",
    city: "Agra",
    state: "Uttar Pradesh",
    pincode: "282001",
    gstin: "09AAACA1234F1Z8",
    pan: "AAACA1234F",
    status: "ACTIVE",
    compliance: {
      gstin: "09AAACA1234F1Z8",
      pan: "AAACA1234F",
      gstStatus: "ACTIVE",
    },
    commercial: {
      paymentTermsDays: 45,
      outstandingLiability: 50000,
      creditLimit: 200000,
      advanceBalance: 0,
    },
  };

  const mockHeader: any = {
    prefix: "PO",
    orderNumber: "2026-0001",
    orderDate: "2026-10-21",
    deliveryDate: "2026-11-05",
    supplierName: "Apex Footwear",
    supplierId: "VEND-001",
    paymentTerms: "45 Days Net",
    currency: "INR",
    commonTaxPercent: 12,
  };

  const mockLines: any[] = [
    {
      id: "line-1",
      product: "Casual Canvas Sneaker - Navy",
      stockNo: "SKU-SNK-001",
      quantity: 20,
      rate: 650,
      taxPercent: 12,
    },
  ];

  describe("POPrintPreviewModal Truthful Printing & Branding Engine", () => {
    it("does not synthesize hardcoded dummy company GSTIN 27AABCT9981K1Z2 or PAN AABCT9981K", () => {
      const html = renderToString(
        <POPrintPreviewModal
          isOpen={true}
          onClose={() => {}}
          header={mockHeader}
          lineItems={mockLines}
          sizePivotRows={[]}
          activeTab="standard"
          vendor={{
            id: "vend-test-001",
            name: "Apex Footwear",
            code: "VEND-001",
            gstin: "09AAACA1234F1Z8",
          }}
          customCompanyProfile={{
            name: "Tattly Threads Global",
            gstin: "27AAACT9999K1Z5",
            pan: "AAACT9999K",
            city: "Mumbai",
            state: "Maharashtra",
          }}
        />
      );

      // Verify hardcoded fake dummy company profile is eliminated
      expect(html).not.toContain("27AABCT9981K1Z2");
      expect(html).not.toContain("AABCT9981K");

      // Verify truthful vendor and company coordinates are rendered
      expect(html).toContain("Tattly Threads Global");
      expect(html).toContain("27AAACT9999K1Z5");
      expect(html).toContain("Apex Footwear");
      expect(html).toContain("PO-2026-0001");
    });

    it("does not fabricate synthetic footwear attributes (Genuine Calf Leather / Gate 1 - Central Footwear Bay)", () => {
      const html = renderToString(
        <POPrintPreviewModal
          isOpen={true}
          onClose={() => {}}
          header={mockHeader}
          lineItems={mockLines}
          sizePivotRows={[]}
          activeTab="standard"
          vendor={{
            id: "vend-test-001",
            name: "Apex Footwear",
            code: "VEND-001",
          }}
          customCompanyProfile={{
            name: "Tattly Threads Global",
            gstin: "27AAACT9999K1Z5",
          }}
        />
      );

      // Verify synthetic footwear specs and gates are eliminated
      expect(html).not.toContain("Genuine Calf Leather / Microfiber");
      expect(html).not.toContain("Gate 1 - Central Footwear Bay");
    });
  });

  describe("SupplierScorecardModal Elimination of Fabricated Benchmark", () => {
    it("renders honest empty state and has eliminated demo benchmark toggle button", () => {
      const html = renderToString(
        <SupplierScorecardModal
          isOpen={true}
          onClose={() => {}}
        />
      );

      // Verify mock demo benchmark button and sample vendor names are removed
      expect(html).not.toContain("Show Demo Benchmark");
      expect(html).not.toContain("Kapoor Textiles Ltd.");
      expect(html).not.toContain("Mehta Synthetics Pvt.");
      expect(html).not.toContain("Sharma Accessories Co.");

      // Verify honest empty state is rendered
      expect(html).toContain("No Supplier Records Found");
      expect(html).toContain("No registered suppliers or purchase orders are currently recorded in the active company database.");
    });
  });

  describe("VendorScorecardTab Zero-Order Vendor Truthful Grading", () => {
    it("classifies new/zero-order vendor as UNRATED and does not award fake 100% Grade AAA Preferred Partner", () => {
      const html = renderToString(
        <VendorScorecardTab
          vendor={{
            ...sampleVendor,
            commercial: {
              ...sampleVendor.commercial!,
              outstandingLiability: 0,
            },
          }}
        />
      );

      // Verify it does NOT award fake Tier 1 / Grade AAA
      expect(html).not.toContain("TIER 1 — PREFERRED PARTNER");
      expect(html).not.toContain("Grade AAA Rating");
      expect(html).not.toContain("Passed footwear inbound checks");

      // Verify honest UNRATED / Tier 0 classification
      expect(html).toContain("TIER 0 — NEW VENDOR (NO ORDERS RECORDED)");
      expect(html).toContain("UNRATED");
      expect(html).toContain("Rating");
      expect(html).toContain("No purchase orders or delivery history recorded to evaluate performance.");
    });
  });

  describe("VendorPayablesTab Elimination of Fake LEDGER Invoice", () => {
    it("renders honest empty subledger without fabricating synthetic LEDGER invoice row", () => {
      const html = renderToString(
        <VendorPayablesTab
          vendor={sampleVendor}
        />
      );

      // Verify synthetic invoice row LEDGER-VEND-001 is completely eliminated
      expect(html).not.toContain("LEDGER-VEND-001");

      // Verify honest informational empty state is displayed
      expect(html).toContain("No Itemized Purchase Bills");
      expect(html).toContain("Opening liability of ₹50000.00 is on record, but no individual purchase bills");
    });
  });

  describe("VendorStatementOfAccountModal Error State", () => {
    it("renders modal container and does not inject fake voucher PB-CURR-001 or CMP-NX-PREVIEW", () => {
      const html = renderToString(
        <VendorStatementOfAccountModal
          isOpen={true}
          onClose={() => {}}
          vendor={sampleVendor}
        />
      );

      // Verify synthetic client-side statement fallback is completely eliminated
      expect(html).not.toContain("PB-CURR-001");
      expect(html).not.toContain("CMP-NX-PREVIEW");
      expect(html).toContain("STATEMENT OF ACCOUNT");
      expect(html).toContain("Apex Footwear");
    });
  });

  describe("PurchaseRequisitionWorkspace & SupplierRfqWorkspace Clean Initial States", () => {
    it("PurchaseRequisitionWorkspace initializes without hardcoded sample footwear SKUs", () => {
      const html = renderToString(<PurchaseRequisitionWorkspace />);

      // Verify sample line item 'Classic Formal Leather Shoe - Tan' is completely eliminated
      expect(html).not.toContain("Classic Formal Leather Shoe - Tan");
      expect(html).not.toContain("SKU-FOOT-001");

      // Verify clean initial list empty state
      expect(html).toContain("No purchase requisitions found matching current filters.");
    });

    it("SupplierRfqWorkspace initializes without hardcoded sample footwear SKUs", () => {
      const html = renderToString(<SupplierRfqWorkspace />);

      // Verify sample item 'Classic Formal Leather Shoe - Tan' is completely eliminated from RFQ workspace
      expect(html).not.toContain("Classic Formal Leather Shoe - Tan");
      expect(html).not.toContain("SKU-FOOT-001");
    });
  });
});
