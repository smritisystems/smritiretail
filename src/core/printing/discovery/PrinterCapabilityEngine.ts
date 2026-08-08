/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel — Universal Printer Capability & Compatibility Engine
 * Standard     : SCS-PRINT-CAPABILITY-001 (v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { UniversalLabelDocument, LabelElement } from "../models/UniversalLabelDocument.ts";
import { PrinterProfile } from "../models/PrinterProfile.ts";
import { UniversalPrintCanvas } from "../models/UniversalPrintCanvas.ts";
import { UniversalPrintTemplate } from "../models/UniversalPrintTemplate.ts";
import { FieldMappingEngine } from "../fields/FieldMappingEngine.ts";
import { DetectedPrinterLanguage } from "../prn_engine/PrinterLanguageDetector.ts";

export type CompatibilityStatus = "SUPPORTED" | "SUPPORTED_WITH_WARNINGS" | "UNSUPPORTED" | "UNKNOWN";
export type ProvenanceType = "DETECTED" | "DRIVER" | "DEVICE" | "USER_CONFIGURED" | "TEMPLATE" | "INFERRED" | "UNKNOWN";
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export interface CapabilityProvenanceInfo {
  value: any;
  source: ProvenanceType;
  confidence: ConfidenceLevel;
}

export interface CapabilityCheckDetail {
  category: "LANGUAGE" | "GEOMETRY" | "DPI" | "MEDIA" | "BARCODE" | "GRAPHICS" | "RAW_COMMAND" | "MULTI_REGION" | "FIELD_MAPPING";
  name: string;
  passed: boolean;
  status: CompatibilityStatus;
  message: string;
  provenance?: CapabilityProvenanceInfo;
}

export interface CapabilityCheckResult {
  status: CompatibilityStatus;
  warnings: string[];
  unsupportedFeatures: string[];
  dpiMatched: boolean;
  dimensionsMatched: boolean;
}

export interface CanvasCompatibilityReport {
  status: CompatibilityStatus;
  overallScore: number; // 0 to 100
  errors: string[];
  warnings: string[];
  checks: CapabilityCheckDetail[];
  dpiMatched: boolean;
  dimensionsMatched: boolean;
  languageMatched: boolean;
  fieldMappingReport?: any;
}

export class PrinterCapabilityEngineService {
  /**
   * Evaluates complete compatibility of a UniversalPrintCanvas + UniversalPrintTemplate on a target PrinterProfile.
   */
  public validateCanvasCompatibility(
    canvas: UniversalPrintCanvas,
    template: UniversalPrintTemplate,
    printer: PrinterProfile
  ): CanvasCompatibilityReport {
    const checks: CapabilityCheckDetail[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    let dpiMatched = true;
    let dimensionsMatched = true;
    let languageMatched = true;

    // 1. Physical Geometry Check (Authoritative in mm)
    const maxWidth = printer.media?.maxWidthMm ?? 104;
    const maxHeight = printer.media?.maxHeightMm ?? 1000;

    if (canvas.widthMm > maxWidth) {
      dimensionsMatched = false;
      const msg = `Canvas width (${canvas.widthMm}mm) exceeds printer max media width (${maxWidth}mm).`;
      errors.push(msg);
      checks.push({
        category: "GEOMETRY",
        name: "Max Width Check",
        passed: false,
        status: "UNSUPPORTED",
        message: msg,
        provenance: { value: maxWidth, source: "DRIVER", confidence: "HIGH" },
      });
    } else {
      checks.push({
        category: "GEOMETRY",
        name: "Max Width Check",
        passed: true,
        status: "SUPPORTED",
        message: `Canvas width (${canvas.widthMm}mm) is supported by printer (${maxWidth}mm).`,
        provenance: { value: maxWidth, source: "DRIVER", confidence: "HIGH" },
      });
    }

    if (canvas.heightMm > maxHeight) {
      warnings.push(`Canvas height (${canvas.heightMm}mm) exceeds nominal printer max height (${maxHeight}mm).`);
      checks.push({
        category: "GEOMETRY",
        name: "Max Height Check",
        passed: true,
        status: "SUPPORTED_WITH_WARNINGS",
        message: `Canvas height (${canvas.heightMm}mm) exceeds nominal max (${maxHeight}mm).`,
        provenance: { value: maxHeight, source: "DRIVER", confidence: "MEDIUM" },
      });
    }

    // 2. DPI Validation
    if (printer.dpi && canvas.dpi !== printer.dpi) {
      dpiMatched = false;
      const msg = `Canvas DPI (${canvas.dpi}) differs from printer hardware DPI (${printer.dpi}). Scaling will be applied.`;
      warnings.push(msg);
      checks.push({
        category: "DPI",
        name: "DPI Matching",
        passed: true,
        status: "SUPPORTED_WITH_WARNINGS",
        message: msg,
        provenance: { value: printer.dpi, source: "DEVICE", confidence: "HIGH" },
      });
    } else {
      checks.push({
        category: "DPI",
        name: "DPI Matching",
        passed: true,
        status: "SUPPORTED",
        message: `Canvas DPI (${canvas.dpi}) matches printer hardware DPI (${printer.dpi}).`,
        provenance: { value: printer.dpi, source: "DEVICE", confidence: "HIGH" },
      });
    }

    // 3. Printer Language Compatibility Check
    const tmplFormat = (template.source?.originalFormat || template.metadata?.sourceFormat || "ZPL").toUpperCase();

    let supportsLang = true;
    if (tmplFormat.includes("ZPL") && !printer.capabilities.supportsZPL) supportsLang = false;
    if (tmplFormat.includes("TSPL") && !printer.capabilities.supportsTSPL) supportsLang = false;
    if (tmplFormat.includes("EPL") && !printer.capabilities.supportsEPL) supportsLang = false;
    if (tmplFormat.includes("CPCL") && !printer.capabilities.supportsCPCL) supportsLang = false;
    if (tmplFormat.includes("ESC") && !printer.capabilities.supportsESCPOS) supportsLang = false;

    if (!supportsLang) {
      languageMatched = false;
      const msg = `Template language '${tmplFormat}' is not supported by printer language capabilities.`;
      errors.push(msg);
      checks.push({
        category: "LANGUAGE",
        name: "Language Compatibility",
        passed: false,
        status: "UNSUPPORTED",
        message: msg,
        provenance: { value: tmplFormat, source: "TEMPLATE", confidence: "HIGH" },
      });
    } else {
      checks.push({
        category: "LANGUAGE",
        name: "Language Compatibility",
        passed: true,
        status: "SUPPORTED",
        message: `Printer supports required template language '${tmplFormat}'.`,
        provenance: { value: tmplFormat, source: "TEMPLATE", confidence: "HIGH" },
      });
    }

    // 4. RAW Command Governance
    if (template.document) {
      for (const el of template.document.elements) {
        if (el.type === "RAW_COMMAND") {
          const rawContent = (el as any).rawCommand || (el as any).content || "";
          if (rawContent.includes("^XA") && !printer.capabilities.supportsZPL) {
            const msg = `Template contains ZPL RAW_COMMAND but printer does not support ZPL.`;
            errors.push(msg);
            checks.push({
              category: "RAW_COMMAND",
              name: "RAW Command Governance",
              passed: false,
              status: "UNSUPPORTED",
              message: msg,
            });
          }
        }
      }
    }

    // 5. Media & Sensor Validation (Unknown Data Rule: Unknown != Unsupported)
    if (canvas.sensor !== "NONE" && printer.media?.supportedSensors && printer.media.supportedSensors.length > 0) {
      if (!printer.media.supportedSensors.includes(canvas.sensor)) {
        warnings.push(`Canvas sensor '${canvas.sensor}' is not explicitly listed in printer supported sensors.`);
        checks.push({
          category: "MEDIA",
          name: "Sensor Validation",
          passed: true,
          status: "SUPPORTED_WITH_WARNINGS",
          message: `Canvas sensor '${canvas.sensor}' unverified on printer.`,
        });
      }
    } else if (!printer.media?.supportedSensors || printer.media.supportedSensors.length === 0) {
      warnings.push(`Printer sensor capability is UNKNOWN. Soft warning generated.`);
      checks.push({
        category: "MEDIA",
        name: "Sensor Validation",
        passed: true,
        status: "SUPPORTED_WITH_WARNINGS",
        message: `Printer sensor capability is UNKNOWN. Soft warning generated.`,
        provenance: { value: "UNKNOWN", source: "UNKNOWN", confidence: "LOW" },
      });
    }

    // 6. Field Mapping Governance Check
    const mapReport = FieldMappingEngine.autoMapTemplate(template);
    if (!mapReport.isValid) {
      if (mapReport.ambiguousFields.length > 0) {
        warnings.push(`Template contains ambiguous placeholders: ${mapReport.ambiguousFields.join(", ")}.`);
      }
      if (mapReport.unmappedFields.length > 0) {
        warnings.push(`Template contains unmapped placeholders: ${mapReport.unmappedFields.join(", ")}.`);
      }
    }

    // Determine Overall Status
    let status: CompatibilityStatus = "SUPPORTED";
    if (errors.length > 0) {
      status = "UNSUPPORTED";
    } else if (warnings.length > 0) {
      status = "SUPPORTED_WITH_WARNINGS";
    }

    const overallScore = errors.length > 0 ? 0 : warnings.length > 0 ? 80 : 100;

    return {
      status,
      overallScore,
      errors,
      warnings,
      checks,
      dpiMatched,
      dimensionsMatched,
      languageMatched,
      fieldMappingReport: mapReport,
    };
  }

  /**
   * Validates document level capabilities against printer capabilities.
   */
  public validateCapability(doc: UniversalLabelDocument, printer: PrinterProfile): CapabilityCheckResult {
    const warnings: string[] = [];
    const unsupportedFeatures: string[] = [];

    let dimensionsMatched = true;
    if (doc.dimensions.widthMm > (printer.media?.maxWidthMm ?? 104)) {
      dimensionsMatched = false;
      unsupportedFeatures.push(`Label width (${doc.dimensions.widthMm}mm) exceeds printer max media width (${printer.media?.maxWidthMm ?? 104}mm).`);
    }

    let dpiMatched = true;
    if (printer.dpi && doc.dimensions.dpi !== printer.dpi) {
      dpiMatched = false;
      warnings.push(`Label target DPI (${doc.dimensions.dpi}) differs from printer hardware DPI (${printer.dpi}). Output scaling will be applied.`);
    }

    const req = doc.capabilities;
    const cap = printer.capabilities;

    if (req.supportsBarcode && !cap.supportsBarcode1D) unsupportedFeatures.push("Printer does not support 1D barcodes.");
    if (req.supportsQRCode && !cap.supportsQRCode) unsupportedFeatures.push("Printer does not support hardware QR code rendering.");
    if (req.supportsDataMatrix && !cap.supportsDataMatrix) unsupportedFeatures.push("Printer does not support hardware DataMatrix rendering.");
    if (req.supportsImages && !cap.supportsRasterImages) unsupportedFeatures.push("Printer does not support raster graphic rendering.");

    let status: CompatibilityStatus = "SUPPORTED";
    if (unsupportedFeatures.length > 0) {
      status = "UNSUPPORTED";
    } else if (warnings.length > 0) {
      status = "SUPPORTED_WITH_WARNINGS";
    }

    return { status, warnings, unsupportedFeatures, dpiMatched, dimensionsMatched };
  }

  /**
   * Ranks available printers for a given canvas and template.
   */
  public rankPrintersForCanvas(
    canvas: UniversalPrintCanvas,
    template: UniversalPrintTemplate,
    printers: PrinterProfile[]
  ): Array<{ printer: PrinterProfile; report: CanvasCompatibilityReport }> {
    const results = printers.map((p) => ({
      printer: p,
      report: this.validateCanvasCompatibility(canvas, template, p),
    }));

    // Sort deterministically: HIGHEST score first, then matching DPI, then printer name
    results.sort((a, b) => {
      if (b.report.overallScore !== a.report.overallScore) {
        return b.report.overallScore - a.report.overallScore;
      }
      if (a.report.dpiMatched !== b.report.dpiMatched) {
        return a.report.dpiMatched ? -1 : 1;
      }
      return a.printer.name.localeCompare(b.printer.name);
    });

    return results;
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