/**
 * Project      : SMRITI Business OS
 * Component    : PrintProviderFramework (Rule SLP-008 & Hardware Printer Discovery)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 * Classification: SMRITI Platform Services
 */

import logger from "../../core/logging/logger.js";
import { apiFetch } from "../../lib/apiFetch";

export type PrintProviderType = "browser" | "pdf" | "prn" | "qz_tray" | "network";

export interface SystemPrinterInfo {
  name: string;
  isDefault?: boolean;
  driver?: string;
  connection?: "USB" | "SPOOLER" | "NETWORK" | "VIRTUAL" | "SERIAL";
}

export interface PrintJobPayload {
  jobId: string;
  printerName: string;
  templateName: string;
  script: string;
  totalLabels: number;
  items: Array<{ name: string; copies: number }>;
}

export interface IPrintProvider {
  type: PrintProviderType;
  name: string;
  isAvailable(): Promise<boolean>;
  sendJob(payload: PrintJobPayload): Promise<{ success: boolean; error?: string }>;
}

/**
 * System Printer Hardware Discovery Service
 */
export class SystemPrinterDiscovery {
  static async requestUsbPrinter(): Promise<SystemPrinterInfo | null> {
    if (typeof navigator === "undefined") return null;

    if ((navigator as any).usb) {
      try {
        const device = await (navigator as any).usb.requestDevice({ filters: [] });
        const name = device.productName || `USB Printer (VID:${device.vendorId} PID:${device.productId})`;
        return { name, connection: "USB", driver: "Direct USB RAW" };
      } catch (err: any) {
        if (err?.name !== "NotFoundError") {
          logger.warn("[SystemPrinterDiscovery] USB permission request failed:", err as unknown);
        }
      }
    }

    if ((navigator as any).serial) {
      try {
        const port = await (navigator as any).serial.requestPort();
        const info = port.getInfo?.() || {};
        const name = `USB Serial Printer (VID:${info.usbVendorId || "unknown"} PID:${info.usbProductId || "unknown"})`;
        return { name, connection: "USB", driver: "USB Serial / WebSerial" };
      } catch (err: any) {
        if (err?.name !== "NotFoundError") {
          logger.warn("[SystemPrinterDiscovery] USB serial permission request failed:", err as unknown);
        }
      }
    }

    return null;
  }

