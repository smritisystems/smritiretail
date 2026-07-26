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
 * * Version    : 4.1.0 (SMRITI Universal Printer Provider Contract)
 * * Created    : 2026-07-26
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

export interface SystemPrinterInfo {
  name: string;
  driverName?: string;
  connectionType: "USB" | "TCP/IP" | "COM" | "SPOOLER" | "PDF";
  isDefault: boolean;
  isOnline: boolean;
  isThermal: boolean;
  description?: string;
}

export type PRNProtocol = "ZPL" | "TSPL" | "EPL" | "CPCL" | "ESC-POS" | "PDF" | "RAW";

export interface PrintJobOptions {
  jobName?: string;
  copies?: number;
  silent?: boolean;
  dpi?: 203 | 300 | 600;
  orientation?: "Portrait" | "Landscape";
  paperSize?: string;
  color?: boolean;
  altPrinting?: boolean;
}

export interface PrintResult {
  success: boolean;
  jobId: string;
  message: string;
  providerName: string;
  timestamp: string;
}

export interface PrinterStatus {
  online: boolean;
  paperOut: boolean;
  coverOpen: boolean;
  error: boolean;
  message: string;
}

/**
 * Universal Printer Provider Interface (SOLID Strategy Pattern)
 */
export interface IPrinterProvider {
  readonly providerId: string;
  readonly providerName: string;

  /** Connection Lifecycle */
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  /** Discovery */
  getInstalledPrinters(): Promise<SystemPrinterInfo[]>;
  getDefaultPrinter(): Promise<SystemPrinterInfo | null>;
  getPrinterStatus(printerName: string): Promise<PrinterStatus>;

  /** Printing Capabilities */
  printPRN(printerName: string, prnScript: string, options?: PrintJobOptions): Promise<PrintResult>;
  printRaw(printerName: string, rawData: string | ArrayBuffer, options?: PrintJobOptions): Promise<PrintResult>;
  printPDF(printerName: string, pdfUrlOrBlob: string | Blob, options?: PrintJobOptions): Promise<PrintResult>;
  printHTML(printerName: string, htmlContent: string, options?: PrintJobOptions): Promise<PrintResult>;
  printImage(printerName: string, imageUrl: string, options?: PrintJobOptions): Promise<PrintResult>;

  /** Job Control */
  cancelJob(jobId: string): Promise<boolean>;
}
