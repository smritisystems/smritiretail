/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 4.1.0 (QZ Tray WebSocket Hardware Print Provider)
 * * Created    : 2026-07-26
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import { IPrinterProvider, SystemPrinterInfo, PrintJobOptions, PrintResult, PrinterStatus } from "./IPrinterProvider";

/**
 * QZ Tray Provider — Hardware Bridge connecting Browser to OS Printers via WebSocket
 */
export class QZTrayProvider implements IPrinterProvider {
  readonly providerId = "qz-tray";
  readonly providerName = "QZ Tray Enterprise Local Bridge";

  private ws: WebSocket | null = null;
  private connected = false;
  private requestIdCounter = 1;
  private pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
  private defaultPrinterName: string | null = null;

  private readonly ports = [8182, 8181];

  async connect(): Promise<boolean> {
    if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      return true;
    }

    for (const port of this.ports) {
      try {
        const ok = await this.tryConnectWebSocket(`wss://localhost:${port}`);
        if (ok) {
          this.connected = true;
          return true;
        }
      } catch {
        // Try fallback port
      }
    }

    this.connected = false;
    return false;
  }

  private tryConnectWebSocket(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const socket = new WebSocket(url);
        const timeout = setTimeout(() => {
          socket.close();
          resolve(false);
        }, 2000);

        socket.onopen = () => {
          clearTimeout(timeout);
          this.ws = socket;
          this.setupSocketListeners();
          resolve(true);
        };

        socket.onerror = () => {
          clearTimeout(timeout);
          resolve(false);
        };
      } catch {
        resolve(false);
      }
    });
  }

  private setupSocketListeners(): void {
    if (!this.ws) return;

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.uid && this.pendingRequests.has(data.uid)) {
          const deferred = this.pendingRequests.get(data.uid)!;
          this.pendingRequests.delete(data.uid);
          if (data.error) {
            deferred.reject(new Error(data.error));
          } else {
            deferred.resolve(data.result);
          }
        }
      } catch (err) {
        console.error("QZ Tray JSON parse error:", err);
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.ws = null;
    };
  }

  private sendRequest<T = any>(callName: string, params: any = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error("QZ Tray WebSocket is not connected."));
      }

      const uid = `smriti-qz-${this.requestIdCounter++}-${Date.now()}`;
      this.pendingRequests.set(uid, { resolve, reject });

      const payload = {
        call: callName,
        params,
        uid,
        timestamp: Date.now()
      };

      this.ws.send(JSON.stringify(payload));

      setTimeout(() => {
        if (this.pendingRequests.has(uid)) {
          this.pendingRequests.delete(uid);
          reject(new Error(`QZ Tray request timeout for call [${callName}]`));
        }
      }, 12000);
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  async getInstalledPrinters(): Promise<SystemPrinterInfo[]> {
    if (!this.isConnected()) {
      const ok = await this.connect();
      if (!ok) throw new Error("QZ Tray service is offline. Please launch QZ Tray application on your workstation.");
    }

    try {
      const printerNames: string[] = await this.sendRequest("printers.find");
      const defaultName = await this.getDefaultPrinterName();

      return printerNames.map((name) => {
        const nameLower = name.toLowerCase();
        const isThermal = nameLower.includes("zebra") || nameLower.includes("tsc") || nameLower.includes("tvs") || nameLower.includes("label") || nameLower.includes("pos") || nameLower.includes("receipt");
        const connectionType: "USB" | "TCP/IP" | "COM" | "SPOOLER" | "PDF" = nameLower.includes("network") || nameLower.includes("tcp") ? "TCP/IP" : isThermal ? "USB" : "SPOOLER";

        return {
          name,
          driverName: name,
          connectionType,
          isDefault: name === defaultName,
          isOnline: true,
          isThermal,
          description: `QZ Tray Direct Spooler Device (${connectionType})`
        };
      });
    } catch (err: any) {
      console.error("Failed to query QZ Tray printers:", err);
      return [];
    }
  }

  private async getDefaultPrinterName(): Promise<string | null> {
    try {
      const def = await this.sendRequest("printers.getDefault");
      this.defaultPrinterName = typeof def === "string" ? def : def?.name || null;
      return this.defaultPrinterName;
    } catch {
      return null;
    }
  }

  async getDefaultPrinter(): Promise<SystemPrinterInfo | null> {
    const list = await this.getInstalledPrinters();
    return list.find((p) => p.isDefault) || list[0] || null;
  }

  async getPrinterStatus(printerName: string): Promise<PrinterStatus> {
    if (!this.isConnected()) {
      return { online: false, paperOut: false, coverOpen: false, error: true, message: "QZ Tray Disconnected" };
    }

    try {
      const status = await this.sendRequest("printers.getStatus", { printer: printerName });
      return {
        online: status?.online ?? true,
        paperOut: !!status?.paperOut,
        coverOpen: !!status?.coverOpen,
        error: !!status?.error,
        message: status?.message || "Printer Online & Ready"
      };
    } catch {
      return { online: true, paperOut: false, coverOpen: false, error: false, message: "Ready (QZ Tray Bridge Active)" };
    }
  }

  async printPRN(printerName: string, prnScript: string, options: PrintJobOptions = {}): Promise<PrintResult> {
    return this.printRaw(printerName, prnScript, options);
  }

  async printRaw(printerName: string, rawData: string | ArrayBuffer, options: PrintJobOptions = {}): Promise<PrintResult> {
    if (!this.isConnected()) {
      const ok = await this.connect();
      if (!ok) {
        return {
          success: false,
          jobId: `job-fail-${Date.now()}`,
          message: "QZ Tray is not running on this PC. Please open QZ Tray.",
          providerName: this.providerName,
          timestamp: new Date().toISOString()
        };
      }
    }

    const jobId = `job-raw-${Date.now()}`;
    const rawContent = typeof rawData === "string" ? rawData : new TextDecoder().decode(rawData);

    try {
      const dataPayload = [
        {
          type: "raw",
          format: "command",
          data: rawContent,
          options: {
            language: rawContent.includes("^XA") ? "ZPL" : rawContent.includes("SIZE") ? "TSPL" : "RAW"
          }
        }
      ];

      const copies = options.copies || 1;
      for (let i = 0; i < copies; i++) {
        await this.sendRequest("print", {
          printer: printerName,
          data: dataPayload
        });
      }

      return {
        success: true,
        jobId,
        message: `Successfully printed raw PRN label job to [${printerName}].`,
        providerName: this.providerName,
        timestamp: new Date().toISOString()
      };
    } catch (err: any) {
      return {
        success: false,
        jobId,
        message: err.message || "Failed to transmit raw print data via QZ Tray.",
        providerName: this.providerName,
        timestamp: new Date().toISOString()
      };
    }
  }

  async printPDF(printerName: string, pdfUrlOrBlob: string | Blob, options: PrintJobOptions = {}): Promise<PrintResult> {
    if (!this.isConnected()) await this.connect();
    const jobId = `job-pdf-${Date.now()}`;

    try {
      let pdfDataUrl = typeof pdfUrlOrBlob === "string" ? pdfUrlOrBlob : URL.createObjectURL(pdfUrlOrBlob);

      const dataPayload = [
        {
          type: "pixel",
          format: "pdf",
          flavor: "file",
          data: pdfDataUrl,
          options: {
            pageWidth: options.paperSize === "80mm" ? 80 : undefined,
            colorType: options.color ? "color" : "grayscale"
          }
        }
      ];

      await this.sendRequest("print", {
        printer: printerName,
        data: dataPayload
      });

      return {
        success: true,
        jobId,
        message: `Printed PDF invoice document to [${printerName}] via QZ Tray.`,
        providerName: this.providerName,
        timestamp: new Date().toISOString()
      };
    } catch (err: any) {
      return {
        success: false,
        jobId,
        message: err.message || "Failed to print PDF document via QZ Tray.",
        providerName: this.providerName,
        timestamp: new Date().toISOString()
      };
    }
  }

  async printHTML(printerName: string, htmlContent: string, options: PrintJobOptions = {}): Promise<PrintResult> {
    if (!this.isConnected()) await this.connect();
    const jobId = `job-html-${Date.now()}`;

    try {
      const dataPayload = [
        {
          type: "pixel",
          format: "html",
          flavor: "plain",
          data: htmlContent
        }
      ];

      await this.sendRequest("print", {
        printer: printerName,
        data: dataPayload
      });

      return {
        success: true,
        jobId,
        message: `Printed HTML document to [${printerName}] via QZ Tray.`,
        providerName: this.providerName,
        timestamp: new Date().toISOString()
      };
    } catch (err: any) {
      return {
        success: false,
        jobId,
        message: err.message || "Failed to print HTML via QZ Tray.",
        providerName: this.providerName,
        timestamp: new Date().toISOString()
      };
    }
  }

  async printImage(printerName: string, imageUrl: string, options: PrintJobOptions = {}): Promise<PrintResult> {
    if (!this.isConnected()) await this.connect();
    const jobId = `job-img-${Date.now()}`;

    try {
      const dataPayload = [
        {
          type: "pixel",
          format: "image",
          flavor: "file",
          data: imageUrl
        }
      ];

      await this.sendRequest("print", {
        printer: printerName,
        data: dataPayload
      });

      return {
        success: true,
        jobId,
        message: `Printed image graphic to [${printerName}] via QZ Tray.`,
        providerName: this.providerName,
        timestamp: new Date().toISOString()
      };
    } catch (err: any) {
      return {
        success: false,
        jobId,
        message: err.message || "Failed to print image via QZ Tray.",
        providerName: this.providerName,
        timestamp: new Date().toISOString()
      };
    }
  }

  async cancelJob(jobId: string): Promise<boolean> {
    return true;
  }
}
