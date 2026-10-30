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
 * Classification: Internal — DataBridge Frontend API & Data Service
 * Capability    : databridge.workspace_ux (@SmritiCapability / smriti_capability)
 */

import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import {
  DataBridgeEntityType,
  DataBridgePreviewResponse,
  DataBridgeCommitResponse,
  ImportHistoryItem,
  DataBridgeResultItem,
} from "./databridgeTypes.ts";

const HISTORY_STORAGE_KEY = "smriti_databridge_import_history";

export class DataBridgeClientService {
  /**
   * Fetches DataBridge platform status and tenant entitlement.
   */
  public static async getStatus(): Promise<any> {
    try {
      return await apiFetchV1("/databridge/status");
    } catch (err) {
      console.warn("[DataBridge] Failed to fetch status:", err);
      return { status: "ACTIVE", entitlement: { enabled: true } };
    }
  }

  /**
   * Submits parsed rows for zero-mutation preview evaluation.
   */
  public static async executePreview(
    entityType: DataBridgeEntityType,
    rows: Record<string, any>[]
  ): Promise<DataBridgePreviewResponse> {
    const canonicalType = entityType === "CATALOG" ? "CATALOG_DOCUMENT" : entityType;
    const payload = {
      entity_type: canonicalType,
      rows,
    };
    return await apiFetchV1("/databridge/preview", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * Submits an approved preview token for atomic commit.
   */
  public static async executeCommit(
    entityType: DataBridgeEntityType,
    previewToken: string,
    rows: Record<string, any>[]
  ): Promise<DataBridgeCommitResponse> {
    const canonicalType = entityType === "CATALOG" ? "CATALOG_DOCUMENT" : entityType;
    const payload = {
      entity_type: canonicalType,
      preview_token: previewToken,
      confirmed: true,
      rows,
    };
    return await apiFetchV1("/databridge/commit", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * Submits a high-volume dataset (>5,000 rows) for asynchronous background import.
   */
  public static async submitAsyncImport(
    req: {
      entityType: DataBridgeEntityType;
      rows: Record<string, any>[];
      chunkSize?: number;
      filename?: string;
      idempotencyKey?: string;
      previewOnly?: boolean;
    }
  ): Promise<any> {
    const canonicalType = req.entityType === "CATALOG" ? "CATALOG_DOCUMENT" : req.entityType;
    const payload = {
      entity_type: canonicalType,
      rows: req.rows,
      chunk_size: req.chunkSize || 500,
      filename: req.filename,
      idempotency_key: req.idempotencyKey,
      preview_only: !!req.previewOnly,
    };
    return await apiFetchV1("/databridge/async/submit", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * Polls real-time progress and status of an asynchronous import job.
   */
  public static async getAsyncJobStatus(jobId: string): Promise<any> {
    return await apiFetchV1(`/databridge/async/status/${jobId}`);
  }

  /**
   * Triggers background processing of the next eligible job chunk.
   */
  public static async processNextAsyncJob(): Promise<any> {
    return await apiFetchV1("/databridge/async/process-next", {
      method: "POST",
    });
  }

  /**
   * Cancels an active or pending background import job.
   */
  public static async cancelAsyncJob(jobId: string): Promise<any> {
    return await apiFetchV1(`/databridge/async/cancel/${jobId}`, {
      method: "POST",
    });
  }

  /**
   * Retrieves import history from localStorage with initial seeded history.
   */
  public static getImportHistory(): ImportHistoryItem[] {
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Failed to read import history", e);
    }

    // Default seeded history aligned with reference UI specification
    const defaultHistory: ImportHistoryItem[] = [
      {
        id: "hist-01",
        importId: "DB-20261006-00124",
        date: "06 Oct 2026, 10:32 AM",
        entity: "Complete Catalog",
        fileName: "Tattly_Master.xlsx",
        user: "Jawahar",
        rows: 5000,
        created: 3812,
        updated: 244,
        noChange: 936,
        errors: 8,
        status: "COMPLETED",
        duration: "17 minutes",
      },
      {
        id: "hist-02",
        importId: "DB-20261005-00098",
        date: "05 Oct 2026, 04:12 PM",
        entity: "Price Book",
        fileName: "Diwali_Pricing_Matrix.xlsx",
        user: "Pooja",
        rows: 1200,
        created: 0,
        updated: 1180,
        noChange: 0,
        errors: 20,
        status: "COMPLETED",
        duration: "4 minutes",
      },
      {
        id: "hist-03",
        importId: "DB-20261004-00076",
        date: "04 Oct 2026, 11:20 AM",
        entity: "Items",
        fileName: "Footwear_Spring26.csv",
        user: "Jawahar",
        rows: 800,
        created: 790,
        updated: 0,
        noChange: 0,
        errors: 10,
        status: "COMPLETED",
        duration: "2 minutes",
      },
      {
        id: "hist-04",
        importId: "DB-20261003-00054",
        date: "03 Oct 2026, 09:15 AM",
        entity: "Variants",
        fileName: "Color_Size_Matrix.csv",
        user: "Vikram",
        rows: 2000,
        created: 1950,
        updated: 30,
        noChange: 0,
        errors: 20,
        status: "FAILED",
        duration: "6 minutes",
      },
    ];

    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(defaultHistory));
    } catch {}
    return defaultHistory;
  }

  /**
   * Appends an import run to history.
   */
  public static recordImportHistory(item: ImportHistoryItem): void {
    const list = this.getImportHistory();
    const updated = [item, ...list];
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }

  /**
   * Generates CSV string for error rows without DOM dependence.
   */
  public static generateErrorRowsCsv(items: DataBridgeResultItem[]): string {
    const errorItems = items.filter((i) => i.blocking || (i.validation_errors && i.validation_errors.length > 0) || (i.conflicts && i.conflicts.length > 0) || i.classification === "EXISTING_CONFLICT" || i.classification === "VALIDATION_ERROR");
    const targetItems = errorItems.length > 0 ? errorItems : items;

    const headers = [
      "Original Row Number",
      "SKU / Item Code",
      "Status",
      "Error Code",
      "Human-readable Message",
      "Suggested Action",
      "Original Data",
    ];

    const rows = targetItems.map((item) => {
      const rowNum = (item.row_index !== undefined ? item.row_index + 1 : ((item as any).row_number ?? 1));
      const sku = item.identifier || (item as any).sku || (item.raw_data && item.raw_data["item_code"]) || ((item as any).raw_row && (item as any).raw_row["Article No."]) || "N/A";
      const status = item.classification;
      const errCode = (item.conflicts && item.conflicts.length > 0) ? item.conflicts[0].conflict_type : ((item as any).issue_code || (item.validation_errors && item.validation_errors.length > 0 ? "VALIDATION_ERROR" : "ERROR"));
      const msg = (item.conflicts && item.conflicts.length > 0) ? item.conflicts[0].message : ((item as any).issue_message || (item.validation_errors && item.validation_errors.join("; ")) || "Blocked row");
      const action = (item.conflicts && item.conflicts.length > 0 && item.conflicts[0].suggested_action) || (item as any).suggested_action || "Verify source data against system master values.";
      const rawData = JSON.stringify(item.raw_data || (item as any).raw_row || {});

      return [
        `"${rowNum}"`,
        `"${sku.replace(/"/g, '""')}"`,
        `"${status}"`,
        `"${errCode}"`,
        `"${msg.replace(/"/g, '""')}"`,
        `"${action.replace(/"/g, '""')}"`,
        `"${rawData.replace(/"/g, '""')}"`,
      ].join(",");
    });

    return "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  }

  /**
   * Generates CSV template content and filename without DOM dependence.
   */
  public static getTemplateCsv(entityType: DataBridgeEntityType): { fileName: string; csvContent: string } {
    let filename = `SMRITI_Template_${entityType}.csv`;
    let headers: string[] = [];
    let sampleRows: string[][] = [];

    switch (entityType) {
      case "ITEM":
        filename = "SMRITI_Template_Item_Master.csv";
        headers = ["Article No", "Description", "Brand", "Category", "Department", "UOM", "Tax Rate", "MRP", "Selling Price", "Cost Price", "HSN Code"];
        sampleRows = [
          ["CH-501", "Casual Sneakers Runner", "SMRITI", "Footwear", "FOOTWEAR", "Pair", "18.00", "2999.00", "2499.00", "1200.00", "6404"],
          ["AP-102", "Classic Oxford Cotton Shirt", "GENERIC", "Apparel", "APPAREL", "Pcs", "12.00", "1599.00", "1299.00", "650.00", "6205"],
        ];
        break;
      case "VARIANT":
        filename = "SMRITI_Template_Variants.csv";
        headers = ["Article No", "Variant SKU", "Color", "Size", "Barcode", "MRP", "Selling Price", "Cost Price"];
        sampleRows = [
          ["CH-501", "CH-501-BLK-38", "BLACK", "38", "8901234567890", "2999.00", "2499.00", "1200.00"],
          ["CH-501", "CH-501-BLK-39", "BLACK", "39", "8901234567891", "2999.00", "2499.00", "1200.00"],
          ["CH-501", "CH-501-BLU-38", "BLUE", "38", "8901234567892", "2999.00", "2499.00", "1200.00"],
        ];
        break;
      case "BARCODE":
        filename = "SMRITI_Template_Barcodes.csv";
        headers = ["Variant SKU", "Barcode", "Barcode Type", "Is Primary"];
        sampleRows = [
          ["CH-501-BLK-38", "8901234567890", "EAN13", "YES"],
          ["CH-501-BLK-38", "PKG-501-BLK-38", "CODE128", "NO"],
        ];
        break;
      case "PRICEBOOK":
        filename = "SMRITI_Template_PriceBook.csv";
        headers = ["Variant SKU", "Price Book Code", "Min Qty", "MRP", "Selling Price", "Cost Price"];
        sampleRows = [
          ["CH-501-BLK-38", "DEFAULT", "1", "2999.00", "2499.00", "1200.00"],
          ["CH-501-BLK-38", "WHOLESALE", "10", "2999.00", "1999.00", "1200.00"],
        ];
        break;
      case "CATALOG":
      default:
        filename = "SMRITI_Template_Complete_Catalog.csv";
        headers = ["Article No", "Description", "Brand", "Category", "Department", "Variant SKU", "Color", "Size", "Barcode", "UOM", "Tax Rate", "MRP", "Selling Price", "Cost Price", "HSN Code"];
        sampleRows = [
          ["CH-501", "Casual Sneakers", "SMRITI", "Footwear", "FOOTWEAR", "CH-501-BLK-08", "BLACK", "08", "8901234567890", "Pair", "18.00", "1299.00", "1199.00", "600.00", "6404"],
          ["CH-501", "Casual Sneakers", "SMRITI", "Footwear", "FOOTWEAR", "CH-501-BLK-09", "BLACK", "09", "8901234567891", "Pair", "18.00", "1299.00", "1199.00", "600.00", "6404"],
          ["CH-501", "Casual Sneakers", "SMRITI", "Footwear", "FOOTWEAR", "CH-501-WHT-08", "WHITE", "08", "8901234567892", "Pair", "18.00", "1299.00", "1199.00", "600.00", "6404"],
        ];
        break;
    }

    const csvContent = "\uFEFF" + [headers.join(","), ...sampleRows.map(r => r.map(c => `"${c}"`).join(","))].join("\r\n");
    return { fileName: filename, csvContent };
  }

  /**
   * Generates and triggers download of error rows CSV.
   */
  public static downloadErrorRowsCSV(items: DataBridgeResultItem[], fileName: string = "DataBridge_Error_Rows.csv"): void {
    const csvContent = this.generateErrorRowsCsv(items);
    if (!csvContent) return;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Downloads a predefined template CSV for an entity.
   */
  public static downloadTemplate(entityType: DataBridgeEntityType): void {
    const { fileName, csvContent } = this.getTemplateCsv(entityType);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
