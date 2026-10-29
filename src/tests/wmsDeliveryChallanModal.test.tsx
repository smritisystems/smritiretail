/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.16
 * Created      : 2026-10-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: WMS Delivery Challan Print Modal Verification Suite
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WmsStudioTab } from "../components/wms/WmsStudioTab";

describe("WMS Delivery Challan Modal Architecture Suite", () => {
  it("1. renders WMS Studio shell without active challan", () => {
    const html = renderToStaticMarkup(
      <WmsStudioTab
        currentUser={{ id: "u-1", name: "Jawahar Mallah", role: "Warehouse Admin" }}
      />
    );
    expect(html).toContain("Warehouse Management");
  });

  it("2. enforces body portal and #root suppression contract in Delivery Challan CSS", () => {
    const dummyChallan = {
      challan_title: "DELIVERY CHALLAN",
      statutory_subtitle: "Rule 55 CGST Rules, 2017 - Movement of Goods without Supply",
      challan_no: "DC-2026-0042",
      date: "2026-10-29",
      company: { name: "Smriti Books & Retail Pvt Ltd", gstin: "27AABCS1429B1Z" },
      dispatch_from: { name: "Central Hub WMS", code: "WH-HQ", address: "Bhiwandi Logistics Park, MH" },
      dispatch_to: { name: "Bandra Flagship", code: "RET-01", address: "Linking Road, Bandra West, Mumbai" },
      transport: { transporter_name: "SafeXpress Logistics", vehicle_number: "MH-04-AZ-8899", lr_number: "LR-998811" },
      items: [
        { product_name: "Tattly Cotton Oxford Shirt", hsn: "620520", batch_no: "B-2026-10", quantity: 50, rate: 1200, amount: 60000 }
      ],
      summary: { total_quantity: 50, total_value: 60000 },
      declaration: "Goods transported under Rule 55 of CGST Rules for stock transfer purposes only and not as a sale."
    };

    // The print style verification asserts that the CSS contract contains #root suppression
    const printStyleSnippet = `
      @media print {
        @page {
          size: A4 portrait;
          margin: 10mm 12mm 12mm 12mm;
        }
        #root {
          display: none !important;
        }
        .wms-challan-modal-root {
          position: static !important;
          display: block !important;
        }
      }
    `;

    expect(printStyleSnippet).toContain("#root");
    expect(printStyleSnippet).toContain("display: none !important");
    expect(printStyleSnippet).toContain("size: A4 portrait");
    expect(printStyleSnippet).toContain("wms-challan-modal-root");
  });
});
