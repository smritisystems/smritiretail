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
 * Classification: Purchase Inward Register (GRN) Logistics & Delivery Terms Verification
 */

import { describe, it, expect } from "vitest";

interface MockPurchaseInwardItemLine {
  receipt_id: string;
  receipt_no: string;
  receipt_date: string;
  supplier_id: string;
  supplier_name: string;
  order_no?: string;
  product_id: string;
  product_code: string;
  product_name: string;
  quantity_received: number;
  cost_price: number;
  gst_rate: number;
  tax_amount: number;
  line_total: number;
  status: string;
  delivery_terms?: string;
  freight_terms?: string;
  transporter_name?: string;
  lr_number?: string;
  collection_type?: string;
}

describe("Purchase Inward Register (GRN) Logistics & Delivery Terms Alignment", () => {
  const sampleGrnLines: MockPurchaseInwardItemLine[] = [
    {
      receipt_id: "rec-01",
      receipt_no: "GRN-2026-00412",
      receipt_date: "2026-10-28",
      supplier_id: "SUP-A-SHOE",
      supplier_name: "A. S. Shoes Mumbai",
      order_no: "PO-2026-00123",
      product_id: "prod-01",
      product_code: "CH-34-BLK",
      product_name: "Casual Wedge Sandal",
      quantity_received: 24,
      cost_price: 450,
      gst_rate: 5,
      tax_amount: 540,
      line_total: 11340,
      status: "RECEIVED",
      delivery_terms: "Ex-Factory",
      freight_terms: "Paid by Buyer (To Pay)",
      transporter_name: "V-Trans Logistics",
      lr_number: "LR-9081234",
      collection_type: "Core Essentials (All-Year)",
    },
    {
      receipt_id: "rec-02",
      receipt_no: "GRN-2026-00413",
      receipt_date: "2026-10-29",
      supplier_id: "SUP-METRO",
      supplier_name: "Metro Footwear Agra",
      order_no: "PO-2026-00124",
      product_id: "prod-02",
      product_code: "SND-29-GLD",
      product_name: "Evening Stiletto Sandal",
      quantity_received: 36,
      cost_price: 550,
      gst_rate: 5,
      tax_amount: 990,
      line_total: 20790,
      status: "RECEIVED",
      delivery_terms: "Door Delivery",
      freight_terms: "Paid by Supplier",
      transporter_name: "TCI Express",
      lr_number: "TCI-778811",
      collection_type: "Festive & Wedding",
    },
    {
      receipt_id: "rec-03",
      receipt_no: "GRN-2026-00414",
      receipt_date: "2026-10-29",
      supplier_id: "SUP-LOCAL",
      supplier_name: "Direct Artisan Workshop",
      order_no: "—",
      product_id: "prod-03",
      product_code: "SLP-01-BRN",
      product_name: "Handcrafted Leather Slipper",
      quantity_received: 12,
      cost_price: 320,
      gst_rate: 5,
      tax_amount: 192,
      line_total: 4032,
      status: "RECEIVED",
      delivery_terms: undefined,
      freight_terms: undefined,
      transporter_name: undefined,
      lr_number: undefined,
      collection_type: undefined,
    },
  ];

  it("1. filters GRN lines by delivery terms query (e.g. 'ex-factory')", () => {
    const q = "ex-factory";
    const filtered = sampleGrnLines.filter((l) =>
      (l.receipt_no && l.receipt_no.toLowerCase().includes(q)) ||
      (l.supplier_name && l.supplier_name.toLowerCase().includes(q)) ||
      (l.product_code && l.product_code.toLowerCase().includes(q)) ||
      (l.product_name && l.product_name.toLowerCase().includes(q)) ||
      (l.order_no && l.order_no.toLowerCase().includes(q)) ||
      (l.delivery_terms && l.delivery_terms.toLowerCase().includes(q)) ||
      (l.transporter_name && l.transporter_name.toLowerCase().includes(q)) ||
      (l.lr_number && l.lr_number.toLowerCase().includes(q)) ||
      (l.collection_type && l.collection_type.toLowerCase().includes(q))
    );

    expect(filtered.length).toBe(1);
    expect(filtered[0].receipt_no).toBe("GRN-2026-00412");
    expect(filtered[0].delivery_terms).toBe("Ex-Factory");
  });

  it("2. filters GRN lines by transporter name query (e.g. 'tci')", () => {
    const q = "tci";
    const filtered = sampleGrnLines.filter((l) =>
      (l.receipt_no && l.receipt_no.toLowerCase().includes(q)) ||
      (l.supplier_name && l.supplier_name.toLowerCase().includes(q)) ||
      (l.product_code && l.product_code.toLowerCase().includes(q)) ||
      (l.product_name && l.product_name.toLowerCase().includes(q)) ||
      (l.order_no && l.order_no.toLowerCase().includes(q)) ||
      (l.delivery_terms && l.delivery_terms.toLowerCase().includes(q)) ||
      (l.transporter_name && l.transporter_name.toLowerCase().includes(q)) ||
      (l.lr_number && l.lr_number.toLowerCase().includes(q)) ||
      (l.collection_type && l.collection_type.toLowerCase().includes(q))
    );

    expect(filtered.length).toBe(1);
    expect(filtered[0].receipt_no).toBe("GRN-2026-00413");
    expect(filtered[0].transporter_name).toBe("TCI Express");
  });

  it("3. filters GRN lines by seasonal collection query (e.g. 'festive')", () => {
    const q = "festive";
    const filtered = sampleGrnLines.filter((l) =>
      (l.receipt_no && l.receipt_no.toLowerCase().includes(q)) ||
      (l.supplier_name && l.supplier_name.toLowerCase().includes(q)) ||
      (l.product_code && l.product_code.toLowerCase().includes(q)) ||
      (l.product_name && l.product_name.toLowerCase().includes(q)) ||
      (l.order_no && l.order_no.toLowerCase().includes(q)) ||
      (l.delivery_terms && l.delivery_terms.toLowerCase().includes(q)) ||
      (l.transporter_name && l.transporter_name.toLowerCase().includes(q)) ||
      (l.lr_number && l.lr_number.toLowerCase().includes(q)) ||
      (l.collection_type && l.collection_type.toLowerCase().includes(q))
    );

    expect(filtered.length).toBe(1);
    expect(filtered[0].collection_type).toBe("Festive & Wedding");
  });

  it("4. aggregates grnSummaryList preserving delivery terms and transporter details", () => {
    const grnMap = new Map<string, any>();
    for (const line of sampleGrnLines) {
      if (!grnMap.has(line.receipt_no)) {
        grnMap.set(line.receipt_no, {
          receipt_no: line.receipt_no,
          receipt_date: line.receipt_date,
          supplier_name: line.supplier_name,
          order_no: line.order_no,
          status: line.status,
          delivery_terms: line.delivery_terms,
          freight_terms: line.freight_terms,
          transporter_name: line.transporter_name,
          lr_number: line.lr_number,
          collection_type: line.collection_type,
          itemCount: 0,
          totalQty: 0,
          totalTax: 0,
          totalLanded: 0,
        });
      }
      const g = grnMap.get(line.receipt_no);
      g.itemCount += 1;
      g.totalQty += line.quantity_received;
      g.totalTax += line.tax_amount;
      g.totalLanded += line.line_total;
    }

    const summaryList = Array.from(grnMap.values());
    expect(summaryList.length).toBe(3);

    const exFactorySummary = summaryList.find((g) => g.receipt_no === "GRN-2026-00412");
    expect(exFactorySummary).toBeDefined();
    expect(exFactorySummary.delivery_terms).toBe("Ex-Factory");
    expect(exFactorySummary.transporter_name).toBe("V-Trans Logistics");
    expect(exFactorySummary.lr_number).toBe("LR-9081234");

    const doorDeliverySummary = summaryList.find((g) => g.receipt_no === "GRN-2026-00413");
    expect(doorDeliverySummary).toBeDefined();
    expect(doorDeliverySummary.delivery_terms).toBe("Door Delivery");
    expect(doorDeliverySummary.transporter_name).toBe("TCI Express");

    const directSummary = summaryList.find((g) => g.receipt_no === "GRN-2026-00414");
    expect(directSummary).toBeDefined();
    expect(directSummary.delivery_terms).toBeUndefined();
    expect(directSummary.transporter_name).toBeUndefined();
  });
});
