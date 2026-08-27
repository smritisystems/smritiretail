/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.25.0
 * Created      : 2026-08-24
 * Modified     : 2026-08-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  GlobalExportService,
  serializeToCSV,
  serializeToTSV,
  serializeToSpreadsheetML,
  serializeToAlignedTextTable,
  sanitizeExportRecord,
  generateSafeExportFilename,
  formatCellValue,
  SENSITIVE_EXPORT_FIELDS,
} from "../services/globalExportService.ts";
import { ExportColumnDefinition, ExportMetadata } from "../components/export/types.ts";

describe("GlobalExportService & Export Engine Test Suite", () => {
  const sampleColumns: ExportColumnDefinition[] = [
    { key: "code", label: "SKU Code", datatype: "text", width: 15 },
    { key: "name", label: "Product Title", datatype: "text", width: 25 },
    { key: "category", label: "Category", datatype: "text", width: 15 },
    { key: "buyingPrice", label: "Buying Price", datatype: "currency", isSummary: true, width: 15 },
    { key: "costPrice", label: "Cost Price", datatype: "currency", isSummary: true, width: 15 },
    { key: "price", label: "Selling Price", datatype: "currency", isSummary: true, width: 15 },
    { key: "mrp", label: "MRP", datatype: "currency", isSummary: true, width: 15 },
    { key: "taxRate", label: "GST %", datatype: "percentage", width: 10 },
    { key: "stock", label: "Stock Qty", datatype: "number", isSummary: true, width: 12 },
    { key: "isActive", label: "Active", datatype: "boolean", width: 10 },
    { key: "createdDate", label: "Created At", datatype: "date", width: 15 },
  ];

  const sampleData = [
    {
      code: "SKU-SHOE-01",
      name: 'Running "Pro" Shoes, Blue',
      category: "Footwear",
      buyingPrice: 1200,
      costPrice: 1000,
      price: 1999,
      mrp: 2499,
      taxRate: 18,
      stock: 45,
      isActive: true,
      createdDate: "2026-08-24T10:00:00Z",
      password: "secret_password_123",
      jwt_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
    },
    {
      code: "SKU-SHIRT-02",
      name: "Cotton Formal Shirt",
      category: "Apparel",
      buyingPrice: 600,
      costPrice: 500,
      price: 999,
      mrp: 1299,
      taxRate: 5,
      stock: 120,
      isActive: false,
      createdDate: "2026-08-23T14:30:00Z",
      api_key: "sgip_key_live_9988",
    },
  ];

  const sampleMetadata: ExportMetadata = {
    moduleTitle: "Item Master Matrix",
    companyName: "SMRITI Retail Ltd",
    branchName: "Flagship Store",
    exportedBy: "System Architect",
    searchTerm: "Shoes",
    appliedFilters: { category: "Footwear" },
    totalRecordsCount: 2,
  };

  describe("1. Sensitive Data Sanitization", () => {
    it("strips password, tokens, secrets, and api_keys from exported records", () => {
      const sanitized = sanitizeExportRecord(sampleData);
      expect(sanitized).toHaveLength(2);

      for (const row of sanitized) {
        for (const sensitiveKey of SENSITIVE_EXPORT_FIELDS) {
          expect(row).not.toHaveProperty(sensitiveKey);
        }
      }

      // Preserves valid business fields
      expect(sanitized[0].code).toBe("SKU-SHOE-01");
      expect(sanitized[0].buyingPrice).toBe(1200);
      expect(sanitized[1].code).toBe("SKU-SHIRT-02");
    });
  });

  describe("2. Value Formatting", () => {
    it("formats currency in Indian Rupees format", () => {
      const col: ExportColumnDefinition = { key: "price", label: "Price", datatype: "currency" };
      const formatted = formatCellValue(1999, col);
      expect(formatted).toContain("1,999.00");
    });

    it("formats percentages with 2 decimals", () => {
      const col: ExportColumnDefinition = { key: "tax", label: "Tax", datatype: "percentage" };
      expect(formatCellValue(18, col)).toBe("18.00%");
      expect(formatCellValue(5.5, col)).toBe("5.50%");
    });

    it("formats dates and booleans correctly", () => {
      const dateCol: ExportColumnDefinition = { key: "date", label: "Date", datatype: "date" };
      expect(formatCellValue("2026-08-24T15:30:00Z", dateCol)).toBe("2026-08-24");

      const boolCol: ExportColumnDefinition = { key: "active", label: "Active", datatype: "boolean" };
      expect(formatCellValue(true, boolCol)).toBe("Yes");
      expect(formatCellValue(false, boolCol)).toBe("No");
    });
  });

  describe("3. CSV Serialization", () => {
    it("generates RFC 4180 compliant CSV with UTF-8 BOM, metadata header, and quotes", () => {
      const csv = serializeToCSV(sampleColumns, sampleData, sampleMetadata);

      // Verify UTF-8 BOM
      expect(csv.startsWith("\uFEFF")).toBe(true);

      // Verify metadata header
      expect(csv).toContain("# SMRITI Retail OS - Export Center");
      expect(csv).toContain("# Module: Item Master Matrix");
      expect(csv).toContain("# Company: SMRITI Retail Ltd");
      expect(csv).toContain("# Search Term: Shoes");

      // Verify column header
      expect(csv).toContain("SKU Code,Product Title,Category,Buying Price,Cost Price,Selling Price,MRP,GST %,Stock Qty,Active,Created At");

      // Verify escaped quotes and commas in product title
      expect(csv).toContain('"Running ""Pro"" Shoes, Blue"');

      // Verify totals/summary row
      expect(csv).toContain("TOTAL / SUMMARY");
    });
  });

  describe("4. SpreadsheetML Excel (XLSX) Serialization", () => {
    it("generates valid SpreadsheetML XML workbook with styles, freeze panes, and numbers", () => {
      const xml = serializeToSpreadsheetML(sampleColumns, sampleData, sampleMetadata, "Item Master");

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"');
      expect(xml).toContain('<Worksheet ss:Name="Item Master">');
      expect(xml).toContain('<Style ss:ID="HeaderStyle">');
      expect(xml).toContain('<Style ss:ID="CurrencyCell">');
      expect(xml).toContain('<FreezePanes/>');

      // Typed numeric cells
      expect(xml).toContain('<Data ss:Type="Number">1200</Data>');
      expect(xml).toContain('<Data ss:Type="Number">1999</Data>');

      // Summary row
      expect(xml).toContain('<Cell ss:StyleID="SummaryStyle"><Data ss:Type="String">TOTAL / SUMMARY</Data></Cell>');
    });
  });

  describe("5. Plain Text (TXT) Table Serialization", () => {
    it("generates monospaced aligned ASCII table with borders and metadata banner", () => {
      const txt = serializeToAlignedTextTable(sampleColumns, sampleData, sampleMetadata);

      expect(txt).toContain("SMRITI RETAIL OS — EXPORT REPORT: Item Master Matrix");
      expect(txt).toContain("Company  : SMRITI Retail Ltd");
      expect(txt).toContain("SKU Code");
      expect(txt).toContain("Product Title");
      expect(txt).toContain("SKU-SHOE-01");
      expect(txt).toContain("TOTAL");
    });
  });

  describe("6. Safe Filename Generation", () => {
    it("generates clean, timestamped filenames without invalid characters", () => {
      const filenameXlsx = generateSafeExportFilename("Item Master / Matrix", "all", "xlsx");
      expect(filenameXlsx).toMatch(/^SMRITI_Item_Master_Matrix_All_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.xlsx$/);

      const filenameCsv = generateSafeExportFilename("Sales & Tax Invoices", "filtered", "csv");
      expect(filenameCsv).toMatch(/^SMRITI_Sales_Tax_Invoices_Filtered_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.csv$/);

      const customName = generateSafeExportFilename("Module", "selected", "txt", "My_Custom_Report:2026");
      expect(customName).toBe("My_Custom_Report_2026.txt");
    });
  });

  describe("7. GlobalExportService Dataset API", () => {
    beforeEach(() => {
      // Mock document and URL APIs for node environment
      if (typeof globalThis.document === "undefined") {
        (globalThis as any).document = {
          createElement: vi.fn().mockReturnValue({
            href: "",
            setAttribute: vi.fn(),
            click: vi.fn(),
          }),
          body: {
            appendChild: vi.fn(),
            removeChild: vi.fn(),
          },
        };
      }
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue("blob:http://localhost/mock-blob");
      globalThis.URL.revokeObjectURL = vi.fn();
    });

    it("exports in-memory dataset successfully for CSV, XLSX, and TXT formats", async () => {
      // CSV
      const csvRes = await GlobalExportService.exportDataset({
        moduleName: "Item Master",
        format: "csv",
        scope: "currentPage",
        columns: sampleColumns,
        data: sampleData,
        metadata: sampleMetadata,
      });
      expect(csvRes.success).toBe(true);
      expect(csvRes.rowCount).toBe(2);
      expect(csvRes.format).toBe("csv");
      expect(csvRes.fileSizeBytes).toBeGreaterThan(0);

      // XLSX
      const xlsxRes = await GlobalExportService.exportDataset({
        moduleName: "Item Master",
        format: "xlsx",
        scope: "currentPage",
        columns: sampleColumns,
        data: sampleData,
        metadata: sampleMetadata,
      });
      expect(xlsxRes.success).toBe(true);
      expect(xlsxRes.rowCount).toBe(2);
      expect(xlsxRes.format).toBe("xlsx");

      // JSON
      const jsonRes = await GlobalExportService.exportDataset({
        moduleName: "Item Master",
        format: "json",
        scope: "currentPage",
        columns: sampleColumns,
        data: sampleData,
        metadata: sampleMetadata,
      });
      expect(jsonRes.success).toBe(true);
      expect(jsonRes.rowCount).toBe(2);
      expect(jsonRes.format).toBe("json");

      // HTML
      const htmlRes = await GlobalExportService.exportDataset({
        moduleName: "Item Master",
        format: "html",
        scope: "currentPage",
        columns: sampleColumns,
        data: sampleData,
        metadata: sampleMetadata,
      });
      expect(htmlRes.success).toBe(true);
      expect(htmlRes.rowCount).toBe(2);
      expect(htmlRes.format).toBe("html");
    });

    it("handles string widths (e.g. '130px') safely in SpreadsheetML without producing NaN", () => {
      const stringWidthCols: ExportColumnDefinition[] = [
        { key: "code", label: "SKU", width: ("130px" as any) },
        { key: "name", label: "Name", width: ("200px" as any) },
      ];
      const xml = serializeToSpreadsheetML(stringWidthCols, sampleData);
      expect(xml).not.toContain("NaN");
      expect(xml).toContain('<Column ss:Width="130"/>');
      expect(xml).toContain('<Column ss:Width="200"/>');
    });

    it("respects selectedRows scope", async () => {
      const selected = [sampleData[0]];
      const res = await GlobalExportService.exportDataset({
        moduleName: "Item Master",
        format: "csv",
        scope: "selected",
        columns: sampleColumns,
        data: sampleData,
        selectedRows: selected,
      });
      expect(res.success).toBe(true);
      expect(res.rowCount).toBe(1);
    });

    it("returns error when dataset is empty", async () => {
      const res = await GlobalExportService.exportDataset({
        moduleName: "Item Master",
        format: "csv",
        scope: "currentPage",
        columns: sampleColumns,
        data: [],
      });
      expect(res.success).toBe(false);
      expect(res.errorMessage).toBe("No records available to export.");
    });

    it("serializes dataset into Tab-Separated Values (TSV) for Google Sheets", () => {
      const tsv = serializeToTSV(sampleColumns, sampleData, sampleMetadata);
      expect(tsv).toContain("SMRITI Retail OS — Item Master Matrix");
      expect(tsv).toContain("SKU Code\tProduct Title\tCategory");
      expect(tsv).toContain("SKU-SHOE-01\tRunning \"Pro\" Shoes, Blue\tFootwear");
      expect(tsv).toContain("TOTAL / SUMMARY");
    });

    it("executes Google Sheets export and handles gsheet format correctly", async () => {
      const res = await GlobalExportService.exportDataset({
        moduleName: "Item Master",
        format: "gsheet",
        scope: "all",
        columns: sampleColumns,
        data: sampleData,
        metadata: sampleMetadata,
      });
      expect(res.success).toBe(true);
      expect(res.format).toBe("gsheet");
      expect(res.rowCount).toBe(2);
    });
  });
});
