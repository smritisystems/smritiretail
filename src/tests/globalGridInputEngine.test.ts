/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.55.0
 * Created      : 2026-10-03
 * Modified     : 2026-10-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: SMRITI Global Grid Input & Import Standard
 */

import { describe, it, expect } from "vitest";
import { GridInputEngine } from "../services/gridInput/gridInputEngine";
import { GRID_PROFILES } from "../services/gridInput/gridProfiles";
import { ParsedGridRow } from "../services/gridInput/types";

describe("SMRITI Global Grid Input Engine & Standard", () => {
  describe("1. Delimited Text Parser (Excel Clipboard, CSV, TSV, PDT)", () => {
    it("should parse Excel / Google Sheets tab-separated values (TSV) natively", () => {
      const excelText = "Barcode\tQuantity\tMRP\n8901001\t5\t999\n8901002\t10\t1499";
      const { matrix, delimiter } = GridInputEngine.parseDelimitedText(excelText);

      expect(delimiter).toBe("\t");
      expect(matrix.length).toBe(3);
      expect(matrix[0]).toEqual(["Barcode", "Quantity", "MRP"]);
      expect(matrix[1]).toEqual(["8901001", "5", "999"]);
      expect(matrix[2]).toEqual(["8901002", "10", "1499"]);
    });

    it("should parse standard CSV with RFC 4180 quotes and commas inside cells", () => {
      const csvText =
        'Barcode,Description,Qty,Price\n8901003,"Running Shoes, Blue",2,1250.50\n8901004,"T-Shirt ""Classic""",1,499.00';
      const { matrix, delimiter } = GridInputEngine.parseDelimitedText(csvText);

      expect(delimiter).toBe(",");
      expect(matrix.length).toBe(3);
      expect(matrix[0]).toEqual(["Barcode", "Description", "Qty", "Price"]);
      expect(matrix[1]).toEqual(["8901003", "Running Shoes, Blue", "2", "1250.50"]);
      expect(matrix[2]).toEqual(["8901004", 'T-Shirt "Classic"', "1", "499.00"]);
    });

    it("should detect and parse PDT tilde-delimited format (~)", () => {
      const pdtText = "8901005~12~750\n8901006~6~850";
      const { matrix, delimiter } = GridInputEngine.parseDelimitedText(pdtText);

      expect(delimiter).toBe("~");
      expect(matrix.length).toBe(2);
      expect(matrix[0]).toEqual(["8901005", "12", "750"]);
      expect(matrix[1]).toEqual(["8901006", "6", "850"]);
    });

    it("should detect and parse pipe-delimited format (|)", () => {
      const pipeText = "SKU|QTY|RATE\nSH-01|4|1200\nSH-02|8|1350";
      const { matrix, delimiter } = GridInputEngine.parseDelimitedText(pipeText);

      expect(delimiter).toBe("|");
      expect(matrix.length).toBe(3);
      expect(matrix[0]).toEqual(["SKU", "QTY", "RATE"]);
      expect(matrix[1]).toEqual(["SH-01", "4", "1200"]);
    });

    it("should strip UTF-8 BOM and handle empty lines gracefully", () => {
      const bomText = "\uFEFF\n\n8901007\t3\n\n";
      const { matrix } = GridInputEngine.parseDelimitedText(bomText);

      expect(matrix.length).toBe(1);
      expect(matrix[0]).toEqual(["8901007", "3"]);
    });
  });

  describe("2. Header Detection & Column Mapping Engine Integration", () => {
    it("should map standard and aliased headers to target profile keys", () => {
      const matrix = [
        ["EAN13", "Article No", "Item Description", "Qty", "Retail Price"],
        ["8901008", "ART-99", "Premium Polo", "3", "799"],
      ];

      const { columnMappings, hasHeaders, dataRows } = GridInputEngine.mapColumns(
        matrix,
        GRID_PROFILES.BILLING
      );

      expect(hasHeaders).toBe(true);
      expect(dataRows.length).toBe(1);

      const barcodeCol = columnMappings.find((m) => m.mappedFieldKey === "barcode");
      const skuCol = columnMappings.find((m) => m.mappedFieldKey === "sku");
      const qtyCol = columnMappings.find((m) => m.mappedFieldKey === "quantity");
      const mrpCol = columnMappings.find((m) => m.mappedFieldKey === "mrp");

      expect(barcodeCol).toBeDefined();
      expect(barcodeCol?.sourceHeader).toBe("EAN13");
      expect(skuCol).toBeDefined();
      expect(skuCol?.sourceHeader).toBe("Article No");
      expect(qtyCol).toBeDefined();
      expect(qtyCol?.sourceHeader).toBe("Qty");
      expect(mrpCol).toBeDefined();
      expect(mrpCol?.sourceHeader).toBe("Retail Price");
    });

    it("should fall back to positional column mapping when headers are not present", () => {
      const matrix = [
        ["8901009", "4", "1299"],
        ["8901010", "2", "899"],
      ];

      const { columnMappings, hasHeaders, dataRows } = GridInputEngine.mapColumns(
        matrix,
        GRID_PROFILES.BILLING
      );

      expect(hasHeaders).toBe(false);
      expect(dataRows.length).toBe(2);
      expect(columnMappings[0].mappedFieldKey).toBe(GRID_PROFILES.BILLING.allowedFields[0].key);
    });
  });

  describe("3. Grid Row Building & Normalization", () => {
    it("should sanitize quantities, currencies, and extract primary identifier", () => {
      const matrix = [
        ["Barcode", "Item Name", "Quantity", "MRP", "Rate"],
        ["8901011", "Leather Wallet", "5", "₹1,299.00", "999.00"],
      ];

      const { columnMappings, dataRows } = GridInputEngine.mapColumns(
        matrix,
        GRID_PROFILES.PURCHASE
      );

      const rows = GridInputEngine.buildGridRows(
        dataRows,
        columnMappings,
        GRID_PROFILES.PURCHASE
      );

      expect(rows.length).toBe(1);
      const row = rows[0];
      expect(row.identifier).toBe("8901011");
      expect(row.identifierType).toBe("BARCODE");
      expect(row.quantity).toBe(5);
      expect(row.mrp).toBe(1299);
      expect(row.costPrice).toBe(999);
      expect(row.resolutionStatus).toBe("PENDING");
    });

    it("should flag missing identifier as VALIDATION_ERROR when profile requires resolution", () => {
      const matrix = [
        ["Barcode", "Quantity"],
        ["", "10"],
      ];

      const { columnMappings, dataRows } = GridInputEngine.mapColumns(
        matrix,
        GRID_PROFILES.BILLING
      );

      const rows = GridInputEngine.buildGridRows(
        dataRows,
        columnMappings,
        GRID_PROFILES.BILLING
      );

      expect(rows.length).toBe(1);
      expect(rows[0].resolutionStatus).toBe("VALIDATION_ERROR");
      expect(rows[0].errorCode).toBe("MISSING_IDENTIFIER");
    });
  });

  describe("4. Duplicate Handling Policies", () => {
    const rawRows: ParsedGridRow[] = [
      {
        rowNumber: 1,
        rawValues: {},
        mappedValues: {},
        identifier: "8902001",
        identifierType: "BARCODE",
        quantity: 2,
        resolutionStatus: "PENDING",
      },
      {
        rowNumber: 2,
        rawValues: {},
        mappedValues: {},
        identifier: "8902001",
        identifierType: "BARCODE",
        quantity: 5,
        resolutionStatus: "PENDING",
      },
      {
        rowNumber: 3,
        rawValues: {},
        mappedValues: {},
        identifier: "8902002",
        identifierType: "BARCODE",
        quantity: 1,
        resolutionStatus: "PENDING",
      },
    ];

    it("MERGE_ROWS: should sum quantities of duplicate identifiers into single row", () => {
      const merged = GridInputEngine.applyDuplicatePolicy(rawRows, "MERGE_ROWS");

      expect(merged.length).toBe(2);
      const row8902001 = merged.find((r) => r.identifier === "8902001");
      expect(row8902001?.quantity).toBe(7);
      expect(row8902001?.warnings?.[0]).toContain("Merged with row #2");
    });

    it("ADD_AS_SEPARATE_ROWS: should preserve duplicates as distinct rows", () => {
      const separate = GridInputEngine.applyDuplicatePolicy(rawRows, "ADD_AS_SEPARATE_ROWS");

      expect(separate.length).toBe(3);
    });

    it("REJECT_DUPLICATE: should mark subsequent duplicates as VALIDATION_ERROR", () => {
      const rejected = GridInputEngine.applyDuplicatePolicy(rawRows, "REJECT_DUPLICATE");

      expect(rejected.length).toBe(3);
      expect(rejected[0].resolutionStatus).toBe("PENDING");
      expect(rejected[1].resolutionStatus).toBe("VALIDATION_ERROR");
      expect(rejected[1].errorCode).toBe("DUPLICATE_ROW");
      expect(rejected[2].resolutionStatus).toBe("PENDING");
    });
  });

  describe("5. Import Modes (APPEND, MERGE, REPLACE)", () => {
    interface ExistingItem {
      barcode: string;
      name: string;
      quantity: number;
    }

    const existing: ExistingItem[] = [
      { barcode: "8903001", name: "Shirt A", quantity: 10 },
      { barcode: "8903002", name: "Shirt B", quantity: 5 },
    ];

    const incoming: ParsedGridRow[] = [
      {
        rowNumber: 1,
        rawValues: {},
        mappedValues: {},
        identifier: "8903002",
        identifierType: "BARCODE",
        quantity: 3,
        resolutionStatus: "VALID",
      },
      {
        rowNumber: 2,
        rawValues: {},
        mappedValues: {},
        identifier: "8903003",
        identifierType: "BARCODE",
        quantity: 4,
        resolutionStatus: "VALID",
      },
    ];

    const converter = (r: ParsedGridRow): ExistingItem => ({
      barcode: r.identifier,
      name: `Imported ${r.identifier}`,
      quantity: r.quantity,
    });

    it("APPEND mode: appends all incoming items to existing list", () => {
      const result = GridInputEngine.applyImportMode(
        existing,
        incoming,
        "APPEND",
        converter,
        "barcode"
      );

      expect(result.length).toBe(4);
      expect(result[0].barcode).toBe("8903001");
      expect(result[2].barcode).toBe("8903002");
      expect(result[2].quantity).toBe(3);
    });

    it("MERGE mode: adds quantities to existing items and appends new items", () => {
      const result = GridInputEngine.applyImportMode(
        existing,
        incoming,
        "MERGE",
        converter,
        "barcode"
      );

      expect(result.length).toBe(3);
      const shirtB = result.find((i) => i.barcode === "8903002");
      expect(shirtB?.quantity).toBe(8); // 5 existing + 3 incoming
      const shirtC = result.find((i) => i.barcode === "8903003");
      expect(shirtC?.quantity).toBe(4);
    });

    it("REPLACE mode: discards existing items and replaces with incoming items", () => {
      const result = GridInputEngine.applyImportMode(
        existing,
        incoming,
        "REPLACE",
        converter,
        "barcode"
      );

      expect(result.length).toBe(2);
      expect(result[0].barcode).toBe("8903002");
      expect(result[1].barcode).toBe("8903003");
    });
  });

  describe("6. Governed Grid Profiles & Architectural Guardrails", () => {
    it("BILLING profile should enforce barcode requirement and allow APPEND/MERGE", () => {
      const billing = GRID_PROFILES.BILLING;
      expect(billing.profileId).toBe("BILLING");
      expect(billing.requireProductResolution).toBe(true);
      expect(billing.allowedFields.find((f) => f.key === "barcode")?.required).toBe(true);
      expect(billing.supportedImportModes).toContain("APPEND");
      expect(billing.supportedImportModes).toContain("MERGE");
    });

    it("PURCHASE profile should enforce atomic transaction safety", () => {
      const purchase = GRID_PROFILES.PURCHASE;
      expect(purchase.profileId).toBe("PURCHASE");
      expect(purchase.requireProductResolution).toBe(true);
      expect(purchase.atomicTransactionSafety).toBe(true);
      expect(purchase.supportedDuplicatePolicies).toContain("REJECT_DUPLICATE");
    });

    it("STOCK_MOVEMENT profile should enforce atomic transaction safety", () => {
      const stock = GRID_PROFILES.STOCK_MOVEMENT;
      expect(stock.profileId).toBe("STOCK_MOVEMENT");
      expect(stock.atomicTransactionSafety).toBe(true);
    });

    it("ITEM_MASTER profile should not require existing product resolution (creation mode)", () => {
      const master = GRID_PROFILES.ITEM_MASTER;
      expect(master.profileId).toBe("ITEM_MASTER");
      expect(master.requireProductResolution).toBe(false);
    });
  });
});
