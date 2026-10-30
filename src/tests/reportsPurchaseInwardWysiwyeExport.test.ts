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
 * Classification: Purchase Inward Register (GRN) WYSIWYE Export Parity Verification
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

const mockDataset: MockPurchaseInwardItemLine[] = [
  {
    receipt_id: "rec-01",
    receipt_no: "GRN-2026-00412",
    receipt_date: "2026-10-28",
    supplier_id: "SUP-01",
    supplier_name: "A. S. Shoes Mumbai",
    order_no: "PO-2026-00123",
    product_id: "p1",
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
    supplier_id: "SUP-02",
    supplier_name: "Metro Footwear Agra",
    order_no: "PO-2026-00124",
    product_id: "p2",
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
    supplier_id: "SUP-01",
    supplier_name: "A. S. Shoes Mumbai",
    order_no: "PO-2026-00125",
    product_id: "p3",
    product_code: "CH-34-GUN",
    product_name: "Casual Wedge Sandal Gunmetal",
    quantity_received: 12,
    cost_price: 450,
    gst_rate: 5,
    tax_amount: 270,
    line_total: 5670,
    status: "RECEIVED",
    delivery_terms: "Ex-Factory",
    freight_terms: "Paid by Buyer (To Pay)",
    transporter_name: "Safechem Freight",
    lr_number: "SF-443322",
    collection_type: "Core Essentials (All-Year)",
  },
];

// Helper resolving export payload and columns based on view mode and active filtered lines
function resolvePurchaseInwardExportPayload(
  filteredLines: MockPurchaseInwardItemLine[],
  viewMode: "detailed" | "grn_summary"
) {
  if (viewMode === "grn_summary") {
    const grnMap = new Map<string, any>();
    for (const line of filteredLines) {
      if (!grnMap.has(line.receipt_no)) {
        grnMap.set(line.receipt_no, {
          receipt_no: line.receipt_no,
          receipt_date: line.receipt_date,
          supplier_name: line.supplier_name,
          order_no: line.order_no || "—",
          delivery_terms: line.delivery_terms || "—",
          freight_terms: line.freight_terms || "—",
          transporter_name: line.transporter_name || "—",
          lr_number: line.lr_number || "—",
          collection_type: line.collection_type || "—",
          itemCount: 0,
          totalQty: 0,
          totalTax: 0,
          totalLanded: 0,
          status: line.status,
        });
      }
      const g = grnMap.get(line.receipt_no);
      g.itemCount += 1;
      g.totalQty += line.quantity_received;
      g.totalTax += line.tax_amount;
      g.totalLanded += line.line_total;
    }

    const columns = [
      { key: "receipt_no", label: "GRN #", datatype: "text" },
      { key: "receipt_date", label: "Date", datatype: "date" },
      { key: "supplier_name", label: "Supplier", datatype: "text" },
      { key: "order_no", label: "PO #", datatype: "text" },
      { key: "delivery_terms", label: "Delivery Terms", datatype: "text" },
      { key: "transporter_name", label: "Transporter", datatype: "text" },
      { key: "lr_number", label: "LR #", datatype: "text" },
      { key: "itemCount", label: "Items Count", datatype: "number", isSummary: true },
      { key: "totalQty", label: "Total Qty (Pcs)", datatype: "number", isSummary: true },
      { key: "totalTax", label: "Tax (INR)", datatype: "currency", isSummary: true },
      { key: "totalLanded", label: "Landed Total (INR)", datatype: "currency", isSummary: true },
      { key: "status", label: "Status", datatype: "text" },
    ];

    return { columns, rows: Array.from(grnMap.values()) };
  } else {
    const columns = [
      { key: "receipt_no", label: "GRN #", datatype: "text" },
      { key: "receipt_date", label: "Date", datatype: "date" },
      { key: "supplier_name", label: "Supplier", datatype: "text" },
      { key: "order_no", label: "PO #", datatype: "text" },
      { key: "delivery_terms", label: "Delivery Terms", datatype: "text" },
      { key: "transporter_name", label: "Transporter", datatype: "text" },
      { key: "lr_number", label: "LR #", datatype: "text" },
      { key: "collection_type", label: "Collection", datatype: "text" },
      { key: "product_code", label: "Article / SKU", datatype: "text" },
      { key: "product_name", label: "Description", datatype: "text" },
      { key: "quantity_received", label: "Qty Received", datatype: "number", isSummary: true },
      { key: "cost_price", label: "Cost Rate", datatype: "currency" },
      { key: "gst_rate", label: "GST %", datatype: "percentage" },
      { key: "tax_amount", label: "Tax (INR)", datatype: "currency", isSummary: true },
      { key: "line_total", label: "Line Total (INR)", datatype: "currency", isSummary: true },
      { key: "status", label: "Status", datatype: "text" },
    ];

    return { columns, rows: filteredLines };
  }
}

