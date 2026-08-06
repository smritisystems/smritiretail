/**
 * Project      : SMRITI Retail OS
 * Component    : EscPosDriver & ZplDriver Plugins
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 2.0.0
 */

import { IPrinterDriver, DriverCapabilities, DriverProtocol, PrinterDriverRegistry } from "./PrinterDriverRegistry.ts";
import { DxpDocumentRequest } from "../models/DxpTypes.ts";

export class EscPosDriver implements IPrinterDriver {
  id = "driver.escpos";
  name = "ESC/POS Thermal Receipt Driver";
  protocol: DriverProtocol = "ESC/POS";
  capabilities: DriverCapabilities = {
    supportsCut: true,
    supportsDrawer: true,
    supportsBarcodes: true,
    supportsImages: true,
    maxPaperWidthMm: 80,
  };

  compile(req: DxpDocumentRequest): string {
    const init = "\x1B\x40";
    const alignCenter = "\x1B\x61\x01";
    const alignLeft = "\x1B\x61\x00";
    const cut = "\x1D\x56\x41\x00";
    const drawerPulse = "\x1B\x70\x00\x19\xFA";

    let body = `${init}${alignCenter}*** ${req.data?.companyName || "SMRITI Systems"} ***\n${alignLeft}`;
    if (req.options?.openDrawer) body += drawerPulse;
    body += cut;
    return body;
  }
}

export class ZplDriver implements IPrinterDriver {
  id = "driver.zpl";
  name = "Zebra ZPL II Label Driver";
  protocol: DriverProtocol = "ZPL";
  capabilities: DriverCapabilities = {
    supportsCut: true,
    supportsDrawer: false,
    supportsBarcodes: true,
    supportsImages: true,
    maxPaperWidthMm: 104,
  };

  compile(req: DxpDocumentRequest): string {
    const copies = req.copies || 1;
    const raw = req.options?.rawContent || "^XA^FO50,50^A0N,30,30^FDSMRITI Systems^FS^XZ";
    return raw.replace("^PQ1", `^PQ${copies}`);
  }

  validateSyntax(compiled: string): boolean {
    return compiled.startsWith("^XA") && compiled.endsWith("^XZ");
  }
}

PrinterDriverRegistry.register(new EscPosDriver());
PrinterDriverRegistry.register(new ZplDriver());
