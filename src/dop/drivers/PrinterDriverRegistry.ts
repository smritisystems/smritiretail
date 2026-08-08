/**
 * Project      : SMRITI Retail OS
 * System       : Universal Document Experience Platform (DXP)
 * Component    : IPrinterDriver Interface & PrinterDriverRegistry
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Standard     : SCS-DXP-002 Enterprise Printing Architecture v2.0
 * Version      : 2.0.0
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { DxpDocumentRequest } from "../models/DxpTypes.ts";

export type DriverProtocol = "ESC/POS" | "ZPL" | "TSPL" | "EPL" | "CPCL" | "RAW" | "SIMULATION";

export interface DriverCapabilities {
  supportsCut: boolean;
  supportsDrawer: boolean;
  supportsBarcodes: boolean;
  supportsImages: boolean;
  maxPaperWidthMm: number;
}

export interface DriverManifest {
  supportsBarcode: boolean;
  supportsQRCode: boolean;
  supportsImages: boolean;
  supportsRotation: boolean;
  maxWidthMm: number;
  minDpi: number;
}

export interface IPrinterDriver {
  id: string;
  name: string;
  protocol: DriverProtocol;
  capabilities: DriverCapabilities;
  manifest?: DriverManifest;
  
  compile(req: DxpDocumentRequest): string | Uint8Array;
  validateSyntax?(compiled: string | Uint8Array): boolean;
}

class PrinterDriverRegistryService {
  private drivers: Map<string, IPrinterDriver> = new Map();

  public register(driver: IPrinterDriver): void {
    this.drivers.set(driver.id, driver);
  }

  public get(id: string): IPrinterDriver | undefined {
    return this.drivers.get(id);
  }

  public list(): IPrinterDriver[] {
    return Array.from(this.drivers.values());
  }

  public findByProtocol(protocol: DriverProtocol): IPrinterDriver | undefined {
    return this.list().find((d) => d.protocol === protocol);
  }
}

export const PrinterDriverRegistry = new PrinterDriverRegistryService();
