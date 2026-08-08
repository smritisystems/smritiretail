import { PrintingEventBus } from "../events/PrintingEventBus.js";
import { PrinterCapability } from "../models/PrintDocument.js";
import { SdaRuntime } from "../../../sdp/SdaRuntime.ts";
import { PrinterCapabilityEngine } from "./PrinterCapabilityEngine.js";
import { PrinterProfileManager } from "./PrinterProfileManager.js";
import { PrintAuditLogger } from "../audit/PrintAuditLogger.js";

export class PrinterDiscoveryService {
  static async discover(requestUsb = false): Promise<PrinterCapability[]> {
    const sdaDevices = await SdaRuntime.getConnectedDevices();
    const discovered = sdaDevices.map((d) => ({
      name: d.name,
      driver: d.type,
      manufacturer: "SDP Hardware",
      connection: d.connection
    }));
    // Handled via SdaRuntime SDP daemon

    const unique = new Map<string, PrinterCapability>();
    for (const item of discovered) {
      const capability = PrinterCapabilityEngine.fromSystemPrinter(item);
      unique.set(capability.id, capability);
      PrinterProfileManager.save(capability);
      PrintingEventBus.publish({ type: "PRINTER_DISCOVERED", timestamp: new Date().toISOString(), printer: capability });
    }
    PrintAuditLogger.record("DISCOVERY", { count: unique.size, requestUsb });
    return [...unique.values()];
  }
}