/**
 * Project      : SMRITI Retail OS
 * System       : SMRITI Universal Printing Platform (SUPP)
 * Component    : IPrintProvider & PrintProviderRegistry (Rule SUPP-004 Driver Independence & Fallback)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { PrintJob, PrinterCapability, PrintResult } from "../models/PrintDocument.js";
import { apiFetch } from "../../../lib/apiFetch.js";

export interface IPrintProvider {
  id: string;
  name: string;
  priority: number;
  discoverPrinters(): Promise<PrinterCapability[]>;
  connect(): Promise<boolean>;
  sendJob(job: PrintJob): Promise<PrintResult>;
  disconnect(): Promise<void>;
}

export class QZProvider implements IPrintProvider {
  id = "qz_tray";
  name = "QZ Tray Desktop Daemon Provider (wss://localhost:8182)";
  priority = 10;

  async discoverPrinters(): Promise<PrinterCapability[]> {
    const list: PrinterCapability[] = [];
    if (typeof window !== "undefined") {
      const win = window as any;
      if (win.qz) {
        try {
          if (!win.qz.websocket.isActive()) {
            await win.qz.websocket.connect({ retries: 2, delay: 1 });
          }
          if (win.qz.websocket.isActive()) {
            const qzPrinters: string[] = await win.qz.printers.find();
            for (const p of qzPrinters) {
              list.push({
                id: `qz_${p}`,
                name: p,
                dpi: p.toLowerCase().includes("300") ? 300 : 203,
                paperWidthMm: 100,
                paperHeightMm: 50,
                supportsZPL: p.toLowerCase().includes("zebra") || true,
                supportsTSPL: p.toLowerCase().includes("tsc"),
                supportsEPL: p.toLowerCase().includes("tvs"),
                supportsESC: false,
                supportsPDF: true,
                supportsRAW: true,
                supportsCutter: false,
                supportsPeeler: false,
                supportsDrawer: false,
                connection: "SPOOLER",
                status: "Online",
              });
            }
          }
        } catch (e) {
          console.warn("[QZProvider] Discovery exception:", e);
        }
      }
    }
    return list;
  }

  async connect(): Promise<boolean> {
    if (typeof window !== "undefined") {
      const win = window as any;
      if (win.qz) {
        if (!win.qz.websocket.isActive()) {
          await win.qz.websocket.connect({ retries: 2, delay: 1 });
        }
        return win.qz.websocket.isActive();
      }
    }
    return false;
  }

  async sendJob(job: PrintJob): Promise<PrintResult> {
    const start = Date.now();
    try {
      const win = window as any;
      if (win.qz && win.qz.websocket) {
        if (!win.qz.websocket.isActive()) {
          await win.qz.websocket.connect({ retries: 2, delay: 1 });
        }
      }
      if (win.qz && win.qz.websocket && win.qz.websocket.isActive()) {
        const config = win.qz.configs.create(job.printerName);
        const data = [job.payload];
        await win.qz.print(config, data);
        return {
          jobId: job.id,
          success: true,
          providerId: this.id,
          driverId: job.driverId,
          timestamp: new Date().toISOString(),
          executionTimeMs: Date.now() - start,
        };
      }
      throw new Error("QZ Tray daemon not active");
    } catch (e: any) {
      return {
        jobId: job.id,
        success: false,
        providerId: this.id,
        driverId: job.driverId,
        timestamp: new Date().toISOString(),
        error: e.message || "QZ Tray print failed",
        executionTimeMs: Date.now() - start,
      };
    }
  }

  async disconnect(): Promise<void> {}
}

export class WindowsSpoolerProvider implements IPrintProvider {
  id = "windows_spooler";
  name = "Windows Native Browser Spooler Provider";
  priority = 20;

  async discoverPrinters(): Promise<PrinterCapability[]> {
    return [];
  }

  async connect(): Promise<boolean> {
    return typeof window !== "undefined";
  }

  async sendJob(job: PrintJob): Promise<PrintResult> {
    const start = Date.now();
    try {
      if (typeof window !== "undefined") {
        window.print();
      }
      return {
        jobId: job.id,
        success: true,
        providerId: this.id,
        driverId: job.driverId,
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - start,
      };
    } catch (e: any) {
      return {
        jobId: job.id,
        success: false,
        providerId: this.id,
        driverId: job.driverId,
        timestamp: new Date().toISOString(),
        error: e.message || "Windows browser spooler print failed",
        executionTimeMs: Date.now() - start,
      };
    }
  }

  async disconnect(): Promise<void> {}
}

export class NetworkProvider implements IPrintProvider {
  id = "network";
  name = "Network Direct TCP/IP Socket Provider (Port 9100)";
  priority = 30;

  async discoverPrinters(): Promise<PrinterCapability[]> {
    return [];
  }

  async connect(): Promise<boolean> {
    return true;
  }

  async sendJob(job: PrintJob): Promise<PrintResult> {
    const start = Date.now();
    try {
      const printerIp = job.printerIp || job.printerName || "192.168.1.100";
      const printerPort = job.printerPort || 9100;
      await apiFetch("/api/v1/print/raw-tcp", {
        method: "POST",
        body: JSON.stringify({
          printerIp,
          port: printerPort,
          rawScript: job.payload,
        }),
      });
      return {
        jobId: job.id,
        success: true,
        providerId: this.id,
        driverId: job.driverId,
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - start,
      };
    } catch (e: any) {
      return {
        jobId: job.id,
        success: false,
        providerId: this.id,
        driverId: job.driverId,
        timestamp: new Date().toISOString(),
        error: e.message || "Network RAW TCP print failed",
        executionTimeMs: Date.now() - start,
      };
    }
  }

  async disconnect(): Promise<void> {}
}

export class PrintProviderRegistry {
  private static providers: Map<string, IPrintProvider> = new Map([
    ["qz_tray", new QZProvider()],
    ["windows_spooler", new WindowsSpoolerProvider()],
    ["network", new NetworkProvider()],
  ]);

  static getProvider(providerId: string): IPrintProvider {
    return this.providers.get(providerId) || new WindowsSpoolerProvider();
  }

  static getOrderedProviders(): IPrintProvider[] {
    return Array.from(this.providers.values()).sort((a, b) => a.priority - b.priority);
  }

  static registerProvider(provider: IPrintProvider): void {
    this.providers.set(provider.id, provider);
  }
}
