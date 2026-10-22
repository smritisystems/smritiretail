/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-10-22
 * Modified     : 2026-10-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : Test Suite for Report Designer Auto-Consolidation & Dynamic Grouping
 * Classification: Internal
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as apiModule from "../lib/apiFetchV1.ts";
import { REPORT_BUILDER_CATALOG_FIELDS } from "../components/reports/ReportBuilder.tsx";

describe("SMRITI Report Designer Intelligent Auto-Consolidation & Grouping Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should categorize report columns into dimensions vs additive and non-additive measures", () => {
    const supplierCol = REPORT_BUILDER_CATALOG_FIELDS.find((f) => f.key === "supplier");
    const poNoCol = REPORT_BUILDER_CATALOG_FIELDS.find((f) => f.key === "po_no");
    const sizeCol = REPORT_BUILDER_CATALOG_FIELDS.find((f) => f.key === "size");
    const qtyCol = REPORT_BUILDER_CATALOG_FIELDS.find((f) => f.key === "quantity");
    const amountCol = REPORT_BUILDER_CATALOG_FIELDS.find((f) => f.key === "net_amount");

    expect(supplierCol).toBeDefined();
    expect(supplierCol?.datatype).toBe("text");
    expect(supplierCol?.isSummary).toBeFalsy();

    expect(poNoCol).toBeDefined();
    expect(poNoCol?.datatype).toBe("text");

    // Size is a grouping dimension, NOT an additive summary measure!
    expect(sizeCol).toBeDefined();
    expect(sizeCol?.isSummary).toBeFalsy();

    // Quantity and Net Amount are verified additive summary measures
    expect(qtyCol?.isSummary).toBe(true);
    expect(amountCol?.isSummary).toBe(true);
  });

  it("should execute auto-consolidated query forwarding consolidation_mode=auto and selected_columns", async () => {
    const mockConsolidatedResponse = {
      category: "Purchase",
      total_count: 1,
      consolidation_mode: "auto",
      group_by_dimensions: ["supplier", "po_no", "article_sku", "color"],
      rows: [
        {
          id: "row-group-1",
          supplier: "A. S. Shoes",
          supplier_code: "-",
          supplier_city: "Agra",
          city: "Agra",
          po_no: "PO-0013",
          po_date: "10 Apr",
          invoice_no: "-",
          article_sku: "CH-01",
          color: "Black",
          size: "All Sizes",
          quantity: 30,
          net_amount: 15000,
          _record_count: 3,
          _is_consolidated: true,
        },
      ],
      totals: {
        quantity: 30,
        net_amount: 15000,
      },
      generated_at: new Date().toISOString(),
    };

    const spy = vi.spyOn(apiModule, "apiFetchV1").mockResolvedValue(mockConsolidatedResponse);

    const queryUrl = "/reports/builder/query?category=Purchase&consolidation_mode=auto&selected_columns=supplier,po_no,article_sku,color,quantity,net_amount&limit=50&offset=0";
    const result = await apiModule.apiFetchV1<typeof mockConsolidatedResponse>(queryUrl);

    expect(spy).toHaveBeenCalledWith(queryUrl);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].quantity).toBe(30);
    expect(result.rows[0].net_amount).toBe(15000);
    expect(result.rows[0]._record_count).toBe(3);
    expect(result.rows[0]._is_consolidated).toBe(true);
    expect(result.totals.quantity).toBe(30);
    expect(result.totals.net_amount).toBe(15000);
  });

  it("should split consolidated group into separate rows when Size dimension is added", async () => {
    const mockSplitResponse = {
      category: "Purchase",
      total_count: 3,
      consolidation_mode: "auto",
      group_by_dimensions: ["supplier", "po_no", "article_sku", "color", "size"],
      rows: [
        { id: "row-1", supplier: "A. S. Shoes", po_no: "PO-0013", article_sku: "CH-01", color: "Black", size: 7, quantity: 10, net_amount: 5000, _record_count: 1, _is_consolidated: false },
        { id: "row-2", supplier: "A. S. Shoes", po_no: "PO-0013", article_sku: "CH-01", color: "Black", size: 8, quantity: 12, net_amount: 6000, _record_count: 1, _is_consolidated: false },
        { id: "row-3", supplier: "A. S. Shoes", po_no: "PO-0013", article_sku: "CH-01", color: "Black", size: 9, quantity: 8, net_amount: 4000, _record_count: 1, _is_consolidated: false },
      ],
      totals: {
        quantity: 30,
        net_amount: 15000,
      },
      generated_at: new Date().toISOString(),
    };

    vi.spyOn(apiModule, "apiFetchV1").mockResolvedValue(mockSplitResponse);

    const queryUrl = "/reports/builder/query?category=Purchase&consolidation_mode=auto&selected_columns=supplier,po_no,article_sku,color,size,quantity,net_amount&limit=50&offset=0";
    const result = await apiModule.apiFetchV1<typeof mockSplitResponse>(queryUrl);

    expect(result.rows).toHaveLength(3);
    expect(result.rows.map((r) => r.size)).toEqual([7, 8, 9]);
    expect(result.rows.map((r) => r.quantity)).toEqual([10, 12, 8]);
    expect(result.totals.quantity).toBe(30);
    expect(result.totals.net_amount).toBe(15000);
  });

  it("should preserve individual records with consolidation_mode=detailed without summing duplicates", async () => {
    const mockDetailedResponse = {
      category: "Purchase",
      total_count: 3,
      consolidation_mode: "detailed",
      group_by_dimensions: [],
      rows: [
        { id: "raw-1", supplier: "A. S. Shoes", po_no: "PO-0013", article_sku: "CH-01", color: "Black", size: "7", quantity: 10, net_amount: 5000, _record_count: 1, _is_consolidated: false },
        { id: "raw-2", supplier: "A. S. Shoes", po_no: "PO-0013", article_sku: "CH-01", color: "Black", size: "8", quantity: 12, net_amount: 6000, _record_count: 1, _is_consolidated: false },
        { id: "raw-3", supplier: "A. S. Shoes", po_no: "PO-0013", article_sku: "CH-01", color: "Black", size: "9", quantity: 8, net_amount: 4000, _record_count: 1, _is_consolidated: false },
      ],
      totals: {
        quantity: 30,
        net_amount: 15000,
      },
      generated_at: new Date().toISOString(),
    };

    vi.spyOn(apiModule, "apiFetchV1").mockResolvedValue(mockDetailedResponse);

    const queryUrl = "/reports/builder/query?category=Purchase&consolidation_mode=detailed&limit=50&offset=0";
    const result = await apiModule.apiFetchV1<typeof mockDetailedResponse>(queryUrl);

    expect(result.rows).toHaveLength(3);
    result.rows.forEach((row) => {
      expect(row._is_consolidated).toBe(false);
      expect(row._record_count).toBe(1);
    });
    expect(result.totals.quantity).toBe(30);
    expect(result.totals.net_amount).toBe(15000);
  });

  it("should support explicit grouping dimensions in consolidation_mode=groupby", async () => {
    const mockGroupByResponse = {
      category: "Purchase",
      total_count: 1,
      consolidation_mode: "groupby",
      group_by_dimensions: ["supplier", "po_no"],
      rows: [
        {
          id: "row-sup-po",
          supplier: "A. S. Shoes",
          po_no: "PO-0013",
          article_sku: "Consolidated SKUs",
          color: "All Colors",
          size: "All Sizes",
          quantity: 30,
          net_amount: 15000,
          _record_count: 3,
          _is_consolidated: true,
        },
      ],
      totals: {
        quantity: 30,
        net_amount: 15000,
      },
      generated_at: new Date().toISOString(),
    };

    vi.spyOn(apiModule, "apiFetchV1").mockResolvedValue(mockGroupByResponse);

    const queryUrl = "/reports/builder/query?category=Purchase&consolidation_mode=groupby&group_by_columns=supplier,po_no&limit=50&offset=0";
    const result = await apiModule.apiFetchV1<typeof mockGroupByResponse>(queryUrl);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].supplier).toBe("A. S. Shoes");
    expect(result.rows[0].po_no).toBe("PO-0013");
    expect(result.rows[0].quantity).toBe(30);
    expect(result.rows[0]._record_count).toBe(3);
  });
});