  /**
   * Queries QZ Tray Daemon, WebUSB, and WebSerial to discover real physical printers connected to the desktop or network.
   */
  static async detectPrinters(): Promise<SystemPrinterInfo[]> {
    const discovered: SystemPrinterInfo[] = [];
    const seenNames = new Set<string>();

    // The browser cannot enumerate Windows spooler printers directly. Ask the
    // local backend as well, when it is running on the same desktop.
    try {
      const response = await apiFetch("/api/v1/barcode/local-printers");
      const localPrinters = Array.isArray(response?.printers) ? response.printers : [];
      for (const printer of localPrinters) {
        if (printer?.name && !seenNames.has(printer.name)) {
          seenNames.add(printer.name);
          discovered.push({
            name: printer.name,
            connection: "SPOOLER",
            driver: printer.driver || printer.port || "Windows / OS Spooler",
            isDefault: Boolean(printer.isDefault),
          });
        }
      }
    } catch (err) {
      logger.warn("[SystemPrinterDiscovery] Windows spooler discovery unavailable:", err as unknown);
    }

    if (typeof window !== "undefined") {
      const win = window as any;

      // 1. QZ Tray OS Spooler Scan (Windows / Mac / Linux)
      if (win.qz) {
        try {
          if (!win.qz.websocket.isActive()) {
            await win.qz.websocket.connect({ retries: 2, delay: 1 });
          }
          if (win.qz.websocket.isActive()) {
            const qzPrinters: string[] = await win.qz.printers.find();
            for (const p of qzPrinters) {
              if (!seenNames.has(p)) {
                seenNames.add(p);
                discovered.push({
                  name: p,
                  connection: "SPOOLER",
                  driver: p.toLowerCase().includes("zebra")
                    ? "ZPL"
                    : p.toLowerCase().includes("tsc")
                    ? "TSPL"
                    : p.toLowerCase().includes("tvs")
                    ? "EPL"
                    : p.toLowerCase().includes("godex")
                    ? "GZPL"
                    : "Windows / OS Spooler",
                });
              }
            }
          }
        } catch (err) {
          logger.warn("[SystemPrinterDiscovery] QZ Tray spooler discovery:", err as unknown);
        }
      }

      // 2. WebUSB Real Device Discovery
      if (navigator && (navigator as any).usb) {
        try {
          const usbDevices = await (navigator as any).usb.getDevices();
          for (const dev of usbDevices) {
            const devName = dev.productName || `USB Printer (VID:${dev.vendorId} PID:${dev.productId})`;
            if (!seenNames.has(devName)) {
              seenNames.add(devName);
              discovered.push({
                name: devName,
                connection: "USB",
                driver: "Direct USB RAW",
              });
            }
          }
        } catch (err) {
          logger.warn("[SystemPrinterDiscovery] WebUSB query warning:", err as unknown);
        }
      }

      // 3. WebSerial Real Port Discovery
      if (navigator && (navigator as any).serial) {
        try {
          const serialPorts = await (navigator as any).serial.getPorts();
          for (let i = 0; i < serialPorts.length; i++) {
            const portName = `Serial Thermal Printer (COM ${i + 1})`;
            if (!seenNames.has(portName)) {
              seenNames.add(portName);
              discovered.push({
                name: portName,
                connection: "SERIAL",
                driver: "RS232 / COM Port",
              });
            }
          }
        } catch (err) {
          logger.warn("[SystemPrinterDiscovery] WebSerial query warning:", err as unknown);
        }
      }

      // 4. Load Saved Physical System Printers from LocalStorage
      try {
        const savedRaw = localStorage.getItem("smriti_saved_printers");
        if (savedRaw) {
          const savedPrinters: SystemPrinterInfo[] = JSON.parse(savedRaw);
          for (const sp of savedPrinters) {
            if (sp && sp.name && !seenNames.has(sp.name)) {
              seenNames.add(sp.name);
              discovered.push(sp);
            }
          }
        }
      } catch (err) {
        logger.warn("[SystemPrinterDiscovery] LocalStorage printers read error:", err as unknown);
      }

      // 5. Default Physical Windows Spooler Presets (If QZ Tray offline or zero auto-detected)
      if (discovered.length === 0) {
        const defaultWindowsPrinters: SystemPrinterInfo[] = [
          {
            name: "IMPACT by Honeywell IH-2 (300 dpi) - DPL",
            connection: "SPOOLER",
            driver: "Honeywell DPL / ZPL",
          },
          {
            name: "Honeywell PC42t (300 dpi)",
            connection: "SPOOLER",
            driver: "Direct Thermal / DPL",
          },
          {
            name: "Zebra ZD420 (ZPL II)",
            connection: "SPOOLER",
            driver: "ZPL",
          },
          {
            name: "TSC TE244 / TE310",
            connection: "SPOOLER",
            driver: "TSPL",
          },
          {
            name: "Windows Default Spooler Printer",
            connection: "SPOOLER",
            driver: "Windows / OS Spooler",
          },
        ];

        for (const wp of defaultWindowsPrinters) {
          if (!seenNames.has(wp.name)) {
            seenNames.add(wp.name);
            discovered.push(wp);
          }
        }
      }
    }

    return discovered;
  }

  /**
   * Save a physical system printer to persistent storage
   */
  static savePrinter(printer: SystemPrinterInfo): void {
    try {
      const savedRaw = localStorage.getItem("smriti_saved_printers");
      const current: SystemPrinterInfo[] = savedRaw ? JSON.parse(savedRaw) : [];
      const updated = [printer, ...current.filter((p) => p.name !== printer.name)];
      localStorage.setItem("smriti_saved_printers", JSON.stringify(updated));
    } catch (e) {
      logger.warn("[SystemPrinterDiscovery] Failed to save printer to localStorage:", e as unknown);
    }
  }

