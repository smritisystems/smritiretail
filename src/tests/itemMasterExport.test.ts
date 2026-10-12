/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.71.0
 * Created      : 2026-10-12
 * Modified     : 2026-10-12
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Unit Test Suite — Item Master Tri-Modal Export
 */

import { describe, it, expect } from "vitest";
import {
  ITEM_MASTER_EXPORT_PRESETS,
  ITEM_MASTER_AUDIT_COLUMNS,
  enrichItemRowsWithAuditMetadata,
} from "../components/itemMaster/itemMasterExportPresets.ts";
import {
  serializeToCSV,
  serializeToSpreadsheetML,
  serializeToOpenXMLXLSX,
} from "../services/globalExportService.ts";
import { ExportColumnDefinition, ExportMetadata } from "../components/export/types.ts";

describe("Item Master Tri-Modal Export Engine & Audit Verification Suite", () => {
  describe("1. Presets Integrity & Column Coverage", () => {
    it("exports all defined standard retail presets", () => {
      const presetIds = ITEM_MASTER_EXPORT_PRESETS.map((p) => p.id);
      expect(presetIds).toContain("all");
      expect(presetIds).toContain("pos_price_list");
      expect(presetIds).toContain("stocktake");
      expect(presetIds).toContain("procurement");
      expect(presetIds).toContain("ecom_catalog");
      expect(presetIds).toContain("statutory_tax");
      expect(presetIds).toContain("forensic_audit");
    });

    it("verifies POS price list preset contains only customer/register fields", () => {
      const posPreset = ITEM_MASTER_EXPORT_PRESETS.find((p) => p.id === "pos_price_list");
      expect(posPreset).toBeDefined();
      expect(posPreset?.columnKeys).toContain("code");
      expect(posPreset?.columnKeys).toContain("barcode");
      expect(posPreset?.columnKeys).toContain("name");
      expect(posPreset?.columnKeys).toContain("mrp");
      expect(posPreset?.columnKeys).toContain("price");
      expect(posPreset?.columnKeys).toContain("gst_percentage");
      // Must not expose sensitive supplier costs to POS cashiers
      expect(posPreset?.columnKeys).not.toContain("buying_price");
      expect(posPreset?.columnKeys).not.toContain("cost_price");
    });

    it("verifies Physical Stocktaking preset contains inventory count fields", () => {
      const stockPreset = ITEM_MASTER_EXPORT_PRESETS.find((p) => p.id === "stocktake");
      expect(stockPreset).toBeDefined();
      expect(stockPreset?.columnKeys).toContain("code");
      expect(stockPreset?.columnKeys).toContain("barcode");
      expect(stockPreset?.columnKeys).toContain("stock");
      expect(stockPreset?.columnKeys).toContain("uom");
      // Stocktake does not need buying/selling prices
      expect(stockPreset?.columnKeys).not.toContain("price");
      expect(stockPreset?.columnKeys).not.toContain("buying_price");
    });

    it("verifies Procurement preset contains vendor and cost fields", () => {
      const procPreset = ITEM_MASTER_EXPORT_PRESETS.find((p) => p.id === "procurement");
      expect(procPreset).toBeDefined();
      expect(procPreset?.columnKeys).toContain("vendor_code");
      expect(procPreset?.columnKeys).toContain("buying_price");
      expect(procPreset?.columnKeys).toContain("cost_price");
      expect(procPreset?.columnKeys).toContain("hsn_code");
    });

    it("verifies Forensic Audit preset flags isAudit and includes compliance fields", () => {
      const auditPreset = ITEM_MASTER_EXPORT_PRESETS.find((p) => p.id === "forensic_audit");
      expect(auditPreset).toBeDefined();
      expect(auditPreset?.isAudit).toBe(true);
      expect(auditPreset?.columnKeys).toContain("compliance_status");
      expect(auditPreset?.columnKeys).toContain("compliance_issues");
      expect(auditPreset?.columnKeys).toContain("audit_margin_amount");
      expect(auditPreset?.columnKeys).toContain("audit_margin_percentage");
      expect(auditPreset?.columnKeys).toContain("created_at");
      expect(auditPreset?.columnKeys).toContain("modified_at");
      expect(auditPreset?.columnKeys).toContain("version");
    });
  });

  describe("2. Forensic Compliance & Anomaly Audit Detection", () => {
    it("correctly identifies fully compliant items as COMPLIANT", () => {
      const validRow = {
        code: "SKU-SHOE-101",
        barcode: "8901234567890",
        name: "Running Shoes",
        category: "Footwear",
        hsn_code: "64041100",
        gst_percentage: 18,
        buying_price: 1000,
        cost_price: 900,
        price: 1500,
        mrp: 1999,
        created_at: "2026-10-12T10:00:00Z",
        version: 1,
      };

      const enriched = enrichItemRowsWithAuditMetadata([validRow]);
      expect(enriched).toHaveLength(1);
      expect(enriched[0].compliance_status).toBe("COMPLIANT");
      expect(enriched[0].compliance_issues).toBe("None (Fully Compliant)");
      expect(enriched[0].audit_margin_amount).toBe(600); // 1500 - 900
      expect(enriched[0].audit_discount_amount).toBe(499); // 1999 - 1500
      expect(enriched[0].audit_margin_percentage).toBeCloseTo(40, 1); // 600 / 1500 * 100
    });

    it("detects Legal Metrology violation when Selling Price > MRP", () => {
      const illegalRow = {
        code: "SKU-VIOLATION-01",
        barcode: "8901234567891",
        name: "Overpriced Goods",
        category: "Apparel",
        hsn_code: "62052000",
        gst_percentage: 12,
        buying_price: 500,
        cost_price: 450,
        price: 1200, // SP 1200 > MRP 1000!
        mrp: 1000,
      };

      const enriched = enrichItemRowsWithAuditMetadata([illegalRow]);
      expect(enriched[0].compliance_status).toBe("FLAGGED");
      expect(enriched[0].compliance_issues).toContain("Legal Metrology Violation: SP exceeds MRP");
    });

    it("detects negative margin when Selling Price < Cost Price", () => {
      const lossRow = {
        code: "SKU-LOSS-02",
        barcode: "8901234567892",
        name: "Loss Maker Article",
        category: "Electronics",
        hsn_code: "85171300",
        gst_percentage: 18,
        buying_price: 6000,
        cost_price: 5500,
        price: 5000, // SP 5000 < CP 5500!
        mrp: 7000,
      };

      const enriched = enrichItemRowsWithAuditMetadata([lossRow]);
      expect(enriched[0].compliance_status).toBe("FLAGGED");
      expect(enriched[0].compliance_issues).toContain("Negative Margin: SP < Cost Price");
      expect(enriched[0].audit_margin_amount).toBe(-500);
    });

    it("detects missing HSN code and missing GST rate", () => {
      const missingStatutory = {
        code: "SKU-NO-HSN-03",
        barcode: "8901234567893",
        name: "Unclassified Product",
        category: "General",
        hsn_code: "",
        gst_percentage: null,
        buying_price: 100,
        cost_price: 80,
        price: 150,
        mrp: 180,
      };

      const enriched = enrichItemRowsWithAuditMetadata([missingStatutory]);
      expect(enriched[0].compliance_status).toBe("FLAGGED");
      expect(enriched[0].compliance_issues).toContain("Missing / Placeholder HSN Code");
      expect(enriched[0].compliance_issues).toContain("Missing GST Tax Rate");
    });

    it("detects Cost Price exceeding Buying Price", () => {
      const invalidCost = {
        code: "SKU-BAD-COST-04",
        barcode: "8901234567894",
        name: "Erroneous Cost Ratio",
        category: "General",
        hsn_code: "52081100",
        gst_percentage: 5,
        buying_price: 100,
        cost_price: 120, // CP 120 > BP 100!
        price: 150,
        mrp: 180,
      };

      const enriched = enrichItemRowsWithAuditMetadata([invalidCost]);
      expect(enriched[0].compliance_status).toBe("FLAGGED");
      expect(enriched[0].compliance_issues).toContain("Cost Price exceeds Buying Price");
    });
  });

  describe("3. Serialization & Export Engine Integration", () => {
    const sampleAuditCols: ExportColumnDefinition[] = [
      { key: "code", label: "SKU Code", datatype: "text" },
      { key: "barcode", label: "Barcode", datatype: "text" },
      { key: "name", label: "Product Name", datatype: "text" },
      { key: "price", label: "Selling Price", datatype: "currency", isSummary: true },
      { key: "mrp", label: "MRP", datatype: "currency", isSummary: true },
      { key: "compliance_status", label: "Audit Status", datatype: "badge" },
      { key: "compliance_issues", label: "Exceptions", datatype: "text" },
      { key: "audit_margin_amount", label: "Margin", datatype: "currency", isSummary: true },
    ];

    const rawRows = [
      {
        code: "SKU-GOOD-01",
        barcode: "8901234567801",
        name: "Good Product",
        hsn_code: "64041100",
        gst_percentage: 18,
        buying_price: 500,
        cost_price: 450,
        price: 800,
        mrp: 999,
      },
      {
        code: "SKU-BAD-02",
        barcode: "8901234567802",
        name: "Bad Product",
        hsn_code: "",
        gst_percentage: null,
        buying_price: 500,
        cost_price: 450,
        price: 1200,
        mrp: 1000,
      },
    ];

    const metadata: ExportMetadata = {
      moduleTitle: "Item Master Audit",
      companyName: "SMRITI Retail Ltd",
      branchName: "Flagship Store",
      exportedBy: "Auditor",
      totalRecordsCount: 2,
    };

    it("serializes enriched audit dataset to CSV with compliance exceptions", () => {
      const enriched = enrichItemRowsWithAuditMetadata(rawRows);
      const csv = serializeToCSV(sampleAuditCols, enriched, metadata);

      expect(csv).toContain("# Module: Item Master Audit");
      expect(csv).toContain("SKU Code,Barcode,Product Name,Selling Price,MRP,Audit Status,Exceptions,Margin");
      expect(csv).toContain("SKU-GOOD-01,8901234567801,Good Product");
      expect(csv).toContain("COMPLIANT");
      expect(csv).toContain("None (Fully Compliant)");
      expect(csv).toContain("FLAGGED");
      expect(csv).toContain("Legal Metrology Violation: SP exceeds MRP");
    });

    it("serializes enriched audit dataset to OpenXML XLSX buffer", () => {
      const enriched = enrichItemRowsWithAuditMetadata(rawRows);
      const xlsxBytes = serializeToOpenXMLXLSX(sampleAuditCols, enriched, metadata, "Item Audit");

      expect(xlsxBytes).toBeInstanceOf(Uint8Array);
      expect(xlsxBytes.length).toBeGreaterThan(100);
      // Valid ZIP magic header: PK\x03\x04
      expect(xlsxBytes[0]).toBe(0x50);
      expect(xlsxBytes[1]).toBe(0x4b);
      expect(xlsxBytes[2]).toBe(0x03);
      expect(xlsxBytes[3]).toBe(0x04);
    });

    it("serializes enriched audit dataset to SpreadsheetML XML", () => {
      const enriched = enrichItemRowsWithAuditMetadata(rawRows);
      const xml = serializeToSpreadsheetML(sampleAuditCols, enriched, metadata, "Item Audit");

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<Worksheet ss:Name="Item Audit">');
      expect(xml).toContain("<Data ss:Type=\"String\">COMPLIANT</Data>");
      expect(xml).toContain("<Data ss:Type=\"String\">FLAGGED</Data>");
    });
  });
});
