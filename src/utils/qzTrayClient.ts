/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.8.0
 * Created      : 2026-08-20
 * Modified     : 2026-08-23
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import qz from "qz-tray";
import { apiFetchV1 } from "../lib/apiFetchV1";

export interface QzPrintPayload {
  job_id: string;
  payload: string;
  language?: string;
  encoding?: string;
  suggested_printer?: string | null;
}

export interface QzDispatchResult {
  success: boolean;
  message: string;
  printerName?: string;
  error?: string;
}

export interface QzConnectionStatus {
  connected: boolean;
  version?: string;
  printers: string[];
  error?: string;
}

let isSecurityInitialized = false;

/**
 * Check if the QZ Tray client integration is enabled via Vite environment variable.
 * Default is TRUE in development/production if variable is set or enabled.
 */
export function isQzTrayEnabled(): boolean {
  const flag = (import.meta as any).env?.VITE_ENABLE_QZ_TRAY;
  if (flag === undefined) return true;
  return flag === "true" || flag === true;
}

/**
 * Configure QZ Tray security certificate and cryptographic signature promises.
 * Fetches digital certificate and requests signature from backend, ensuring
 * private keys never touch the client browser.
 */
export function initQzSecurity(): void {
  if (isSecurityInitialized) return;

  try {
    qz.security.setCertificatePromise((resolve, reject) => {
      apiFetchV1("/barcode/qz/certificate", { method: "GET" })
        .then((certData: any) => {
          if (typeof certData === "string") {
            resolve(certData);
          } else if (certData?.certificate) {
            resolve(certData.certificate);
          } else {
            resolve(String(certData));
          }
        })
        .catch(err => {
          // If backend certificate is temporarily unreachable, reject or fallback to unverified
          console.warn("[QZ Security] Could not fetch server certificate, continuing:", err);
          reject(err);
        });
    });

    qz.security.setSignatureAlgorithm("SHA512");

    qz.security.setSignaturePromise((toSign: string) => {
      return (resolve, reject) => {
        apiFetchV1("/barcode/qz/sign", {
          method: "POST",
          body: JSON.stringify({ request: toSign })
        })
          .then((sigData: any) => {
            if (typeof sigData === "string") {
              resolve(sigData);
            } else if (sigData?.signature) {
              resolve(sigData.signature);
            } else {
              resolve(String(sigData));
            }
          })
          .catch(err => {
            console.error("[QZ Security] Server failed to sign request:", err);
            reject(err);
          });
      };
    });

    isSecurityInitialized = true;
  } catch (err) {
    console.warn("[QZ Security] Initialization error:", err);
  }
}

/**
 * Connects to the local QZ Tray instance (ws://localhost:8182 or wss://localhost:8181).
 * Safe and idempotent.
 */
export async function connectQzTray(): Promise<{ connected: boolean; version?: string; error?: string }> {
  if (!isQzTrayEnabled()) {
    return { connected: false, error: "QZ Tray integration is disabled in frontend environment." };
  }

  initQzSecurity();

  try {
    if (qz.websocket.isActive()) {
      const ver = await qz.api.getVersion().catch(() => "2.2.6");
      return { connected: true, version: ver };
    }

    await qz.websocket.connect({
      host: "localhost",
      usingSecure: false,
      retries: 2,
      delay: 0.5
    });

    const ver = await qz.api.getVersion().catch(() => "2.2.6");
    return { connected: true, version: ver };
  } catch (err: any) {
    // Retry with secure websocket on 8181
    try {
      if (!qz.websocket.isActive()) {
        await qz.websocket.connect({
          host: "localhost",
          usingSecure: true,
          retries: 1,
          delay: 0.5
        });
      }
      const ver = await qz.api.getVersion().catch(() => "2.2.6");
      return { connected: true, version: ver };
    } catch (e: any) {
      const msg = err?.message || String(err);
      return { connected: false, error: msg };
    }
  }
}

/**
 * Check if QZ Tray websocket is currently active.
 */
export function isQzConnected(): boolean {
  try {
    return Boolean(qz.websocket && qz.websocket.isActive());
  } catch {
    return false;
  }
}

/**
 * Lists all installed Windows / OS printers discovered via QZ Tray.
 */
export async function listQzPrinters(): Promise<string[]> {
  try {
    const conn = await connectQzTray();
    if (!conn.connected) return [];
    const printers = await qz.printers.find();
    return Array.isArray(printers) ? printers : [];
  } catch (err) {
    console.warn("[QZ Tray Client] Failed to list printers:", err);
    return [];
  }
}

/**
 * Get the default Windows printer queue name.
 */
export async function getQzDefaultPrinter(): Promise<string> {
  try {
    const conn = await connectQzTray();
    if (!conn.connected) return "";
    return await qz.printers.getDefault();
  } catch {
    return "";
  }
}

/**
 * Diagnostic test function to verify end-to-end QZ Tray connection and list available printers.
 */
