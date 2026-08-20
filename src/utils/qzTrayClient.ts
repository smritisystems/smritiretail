/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.29.0
 * Created      : 2026-08-20
 * Modified     : 2026-08-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

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

/**
 * Check if the QZ Tray client integration is enabled via Vite environment variable.
 * Default is FALSE (disabled) unless explicitly set to "true".
 */
export function isQzTrayEnabled(): boolean {
  const flag = (import.meta as any).env?.VITE_ENABLE_QZ_TRAY;
  return flag === "true" || flag === true;
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
 * Dispatches raw label payload (ZPL / TSPL / ESC/POS) to a local QZ Tray instance.
 * If QZ Tray is disabled or unreachable, it reports an error and updates the job ACK.
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

  const qz = (window as any).qz;

  // 1. If official qz-tray JavaScript SDK is present on window
  if (qz && qz.websocket) {
    try {
      if (!qz.websocket.isActive()) {
        await qz.websocket.connect();
      }

      const printer = targetPrinterName || printData.suggested_printer || (await qz.printers.getDefault());
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
        message: `Successfully printed via QZ Tray (${printer}).`,
        printerName: printer
      };
    } catch (err: any) {
      const errDetail = err?.message || String(err);
      await acknowledgePrintJob(printData.job_id, false, undefined, errDetail);
      return {
        success: false,
        message: `QZ Tray dispatch failed: ${errDetail}`,
        error: errDetail
      };
    }
  }

  // 2. Direct lightweight WebSocket fallback to local QZ Tray ports (8182 plain / 8181 SSL)
  try {
    const wsResult = await sendRawWebSocketPrint(printData, targetPrinterName);
    await acknowledgePrintJob(printData.job_id, wsResult.success, wsResult.printerName, wsResult.error);
    return wsResult;
  } catch (err: any) {
    const errDetail = err?.message || "QZ Tray is not running locally on ws://localhost:8182";
    await acknowledgePrintJob(printData.job_id, false, undefined, errDetail);
    return {
      success: false,
      message: `Could not connect to QZ Tray. Ensure QZ Tray application is running on this workstation. (${errDetail})`,
      error: errDetail
    };
  }
}

/**
 * Minimalist direct WebSocket RPC fallback when qz-tray.js script tag is not injected.
 */
function sendRawWebSocketPrint(
  printData: QzPrintPayload,
  printerName?: string
): Promise<QzDispatchResult> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket | null = null;
    const timeout = setTimeout(() => {
      if (ws) ws.close();
      reject(new Error("Connection to QZ Tray timed out (5s)."));
    }, 5000);

    try {
      ws = new WebSocket("ws://localhost:8182");

      ws.onopen = () => {
        const reqId = "req_" + Date.now();
        // QZ Tray JSON RPC request
        const msg = JSON.stringify({
          call: "print",
          params: {
            printer: printerName || printData.suggested_printer || { default: true },
            data: [
              {
                type: "raw",
                format: "command",
                flavor: "plain",
                data: printData.payload
              }
            ]
          },
          timestamp: Date.now(),
          uid: reqId
        });
        ws?.send(msg);
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        try {
          const res = JSON.parse(event.data);
          ws?.close();
          if (res.error) {
            resolve({
              success: false,
              message: res.error,
              error: res.error
            });
          } else {
            resolve({
              success: true,
              message: "QZ Tray direct WebSocket dispatch successful.",
              printerName: printerName || "Default Local Printer"
            });
          }
        } catch {
          ws?.close();
          resolve({
            success: true,
            message: "QZ Tray accepted raw stream.",
            printerName: printerName || "Default Local Printer"
          });
        }
      };

      ws.onerror = (err) => {
        clearTimeout(timeout);
        reject(new Error("WebSocket error connecting to QZ Tray on localhost:8182"));
      };
    } catch (e) {
      clearTimeout(timeout);
      reject(e);
    }
  });
}
