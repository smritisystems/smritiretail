/**
 * Project      : SMRITI Retail OS
 * System       : Universal Document Experience Platform (DXP)
 * Component    : CapabilityResolver (Smart Driver & Transport Selection)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Standard     : SCS-DXP-002 Enterprise Printing Architecture v2.0
 * Version      : 2.0.0
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { DxpDocumentRequest } from "../models/DxpTypes.ts";
import { IPrinterDriver, PrinterDriverRegistry } from "../drivers/PrinterDriverRegistry.ts";
import { IPrinterTransport, TransportRegistry } from "../transports/TransportRegistry.ts";
import "./../drivers/ProtocolDrivers.ts";
import "./../drivers/SimulationDriver.ts";

export interface PrinterCapabilityProfile {
  printerId: string;
  name: string;
  protocol: "ESC/POS" | "ZPL" | "TSPL" | "EPL" | "CPCL" | "RAW" | "SIMULATION";
  supportsCut: boolean;
  supportsDrawer: boolean;
  supportsBarcodes: boolean;
  paperWidthMm: number;
  dpi: number;
  transportType: "SDA" | "NETWORK" | "USB" | "BLUETOOTH" | "QZ" | "SIMULATION";
  targetAddress: string;
}

export class CapabilityResolverService {
  public resolveDriver(req: DxpDocumentRequest, profile?: PrinterCapabilityProfile): IPrinterDriver {
    if (profile?.protocol) {
      const match = PrinterDriverRegistry.findByProtocol(profile.protocol);
      if (match) return match;
    }

    if (req.documentType === "RECEIPT" || req.format === "Thermal80mm") {
      return PrinterDriverRegistry.findByProtocol("ESC/POS") || PrinterDriverRegistry.list()[0];
    }

    if (req.documentType === "BARCODE_LABEL" || req.documentType === "SHELF_LABEL") {
      return PrinterDriverRegistry.findByProtocol("ZPL") || PrinterDriverRegistry.list()[0];
    }

    return PrinterDriverRegistry.findByProtocol("SIMULATION") || PrinterDriverRegistry.list()[0];
  }

  public resolveTransport(profile?: PrinterCapabilityProfile): IPrinterTransport {
    if (profile?.transportType) {
      return TransportRegistry.resolveBestTransport(profile.transportType);
    }
    return TransportRegistry.resolveBestTransport();
  }
}

export const CapabilityResolver = new CapabilityResolverService();
