/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel
 * Standard     : SCS-PRINT-KERNEL-007 (Printer Profile Model v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { DetectedPrinterLanguage } from "../prn_engine/PrinterLanguageDetector.ts";

export type PrinterConnectionType =
  | "WINDOWS_SPOOLER"
  | "USB"
  | "TCP"
  | "LOCAL_AGENT"
  | "QZ"
  | "FILE";

export type PrinterStatus =
  | "READY"
  | "BUSY"
  | "OFFLINE"
  | "PAPER_OUT"
  | "RIBBON_OUT"
  | "COVER_OPEN"
  | "ERROR"
  | "UNKNOWN";

export interface USBIdentifiers {
  vendorId?: string;
  productId?: string;
  serialNumber?: string;
  driverName?: string;
  portName?: string;
}

export interface PrinterMediaCapability {
  maxWidthMm: number;
  maxHeightMm: number;
  minWidthMm?: number;
  minHeightMm?: number;
  defaultDpi: number;
  supportedDpis: number[];
  supportsCutter: boolean;
  supportsPeeler: boolean;
  supportsBlackMark: boolean;
  supportsGapSensor: boolean;
}

export interface PrinterHardwareCapabilities {
  supportsBarcode1D: boolean;
  supportsQRCode: boolean;
  supportsDataMatrix: boolean;
  supportsGS1: boolean;
  supportsRasterImages: boolean;
  supportsVectorGraphics: boolean;
  supportsScalableFonts: boolean;
  supportsRotation: boolean;
  supportsStatusQuery: boolean;
  supportsCalibration: boolean;
  supportsRawPrinting: boolean;
}

export interface PrinterProfileJSON {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  language: DetectedPrinterLanguage;
  connectionType: PrinterConnectionType;
  host?: string;
  port?: number;
  usbIdentifiers?: USBIdentifiers;
  dpi: number;
  media: PrinterMediaCapability;
  capabilities: PrinterHardwareCapabilities;
  status: PrinterStatus;
  lastSeen?: string;
  paired?: boolean;
  isDefault?: boolean;
}

export class PrinterProfile {
  public id: string;
  public name: string;
  public manufacturer: string;
  public model: string;
  public language: DetectedPrinterLanguage;
  public connectionType: PrinterConnectionType;
  public host?: string;
  public port?: number;
  public usbIdentifiers?: USBIdentifiers;
  public dpi: number;
  public media: PrinterMediaCapability;
  public capabilities: PrinterHardwareCapabilities;
  public status: PrinterStatus;
  public lastSeen?: string;
  public paired: boolean;
  public isDefault: boolean;

  constructor(init: Partial<PrinterProfileJSON> & { id: string; name: string }) {
    this.id = init.id;
    this.name = init.name;
    this.manufacturer = init.manufacturer || "Generic";
    this.model = init.model || "Thermal Printer";
    this.language = init.language || "ZPL";
    this.connectionType = init.connectionType || "TCP";
    this.host = init.host || "192.168.1.200";
    this.port = init.port || 9100;
    this.usbIdentifiers = init.usbIdentifiers ? { ...init.usbIdentifiers } : undefined;
    this.dpi = init.dpi || 203;

    this.media = {
      maxWidthMm: init.media?.maxWidthMm ?? 108.0,
      maxHeightMm: init.media?.maxHeightMm ?? 300.0,
      minWidthMm: init.media?.minWidthMm ?? 20.0,
      minHeightMm: init.media?.minHeightMm ?? 10.0,
      defaultDpi: init.media?.defaultDpi ?? 203,
      supportedDpis: init.media?.supportedDpis ? [...init.media.supportedDpis] : [203, 300],
      supportsCutter: init.media?.supportsCutter ?? false,
      supportsPeeler: init.media?.supportsPeeler ?? false,
      supportsBlackMark: init.media?.supportsBlackMark ?? true,
      supportsGapSensor: init.media?.supportsGapSensor ?? true,
    };

    this.capabilities = {
      supportsBarcode1D: init.capabilities?.supportsBarcode1D ?? true,
      supportsQRCode: init.capabilities?.supportsQRCode ?? true,
      supportsDataMatrix: init.capabilities?.supportsDataMatrix ?? true,
      supportsGS1: init.capabilities?.supportsGS1 ?? true,
      supportsRasterImages: init.capabilities?.supportsRasterImages ?? true,
      supportsVectorGraphics: init.capabilities?.supportsVectorGraphics ?? true,
      supportsScalableFonts: init.capabilities?.supportsScalableFonts ?? true,
      supportsRotation: init.capabilities?.supportsRotation ?? true,
      supportsStatusQuery: init.capabilities?.supportsStatusQuery ?? true,
      supportsCalibration: init.capabilities?.supportsCalibration ?? true,
      supportsRawPrinting: init.capabilities?.supportsRawPrinting ?? true,
    };

    this.status = init.status || "READY";
    this.lastSeen = init.lastSeen || new Date().toISOString();
    this.paired = init.paired ?? true;
    this.isDefault = init.isDefault ?? false;
  }

  public toJSON(): PrinterProfileJSON {
    return {
      id: this.id,
      name: this.name,
      manufacturer: this.manufacturer,
      model: this.model,
      language: this.language,
      connectionType: this.connectionType,
      host: this.host,
      port: this.port,
      usbIdentifiers: this.usbIdentifiers ? { ...this.usbIdentifiers } : undefined,
      dpi: this.dpi,
      media: { ...this.media },
      capabilities: { ...this.capabilities },
      status: this.status,
      lastSeen: this.lastSeen,
      paired: this.paired,
      isDefault: this.isDefault,
    };
  }

  public static fromJSON(json: PrinterProfileJSON): PrinterProfile {
    return new PrinterProfile(json);
  }
}
