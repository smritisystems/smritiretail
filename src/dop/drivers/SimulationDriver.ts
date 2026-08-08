/**
 * Project      : SMRITI Retail OS
 * Component    : SimulationDriver (Print Layout Simulation & Offline Protocol Validation)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 2.0.0
 */

import { IPrinterDriver, DriverCapabilities, DriverProtocol, PrinterDriverRegistry } from "./PrinterDriverRegistry.ts";
import { DxpDocumentRequest } from "../models/DxpTypes.ts";

export class SimulationDriver implements IPrinterDriver {
  id = "driver.simulation";
  name = "Protocol Simulation & Layout Validation Driver";
  protocol: DriverProtocol = "SIMULATION";
  capabilities: DriverCapabilities = {
    supportsCut: true,
    supportsDrawer: true,
    supportsBarcodes: true,
    supportsImages: true,
    maxPaperWidthMm: 210,
  };

  compile(req: DxpDocumentRequest): string {
    const json = JSON.stringify({
      simulated: true,
      documentType: req.documentType,
      referenceId: req.referenceId,
      itemsCount: req.items?.length || 0,
      timestamp: new Date().toISOString(),
    }, null, 2);
    return json;
  }

  validateSyntax(compiled: string): boolean {
    try {
      JSON.parse(compiled);
      return true;
    } catch {
      return false;
    }
  }
}

PrinterDriverRegistry.register(new SimulationDriver());
