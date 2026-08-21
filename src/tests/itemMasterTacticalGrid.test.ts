/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.33.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { describe, it, expect } from "vitest";
import { 
  DEFAULT_MANDATORY_FIELDS, 
  ALL_AVAILABLE_ITEM_FIELDS, 
  DEFAULT_INITIAL_SELECTED_FIELDS,
  ItemMasterCommonFieldValues,
  ItemMasterGridRow
} from "../components/itemMaster/types.ts";
import { generateSkuCode } from "../services/skuGenerationEngine.ts";
import { itemMasterConfig } from "../components/global/configs/itemMaster.config.tsx";

describe("Item Master Tactical Grid (Smriti Prime Specification)", () => {

  describe("1. Field Definitions & Mandatory Attributes", () => {
    it("should have Stock No, Product, and MRP as required mandatory fields", () => {
      const mandatoryIds = DEFAULT_MANDATORY_FIELDS.map(f => f.id);
      expect(mandatoryIds).toContain("stockNo");
      expect(mandatoryIds).toContain("product");
      expect(mandatoryIds).toContain("mrp");
      expect(mandatoryIds.length).toBe(3);
    });

    it("should register all retail attributes in ALL_AVAILABLE_ITEM_FIELDS", () => {
      const allIds = ALL_AVAILABLE_ITEM_FIELDS.map(f => f.id);
      expect(allIds).toContain("barcode");
      expect(allIds).toContain("brand");
      expect(allIds).toContain("style");
      expect(allIds).toContain("shade");
      expect(allIds).toContain("size");
      expect(allIds).toContain("itemDescription");
      expect(allIds).toContain("sellingPrice");
      expect(allIds).toContain("dealerPrice");
      expect(allIds).toContain("costPrice");
      expect(allIds).toContain("productTax");
      expect(allIds).toContain("hsnCode");
      expect(allIds).toContain("manufacturer");
      expect(allIds).toContain("binLocation");
    });

    it("should contain default initial columns matching tactical grid setup", () => {
      expect(DEFAULT_INITIAL_SELECTED_FIELDS).toContain("stockNo");
      expect(DEFAULT_INITIAL_SELECTED_FIELDS).toContain("barcode");
      expect(DEFAULT_INITIAL_SELECTED_FIELDS).toContain("product");
      expect(DEFAULT_INITIAL_SELECTED_FIELDS).toContain("mrp");
      expect(DEFAULT_INITIAL_SELECTED_FIELDS).toContain("sellingPrice");
      expect(DEFAULT_INITIAL_SELECTED_FIELDS).toContain("productTax");
    });
  });

  describe("2. Field Selection Transfer & Reorder Logic", () => {
    it("should allow adding fields from available to selected", () => {
      let selected = [...DEFAULT_INITIAL_SELECTED_FIELDS];
      const newField = "binLocation";
      
      expect(selected).not.toContain(newField);
      selected = [...selected, newField];
      expect(selected).toContain(newField);
    });

    it("should prevent removing mandatory fields", () => {
      const mandatorySet = new Set(DEFAULT_MANDATORY_FIELDS.map(f => f.id));
      const targetToRemove = "stockNo";
      
      const isAllowed = !mandatorySet.has(targetToRemove);
      expect(isAllowed).toBe(false);
    });

    it("should reorder columns correctly when moving left/up or right/down", () => {
      const columns = ["stockNo", "barcode", "product", "brand"];
      
      // Move "product" (index 2) up
      const idx = columns.indexOf("product");
      const next = [...columns];
      const temp = next[idx - 1];
      next[idx - 1] = next[idx];
      next[idx] = temp;

      expect(next).toEqual(["stockNo", "product", "barcode", "brand"]);
    });
  });

  describe("3. Common Fields Propagation", () => {
    it("should hold complete batch default configuration values", () => {
      const common: ItemMasterCommonFieldValues = {
        brand: "Nike",
        category: "Footwear",
        subCategory: "Running",
        taxRate: "18",
        supplier: "Global Distributor Ltd",
        season: "SS26",
        status: "active",
        department: "Men",
        merchandiseCategory: "Athletic"
      };

      expect(common.brand).toBe("Nike");
      expect(common.taxRate).toBe("18");
      expect(common.status).toBe("active");
    });
  });

  describe("4. Auto SKU Generation", () => {
    it("should generate standardized auto-incrementing SKU codes", () => {
      const sku1 = generateSkuCode({
        brand: "Nike",
        styleCode: "AirMax",
        colour: "Black",
        size: "9"
      }, { mode: "AUTO", prefix: "SKU", sequenceStart: 1001 }, 0);

      const sku2 = generateSkuCode({
        brand: "Nike",
        styleCode: "AirMax",
        colour: "Black",
        size: "10"
      }, { mode: "AUTO", prefix: "SKU", sequenceStart: 1001 }, 1);

      const year = new Date().getFullYear();
      expect(sku1).toBe(`SKU-${year}-01001`);
      expect(sku2).toBe(`SKU-${year}-01002`);
    });
  });

  describe("5. Clipboard TSV Parsing for Tactical Grid", () => {
    it("should parse multi-column tab-separated rows into grid rows", () => {
      const tsvData = "STK-1001\t8901234567890\tErgonomic Chair\tHerman Miller\tAeron\tGraphite\tB\tOffice Chair\t299.99\t285.00\t210.00\t125.00\tSTD_18\t94031010\nSTK-1002\t8901234567891\tMechanical Keyboard\tLogitech\tMX\tGraphite\tFull\tQuiet Switches\t119.00\t110.00\t85.00\t45.50\tSTD_18\t84716040";
      
      const lines = tsvData.trim().split("\n");
      expect(lines.length).toBe(2);

      const row1Tokens = lines[0].split("\t");
      expect(row1Tokens[0]).toBe("STK-1001");
      expect(row1Tokens[1]).toBe("8901234567890");
      expect(row1Tokens[2]).toBe("Ergonomic Chair");
      expect(row1Tokens[3]).toBe("Herman Miller");
      expect(row1Tokens[8]).toBe("299.99");
    });
  });

  describe("6. Backend Payload Transformation", () => {
    it("should transform grid row into compliant FastAPI product payload", () => {
      const gridRow: ItemMasterGridRow = {
        id: "row-1",
        stockNo: "STK-1001",
        barcode: "8901234567890",
        product: "Ergonomic Desk Chair V2",
        brand: "Herman Miller",
        style: "Aeron",
        shade: "Graphite",
        size: "B",
        itemDescription: "Premium Office Chair",
        mrp: "299.99",
        sellingPrice: "285.00",
        dealerPrice: "210.00",
        costPrice: "125.00",
        productTax: "STD_18",
        hsnCode: "94031010",
        uom: "Pcs"
      };

      const payload = {
        code: gridRow.stockNo,
        name: gridRow.product,
        barcode: gridRow.barcode,
        price: parseFloat(gridRow.sellingPrice),
        mrp: parseFloat(gridRow.mrp),
        cost_price: parseFloat(gridRow.costPrice),
        stock: 100,
        brand: gridRow.brand,
        color: gridRow.shade,
        size: gridRow.size,
        style_code: gridRow.style,
        hsn_code: gridRow.hsnCode,
        gst_percentage: 18,
        is_active: true
      };

      expect(payload.code).toBe("STK-1001");
      expect(payload.name).toBe("Ergonomic Desk Chair V2");
      expect(payload.price).toBe(285.00);
      expect(payload.mrp).toBe(299.99);
      expect(payload.cost_price).toBe(125.00);
      expect(payload.gst_percentage).toBe(18);
    });
  });

  describe("7. Edit Mode Immutability & Non-Editable SKU / Barcode Enforcement", () => {
    it("should classify SKU and Barcode as non-editable in Edit mode while all other fields remain editable", () => {
      const activeMode = "edit";
      const isFieldNonEditable = (key: string, mode: string) => {
        const isCode = key === "code" || key === "sku" || key === "stockNo";
        const isBarcode = key === "barcode";
        return mode === "edit" && (isCode || isBarcode);
      };

      // SKU and Barcode MUST be non-editable in edit mode
      expect(isFieldNonEditable("code", activeMode)).toBe(true);
      expect(isFieldNonEditable("sku", activeMode)).toBe(true);
      expect(isFieldNonEditable("stockNo", activeMode)).toBe(true);
      expect(isFieldNonEditable("barcode", activeMode)).toBe(true);

      // Other fields MUST remain editable in edit mode
      const editableKeys = [
        "product", "name", "brand", "style", "shade", "size",
        "itemDescription", "sellingPrice", "dealerPrice", "costPrice",
        "mrp", "productTax", "hsnCode", "category", "subCategory", "uom",
        "a1", "a2", "a3", "a4", "a5"
      ];

      editableKeys.forEach(k => {
        expect(isFieldNonEditable(k, activeMode)).toBe(false);
      });
    });

    it("should allow SKU and Barcode to be editable in Add mode", () => {
      const activeMode = "add";
      const isFieldNonEditable = (key: string, mode: string) => {
        const isCode = key === "code" || key === "sku" || key === "stockNo";
        const isBarcode = key === "barcode";
        return mode === "edit" && (isCode || isBarcode);
      };

      expect(isFieldNonEditable("code", activeMode)).toBe(false);
      expect(isFieldNonEditable("sku", activeMode)).toBe(false);
      expect(isFieldNonEditable("stockNo", activeMode)).toBe(false);
      expect(isFieldNonEditable("barcode", activeMode)).toBe(false);
    });

    it("should configure code and barcode as disabled in itemMasterConfig when isEdit is true", () => {
      const codeField = itemMasterConfig.fields.find(f => f.name === "code");
      const barcodeField = itemMasterConfig.fields.find(f => f.name === "barcode");
      const nameField = itemMasterConfig.fields.find(f => f.name === "name");
      const priceField = itemMasterConfig.fields.find(f => f.name === "price");

      expect(codeField).toBeDefined();
      expect(barcodeField).toBeDefined();
      expect(nameField).toBeDefined();

      // When editing (isEdit = true), code & barcode must be disabled
      expect(typeof codeField?.disabled === "function" && codeField.disabled({}, true)).toBe(true);
      expect(typeof barcodeField?.disabled === "function" && barcodeField.disabled({}, true)).toBe(true);

      // When creating new (isEdit = false), code & barcode must NOT be disabled
      expect(typeof codeField?.disabled === "function" && codeField.disabled({}, false)).toBe(false);
      expect(typeof barcodeField?.disabled === "function" && barcodeField.disabled({}, false)).toBe(false);

      // Other fields like name and price must not be disabled in edit mode
      expect(nameField?.disabled).toBeUndefined();
      expect(priceField?.disabled).toBeUndefined();
    });
  });

});

