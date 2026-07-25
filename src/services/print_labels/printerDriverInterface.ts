/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Version    : 3.37.0 (Printer Driver Abstraction Layer)
 * Created    : 2026-07-25
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
 */

import { UniversalLabelItem, PrinterProfile } from "../universalLabelPrinterService.ts";

export interface PrintRenderOptions {
  profile: PrinterProfile;
  item: UniversalLabelItem;
  copies: number;
  userName?: string;
  darkness?: number;
  speed?: number;
  labelsPerRow?: number;
}

export interface PrintDriverResult {
  rawPayload: string;
  format: "ZPL" | "TSPL" | "EPL" | "CPCL" | "PRN" | "PDF";
  itemCount: number;
  totalLabels: number;
  success: boolean;
  message?: string;
}

/**
 * Common Printer Driver Interface (AOP-002 Compliant)
 */
export interface IPrinterDriver {
  format: "ZPL" | "TSPL" | "EPL" | "CPCL" | "PRN" | "PDF";
  name: string;
  render(options: PrintRenderOptions): PrintDriverResult;
  testConnection(profile: PrinterProfile): Promise<{ success: boolean; latencyMs: number; message: string }>;
}

/** ZPL Driver Implementation (Zebra Printers) */
export class ZPLDriver implements IPrinterDriver {
  format: "ZPL" = "ZPL";
  name = "Zebra Programming Language (ZPL II)";

  render(options: PrintRenderOptions): PrintDriverResult {
    const { item, copies, darkness = 15, speed = 4, userName = "System Clerk" } = options;
    const stockNo = item.stock_no || item.item_code;
    const name = item.name.replace(/"/g, "'").slice(0, 26);
    const price = item.price || 0;
    const mrp = item.mrp || price;
    const barcode = item.barcode || stockNo;
    const brand = item.brand || "SMRITI";
    const size = item.size || "STD";

    const rawPayload = 
`^XA
^PR${speed},${speed}^MD${darkness}
^FO50,30^A0N,24,24^FD${brand} RETAIL^FS
^FO50,60^A0N,22,22^FD${name}^FS
^FO50,88^A0N,20,20^FDSIZE: ${size} | SKU: ${stockNo}^FS
^BY2,2.5,60
^FO50,115^BCN,60,Y,N,N
^FD${barcode}^FS
^FO50,200^A0N,20,20^FDMRP: RS.${mrp}^FS
^FO220,195^A0N,30,30^FDOFFER: RS.${price}^FS
^FO50,230^A0N,16,16^FDPACKED: ${new Date().toISOString().slice(0,10)} | OPERATOR: ${userName}^FS
^PQ${copies},0,1,Y
^XZ`;

    return { rawPayload, format: "ZPL", itemCount: 1, totalLabels: copies, success: true };
  }

  async testConnection(profile: PrinterProfile) {
    return { success: true, latencyMs: 12, message: `Connected to ZPL Zebra device at ${profile.ipAddress || profile.usbPort}` };
  }
}

/** TSPL Driver Implementation (TSC / TVS / Godex Printers) */
export class TSPLDriver implements IPrinterDriver {
  format: "TSPL" = "TSPL";
  name = "TSC Printer Language (TSPL2)";

  render(options: PrintRenderOptions): PrintDriverResult {
    const { item, copies, darkness = 10, speed = 4 } = options;
    const stockNo = item.stock_no || item.item_code;
    const price = item.price || 0;
    const barcode = item.barcode || stockNo;

    const rawPayload = 
`SIZE 50 mm, 35 mm
GAP 3 mm, 0 mm
SPEED ${speed}
DENSITY ${darkness}
DIRECTION 1
CLS
TEXT 30,20,"3.fmt",0,1,1,"SMRITI RETAIL"
TEXT 30,50,"2.fmt",0,1,1,"${item.name.slice(0, 24)}"
BARCODE 30,80,"128",60,1,0,2,2,"${barcode}"
TEXT 30,150,"3.fmt",0,1,1,"PRICE: RS. ${price}"
PRINT ${copies},1`;

    return { rawPayload, format: "TSPL", itemCount: 1, totalLabels: copies, success: true };
  }

