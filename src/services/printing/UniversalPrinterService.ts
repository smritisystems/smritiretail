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
 * * Version    : 4.1.0 (Universal Printer Service Orchestration Layer)
 * * Created    : 2026-07-26
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import { IPrinterProvider, SystemPrinterInfo, PrintJobOptions, PrintResult, PrinterStatus } from "./IPrinterProvider";
import { QZTrayProvider } from "./QZTrayProvider";
import { BrowserPrintProvider } from "./BrowserPrintProvider";

export interface WorkstationPrinterPreferences {
  preferredPrinterName: string;
  preferredProviderId: string;
  silentMode: boolean;
  paperProfile: string;
  autoCut: boolean;
}

const PREFERENCES_STORAGE_KEY = "smriti_workstation_printer_prefs_v1";

/**
 * UniversalPrinterService — High-availability singleton managing hardware printers,
 * provider cascades (QZ Tray -> Browser), preferences, and job retries.
 */
export class UniversalPrinterService {
  private static instance: UniversalPrinterService;

  private activeProvider: IPrinterProvider;
  private qzProvider: QZTrayProvider;
  private browserProvider: BrowserPrintProvider;
  private preferences: WorkstationPrinterPreferences;
  private listeners: Set<() => void> = new Set();

  private constructor() {
    this.qzProvider = new QZTrayProvider();
    this.browserProvider = new BrowserPrintProvider();
    this.activeProvider = this.browserProvider; // Default fallback until QZ connects

    this.preferences = this.loadWorkstationPreferences();
    this.initProviderCascade();
  }

  public static getInstance(): UniversalPrinterService {
    if (!UniversalPrinterService.instance) {
      UniversalPrinterService.instance = new UniversalPrinterService();
    }
    return UniversalPrinterService.instance;
  }

  private loadWorkstationPreferences(): WorkstationPrinterPreferences {
    try {
      const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn("Failed to load printer preferences:", e);
    }

    return {
      preferredPrinterName: "",
      preferredProviderId: "qz-tray",
      silentMode: true,
      paperProfile: "50x25",
      autoCut: true
    };
  }

  public saveWorkstationPreferences(prefs: Partial<WorkstationPrinterPreferences>): void {
    this.preferences = { ...this.preferences, ...prefs };
    try {
      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(this.preferences));
    } catch (e) {
      console.error("Failed to save workstation printer preferences:", e);
    }
    this.notifyListeners();
  }

  public getPreferences(): WorkstationPrinterPreferences {
    return { ...this.preferences };
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach((cb) => cb());
  }

  public async initProviderCascade(): Promise<boolean> {
    const qzOk = await this.qzProvider.connect();
    if (qzOk) {
      this.activeProvider = this.qzProvider;
      this.notifyListeners();
      return true;
    }

    this.activeProvider = this.browserProvider;
    this.notifyListeners();
    return false;
  }

  public getActiveProvider(): IPrinterProvider {
    return this.activeProvider;
  }

  public isQZConnected(): boolean {
    return this.qzProvider.isConnected();
  }

  public async getInstalledPrinters(): Promise<SystemPrinterInfo[]> {
    if (this.qzProvider.isConnected()) {
      return this.qzProvider.getInstalledPrinters();
    }

    // Try connecting QZ Tray first
    const qzOk = await this.qzProvider.connect();
    if (qzOk) {
      this.activeProvider = this.qzProvider;
      this.notifyListeners();
      return this.qzProvider.getInstalledPrinters();
    }

    return this.browserProvider.getInstalledPrinters();
  }

  public async getDefaultPrinter(): Promise<SystemPrinterInfo | null> {
    const list = await this.getInstalledPrinters();
    if (this.preferences.preferredPrinterName) {
      const found = list.find((p) => p.name === this.preferences.preferredPrinterName);
      if (found) return found;
    }
    return list.find((p) => p.isDefault) || list[0] || null;
  }

  public async getPrinterStatus(printerName?: string): Promise<PrinterStatus> {
    const targetName = printerName || this.preferences.preferredPrinterName;
    if (!targetName) {
      return { online: true, paperOut: false, coverOpen: false, error: false, message: "Ready" };
    }
    return this.activeProvider.getPrinterStatus(targetName);
  }

  public async printPRN(prnScript: string, options: PrintJobOptions = {}): Promise<PrintResult> {
    const targetPrinter = await this.resolveTargetPrinterName(options);
    return this.activeProvider.printPRN(targetPrinter, prnScript, {
      silent: this.preferences.silentMode,
      ...options
    });
  }

  public async printRaw(rawData: string | ArrayBuffer, options: PrintJobOptions = {}): Promise<PrintResult> {
    const targetPrinter = await this.resolveTargetPrinterName(options);
    return this.activeProvider.printRaw(targetPrinter, rawData, {
      silent: this.preferences.silentMode,
      ...options
    });
  }

  public async printPDF(pdfUrlOrBlob: string | Blob, options: PrintJobOptions = {}): Promise<PrintResult> {
    const targetPrinter = await this.resolveTargetPrinterName(options);
    return this.activeProvider.printPDF(targetPrinter, pdfUrlOrBlob, {
      silent: this.preferences.silentMode,
      ...options
    });
  }

  public async printHTML(htmlContent: string, options: PrintJobOptions = {}): Promise<PrintResult> {
    const targetPrinter = await this.resolveTargetPrinterName(options);
    return this.activeProvider.printHTML(targetPrinter, htmlContent, {
      silent: this.preferences.silentMode,
      ...options
    });
  }

  public async printImage(imageUrl: string, options: PrintJobOptions = {}): Promise<PrintResult> {
    const targetPrinter = await this.resolveTargetPrinterName(options);
    return this.activeProvider.printImage(targetPrinter, imageUrl, {
      silent: this.preferences.silentMode,
      ...options
    });
  }

  private async resolveTargetPrinterName(options: PrintJobOptions): Promise<string> {
    if (options.jobName && options.jobName.includes("::")) {
      const parts = options.jobName.split("::");
      return parts[1];
    }

    if (this.preferences.preferredPrinterName) {
      return this.preferences.preferredPrinterName;
    }

    const def = await this.getDefaultPrinter();
    return def ? def.name : "Standard System Print Spooler";
  }
}
