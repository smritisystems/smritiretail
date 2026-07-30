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
 * Registry Singleton for Print Providers
 */
export class PrintProviderRegistry {
  private static providers: Map<PrintProviderType, IPrintProvider> = new Map([
    ["browser", new BrowserPrintProvider()],
    ["prn", new PRNFilePrintProvider()],
  ]);

  static getProvider(type: PrintProviderType): IPrintProvider {
    return this.providers.get(type) || new PRNFilePrintProvider();
  }

  static registerProvider(provider: IPrintProvider) {
    this.providers.set(provider.type, provider);
  }
}