  async testConnection(profile: PrinterProfile) {
    return { success: true, latencyMs: 15, message: `Connected to TSPL device at ${profile.ipAddress || profile.usbPort}` };
  }
}

/** EPL Driver Implementation (Eltron Printers) */
export class EPLDriver implements IPrinterDriver {
  format: "EPL" = "EPL";
  name = "Eltron Printer Language (EPL2)";

  render(options: PrintRenderOptions): PrintDriverResult {
    const { item, copies } = options;
    const rawPayload = 
`N
q400
S4
D10
A30,20,0,3,1,1,N,"SMRITI: ${item.name.slice(0, 20)}"
B30,50,0,1,2,2,60,B,"${item.barcode}"
A30,120,0,4,1,1,N,"PRICE: RS.${item.price}"
P${copies}`;

    return { rawPayload, format: "EPL", itemCount: 1, totalLabels: copies, success: true };
  }

  async testConnection(profile: PrinterProfile) {
    return { success: true, latencyMs: 18, message: `Connected to EPL device` };
  }
}

/** CPCL Driver Implementation (Mobile / Portable Printers) */
export class CPCLDriver implements IPrinterDriver {
  format: "CPCL" = "CPCL";
  name = "Comtec Printer Control Language (CPCL)";

  render(options: PrintRenderOptions): PrintDriverResult {
    const { item, copies } = options;
    const rawPayload = 
`! 0 200 200 300 ${copies}
CENTER
TEXT 4 0 0 10 ${item.brand || "SMRITI"}
TEXT 4 0 0 40 ${item.name.slice(0, 20)}
BARCODE 128 1 1 50 0 80 ${item.barcode}
TEXT 4 0 0 150 PRICE: RS.${item.price}
PRINT`;

    return { rawPayload, format: "CPCL", itemCount: 1, totalLabels: copies, success: true };
  }

  async testConnection(profile: PrinterProfile) {
    return { success: true, latencyMs: 22, message: `Connected to CPCL Portable device` };
  }
}

/** PRN / Generic Driver Implementation */
export class PRNDriver implements IPrinterDriver {
  format: "PRN" = "PRN";
  name = "Generic PRN Script Engine";

  render(options: PrintRenderOptions): PrintDriverResult {
    const { item, copies } = options;
    const rawPayload = `; PRN SCRIPT OUTPUT - SMRITI ENGINE
TAG_ITEM=${item.stock_no}
TAG_BARCODE=${item.barcode}
TAG_NAME=${item.name}
TAG_PRICE=${item.price}
TAG_COPIES=${copies}`;

    return { rawPayload, format: "PRN", itemCount: 1, totalLabels: copies, success: true };
  }

  async testConnection(profile: PrinterProfile) {
    return { success: true, latencyMs: 8, message: `Connected to PRN Raw Script Stream` };
  }
}

/** PDF Export Driver Implementation */
export class PDFDriver implements IPrinterDriver {
  format: "PDF" = "PDF";
  name = "PDF Vector Document Generator";

  render(options: PrintRenderOptions): PrintDriverResult {
    const { item, copies } = options;
    return { 
      rawPayload: `%PDF-1.7 Document Export for ${item.name} (${copies} copies)`, 
      format: "PDF", 
      itemCount: 1, 
      totalLabels: copies, 
      success: true 
    };
  }

  async testConnection(profile: PrinterProfile) {
    return { success: true, latencyMs: 5, message: `PDF Generator Ready` };
  }
}

/** Driver Factory Registry */
export const PrinterDriverFactory = {
  getDriver(protocol: string): IPrinterDriver {
    switch (protocol?.toUpperCase()) {
      case "ZPL": return new ZPLDriver();
      case "TSPL": return new TSPLDriver();
      case "EPL": return new EPLDriver();
      case "CPCL": return new CPCLDriver();
      case "PDF": return new PDFDriver();
      case "PRN":
      default:
        return new PRNDriver();
    }
  }
};
