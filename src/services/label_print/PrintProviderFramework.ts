/**
 * Project      : SMRITI Business OS
 * Component    : PrintProviderFramework (Rule SLP-008)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 * Classification: SMRITI Platform Services
 */

export type PrintProviderType = "browser" | "pdf" | "prn" | "qz_tray" | "network";

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
      if (win.qz && win.qz.websocket && win.qz.websocket.isActive()) {
        const config = win.qz.configs.create(payload.printerName || "Zebra ZD420");
        const data = [payload.script];
        await win.qz.print(config, data);
        return { success: true };
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
      // Sends payload via SMRITI Platform API Gateway TCP Socket Proxy
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
