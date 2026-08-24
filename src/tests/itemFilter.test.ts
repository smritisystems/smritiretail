/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.4.0
 * Created      : 2026-08-23
 * Modified     : 2026-08-23
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";

// Numeric field comparator & filter testing mirroring ItemDetailsGrid logic
const NUMERIC_FIELD_KEYS = new Set([
  "mrp",
  "price",
  "sellingPrice",
  "costPrice",
  "cost_price",
  "gst_percentage",
  "gstPercentage",
  "stock",
  "quantity",
  "discount",
  "tax"
]);

function isNumericField(key: string, val: any): boolean {
  if (NUMERIC_FIELD_KEYS.has(key)) return true;
  if (typeof val === "number") return true;
  if (typeof val === "string" && val.trim() !== "" && !isNaN(Number(val.trim()))) {
    return true;
  }
  return false;
}

function compareGridValues(a: any, b: any, key: string, direction: "asc" | "desc"): number {
  const isAEmpty = a === null || a === undefined || a === "";
  const isBEmpty = b === null || b === undefined || b === "";

  if (isAEmpty && isBEmpty) return 0;
  // Empty values appear last in both ascending and descending order
  if (isAEmpty) return 1;
  if (isBEmpty) return -1;

  let comparison = 0;
  const isNumeric = isNumericField(key, a) && isNumericField(key, b);

  if (isNumeric) {
    const numA = typeof a === "number" ? a : parseFloat(String(a));
    const numB = typeof b === "number" ? b : parseFloat(String(b));
    comparison = numA - numB;
  } else {
    const strA = String(a).toLowerCase();
    const strB = String(b).toLowerCase();
    comparison = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: "base" });
  }

  return direction === "asc" ? comparison : -comparison;
}

interface GridTestRow {
  _id: string;
  code: string;
  name: string;
  brand: string;
  colour: string;
  mrp: number | string;
  price: number | string;
  costPrice: number | string;
  gst_percentage: number | string;
  a1?: string;
  a2?: string;
  [key: string]: any;
}

interface DerivedRow {
  row: GridTestRow;
  sourceIndex: number;
}

function applyGridFilterAndSort(
  rows: GridTestRow[],
  searchFilter: string,
  columnFilters: Record<string, string>,
  sortConfig: { columnKey: string; direction: "asc" | "desc" } | null
): DerivedRow[] {
  let result: DerivedRow[] = rows.map((row, sourceIndex) => ({ row, sourceIndex }));

  // 1. Global Search Filter
  if (searchFilter.trim()) {
    const q = searchFilter.trim().toLowerCase();
    result = result.filter(({ row }) => {
      return Object.entries(row).some(([k, v]) => {
        if (k.startsWith("_") || typeof v === "boolean" || typeof v === "object") return false;
        return String(v ?? "").toLowerCase().includes(q);
      });
    });
  }

  // 2. Per-Column Filters
  const activeColFilters = Object.entries(columnFilters).filter(([_, val]) => Boolean(val && val.trim()));
  if (activeColFilters.length > 0) {
    result = result.filter(({ row }) => {
      return activeColFilters.every(([colKey, filterVal]) => {
        const targetVal = String(row[colKey] ?? "").toLowerCase();
        return targetVal.includes(filterVal.trim().toLowerCase());
      });
    });
  }

  // 3. Per-Column Sort
  if (sortConfig) {
    const { columnKey, direction } = sortConfig;
    result = [...result].sort((a, b) => {
      return compareGridValues(a.row[columnKey], b.row[columnKey], columnKey, direction);
    });
  }

  return result;
}

