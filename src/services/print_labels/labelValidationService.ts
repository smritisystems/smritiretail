/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Version    : 3.37.0 (Pre-Flight Label Readiness & Validation Service)
 * Created    : 2026-07-25
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
 */

import { UniversalLabelItem, PrinterProfile } from "../universalLabelPrinterService.ts";

export interface LabelValidationIssue {
  itemId: string;
  itemName: string;
  severity: "warning" | "error";
  code: string;
  message: string;
  field?: string;
}

export interface LabelPreflightReport {
  totalItems: number;
  totalLabels: number;
  readyItemsCount: number;
  warningsCount: number;
  errorsCount: number;
  issues: LabelValidationIssue[];
  canPrint: boolean;
}

export const validateLabelQueuePreflight = (
  items: UniversalLabelItem[],
  activePrinter?: PrinterProfile,
  labelsStrategy: string = "specified"
): LabelPreflightReport => {
  const issues: LabelValidationIssue[] = [];
  let readyCount = 0;
  let totalLabels = 0;

  items.forEach(item => {
    let itemHasError = false;
    const copies = labelsStrategy === "stock" ? (item.stock_qty || 1) : (item.label_copies || 1);
    totalLabels += copies;

    // 1. Missing Barcode Check
    if (!item.barcode || item.barcode.trim() === "") {
      issues.push({
        itemId: item.id,
        itemName: item.name,
        severity: "error",
        code: "ERR_NO_BARCODE",
        message: "Missing barcode code symbol",
        field: "barcode"
      });
      itemHasError = true;
    } else if (item.barcode.length < 4) {
      issues.push({
        itemId: item.id,
        itemName: item.name,
        severity: "warning",
        code: "WARN_SHORT_BARCODE",
        message: "Barcode length is under 4 characters",
        field: "barcode"
      });
    }

    // 2. Zero Price Check
    if (!item.price || item.price <= 0) {
      issues.push({
        itemId: item.id,
        itemName: item.name,
        severity: "warning",
        code: "WARN_ZERO_PRICE",
        message: "Selling price is set to ₹0",
        field: "price"
      });
    }

    // 3. Negative / Zero Stock Check
    if ((item.stock_qty ?? 0) <= 0) {
      issues.push({
        itemId: item.id,
        itemName: item.name,
        severity: "warning",
        code: "WARN_ZERO_STOCK",
        message: "Current stock quantity on hand is 0",
        field: "stock_qty"
      });
    }

    if (!itemHasError) {
      readyCount++;
    }
  });

  // Printer Device Readiness Check
  if (!activePrinter) {
    issues.push({
      itemId: "global-prn",
      itemName: "Hardware Setup",
      severity: "error",
      code: "ERR_NO_PRINTER",
      message: "No active printer profile selected"
    });
  }

  const warningsCount = issues.filter(i => i.severity === "warning").length;
  const errorsCount = issues.filter(i => i.severity === "error").length;

  return {
    totalItems: items.length,
    totalLabels,
    readyItemsCount: readyCount,
    warningsCount,
    errorsCount,
    issues,
    canPrint: items.length > 0 && errorsCount === 0
  };
};
