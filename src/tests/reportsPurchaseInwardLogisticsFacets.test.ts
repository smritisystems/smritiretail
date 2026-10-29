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
 * Classification: Purchase Inward Register (GRN) Logistics Facets Verification
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
  {
    receipt_id: "rec-04",
    receipt_no: "GRN-2026-00415",
    receipt_date: "2026-10-29",
    supplier_id: "SUP-03",
    supplier_name: "Royal Footwear Delhi",
    order_no: "PO-2026-00126",
    product_id: "p4",
    product_code: "ROY-01",
    product_name: "Velvet Bridal Mojari",
    quantity_received: 18,
    cost_price: 600,
    gst_rate: 12,
    tax_amount: 1296,
    line_total: 12096,
    status: "RECEIVED",
    delivery_terms: "Door Delivery",
    freight_terms: "Paid by Supplier",
    transporter_name: "TCI Express",
    lr_number: "TCI-998822",
    collection_type: "Festive & Wedding",
  },
];

// Helper reproducing the filtering logic in ReportDesignerTab
function applyGrnFilters(
  lines: MockPurchaseInwardItemLine[],
  deliveryTermFilter: "all" | "door_delivery" | "ex_factory",
  transporterFilter: string,
  collectionFilter: string,
  searchQuery: string
) {
  let list = lines;

  // Delivery terms facet
  if (deliveryTermFilter === "door_delivery") {
    list = list.filter((l) => l.delivery_terms && l.delivery_terms.toLowerCase().includes("door delivery"));
  } else if (deliveryTermFilter === "ex_factory") {
    list = list.filter((l) => l.delivery_terms && l.delivery_terms.toLowerCase().includes("ex-factory"));
  }

  // Transporter carrier facet
  if (transporterFilter !== "all") {
    list = list.filter((l) => l.transporter_name === transporterFilter);
  }

  // Collection facet
  if (collectionFilter !== "all") {
    list = list.filter((l) => l.collection_type === collectionFilter);
  }

  // Free-text query
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter((l) =>
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
  }

  return list;
}

describe("Purchase Inward Register (GRN) Logistics Facets & Drilldown Logic", () => {
  it("1. extracts unique available transporters and collections", () => {
    const transpSet = new Set<string>();
    const collSet = new Set<string>();
    for (const l of mockDataset) {
      if (l.transporter_name && l.transporter_name.trim()) transpSet.add(l.transporter_name.trim());
      if (l.collection_type && l.collection_type.trim()) collSet.add(l.collection_type.trim());
    }
    const transporters = Array.from(transpSet).sort();
    const collections = Array.from(collSet).sort();

    expect(transporters).toEqual(["Safechem Freight", "TCI Express", "V-Trans Logistics"]);
    expect(collections).toEqual(["Core Essentials (All-Year)", "Festive & Wedding"]);
  });

  it("2. computes delivery terms facet counter badges", () => {
    const doorCount = mockDataset.filter((l) => l.delivery_terms?.toLowerCase().includes("door delivery")).length;
    const exCount = mockDataset.filter((l) => l.delivery_terms?.toLowerCase().includes("ex-factory")).length;

    expect(doorCount).toBe(2);
    expect(exCount).toBe(2);
    expect(mockDataset.length).toBe(4);
  });

  it("3. filters correctly when Ex-Factory facet chip is selected", () => {
    const filtered = applyGrnFilters(mockDataset, "ex_factory", "all", "all", "");
    expect(filtered.length).toBe(2);
    expect(filtered.every((l) => l.delivery_terms === "Ex-Factory")).toBe(true);

    const totalQty = filtered.reduce((sum, l) => sum + l.quantity_received, 0);
    const totalLanded = filtered.reduce((sum, l) => sum + l.line_total, 0);
    expect(totalQty).toBe(36); // 24 + 12
    expect(totalLanded).toBe(17010); // 11340 + 5670
  });

  it("4. filters correctly when Door Delivery facet chip is selected", () => {
    const filtered = applyGrnFilters(mockDataset, "door_delivery", "all", "all", "");
    expect(filtered.length).toBe(2);
    expect(filtered.every((l) => l.delivery_terms === "Door Delivery")).toBe(true);

    const totalQty = filtered.reduce((sum, l) => sum + l.quantity_received, 0);
    const totalLanded = filtered.reduce((sum, l) => sum + l.line_total, 0);
    expect(totalQty).toBe(54); // 36 + 18
    expect(totalLanded).toBe(32886); // 20790 + 12096
  });

  it("5. filters by carrier dropdown (e.g. 'TCI Express')", () => {
    const filtered = applyGrnFilters(mockDataset, "all", "TCI Express", "all", "");
    expect(filtered.length).toBe(2);
    expect(filtered.map((l) => l.receipt_no)).toEqual(["GRN-2026-00413", "GRN-2026-00415"]);
  });

  it("6. filters by collection dropdown (e.g. 'Festive & Wedding')", () => {
    const filtered = applyGrnFilters(mockDataset, "all", "all", "Festive & Wedding", "");
    expect(filtered.length).toBe(2);
    expect(filtered.every((l) => l.collection_type === "Festive & Wedding")).toBe(true);
  });

  it("7. compound filters: Ex-Factory + V-Trans Logistics + Search 'Wedge'", () => {
    const filtered = applyGrnFilters(mockDataset, "ex_factory", "V-Trans Logistics", "all", "Wedge");
    expect(filtered.length).toBe(1);
    expect(filtered[0].receipt_no).toBe("GRN-2026-00412");
    expect(filtered[0].product_code).toBe("CH-34-BLK");
  });

  it("8. compound filters: Ex-Factory + TCI Express returns empty array", () => {
    const filtered = applyGrnFilters(mockDataset, "ex_factory", "TCI Express", "all", "");
    expect(filtered.length).toBe(0);
  });
});
