import { PrintingEventBus } from "../events/PrintingEventBus.js";
import { PrinterCapability } from "../models/PrintDocument.js";
import { SystemPrinterDiscovery } from "../../../services/label_print/PrintProviderFramework.js";
import { PrinterCapabilityEngine } from "./PrinterCapabilityEngine.js";
import { PrinterProfileManager } from "./PrinterProfileManager.js";
import { PrintAuditLogger } from "../audit/PrintAuditLogger.js";

export class PrinterDiscoveryService {
  static async discover(requestUsb = false): Promise<PrinterCapability[]> {
    const discovered = await SystemPrinterDiscovery.detectPrinters();
    if (requestUsb) {
      const usb = await SystemPrinterDiscovery.requestUsbPrinter();
      if (usb) {
        discovered.unshift(usb);
        PrintAuditLogger.record("USB_PERMISSION", { status: "granted", printer: usb.name });
        PrintingEventBus.publish({ type: "USB_PERMISSION_GRANTED", timestamp: new Date().toISOString(), message: usb.name });
        PrintingEventBus.publish({ type: "PRINTER_CONNECTED", timestamp: new Date().toISOString(), message: usb.name });
      } else {
        PrintAuditLogger.record("USB_PERMISSION", { status: "denied_or_unavailable" });
        PrintingEventBus.publish({ type: "USB_PERMISSION_DENIED", timestamp: new Date().toISOString(), message: "USB permission denied or unavailable" });
      }
    }

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