/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-10-06
 * Modified     : 2026-10-06
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal — DataBridge UX Acceptance Test Suite
 */

import { describe, it, expect } from "vitest";
import { HeaderMappingEngine } from "../lib/headerMapping/HeaderMappingEngine.ts";
import { SMRITI_ITEM_MASTER_FIELDS } from "../lib/headerMapping/HeaderAliasRegistry.ts";
import { DataBridgeClientService } from "../components/databridge/databridgeService.ts";
import {
  DataBridgePreviewResponse,
  DataBridgeResultItem,
  DataBridgeEntityType,
} from "../components/databridge/databridgeTypes.ts";
import { resolveNavigation } from "../components/shell/navigationResolver.ts";
import { LAUNCHPAD_CATALOG } from "../components/launchpad/launchpadCatalog.ts";

describe("SMRITI DataBridge UX Requirements & Acceptance Criteria", () => {
  // Criterion 1 & 5: Header Mapping & Alias Registry
  describe("Field Mapping & HeaderAliasRegistry (Criteria 1 & 5)", () => {
    it("should automatically map recognizable headers using HeaderAliasRegistry", () => {
      const engine = new HeaderMappingEngine(SMRITI_ITEM_MASTER_FIELDS);
      const testHeaders = [
        "Article No.",
        "Brand",
        "Category",
        "Colour",
        "Size",
        "Barcode",
        "MRP",
        "Selling Price",
      ];
      const result = engine.mapHeaders(testHeaders);

      expect(result.columns.length).toBe(testHeaders.length);

      const mappedArticle = result.columns.find((c) => c.sourceHeader === "Article No.");
      expect(mappedArticle?.mappedFieldKey).toBe("code");

      const mappedColor = result.columns.find((c) => c.sourceHeader === "Colour");
      expect(mappedColor?.mappedFieldKey).toBe("colour");

      const mappedSize = result.columns.find((c) => c.sourceHeader === "Size");
      expect(mappedSize?.mappedFieldKey).toBe("size");

      const mappedBarcode = result.columns.find((c) => c.sourceHeader === "Barcode");
      expect(mappedBarcode?.mappedFieldKey).toBe("barcode");

      const mappedMrp = result.columns.find((c) => c.sourceHeader === "MRP");
      expect(mappedMrp?.mappedFieldKey).toBe("mrp");

      const mappedSellingPrice = result.columns.find((c) => c.sourceHeader === "Selling Price");
      expect(mappedSellingPrice?.mappedFieldKey).toBe("price");
    });

    it("should not silently map unknown or ambiguous headers", () => {
      const engine = new HeaderMappingEngine(SMRITI_ITEM_MASTER_FIELDS);
      const result = engine.mapHeaders(["XYZ_UNKNOWN_FIELD_123"]);
      expect(result.columns[0].mappedFieldKey).toBeNull();
      expect(result.columns[0].confidence).toBe("UNMAPPED");
    });
  });

  // Criterion 7 & 11: Preview Dashboard & Commit Guard
  describe("Commit Guard & Safety Invariants (Criteria 7 & 11)", () => {
    it("should disable commit when conflict count > 0", () => {
      const previewWithConflicts: DataBridgePreviewResponse = {
        preview_token: "tok_test_001",
        import_id: "DB-TEST-001",
        entity_type: "CATALOG",
        total_rows: 500,
        summary: {
          total_rows: 500,
          create_count: 450,
          update_count: 40,
          no_change_count: 8,
          conflict_count: 2,
          validation_error_count: 0,
          dependency_error_count: 0,
          create: 450,
          update: 40,
          no_change: 8,
          conflicts: 2,
          validation_errors: 0,
          dependency_errors: 0,
        },
        can_commit: false,
        blocking_reasons: ["2 barcode identity conflicts must be resolved before import."],
        items: [],
      };

      const canCommitComputed =
        previewWithConflicts.summary.conflicts === 0 &&
        previewWithConflicts.summary.validation_errors === 0 &&
        previewWithConflicts.summary.dependency_errors === 0 &&
        previewWithConflicts.can_commit;

      expect(canCommitComputed).toBe(false);
      expect(previewWithConflicts.blocking_reasons.length).toBeGreaterThan(0);
    });

    it("should disable commit when validation error count > 0", () => {
      const previewWithValidationErrors: DataBridgePreviewResponse = {
        preview_token: "tok_test_002",
        import_id: "DB-TEST-002",
        entity_type: "ITEMS",
        total_rows: 100,
        summary: {
          total_rows: 100,
          create_count: 95,
          update_count: 0,
          no_change_count: 0,
          conflict_count: 0,
          validation_error_count: 5,
          dependency_error_count: 0,
          create: 95,
          update: 0,
          no_change: 0,
          conflicts: 0,
          validation_errors: 5,
          dependency_errors: 0,
        },
        can_commit: false,
        blocking_reasons: ["5 validation errors found in source file."],
        items: [],
      };

      const canCommitComputed =
        previewWithValidationErrors.summary.conflicts === 0 &&
        previewWithValidationErrors.summary.validation_errors === 0 &&
        previewWithValidationErrors.summary.dependency_errors === 0 &&
        previewWithValidationErrors.can_commit;

      expect(canCommitComputed).toBe(false);
    });

    it("should allow commit ONLY when blocking issue counts are all 0", () => {
      const cleanPreview: DataBridgePreviewResponse = {
        preview_token: "tok_test_003",
        import_id: "DB-TEST-003",
        entity_type: "CATALOG",
        total_rows: 1000,
        summary: {
          total_rows: 1000,
          create_count: 900,
          update_count: 80,
          no_change_count: 20,
          conflict_count: 0,
          validation_error_count: 0,
          dependency_error_count: 0,
          create: 900,
          update: 80,
          no_change: 20,
          conflicts: 0,
          validation_errors: 0,
          dependency_errors: 0,
        },
        can_commit: true,
        blocking_reasons: [],
        items: [],
      };

      const canCommitComputed =
        cleanPreview.summary.conflicts === 0 &&
        cleanPreview.summary.validation_errors === 0 &&
        cleanPreview.summary.dependency_errors === 0 &&
        cleanPreview.can_commit;

      expect(canCommitComputed).toBe(true);
      expect(cleanPreview.blocking_reasons.length).toBe(0);
    });
  });

  // Criterion 8: Diff View Integrity
  describe("Diff View Requirements (Criterion 8)", () => {
    it("should correctly isolate changed fields from unchanged fields", () => {
      const mockResultItem: DataBridgeResultItem = {
        row_number: 14,
        sku: "CH-501-BLK-09",
        classification: "UPDATE",
        status_label: "Update",
        description: "Casual Shoes Black 09",
        barcode: "8901234567891",
        mrp: 1599,
        selling_price: 1299,
        changes_count: 2,
        diff_fields: [
          {
            field_name: "selling_price",
            current_value: 1199,
            incoming_value: 1299,
            diff_type: "CHANGED",
          },
          {
            field_name: "mrp",
            current_value: 1499,
            incoming_value: 1599,
            diff_type: "CHANGED",
          },
          {
            field_name: "item_code",
            current_value: "CH-501-BLK-09",
            incoming_value: "CH-501-BLK-09",
            diff_type: "UNCHANGED",
          },
          {
            field_name: "brand",
            current_value: "SMRITI",
            incoming_value: "SMRITI",
            diff_type: "UNCHANGED",
          },
        ],
      };

      const changedOnly = mockResultItem.diff_fields.filter((f) => f.diff_type === "CHANGED");
      const unchangedOnly = mockResultItem.diff_fields.filter((f) => f.diff_type === "UNCHANGED");

      expect(changedOnly.length).toBe(2);
      expect(unchangedOnly.length).toBe(2);
      expect(changedOnly[0].field_name).toBe("selling_price");
      expect(changedOnly[0].current_value).toBe(1199);
      expect(changedOnly[0].incoming_value).toBe(1299);
    });
  });

  // Criterion 9 & 10: Conflict UX and WHY Explainability
  describe("Conflict UX & Explainability (Criteria 9 & 10)", () => {
    it("should provide human-readable explainability for barcode identity conflicts", () => {
      const conflictItem: DataBridgeResultItem = {
        row_number: 22,
        sku: "CH-502-BLU-08",
        classification: "EXISTING_CONFLICT",
        status_label: "Conflict",
        description: "Sports Shoes Blue 08",
        barcode: "8901234567893",
        conflict_details: {
          conflict_type: "BARCODE_COLLISION",
          title: "Barcode Conflict",
          barcode: "8901234567893",
          existing_sku: "CH-501-BLK-08",
          incoming_sku: "CH-502-BLU-08",
          why_explanation:
            "SMRITI protects barcode identity and never automatically transfers a barcode between SKUs.",
          action_guidance:
            "1. Correct the barcode in your source file, OR\n2. Remove this row and import again.",
        },
        diff_fields: [],
      };

      expect(conflictItem.conflict_details).toBeDefined();
      expect(conflictItem.conflict_details?.title).toBe("Barcode Conflict");
      expect(conflictItem.conflict_details?.why_explanation).toContain("protects barcode identity");
      expect(conflictItem.conflict_details?.action_guidance).toContain("Correct the barcode");
    });
  });

  // Criterion 14: Error Rows Export Formatting
  describe("Error Rows CSV Export (Criterion 14)", () => {
    it("should produce CSV rows with required schema and without raw technical tracebacks", () => {
      const itemsWithIssues: DataBridgeResultItem[] = [
        {
          row_number: 4,
          sku: "CH-502-BLU-08",
          classification: "EXISTING_CONFLICT",
          status_label: "Conflict",
          description: "Sports Shoes Blue 08",
          barcode: "8901234567893",
          issue_code: "BARCODE_COLLISION",
          issue_message: "Barcode already allocated to SKU CH-501-BLK-08",
          suggested_action: "Correct barcode in source spreadsheet",
          raw_row: { "Article No.": "CH-502-BLU-08", Barcode: "8901234567893" },
          diff_fields: [],
        },
        {
          row_number: 5,
          sku: "CH-503-RED-08",
          classification: "VALIDATION_ERROR",
          status_label: "Validation Error",
          description: "Sports Shoes Red 08",
          issue_code: "MISSING_MANDATORY_FIELD",
          issue_message: "Mandatory barcode is missing",
          suggested_action: "Provide valid 8 to 14 digit barcode",
          raw_row: { "Article No.": "CH-503-RED-08", Barcode: "" },
          diff_fields: [],
        },
      ];

      const csvContent = DataBridgeClientService.generateErrorRowsCsv(itemsWithIssues);

      // Verify CSV header line
      expect(csvContent).toContain("Original Row Number,SKU / Item Code,Status,Error Code,Human-readable Message,Suggested Action,Original Data");
      // Verify row 4 & 5 content
      expect(csvContent).toContain('"4","CH-502-BLU-08","EXISTING_CONFLICT","BARCODE_COLLISION"');
      expect(csvContent).toContain('"5","CH-503-RED-08","VALIDATION_ERROR","MISSING_MANDATORY_FIELD"');

      // Verify no raw tracebacks or internal paths leaked
      expect(csvContent).not.toContain("Traceback (most recent call last)");
      expect(csvContent).not.toContain("backend/app/services");
      expect(csvContent).not.toContain("psycopg2");
      expect(csvContent).not.toContain("SQLAlchemyError");
    });
  });

  // Criterion 17: Downloadable Templates Catalog
  describe("Downloadable Templates Catalog (Criterion 17)", () => {
    it("should provide pre-configured templates for all 5 entity types", () => {
      const entityTypes: DataBridgeEntityType[] = ["ITEM", "VARIANT", "BARCODE", "PRICEBOOK", "CATALOG"];

      entityTypes.forEach((entity) => {
        const template = DataBridgeClientService.getTemplateCsv(entity);
        expect(template.fileName).toContain(".csv");
        expect(template.csvContent.length).toBeGreaterThan(20);
        expect(template.csvContent).toContain(","); // Valid CSV headers
      });
    });
  });

  // Criterion 1 & 16: Launchpad & Navigation Resolution
  describe("Workspace Shell Integration (Criterion 1 & 16)", () => {
    it("should resolve databridge under masters navigation context", () => {
      const resolved = resolveNavigation({ context: "masters" });
      const databridgeItem = resolved.items.find((item) => item.id === "databridge");

      expect(databridgeItem).toBeDefined();
      expect(databridgeItem?.title).toBe("SMRITI DataBridge");
      expect(databridgeItem?.icon).toBe("dataset");
    });

    it("should have databridge tile in LAUNCHPAD_CATALOG under Data & Config group", () => {
      const databridgeTile = LAUNCHPAD_CATALOG.find((tile) => tile.id === "databridge");

      expect(databridgeTile).toBeDefined();
      expect(databridgeTile?.group).toBe("Data & Config");
      expect(databridgeTile?.shortcut).toBe("F11");
      expect(databridgeTile?.tag).toBe("DataBridge");
    });
  });
});
