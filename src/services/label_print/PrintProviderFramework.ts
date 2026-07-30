/**
 * Project      : SMRITI Business OS
 * Component    : PrintProviderFramework (Rule SLP-008 & Hardware Printer Discovery)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 * Classification: SMRITI Platform Services
 */

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
  /**
   * Queries QZ Tray Daemon, WebUSB, and WebSerial to discover real physical printers connected to the desktop or network.
   */
  static async detectPrinters(): Promise<SystemPrinterInfo[]> {
    const discovered: SystemPrinterInfo[] = [];
    const seenNames = new Set<string>();

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
          console.warn("[SystemPrinterDiscovery] QZ Tray spooler discovery:", err);
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
          console.warn("[SystemPrinterDiscovery] WebUSB query warning:", err);
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
          console.warn("[SystemPrinterDiscovery] WebSerial query warning:", err);
        }
      }
    }

    // Returns ONLY REAL discovered physical printers (NO hardcoded fake placeholders)
    return discovered;
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
      const response = await fetch("/api/v1/print/raw-tcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printerIp: payload.printerName || "192.168.1.100",
          port: 9100,
          rawScript: payload.script,
        }),
      });
      if (!response.ok) {
        throw new Error(`TCP Printer raw socket error: HTTP ${response.status}`);
      }
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
