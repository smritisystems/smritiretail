import { PrinterCapability } from "../models/PrintDocument.js";
import { SystemPrinterInfo } from "../../../services/label_print/PrintProviderFramework.js";

export class PrinterCapabilityEngine {
  static fromSystemPrinter(info: SystemPrinterInfo & Record<string, any>): PrinterCapability {
    const lower = `${info.name} ${info.driver || ""}`.toLowerCase();
    const protocols: PrinterCapability["protocols"] = ["RAW", "PDF"];
    if (lower.includes("zebra") || lower.includes("zpl")) protocols.push("ZPL");
    if (lower.includes("tsc") || lower.includes("tspl")) protocols.push("TSPL");
    if (lower.includes("godex") || lower.includes("epl")) protocols.push("EPL");
    if (lower.includes("epson") || lower.includes("esc")) protocols.push("ESC_POS");

    const connection = info.connection === "SERIAL" ? "SERIAL" : info.connection === "USB" ? "USB" : info.connection === "NETWORK" ? "NETWORK" : info.connection === "VIRTUAL" ? "VIRTUAL" : "SPOOLER";

    return {
      id: `PRN-${info.name.replaceAll(/\s+/g, "-")}`,
      name: info.name,
      manufacturer: info.manufacturer,
      model: info.model || info.name,
      vendorId: info.vendorId,
      productId: info.productId,
      dpi: lower.includes("300") ? 300 : 203,
      paperWidthMm: 100,
      paperHeightMm: 50,
      supportsZPL: protocols.includes("ZPL"),
      supportsTSPL: protocols.includes("TSPL"),
      supportsEPL: protocols.includes("EPL"),
      supportsESC: protocols.includes("ESC_POS"),
      supportsPDF: true,
      supportsRAW: true,
      supportsCutter: false,
      supportsPeeler: false,
      supportsDrawer: false,
      connection,
      transport: connection,
      protocols,
      status: "Online",
      isDefault: info.isDefault,
    };
  }
}