describe("Purchase Inward Register (GRN) WYSIWYE Export Parity", () => {
  it("1. detailed view export generates SKU-level rows with logistics columns", () => {
    const { columns, rows } = resolvePurchaseInwardExportPayload(mockDataset, "detailed");

    expect(rows.length).toBe(3);
    expect(columns.some((c) => c.key === "delivery_terms")).toBe(true);
    expect(columns.some((c) => c.key === "transporter_name")).toBe(true);
    expect(columns.some((c) => c.key === "collection_type")).toBe(true);
    expect(columns.some((c) => c.key === "product_code")).toBe(true);
    expect(rows[0].product_code).toBe("CH-34-BLK");
    expect(rows[0].delivery_terms).toBe("Ex-Factory");
  });

  it("2. summary view export generates receipt-aggregated rows with item count and totals", () => {
    const { columns, rows } = resolvePurchaseInwardExportPayload(mockDataset, "grn_summary");

    expect(rows.length).toBe(3); // 3 distinct GRNs
    expect(columns.some((c) => c.key === "itemCount")).toBe(true);
    expect(columns.some((c) => c.key === "totalLanded")).toBe(true);
    expect(columns.some((c) => c.key === "product_code")).toBe(false); // Summary hides SKU line columns

    const r1 = rows.find((r) => r.receipt_no === "GRN-2026-00412");
    expect(r1).toBeDefined();
    expect(r1.totalQty).toBe(24);
    expect(r1.totalLanded).toBe(11340);
    expect(r1.transporter_name).toBe("V-Trans Logistics");
  });

  it("3. WYSIWYE parity: exporting filtered Ex-Factory subset exports only Ex-Factory rows", () => {
    const exFactoryOnly = mockDataset.filter((l) => l.delivery_terms === "Ex-Factory");
    const { rows: detailedRows } = resolvePurchaseInwardExportPayload(exFactoryOnly, "detailed");
    const { rows: summaryRows } = resolvePurchaseInwardExportPayload(exFactoryOnly, "grn_summary");

    expect(detailedRows.length).toBe(2);
    expect(detailedRows.every((r) => r.delivery_terms === "Ex-Factory")).toBe(true);

    expect(summaryRows.length).toBe(2);
    expect(summaryRows.every((r) => r.delivery_terms === "Ex-Factory")).toBe(true);
  });

  it("4. WYSIWYE parity: exporting filtered carrier subset exports only matching carrier rows", () => {
    const vTransOnly = mockDataset.filter((l) => l.transporter_name === "V-Trans Logistics");
    const { rows } = resolvePurchaseInwardExportPayload(vTransOnly, "detailed");

    expect(rows.length).toBe(1);
    expect(rows[0].transporter_name).toBe("V-Trans Logistics");
    expect(rows[0].receipt_no).toBe("GRN-2026-00412");
  });

  it("5. mathematical consistency: summary totals sum identically to detailed line totals", () => {
    const { rows: detailedRows } = resolvePurchaseInwardExportPayload(mockDataset, "detailed");
    const { rows: summaryRows } = resolvePurchaseInwardExportPayload(mockDataset, "grn_summary");

    const detailedTotalQty = detailedRows.reduce((acc, r) => acc + r.quantity_received, 0);
    const summaryTotalQty = summaryRows.reduce((acc, r) => acc + r.totalQty, 0);
    expect(detailedTotalQty).toBe(summaryTotalQty);

    const detailedTotalLanded = detailedRows.reduce((acc, r) => acc + r.line_total, 0);
    const summaryTotalLanded = summaryRows.reduce((acc, r) => acc + r.totalLanded, 0);
    expect(detailedTotalLanded).toBe(summaryTotalLanded);
  });
});
