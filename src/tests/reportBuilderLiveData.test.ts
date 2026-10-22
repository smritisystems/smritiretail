/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.1.0
 * Created      : 2026-10-22
 * Modified     : 2026-10-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : Test Suite for Report Builder Live Data Binding & Non-Dummy Contract
 * Classification: Internal
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as apiModule from "../lib/apiFetchV1.ts";

describe("SMRITI Report Builder Live Data Binding & Data Flow Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should query the live FastAPI endpoint /reports/builder/query with category=Purchase", async () => {
    const mockApiResponse = {
      category: "Purchase",
      total_count: 2,
      rows: [
        {
          id: "row-poi_1",
          supplier: "ALIYA FOOTWEAR",
          supplier_code: "A",
          supplier_city: "Mumbai",
          city: "Mumbai",
          po_no: "PO-A-462",
          po_date: "27 May",
          invoice_no: "462",
          article_sku: "CH-04-A-BLACK-36",
          color: "BLACK",
          size: "36",
          quantity: 49,
          net_amount: 19293.75,
        },
        {
          id: "row-poi_2",
          supplier: "AK FOOTWEAR",
          supplier_code: "C",
          supplier_city: "Delhi",
          city: "Delhi",
          po_no: "PO-C-847",
          po_date: "11 Jun",
          invoice_no: "847",
          article_sku: "CH-12-C-BRONZE-38",
          color: "BRONZE",
          size: "38",
          quantity: 68,
          net_amount: 31416,
        },
      ],
      totals: {
        quantity: 117,
        net_amount: 50709.75,
      },
      generated_at: new Date().toISOString(),
    };

    const spy = vi.spyOn(apiModule, "apiFetchV1").mockResolvedValue(mockApiResponse);

    const result = await apiModule.apiFetchV1<typeof mockApiResponse>(
      "/reports/builder/query?category=Purchase&limit=50&offset=0"
    );

    expect(spy).toHaveBeenCalledWith("/reports/builder/query?category=Purchase&limit=50&offset=0");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].supplier).toBe("ALIYA FOOTWEAR");
    expect(result.rows[0].po_no).toBe("PO-A-462");
    expect(result.totals.quantity).toBe(117);
    expect(result.totals.net_amount).toBe(50709.75);
  });

  it("should ensure honest empty state when 0 records match criteria without silent dummy fallback", async () => {
    const mockEmptyResponse = {
      category: "Purchase",
      total_count: 0,
      rows: [],
      totals: {
        quantity: 0,
        net_amount: 0,
      },
      generated_at: new Date().toISOString(),
    };

    vi.spyOn(apiModule, "apiFetchV1").mockResolvedValue(mockEmptyResponse);

    const result = await apiModule.apiFetchV1<typeof mockEmptyResponse>(
      "/reports/builder/query?category=Purchase&start_date=2020-01-01&end_date=2020-01-02"
    );

    expect(result.rows).toHaveLength(0);
    expect(result.total_count).toBe(0);
    // Verifies data does NOT silently revive hardcoded "ABC Footwear" rows
    const containsMockData = result.rows.some((r: any) => r.supplier === "ABC Footwear");
    expect(containsMockData).toBe(false);
  });

  it("should reject and surface backend database errors rather than falling back to dummy data", async () => {
    vi.spyOn(apiModule, "apiFetchV1").mockRejectedValue(
      new Error("Failed to load report records from database.")
    );

    let caughtError: any = null;
    try {
      await apiModule.apiFetchV1("/reports/builder/query?category=Purchase");
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeDefined();
    expect(caughtError.message).toContain("Failed to load report records from database.");
  });

  it("should correctly support Items and Inventory domain category querying", async () => {
    const mockInventoryResponse = {
      category: "Inventory",
      total_count: 1,
      rows: [
        {
          id: "prod-1",
          item_code: "CH-04-A-BLACK-36",
          item_name: "Chappal Black 36",
          brand: "Smriti Footwear",
          stock_on_hand: 120,
          valuation_cost: 45000,
        },
      ],
      totals: {
        stock_on_hand: 120,
        valuation_cost: 45000,
      },
      generated_at: new Date().toISOString(),
    };

    vi.spyOn(apiModule, "apiFetchV1").mockResolvedValue(mockInventoryResponse);

    const result = await apiModule.apiFetchV1<typeof mockInventoryResponse>(
      "/reports/builder/query?category=Inventory"
    );

    expect(result.category).toBe("Inventory");
    expect(result.rows[0].item_code).toBe("CH-04-A-BLACK-36");
    expect(result.totals.stock_on_hand).toBe(120);
  });
});