export async function testQzConnection(): Promise<QzConnectionStatus> {
  const conn = await connectQzTray();
  if (!conn.connected) {
    return {
      connected: false,
      printers: [],
      error: conn.error || "Unable to establish WebSocket connection with QZ Tray on localhost:8182/8181."
    };
  }

  const printers = await listQzPrinters();
  return {
    connected: true,
    version: conn.version || "2.2.6",
    printers,
    error: undefined
  };
}

/**
 * Dispatches a safe calibration test label to the target Windows printer via QZ Tray.
 */
export async function testQzLabelPrint(
  targetPrinterName: string,
  format: "DPL" | "ZPL" | "TSPL" = "ZPL"
): Promise<QzDispatchResult> {
  const conn = await connectQzTray();
  if (!conn.connected) {
    return {
      success: false,
      message: `QZ Tray is not connected (${conn.error || "Offline"}).`,
      error: conn.error
    };
  }

  try {
    let payload = "";
    if (format === "DPL") {
      payload = `\x02L\nD11\n121100000200050SMRITI TEST (DPL)\n1a42000005000508901234567890\nQ0001\nE\n`;
    } else if (format === "TSPL") {
      payload = `SIZE 50 mm, 25 mm\nGAP 2 mm, 0 mm\nCLS\nTEXT 50,20,"3",0,1,1,"SMRITI TEST (TSPL)"\nBARCODE 50,60,"128",40,1,0,2,2,"8901234567890"\nPRINT 1,1\n`;
    } else {
      payload = `^XA\n^PW400\n^LL200\n^FO50,30^A0N,28,28^FDSMRITI TEST (ZPL)^FS\n^FO50,80^BY2^BCN,50,Y,N,N^FD8901234567890^FS\n^XZ\n`;
    }

    const config = qz.configs.create(targetPrinterName, { encoding: "UTF-8" });
    await qz.print(config, [
      {
        type: "raw",
        format: "command",
        flavor: "plain",
        data: payload
      }
    ]);

    return {
      success: true,
      message: `Test label sent successfully to printer "${targetPrinterName}".`,
      printerName: targetPrinterName
    };
  } catch (err: any) {
    const detail = err?.message || String(err);
    return {
      success: false,
      message: `Failed to print test label on "${targetPrinterName}": ${detail}`,
      error: detail
    };
  }
}

/**
 * Acknowledge print job execution status to the backend.
 * Tenant-scoped and idempotent.
 */
export async function acknowledgePrintJob(
  jobId: string,
  success: boolean,
  printerName?: string,
  errorMessage?: string
): Promise<void> {
  try {
    await apiFetchV1(`/barcode/print-jobs/${jobId}/ack`, {
      method: "POST",
      body: JSON.stringify({
        success,
        printer_name: printerName || (success ? "QZ Tray (Local)" : undefined),
        error_message: errorMessage
      })
    });
  } catch (err) {
    console.warn(`[QZ Tray Client] Failed to ACK print job ${jobId}:`, err);
  }
}

/**
 * Dispatches raw label payload (DPL / ZPL / TSPL / ESC/POS) to a local QZ Tray instance.
 * Updates backend job status upon completion.
 */
export async function dispatchToQzTray(
  printData: QzPrintPayload,
  targetPrinterName?: string
): Promise<QzDispatchResult> {
  if (!isQzTrayEnabled()) {
    const errorMsg = "QZ Tray printing is disabled. Set VITE_ENABLE_QZ_TRAY=true to enable local browser dispatch.";
    await acknowledgePrintJob(printData.job_id, false, undefined, errorMsg);
    return {
      success: false,
      message: errorMsg,
      error: errorMsg
    };
  }

  const conn = await connectQzTray();
  if (!conn.connected) {
    const errDetail = conn.error || "QZ Tray daemon is not running on localhost:8182/8181.";
    await acknowledgePrintJob(printData.job_id, false, undefined, errDetail);
    return {
      success: false,
      message: `Could not connect to QZ Tray. Ensure QZ Tray application is running on this workstation. (${errDetail})`,
      error: errDetail
    };
  }

  try {
    const printer = targetPrinterName || printData.suggested_printer || (await qz.printers.getDefault());
    if (!printer) {
      throw new Error("No target printer specified and no default printer found in Windows.");
    }

    const config = qz.configs.create(printer, {
      encoding: printData.encoding || "UTF-8"
    });

    const rawData = [
      {
        type: "raw",
        format: "command",
        flavor: "plain",
        data: printData.payload
      }
    ];

    await qz.print(config, rawData);

    // Successfully printed
    await acknowledgePrintJob(printData.job_id, true, printer);
    return {
      success: true,
      message: `Successfully printed ${printData.payload ? "labels" : ""} via QZ Tray (${printer}).`,
      printerName: printer
    };
  } catch (err: any) {
    const errDetail = err?.message || String(err);
    await acknowledgePrintJob(printData.job_id, false, targetPrinterName, errDetail);
    return {
      success: false,
      message: `QZ Tray dispatch failed: ${errDetail}`,
      error: errDetail
    };
  }
}
