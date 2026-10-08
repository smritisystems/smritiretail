/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.70.0
 * Created      : 2026-10-08
 * Modified     : 2026-10-08
 * Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: SMRITI Global Grid Input & Import Standard
 */

import { GridInputProfile } from "./types";

export interface TemplateGeneratorOptions {
  typeCode?: string;
  typeLabel?: string;
}

/**
 * Generates sample CSV template content for a given grid input profile.
 */
export function generateSampleCsvContent(
  profile: GridInputProfile,
  _options?: TemplateGeneratorOptions
): string {
  const headers = profile.allowedFields.map((f) => f.key);
  let sampleRecords: Record<string, string>[] = [];

  switch (profile.profileId) {
    case "LOOKUP_VALUE": {
      sampleRecords = [
        {
          code: "UPI",
          name: "UPI / Instant QR",
          description: "Unified Payments Interface Mode",
          active: "true",
          vendorCode: "",
          values: "",
        },
        {
          code: "MENS",
          name: "Men's Collection",
          description: "Standard Menswear & Footwear",
          active: "true",
          vendorCode: "",
          values: "",
        },
        {
          code: "GST-18",
          name: "GST 18% Standard",
          description: "Goods & Services Tax 18 Percent",
          active: "true",
          vendorCode: "",
          values: "",
        },
      ];
      break;
    }

    case "PURCHASE": {
      sampleRecords = [
        {
          barcode: "8901030383123",
          sku: "ART-101-BLK",
          name: "Leather Oxford Shoes",
          size: "42",
          color: "BLACK",
          quantity: "50",
          rate: "299.00",
          mrp: "599.00",
          batch: "BATCH-01",
        },
        {
          barcode: "8901030383124",
          sku: "ART-102-WHT",
          name: "Canvas Sneaker",
          size: "41",
          color: "WHITE",
          quantity: "25",
          rate: "499.00",
          mrp: "899.00",
          batch: "BATCH-02",
        },
      ];
      break;
    }

    case "STOCK_MOVEMENT": {
      sampleRecords = [
        {
          barcode: "8901030383123",
          sku: "ART-101-BLK",
          quantity: "10",
          batch: "BATCH-01",
        },
        {
          barcode: "8901030383124",
          sku: "ART-102-WHT",
          quantity: "15",
          batch: "BATCH-02",
        },
      ];
      break;
    }

    case "BARCODE_PRINTING": {
      sampleRecords = [
        {
          barcode: "8901030383123",
          sku: "ART-101-BLK",
          quantity: "20",
          price: "299.00",
          mrp: "599.00",
        },
        {
          barcode: "8901030383124",
          sku: "ART-102-WHT",
          quantity: "30",
          price: "499.00",
          mrp: "899.00",
        },
      ];
      break;
    }

    case "ITEM_MASTER": {
      sampleRecords = [
        {
          code: "OXFORD-01-42-BLK",
          name: "Classic Leather Oxford",
          barcode: "8901030383123",
          mrp: "599.00",
          purchaseRate: "299.00",
          category: "FOOTWEAR",
          size: "42",
          color: "BLACK",
          uom: "PAIR",
        },
        {
          code: "SNKR-02-41-WHT",
          name: "Casual Canvas Sneaker",
          barcode: "8901030383124",
          mrp: "899.00",
          purchaseRate: "449.00",
          category: "FOOTWEAR",
          size: "41",
          color: "WHITE",
          uom: "PAIR",
        },
      ];
      break;
    }

    default: {
      const fallbackRecord: Record<string, string> = {};
      profile.allowedFields.forEach((f) => {
        if (f.required) {
          fallbackRecord[f.key] = `SAMPLE_${f.key.toUpperCase()}`;
        }
      });
      sampleRecords = [fallbackRecord];
      break;
    }
  }

  const headerLine = headers.join(",");
  const dataLines = sampleRecords.map((record) => {
    return headers
      .map((key) => {
        const val = record[key] ?? "";
        if (val.includes(",") || val.includes('"') || val.includes("\n")) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      })
      .join(",");
  });

  return [headerLine, ...dataLines].join("\r\n");
}

/**
 * Browser helper to trigger instant download of a generated CSV string.
 */
export function triggerCsvDownload(filename: string, content: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
