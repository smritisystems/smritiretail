/**
 * Project      : SMRITI Retail OS
 * System       : Universal Document Experience Platform (DXP)
 * Component    : PrinterProfileRegistry (Fleet Printer Registry)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Standard     : SCS-DXP-002 Enterprise Printing Architecture v2.1
 * Version      : 2.1.0
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { TransportType } from "../transports/TransportRegistry.ts";

export interface FleetPrinter {
  id: string;
  friendlyName: string;
  location: string;
  department: string;
  protocol: "ESC/POS" | "ZPL" | "TSPL" | "EPL" | "CPCL" | "RAW" | "SIMULATION";
  transportType: TransportType;
  targetAddress: string;
  isDefault?: boolean;
  paperWidthMm: number;
  dpi: number;
  status: "ONLINE" | "OFFLINE" | "WARNING" | "BUSY";
}

class PrinterProfileRegistryService {
  private printers: Map<string, FleetPrinter> = new Map();

  constructor() {
    this.seedDefaultFleet();
  }

  private seedDefaultFleet() {
    this.register({
      id: "prn-pos-01",
      friendlyName: "POS Main Thermal Receipt Printer",
      location: "Front Billing Counter 1",
      department: "Sales & Checkout",
      protocol: "ESC/POS",
      transportType: "SDA",
      targetAddress: "usb://04b8:0202",
      isDefault: true,
      paperWidthMm: 80,
      dpi: 203,
      status: "ONLINE",
    });

    this.register({
      id: "prn-barcode-01",
      friendlyName: "Warehouse Barcode Sticker Printer",
      location: "Central Warehouse Dispatch",
      department: "Inventory",
      protocol: "ZPL",
      transportType: "NETWORK",
      targetAddress: "tcp://192.168.1.150:9100",
      paperWidthMm: 104,
      dpi: 300,
      status: "ONLINE",
    });

    this.register({
      id: "prn-laser-01",
      friendlyName: "Accounts Laser Document Printer",
      location: "Back Office Accounts Room",
      department: "Finance",
      protocol: "RAW",
      transportType: "NETWORK",
      targetAddress: "tcp://192.168.1.160:9100",
      paperWidthMm: 210,
      dpi: 600,
      status: "ONLINE",
    });
  }

  public register(printer: FleetPrinter): void {
    this.printers.set(printer.id, printer);
  }

  public get(id: string): FleetPrinter | undefined {
    return this.printers.get(id);
  }

  public list(): FleetPrinter[] {
    return Array.from(this.printers.values());
  }

  public getDefault(): FleetPrinter {
    const list = this.list();
    return list.find((p) => p.isDefault) || list[0];
  }
}

export const PrinterProfileRegistry = new PrinterProfileRegistryService();