describe("Item Master Column Filtering and Sorting Engine", () => {
  const sampleRows: GridTestRow[] = [
    {
      _id: "row-0",
      code: "SMRT-003",
      name: "Sneakers Pro High",
      brand: "Nike",
      colour: "White",
      mrp: 4999,
      price: 3999,
      costPrice: 2000,
      gst_percentage: "18",
      a1: "High Top",
      a2: "Leather"
    },
    {
      _id: "row-1",
      code: "SMRT-001",
      name: "Classic Leather Shoe",
      brand: "Adidas",
      colour: "Black",
      mrp: 299,
      price: 249,
      costPrice: 120,
      gst_percentage: "5",
      a1: "Low Heel",
      a2: "Full-Grain Leather"
    },
    {
      _id: "row-2",
      code: "SMRT-002",
      name: "Air Running Boot",
      brand: "Nike",
      colour: "Black",
      mrp: 12999,
      price: 9999,
      costPrice: 5000,
      gst_percentage: "18",
      a1: "Cushioned",
      a2: "Mesh"
    },
    {
      _id: "row-3",
      code: "SMRT-004",
      name: "Casual Slip-On",
      brand: "Puma",
      colour: "Grey",
      mrp: "", // empty value for testing
      price: 1500,
      costPrice: 700,
      gst_percentage: "12",
      a1: "Flat",
      a2: ""
    }
  ];

  describe("1. Numeric and Text Sorting", () => {
    it("sorts text column (name) ascending and descending case-insensitively", () => {
      const asc = applyGridFilterAndSort(sampleRows, "", {}, { columnKey: "name", direction: "asc" });
      expect(asc.map(r => r.row.name)).toEqual([
        "Air Running Boot",
        "Casual Slip-On",
        "Classic Leather Shoe",
        "Sneakers Pro High"
      ]);

      const desc = applyGridFilterAndSort(sampleRows, "", {}, { columnKey: "name", direction: "desc" });
      expect(desc.map(r => r.row.name)).toEqual([
        "Sneakers Pro High",
        "Classic Leather Shoe",
        "Casual Slip-On",
        "Air Running Boot"
      ]);
    });

    it("sorts numeric column (mrp) numerically rather than lexicographically", () => {
      // Lexicographic sort would order 12999 < 299 < 4999. Numeric sort orders 299 < 4999 < 12999
      const asc = applyGridFilterAndSort(sampleRows, "", {}, { columnKey: "mrp", direction: "asc" });
      expect(asc.map(r => r.row.mrp)).toEqual([299, 4999, 12999, ""]);

      const desc = applyGridFilterAndSort(sampleRows, "", {}, { columnKey: "mrp", direction: "desc" });
      expect(desc.map(r => r.row.mrp)).toEqual([12999, 4999, 299, ""]);
    });

    it("ensures empty values always appear last in both ascending and descending sorts", () => {
      const asc = applyGridFilterAndSort(sampleRows, "", {}, { columnKey: "mrp", direction: "asc" });
      expect(asc[asc.length - 1].row.code).toBe("SMRT-004");

      const desc = applyGridFilterAndSort(sampleRows, "", {}, { columnKey: "mrp", direction: "desc" });
      expect(desc[desc.length - 1].row.code).toBe("SMRT-004");
    });
  });

  describe("2. Single and Multiple Column Filtering", () => {
    it("filters by single column case-insensitively", () => {
      const filtered = applyGridFilterAndSort(sampleRows, "", { brand: "nike" }, null);
      expect(filtered.length).toBe(2);
      expect(filtered.map(r => r.row.code)).toEqual(["SMRT-003", "SMRT-002"]);
    });

    it("combines multiple column filters (AND logic)", () => {
      const filtered = applyGridFilterAndSort(sampleRows, "", { brand: "nike", colour: "black" }, null);
      expect(filtered.length).toBe(1);
      expect(filtered[0].row.code).toBe("SMRT-002");
      expect(filtered[0].row.name).toBe("Air Running Boot");
    });

    it("returns empty result when column filter has no matches", () => {
      const filtered = applyGridFilterAndSort(sampleRows, "", { brand: "Reebok" }, null);
      expect(filtered.length).toBe(0);
    });
  });

  describe("3. Combined Global Search and Column Filters", () => {
    it("works together: global search narrows rows while column filter refines further", () => {
      // Global search for 'shoe' matches 'Classic Leather Shoe' and also any attributes
      const result = applyGridFilterAndSort(sampleRows, "shoe", { colour: "black" }, null);
      expect(result.length).toBe(1);
      expect(result[0].row.code).toBe("SMRT-001");
    });

    it("applies sorting on top of combined global search and column filters", () => {
      const result = applyGridFilterAndSort(sampleRows, "nike", { colour: "w" }, { columnKey: "price", direction: "asc" });
      expect(result.length).toBe(1);
      expect(result[0].row.code).toBe("SMRT-003");
    });
  });

  describe("4. Preservation of Source Index for Mutations and Selection", () => {
    it("preserves original sourceIndex when filtered and sorted", () => {
      // Sort descending by MRP: row-2 (SMRT-002) is index 2 in sampleRows, should come first
      const result = applyGridFilterAndSort(sampleRows, "", {}, { columnKey: "mrp", direction: "desc" });
      expect(result[0].sourceIndex).toBe(2); // SMRT-002
      expect(result[1].sourceIndex).toBe(0); // SMRT-003
      expect(result[2].sourceIndex).toBe(1); // SMRT-001
      expect(result[3].sourceIndex).toBe(3); // SMRT-004
    });

    it("correctly simulates cell edit at preserved sourceIndex without mutating wrong rows", () => {
      const state = [...sampleRows];
      const filtered = applyGridFilterAndSort(state, "", { brand: "Adidas" }, null);
      expect(filtered.length).toBe(1);
      
      const targetSourceIndex = filtered[0].sourceIndex;
      expect(targetSourceIndex).toBe(1);

      // Perform edit at sourceIndex
      state[targetSourceIndex] = { ...state[targetSourceIndex], price: 350 };
      expect(state[1].price).toBe(350);
      expect(state[0].price).toBe(3999); // Untouched
    });

    it("selects visible filtered rows and adds their true sourceIndexes to selection set", () => {
      const filtered = applyGridFilterAndSort(sampleRows, "", { brand: "Nike" }, null);
      const selectedIndices = new Set<number>();

      // Select All on filtered
      filtered.forEach(item => selectedIndices.add(item.sourceIndex));

      expect(selectedIndices.size).toBe(2);
      expect(selectedIndices.has(0)).toBe(true); // SMRT-003
      expect(selectedIndices.has(2)).toBe(true); // SMRT-002
      expect(selectedIndices.has(1)).toBe(false); // Adidas untouched
    });
  });

  describe("5. Dynamic Attribute Columns Support", () => {
    it("filters and sorts on dynamic attribute fields (a1, a2)", () => {
      const filtered = applyGridFilterAndSort(sampleRows, "", { a1: "Top" }, null);
      expect(filtered.length).toBe(1);
      expect(filtered[0].row.code).toBe("SMRT-003");

      const sortedByA1 = applyGridFilterAndSort(sampleRows, "", {}, { columnKey: "a1", direction: "asc" });
      expect(sortedByA1.map(r => r.row.a1)).toEqual([
        "Cushioned",
        "Flat",
        "High Top",
        "Low Heel"
      ]);
    });
  });
});
