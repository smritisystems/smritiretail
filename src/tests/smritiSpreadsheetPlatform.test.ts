/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Spreadsheet Platform (SSP)
 * Organization : SmritiSys
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.3.0
 * Created      : 2026-07-27
 * Copyright    : © SmritiSys. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { describe, it, expect } from "vitest";
import { evaluateFormula } from "../spreadsheet/core/FormulaEngine";
import { parseClipboardData } from "../spreadsheet/core/ClipboardEngine";
import { validateCell } from "../spreadsheet/core/ValidationEngine";
import { HistoryEngine } from "../spreadsheet/core/HistoryEngine";
import { TransactionEngine } from "../spreadsheet/core/TransactionEngine";
import { PermissionEngine } from "../spreadsheet/core/PermissionEngine";
import { parseSSPAIPrompt, executeSSPAICommand } from "../spreadsheet/ai/AIAssistant";
import { ItemMasterAdapter } from "../spreadsheet/adapters/ItemMasterAdapter";
import { Product } from "../types";

describe("SMRITI Spreadsheet Platform (SSP) Core Tests", () => {
  describe("FormulaEngine", () => {
    it("should evaluate basic arithmetic and ROUND formula", () => {
      const res = evaluateFormula("=ROUND(100 * 1.18, 2)", { getValue: () => 0 });
      expect(res).toBe(118);
    });

    it("should evaluate ERP business function =GST(1000, 18)", () => {
      const res = evaluateFormula("=GST(1000, 18)", { getValue: () => 0 });
      expect(res).toBe(180);
    });

    it("should evaluate ERP business function =MARGIN(500, 300)", () => {
      const res = evaluateFormula("=MARGIN(500, 300)", { getValue: () => 0 });
      expect(res).toBe(40); // 40% margin
    });

    it("should evaluate ERP business function =MRP(400, 25)", () => {
      const res = evaluateFormula("=MRP(400, 25)", { getValue: () => 0 });
      expect(res).toBe(500);
    });
  });

  describe("ClipboardEngine", () => {
    it("should parse multi-row tab-separated TSV clipboard data", () => {
      const tsvData = "SKU-001\tT-Shirt\t499\nSKU-002\tJeans\t1299";
      const cols = [
        { key: "code", label: "SKU" },
        { key: "name", label: "Name" },
        { key: "price", label: "Price" },
      ];
      const parsed = parseClipboardData(tsvData, cols);
      expect(parsed.rowCount).toBe(2);
      expect(parsed.rows[0].code).toBe("SKU-001");
      expect(parsed.rows[0].name).toBe("T-Shirt");
      expect(parsed.rows[1].price).toBe("1299");
    });
  });

  describe("ValidationEngine", () => {
    it("should validate GST percentage boundaries", () => {
      const invalidGst = validateCell({ gstPercentage: "60" }, "gstPercentage");
      expect(invalidGst.status).toBe("error");

      const validGst = validateCell({ gstPercentage: "18" }, "gstPercentage");
      expect(validGst.status).toBe("valid");
    });

    it("should flag duplicate barcodes across rows", () => {
      const rows = [{ barcode: "8901" }, { barcode: "8901" }];
      const res = validateCell(rows[1], "barcode", rows);
      expect(res.status).toBe("warning");
    });
  });

  describe("HistoryEngine & TransactionEngine", () => {
    it("should support undo/redo stack state management", () => {
      const history = new HistoryEngine<number[]>(10);
      history.pushState([1, 2]);
      const undone = history.undo([1, 2, 3]);
      expect(undone).toEqual([1, 2]);

      const redone = history.redo([1, 2]);
      expect(redone).toEqual([1, 2, 3]);
    });

    it("should record pending transactions and commit", () => {
      const tx = new TransactionEngine();
      tx.recordChange({ rowIndex: 0, colKey: "price", oldValue: 100, newValue: 120, timestamp: Date.now() });
      expect(tx.getPendingCount()).toBe(1);

      const committed = tx.commit();
      expect(committed.length).toBe(1);
      expect(tx.getPendingCount()).toBe(0);
    });
  });

  describe("ItemMasterAdapter", () => {
    it("should transform Product entity array to grid rows and back", () => {
      const mockProd: Product = {
        id: "P-1",
        code: "SKU-100",
        name: "Mock Item",
        barcode: "123456",
        price: 500,
        mrp: 600,
        costPrice: 300,
        stock: 15,
        category: "Apparel",
      };

      const rows = ItemMasterAdapter.toGridRows([mockProd]);
      expect(rows[0].code).toBe("SKU-100");
      expect(rows[0].price).toBe("500");

      const reconstructed = ItemMasterAdapter.fromGridRows(rows);
      expect(reconstructed[0].price).toBe(500);
      expect(reconstructed[0].stock).toBe(15);
    });
  });

  describe("AIAssistant", () => {
    it("should execute natural language AI command 'Increase MRP by 10%'", () => {
      const rows = [{ mrp: "100" }, { mrp: "200" }];
      const cmd = parseSSPAIPrompt("Increase MRP by 10%");
      expect(cmd).not.toBeNull();
      const { updatedRows, result } = executeSSPAICommand(rows, cmd!);
      expect(result.updatedRowsCount).toBe(2);
      expect(updatedRows[0].mrp).toBe("110");
      expect(updatedRows[1].mrp).toBe("220");
    });
  });
});
