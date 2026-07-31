/**
 * Project      : SMRITI Retail OS
 * System       : SMRITI Universal Printing Platform (SUPP)
 * Component    : IDriver & PrintDriverRegistry (Rule SUPP-003 Transport Independence)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { PrintDocument } from "../models/PrintDocument.js";

export interface IPrintDriver {
  id: string; // e.g. "zpl", "tspl", "epl", "esc_pos", "raw"
  name: string;
  commandLanguage: string;
  supportsBinary: boolean;
  translate(document: PrintDocument, copies?: number): string;
}

export class ZPLDriver implements IPrintDriver {
  id = "zpl";
  name = "Zebra ZPL II Command Language Driver";
  commandLanguage = "ZPL";
  supportsBinary = false;

  translate(document: PrintDocument, copies: number = 1): string {
    let script = document.content;
    script = script.replaceAll("{copies}", String(copies));
    script = script.replaceAll("^PQ1", `^PQ${copies}`);
    return script;
  }
}

export class TSPLDriver implements IPrintDriver {
  id = "tspl";
  name = "TSC TSPL Command Language Driver";
  commandLanguage = "TSPL";
  supportsBinary = false;

  translate(document: PrintDocument, copies: number = 1): string {
    let script = document.content;
    script = script.replaceAll("{copies}", String(copies));
    script = script.replaceAll("PRINT 1,1", `PRINT ${copies},1`);
    return script;
  }
}

export class EPLDriver implements IPrintDriver {
  id = "epl";
  name = "Eltron EPL Command Language Driver";
  commandLanguage = "EPL";
  supportsBinary = false;

  translate(document: PrintDocument, copies: number = 1): string {
    let script = document.content;
    return script.replaceAll("{copies}", String(copies));
  }
}

export class ESCPOSDriver implements IPrintDriver {
  id = "esc_pos";
  name = "Epson ESC/POS Receipt Command Language Driver";
  commandLanguage = "ESC/POS";
  supportsBinary = true;

  translate(document: PrintDocument, copies: number = 1): string {
    // ESC/POS receipt initialization \x1b\x40
    let script = `\x1B\x40${document.content}\x1D\x56\x41\x00`;
    return script;
  }
}

export class RAWDriver implements IPrintDriver {
  id = "raw";
  name = "Plain Text RAW Driver";
  commandLanguage = "RAW";
  supportsBinary = false;

  translate(document: PrintDocument, copies: number = 1): string {
    return document.content;
  }
}

export class PrintDriverRegistry {
  private static drivers: Map<string, IPrintDriver> = new Map([
    ["zpl", new ZPLDriver()],
    ["tspl", new TSPLDriver()],
    ["epl", new EPLDriver()],
    ["esc_pos", new ESCPOSDriver()],
    ["raw", new RAWDriver()],
  ]);

  static getDriver(driverId: string): IPrintDriver {
    return this.drivers.get(driverId) || new RAWDriver();
  }

  static registerDriver(driver: IPrintDriver): void {
    this.drivers.set(driver.id, driver);
  }
}
