/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-10-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: GRN Logistics, PO Delivery Terms Inheritance & Carrier Audit Trail Verification
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GrnPrintModal, GrnPrintReceiptData } from "../components/purchase/GrnPrintModal";

describe("GRN Logistics, PO Delivery Terms Inheritance & Carrier Audit Trail", () => {
  const sampleGrnPrintData: GrnPrintReceiptData = {
    receipt_no: "GRN-2026-00412",
    supplier_id: "SUP-A-SHOE",
    supplier_name: "A. S. Shoes Mumbai",
    po_number: "PO-2026-00123",
    invoice_number: "INV-AS-9812",
    invoice_date: "2026-10-28",
    transporter_name: "V-Trans Logistics India",
    lr_number: "LR-9081234",
    lr_date: "2026-10-27",
    vehicle_number: "MH-04-AB-1234",
    cartons: 12,
    weight_cbm: "450 Kg / 3.2 CBM",
    delivery_terms: "Ex-Factory",
    freight_terms: "Paid by Buyer (To Pay)",
    payment_terms: "120 Days",
    collection_type: "Core Essentials (All-Year)",
    notes: "[LOGISTICS & LANDED COST: Transporter: V-Trans Logistics India, LR: LR-9081234, Delivery: Ex-Factory, Freight Terms: Paid by Buyer (To Pay)]",
    items: [
      {
        code: "CH-34-BLK",
        name: "Casual Wedge Sandal",
        size: "38",
        color: "BLACK",
        quantity_ordered: 24,
        quantity_received: 24,
        quantity_damaged: 0,
        cost_price: 450,
        invoice_rate: 450,
        landed_cost: 485,
        freight_allocated: 35,
        mrp: 899,
        gst_rate: 5,
      },
    ],
    cost_components: [
      {
        component_type: "FREIGHT",
        description: "Primary Inward Highway Freight",
        amount: 840,
        allocation_method: "VALUE",
        transporter_name: "V-Trans Logistics India",
        document_no: "LR-9081234",
      },
    ],
  };

  it("1. renders statutory GRN Print Slip with Delivery Terms and Freight Terms in Carrier Audit Trail", () => {
    const html = renderToStaticMarkup(
      <GrnPrintModal
        isOpen={true}
        onClose={() => {}}
        receiptData={sampleGrnPrintData}
      />
    );

    // Verify statutory header & numbers
    expect(html).toContain("GRN-2026-00412");
    expect(html).toContain("SMRITI RETAIL OS");
    expect(html).toContain("OFFICIAL SYSTEM OF RECORD");

    // Verify Logistics & Carrier Audit Trail
    expect(html).toContain("Logistics &amp; Carrier Audit Trail");
    expect(html).toContain("V-Trans Logistics India");
    expect(html).toContain("LR / Bilty No:");
    expect(html).toContain("LR-9081234");
    expect(html).toContain("Vehicle:");
    expect(html).toContain("MH-04-AB-1234");

    // Verify Delivery Terms and Freight Terms
    expect(html).toContain("Delivery Terms:");
    expect(html).toContain("Ex-Factory");
    expect(html).toContain("Paid by Buyer (To Pay)");

    // Verify Collection Type
    expect(html).toContain("Collection:");
    expect(html).toContain("Core Essentials (All-Year)");

    // Verify Payment Terms
    expect(html).toContain("Payment Terms:");
    expect(html).toContain("120 Days");
  });

  it("2. renders Door Delivery cleanly when freight is paid by supplier", () => {
    const doorDeliveryData: GrnPrintReceiptData = {
      ...sampleGrnPrintData,
      delivery_terms: "Door Delivery",
      freight_terms: "Paid by Supplier",
      collection_type: "Spring / Summer 2026",
    };

    const html = renderToStaticMarkup(
      <GrnPrintModal
        isOpen={true}
        onClose={() => {}}
        receiptData={doorDeliveryData}
      />
    );

    expect(html).toContain("Delivery Terms:");
    expect(html).toContain("Door Delivery");
    expect(html).toContain("Paid by Supplier");
    expect(html).toContain("Collection:");
    expect(html).toContain("Spring / Summer 2026");
  });

  it("3. falls back gracefully when delivery terms and carrier details are omitted", () => {
    const minimalData: GrnPrintReceiptData = {
      receipt_no: "GRN-2026-00001",
      supplier_name: "Direct Local Supplier",
      delivery_terms: undefined,
      freight_terms: undefined,
      transporter_name: undefined,
      items: [],
    };

    const html = renderToStaticMarkup(
      <GrnPrintModal
        isOpen={true}
        onClose={() => {}}
        receiptData={minimalData}
      />
    );

    expect(html).toContain("GRN-2026-00001");
    expect(html).toContain("Direct / Hand Delivery");
    expect(html).not.toContain("Delivery Terms:");
  });

  it("4. verifies notes regex extraction parses delivery, freight, and payment terms correctly", () => {
    const notes = "Vendor Bill VB-9821 | dated 2026-10-24 | [LOGISTICS & LANDED COST: Transporter: TCI Freight, LR: LR-112233, Delivery: Door Delivery, Freight Terms: Paid by Supplier, Payment: 120 Days, Collection: Festive & Wedding]";

    const delMatch = notes.match(/delivery:\s*([^,|\]]+)/i);
    expect(delMatch?.[1]?.trim()).toBe("Door Delivery");

    const frMatch = notes.match(/freight terms:\s*([^,|\]]+)/i);
    expect(frMatch?.[1]?.trim()).toBe("Paid by Supplier");

    const payMatch = notes.match(/payment:\s*([^,|\]]+)/i);
    expect(payMatch?.[1]?.trim()).toBe("120 Days");

    const collMatch = notes.match(/collection:\s*([^,|\]]+)/i);
    expect(collMatch?.[1]?.trim()).toBe("Festive & Wedding");

    const lrMatch = notes.match(/lr:\s*([^,|\]]+)/i);
    expect(lrMatch?.[1]?.trim()).toBe("LR-112233");

    const transpMatch = notes.match(/transporter:\s*([^,|\]]+)/i);
    expect(transpMatch?.[1]?.trim()).toBe("TCI Freight");
  });
});
