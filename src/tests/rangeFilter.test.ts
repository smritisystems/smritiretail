/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.51.0
 * Created      : 2026-10-10
 * Modified     : 2026-10-10
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import {
  compareNatural,
  isWithinRange,
  filterRowsByItemMasterCriteria,
  filterRowsByGridRange
} from "../components/barcode/rangeFilter.ts";
import { LabelPrintRow, ItemMasterSelectionCriteria } from "../components/barcode/types.ts";

describe("SMRITI Barcode Natural Range Filter Engine Suite", () => {
  const sampleRows: LabelPrintRow[] = [
    {
      id: "row-1",
      sNo: 1,
      stockNo: "000001",
      barcode: "890100000001",
      brand: "TATTLY THREADS",
      product: "Loafers",
      colour: "BLACK",
      style: "CH-10-A",
      size: "38",
      mrp: 1499,
      sellingPrice: 1499,
      currentStock: 10,
      labelCount: 1
    },
    {
      id: "row-2",
      sNo: 2,
      stockNo: "000002",
      barcode: "890100000002",
      brand: "TATTLY THREADS",
      product: "Sneakers",
      colour: "WHITE",
      style: "CH-10-B",
      size: "39",
      mrp: 999,
      sellingPrice: 999,
      currentStock: 8,
      labelCount: 1
    },
    {
      id: "row-3",
      sNo: 3,
      stockNo: "000003",
      barcode: "890100000003",
      brand: "TATTLY THREADS",
      product: "Oxford",
      colour: "BROWN",
      style: "CH-20-C",
      size: "40",
      mrp: 1899,
      sellingPrice: 1899,
      currentStock: 15,
      labelCount: 1
    },
    {
      id: "row-4",
      sNo: 4,
      stockNo: "000006",
      barcode: "890100000006",
      brand: "TATTLY THREADS",
      product: "Footwear",
      colour: "BLACK",
      style: "CH-30-K",
      size: "37",
      mrp: 1199,
      sellingPrice: 1199,
      currentStock: 14,
      labelCount: 1
    },
    {
      id: "row-5",
      sNo: 5,
      stockNo: "000010",
      barcode: "890100000010",
      brand: "TATTLY THREADS",
      product: "Trainers",
      colour: "GREY",
      style: "CH-40-M",
      size: "42",
      mrp: 1599,
      sellingPrice: 1599,
      currentStock: 16,
      labelCount: 1
    }
  ];

  describe("1. compareNatural", () => {
    it("sorts alphanumeric style codes in logical sequence", () => {
      expect(compareNatural("CH-10-A", "CH-10-B")).toBeLessThan(0);
      expect(compareNatural("CH-10-B", "CH-20-C")).toBeLessThan(0);
      expect(compareNatural("CH-20-C", "CH-30-K")).toBeLessThan(0);
      expect(compareNatural("CH-30-K", "CH-10-A")).toBeGreaterThan(0);
    });

    it("compares numeric strings naturally without leading zero distortions", () => {
      expect(compareNatural("000006", "000010")).toBeLessThan(0);
      expect(compareNatural("890100000001", "890100000010")).toBeLessThan(0);
      expect(compareNatural("890100000010", "890100000001")).toBeGreaterThan(0);
    });
  });

  describe("2. isWithinRange", () => {
    it("evaluates barcode numeric range correctly", () => {
      expect(isWithinRange("890100000002", "890100000001", "890100000006", "barcode")).toBe(true);
      expect(isWithinRange("890100000010", "890100000001", "890100000006", "barcode")).toBe(false);
      // Open-ended bounds
      expect(isWithinRange("890100000010", "890100000005", "", "barcode")).toBe(true);
      expect(isWithinRange("890100000002", "", "890100000005", "barcode")).toBe(true);
    });

    it("evaluates style code alphanumeric range correctly", () => {
      expect(isWithinRange("CH-20-C", "CH-10-A", "CH-30-K", "style")).toBe(true);
      expect(isWithinRange("CH-40-M", "CH-10-A", "CH-30-K", "style")).toBe(false);
    });

    it("evaluates numeric MRP range correctly", () => {
      expect(isWithinRange(1199, 1000, 1500, "numeric")).toBe(true);
      expect(isWithinRange(999, 1000, 1500, "numeric")).toBe(false);
      expect(isWithinRange(1899, 1000, 1500, "numeric")).toBe(false);
    });
  });

  describe("3. filterRowsByItemMasterCriteria (Step 1 Catalog Range Filter)", () => {
    it("filters catalog items by Barcode Range (From -> To)", () => {
      const criteria: Partial<ItemMasterSelectionCriteria> = {
        barcodeFrom: "890100000002",
        barcodeTo: "890100000006"
      };
      const filtered = filterRowsByItemMasterCriteria(sampleRows, criteria);
      expect(filtered.map(r => r.stockNo)).toEqual(["000002", "000003", "000006"]);
    });

    it("filters catalog items by Style Range (From -> To)", () => {
      const criteria: Partial<ItemMasterSelectionCriteria> = {
        styleFrom: "CH-10-B",
        styleTo: "CH-30-K"
      };
      const filtered = filterRowsByItemMasterCriteria(sampleRows, criteria);
      expect(filtered.map(r => r.style)).toEqual(["CH-10-B", "CH-20-C", "CH-30-K"]);
    });

    it("filters catalog items by MRP Range (Min -> Max)", () => {
      const criteria: Partial<ItemMasterSelectionCriteria> = {
        mrpFrom: "1100",
        mrpTo: "1600"
      };
      const filtered = filterRowsByItemMasterCriteria(sampleRows, criteria);
      expect(filtered.map(r => r.stockNo)).toEqual(["000001", "000006", "000010"]);
    });

    it("combines Barcode Range and Style Range using AND logic", () => {
      const criteria: Partial<ItemMasterSelectionCriteria> = {
        barcodeFrom: "890100000001",
        barcodeTo: "890100000006",
        styleFrom: "CH-20-C",
        styleTo: "CH-40-M"
      };
      const filtered = filterRowsByItemMasterCriteria(sampleRows, criteria);
      expect(filtered.map(r => r.stockNo)).toEqual(["000003", "000006"]);
    });
  });

  describe("4. filterRowsByGridRange (Step 3 Grid Batch Range Selector)", () => {
    it("selects grid items by S.No Range", () => {
      const matched = filterRowsByGridRange(sampleRows, "sNo", "2", "4");
      expect(matched.map(r => r.sNo)).toEqual([2, 3, 4]);
    });

    it("selects grid items by Barcode Range", () => {
      const matched = filterRowsByGridRange(sampleRows, "barcode", "890100000003", "890100000010");
      expect(matched.map(r => r.stockNo)).toEqual(["000003", "000006", "000010"]);
    });

    it("selects grid items by Style Range", () => {
      const matched = filterRowsByGridRange(sampleRows, "style", "CH-10-A", "CH-20-C");
      expect(matched.map(r => r.style)).toEqual(["CH-10-A", "CH-10-B", "CH-20-C"]);
    });

    it("selects grid items by MRP Range", () => {
      const matched = filterRowsByGridRange(sampleRows, "mrp", "900", "1200");
      expect(matched.map(r => r.stockNo)).toEqual(["000002", "000006"]);
    });
  });
});