  /**
   * Remove a saved printer from persistent storage
   */
  static removePrinter(printerName: string): void {
    try {
      const savedRaw = localStorage.getItem("smriti_saved_printers");
      if (!savedRaw) return;
      const current: SystemPrinterInfo[] = JSON.parse(savedRaw);
      const updated = current.filter((p) => p.name !== printerName);
      localStorage.setItem("smriti_saved_printers", JSON.stringify(updated));
    } catch (e) {
      logger.warn("[SystemPrinterDiscovery] Failed to remove printer from localStorage:", e as unknown);
    }
  }
}

/**
 * Browser Print Provider (Direct System Print Dialog)
 */
export class BrowserPrintProvider implements IPrintProvider {
  type: PrintProviderType = "browser";
  name = "Browser System Print";

  async isAvailable(): Promise<boolean> {
    return typeof window !== "undefined";
  }

  async sendJob(payload: PrintJobPayload): Promise<{ success: boolean; error?: string }> {
    try {
      if (typeof window !== "undefined") {
        window.print();
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || "Browser print execution failed" };
    }
  }
}

/**
 * PRN File Download Provider
 */
export class PRNFilePrintProvider implements IPrintProvider {
  type: PrintProviderType = "prn";
  name = "Raw PRN File Download";

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async sendJob(payload: PrintJobPayload): Promise<{ success: boolean; error?: string }> {
    try {
      if (typeof window !== "undefined") {
        const blob = new Blob([payload.script], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `smriti_print_job_${payload.jobId}.prn`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || "PRN download failed" };
    }
  }
}

/**
 * QZ Tray Hardware Direct Print Provider
 */
export class QZTrayPrintProvider implements IPrintProvider {
  type: PrintProviderType = "qz_tray";
  name = "QZ Tray Direct Hardware Thermal Print";

  async isAvailable(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    return Boolean((window as any).qz || (window as any).WebSocket);
  }

  async sendJob(payload: PrintJobPayload): Promise<{ success: boolean; error?: string }> {
    try {
      const win = window as any;
      if (win.qz && win.qz.websocket) {
        if (!win.qz.websocket.isActive()) {
          await win.qz.websocket.connect({ retries: 2, delay: 1 });
        }
        if (win.qz.websocket.isActive()) {
          const config = win.qz.configs.create(payload.printerName);
          const data = [payload.script];
          await win.qz.print(config, data);
          return { success: true };
        }
      }
      // Fallback to PRN download if QZ not connected
      return new PRNFilePrintProvider().sendJob(payload);
    } catch (e: any) {
      return { success: false, error: e.message || "QZ Tray raw thermal print failed" };
    }
  }
}

/**
 * Network RAW TCP/IP Direct Thermal Print Provider (Port 9100 Socket)
 */
export class NetworkRawPrintProvider implements IPrintProvider {
  type: PrintProviderType = "network";
  name = "Network Direct TCP/IP (Port 9100 RAW)";

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async sendJob(payload: PrintJobPayload): Promise<{ success: boolean; error?: string }> {
    try {
      await apiFetch("/api/v1/print/raw-tcp", {
        method: "POST",
        body: JSON.stringify({
          printerIp: payload.printerName || "192.168.1.100",
          port: 9100,
          rawScript: payload.script,
        }),
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || "RAW TCP/IP Port 9100 direct print failed" };
    }
  }
}

/**
 * Registry Singleton for Print Providers
 */
export class PrintProviderRegistry {
  private static providers: Map<PrintProviderType, IPrintProvider> = new Map([
    ["browser", new BrowserPrintProvider()],
    ["prn", new PRNFilePrintProvider()],
    ["qz_tray", new QZTrayPrintProvider()],
    ["network", new NetworkRawPrintProvider()],
  ]);

  static getProvider(type: PrintProviderType): IPrintProvider {
    return this.providers.get(type) || new PRNFilePrintProvider();
  }

  static registerProvider(provider: IPrintProvider) {
    this.providers.set(provider.type, provider);
  }
}
