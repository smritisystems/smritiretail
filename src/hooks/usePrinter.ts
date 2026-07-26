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
 * * Version    : 4.1.0 (SMRITI Universal Printer React Hooks)
 * * Created    : 2026-07-26
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import { useState, useEffect, useCallback } from "react";
import { UniversalPrinterService } from "../services/printing/UniversalPrinterService";
import { SystemPrinterInfo, PrintJobOptions, PrintResult, PrinterStatus } from "../services/printing/IPrinterProvider";

/**
 * Primary React Hook for hardware print execution & status
 */
export function usePrinter() {
  const service = UniversalPrinterService.getInstance();
  const [isQZConnected, setIsQZConnected] = useState<boolean>(service.isQZConnected());
  const [activeProviderName, setActiveProviderName] = useState<string>(service.getActiveProvider().providerName);
  const [preferences, setPreferences] = useState(service.getPreferences());

  useEffect(() => {
    const unsubscribe = service.subscribe(() => {
      setIsQZConnected(service.isQZConnected());
      setActiveProviderName(service.getActiveProvider().providerName);
      setPreferences(service.getPreferences());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const connectQZ = useCallback(async () => {
    return service.initProviderCascade();
  }, []);

  const setPreferredPrinter = useCallback((printerName: string) => {
    service.saveWorkstationPreferences({ preferredPrinterName: printerName });
  }, []);

  const setSilentMode = useCallback((silent: boolean) => {
    service.saveWorkstationPreferences({ silentMode: silent });
  }, []);

  const printPRN = useCallback(async (prnScript: string, options?: PrintJobOptions): Promise<PrintResult> => {
    return service.printPRN(prnScript, options);
  }, []);

  const printPDF = useCallback(async (pdfUrlOrBlob: string | Blob, options?: PrintJobOptions): Promise<PrintResult> => {
    return service.printPDF(pdfUrlOrBlob, options);
  }, []);

  const printHTML = useCallback(async (htmlContent: string, options?: PrintJobOptions): Promise<PrintResult> => {
    return service.printHTML(htmlContent, options);
  }, []);

  const printRaw = useCallback(async (rawData: string | ArrayBuffer, options?: PrintJobOptions): Promise<PrintResult> => {
    return service.printRaw(rawData, options);
  }, []);

  return {
    isQZConnected,
    activeProviderName,
    preferences,
    setPreferredPrinter,
    setSilentMode,
    connectQZ,
    printPRN,
    printPDF,
    printHTML,
    printRaw
  };
}

/**
 * React Hook for observing real-time printer hardware status
 */
export function usePrinterStatus(printerName?: string) {
  const service = UniversalPrinterService.getInstance();
  const [status, setStatus] = useState<PrinterStatus>({
    online: true,
    paperOut: false,
    coverOpen: false,
    error: false,
    message: "Initializing..."
  });

  const checkStatus = useCallback(async () => {
    const res = await service.getPrinterStatus(printerName);
    setStatus(res);
  }, [printerName]);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  return { status, refreshStatus: checkStatus };
}

/**
 * React Hook for querying installed local system printers
 */
export function usePrinterList() {
  const service = UniversalPrinterService.getInstance();
  const [printers, setPrinters] = useState<SystemPrinterInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [defaultPrinter, setDefaultPrinter] = useState<SystemPrinterInfo | null>(null);

  const refreshPrinters = useCallback(async () => {
    setLoading(true);
    try {
      const list = await service.getInstalledPrinters();
      const def = await service.getDefaultPrinter();
      setPrinters(list);
      setDefaultPrinter(def);
    } catch (e) {
      console.error("Failed to load printer list:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshPrinters();
  }, [refreshPrinters]);

  return { printers, loading, defaultPrinter, refreshPrinters };
}
