/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel
 * Standard     : SCS-PRINT-KERNEL-008 (Printer Capability Engine v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { UniversalLabelDocument } from "../models/UniversalLabelDocument.ts";
import { PrinterProfile } from "../models/PrinterProfile.ts";

export type CompatibilityStatus = "SUPPORTED" | "SUPPORTED_WITH_WARNINGS" | "UNSUPPORTED";

export interface CapabilityCheckResult {
  status: CompatibilityStatus;
  warnings: string[];
  unsupportedFeatures: string[];
  dpiMatched: boolean;
  dimensionsMatched: boolean;
}

export class PrinterCapabilityEngineService {
  public validateCapability(
    doc: UniversalLabelDocument,
    printer: PrinterProfile
  ): CapabilityCheckResult {
    const warnings: string[] = [];
    const unsupportedFeatures: string[] = [];

    // 1. Dimensions check
    let dimensionsMatched = true;
    if (doc.dimensions.widthMm > printer.media.maxWidthMm) {
      dimensionsMatched = false;
      unsupportedFeatures.push(
        `Label width (${doc.dimensions.widthMm}mm) exceeds printer max media width (${printer.media.maxWidthMm}mm).`
      );
    }
    if (doc.dimensions.heightMm > printer.media.maxHeightMm) {
      dimensionsMatched = false;
      warnings.push(
        `Label height (${doc.dimensions.heightMm}mm) exceeds printer nominal max height (${printer.media.maxHeightMm}mm).`
      );
    }

    // 2. DPI check
    let dpiMatched = true;
    if (doc.dimensions.dpi !== printer.dpi) {
      dpiMatched = false;
      warnings.push(
        `Label target DPI (${doc.dimensions.dpi}) differs from printer hardware DPI (${printer.dpi}). Output scaling will be applied.`
      );
    }

    // 3. Document element capability requirement check against printer hardware
    const req = doc.capabilities;
    const cap = printer.capabilities;

    if (req.supportsBarcode && !cap.supportsBarcode1D) {
      unsupportedFeatures.push("Printer does not support 1D barcodes.");
    }
    if (req.supportsQRCode && !cap.supportsQRCode) {
      unsupportedFeatures.push("Printer does not support hardware QR code rendering.");
    }
    if (req.supportsDataMatrix && !cap.supportsDataMatrix) {
      unsupportedFeatures.push("Printer does not support hardware DataMatrix rendering.");
    }
    if (req.supportsImages && !cap.supportsRasterImages) {
      unsupportedFeatures.push("Printer does not support raster graphic rendering.");
    }
    if (req.supportsRotation && !cap.supportsRotation) {
      warnings.push("Printer does not support 90/180/270 degree element rotation.");
    }

    // Check specific elements in document
    for (const el of doc.elements) {
      if (el.type === "RAW_COMMAND" && !cap.supportsRawPrinting) {
        unsupportedFeatures.push("Document contains RAW_COMMAND elements, but printer profile does not allow raw printing.");
      }
    }

    let status: CompatibilityStatus = "SUPPORTED";

    if (unsupportedFeatures.length > 0) {
      status = "UNSUPPORTED";
    } else if (warnings.length > 0) {
      status = "SUPPORTED_WITH_WARNINGS";
    }

    return {
      status,
      warnings,
      unsupportedFeatures,
      dpiMatched,
      dimensionsMatched,
    };
  }

  public fromSystemPrinter(item: { name: string; driver?: string; manufacturer?: string; connection?: string }): any {
    return {
      id: `sys-${item.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      name: item.name,
      driverId: item.driver || "zpl",
      manufacturer: item.manufacturer || "Generic",
      connectionType: item.connection || "USB",
      dpi: 203,
      protocols: ["ZPL", "TSPL", "RAW"],
      supportsZPL: true,
      supportsTSPL: true,
      supportsEPL: false,
      supportsCPCL: false,
      supportsESCPOS: false,
      supportsRaster: true,
    };
  }
}

export const PrinterCapabilityEngine = new PrinterCapabilityEngineService();
// Static compatibility facade
(PrinterCapabilityEngine as any).fromSystemPrinter = (item: any) =>
  PrinterCapabilityEngine.fromSystemPrinter(item);