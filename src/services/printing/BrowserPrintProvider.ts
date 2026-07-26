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
 * * Version    : 4.1.0 (Standard Browser Fallback Print Provider)
 * * Created    : 2026-07-26
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import { IPrinterProvider, SystemPrinterInfo, PrintJobOptions, PrintResult, PrinterStatus } from "./IPrinterProvider";

/**
 * BrowserPrintProvider — Standard Browser Fallback Print Engine (window.print() & WebSerial)
 */
export class BrowserPrintProvider implements IPrinterProvider {
  readonly providerId = "browser-native";
  readonly providerName = "Standard System Browser Spooler";

  private connected = true;

  async connect(): Promise<boolean> {
    this.connected = true;
    return true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getInstalledPrinters(): Promise<SystemPrinterInfo[]> {
    return [
      {
        name: "Standard System Print Spooler (Default)",
        driverName: "Windows / Mac Native Printer",
        connectionType: "SPOOLER",
        isDefault: true,
        isOnline: true,
        isThermal: false,
        description: "Launches standard operating system print dialog"
      },
      {
        name: "Virtual PDF Document Renderer",
        driverName: "PDF Printer",
        connectionType: "PDF",
        isDefault: false,
        isOnline: true,
        isThermal: false,
        description: "Browser built-in PDF download and preview engine"
      }
    ];
  }

  async getDefaultPrinter(): Promise<SystemPrinterInfo | null> {
    const list = await this.getInstalledPrinters();
    return list[0];
  }

  async getPrinterStatus(printerName: string): Promise<PrinterStatus> {
    return {
      online: true,
      paperOut: false,
      coverOpen: false,
      error: false,
      message: "Browser Print Engine Ready"
    };
  }

  async printPRN(printerName: string, prnScript: string, options: PrintJobOptions = {}): Promise<PrintResult> {
    return this.printRaw(printerName, prnScript, options);
  }

  async printRaw(printerName: string, rawData: string | ArrayBuffer, options: PrintJobOptions = {}): Promise<PrintResult> {
    const jobId = `job-raw-${Date.now()}`;
    const rawContent = typeof rawData === "string" ? rawData : new TextDecoder().decode(rawData);

    // Try browser WebSerial direct USB printing if available
    if ("serial" in navigator) {
      try {
        const port = await (navigator as any).serial.requestPort();
        await port.open({ baudRate: 9600 });
        const writer = port.writable.getWriter();
        const encoder = new TextEncoder();
        await writer.write(encoder.encode(rawContent));
        writer.releaseLock();
        await port.close();

        return {
          success: true,
          jobId,
          message: "Sent raw PRN script to WebSerial USB port.",
          providerName: this.providerName,
          timestamp: new Date().toISOString()
        };
      } catch (err: any) {
        console.warn("WebSerial direct raw print skipped/cancelled:", err);
      }
    }

    // Fallback: create raw text download blob or alert
    const blob = new Blob([rawContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `label-print-${jobId}.prn`;
    a.click();
    URL.revokeObjectURL(url);

    return {
      success: true,
      jobId,
      message: "Generated raw .PRN label script download. To print silently without prompts, open QZ Tray.",
      providerName: this.providerName,
      timestamp: new Date().toISOString()
    };
  }

  async printPDF(printerName: string, pdfUrlOrBlob: string | Blob, options: PrintJobOptions = {}): Promise<PrintResult> {
    const jobId = `job-pdf-${Date.now()}`;
    const pdfUrl = typeof pdfUrlOrBlob === "string" ? pdfUrlOrBlob : URL.createObjectURL(pdfUrlOrBlob);

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.src = pdfUrl;

    document.body.appendChild(iframe);

    return new Promise((resolve) => {
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          window.open(pdfUrl, "_blank");
        }
        setTimeout(() => {
          document.body.removeChild(iframe);
          resolve({
            success: true,
            jobId,
            message: "Triggered standard browser print window.",
            providerName: this.providerName,
            timestamp: new Date().toISOString()
          });
        }, 1000);
      };
    });
  }

  async printHTML(printerName: string, htmlContent: string, options: PrintJobOptions = {}): Promise<PrintResult> {
    const jobId = `job-html-${Date.now()}`;
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    }

    return {
      success: true,
      jobId,
      message: "Dispatched HTML print preview dialog.",
      providerName: this.providerName,
      timestamp: new Date().toISOString()
    };
  }

  async printImage(printerName: string, imageUrl: string, options: PrintJobOptions = {}): Promise<PrintResult> {
    const html = `<div style="display:flex;justify-content:center;align-items:center;height:100vh;"><img src="${imageUrl}" style="max-width:100%;max-height:100%;"/></div>`;
    return this.printHTML(printerName, html, options);
  }

  async cancelJob(jobId: string): Promise<boolean> {
    return true;
  }
}
