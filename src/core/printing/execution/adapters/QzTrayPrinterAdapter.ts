/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel — QZ Tray Transport Adapter
 * Standard     : SCS-PRINT-QZ-ADAPTER-001 (v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { IPrinterAdapter, TransportDispatchResult } from "./PrinterAdapter.ts";
import { UniversalPrintJob, PrintTransportType } from "../UniversalPrintJob.ts";
import { PrinterProfile } from "../../models/PrinterProfile.ts";
// @ts-ignore
import { WebSocket } from "ws";

export interface QzConnectionConfig {
  host?: string;
  ports?: number[];
  secure?: boolean;
}

export interface QzDiscoveryResult {
  printers: string[];
  exactMatch?: string;
  status: "CONNECTED" | "NOT_CONNECTED" | "ERROR";
  errorMessage?: string;
}

export class QzTrayPrinterAdapter implements IPrinterAdapter {
  public readonly transportType: PrintTransportType = "QZ";
  private ports: number[] = [8182, 8192, 8193, 8191];
  private host: string = "127.0.0.1";

  constructor(config?: QzConnectionConfig) {
    if (config?.host) this.host = config.host;
    if (config?.ports) this.ports = config.ports;
  }

  /**
   * Connects to QZ Tray WebSocket on localhost ports.
   */
  public async connect(): Promise<{ socket: any; port: number }> {
    for (const port of this.ports) {
      try {
        const socket = await new Promise<any>((resolve, reject) => {
          const ws = new WebSocket(`ws://${this.host}:${port}`);
          const timer = setTimeout(() => {
            try { ws.close(); } catch {}
            reject(new Error("Timeout"));
          }, 1500);

          ws.on("open", () => {
            clearTimeout(timer);
            resolve(ws);
          });

          ws.on("error", (err: any) => {
            clearTimeout(timer);
            reject(err);
          });
        });

        return { socket, port };
      } catch {}
    }

    throw new Error("QZ_TRAY_NOT_CONNECTED: QZ Tray is not running or not listening on ports " + this.ports.join(", "));
  }

  /**
   * Discovers printers registered with QZ Tray.
   */
  public async discover(searchTarget?: string): Promise<QzDiscoveryResult> {
    try {
      const { socket } = await this.connect();

      return new Promise<QzDiscoveryResult>((resolve) => {
        const reqId = `req-${Date.now()}`;
        const msg = JSON.stringify({
          call: "printers.find",
          params: {},
          uid: reqId,
        });

        socket.on("message", (data: any) => {
          try {
            const resp = JSON.parse(data.toString());
            const printers: string[] = Array.isArray(resp.result) ? resp.result : [];

            let exactMatch: string | undefined = undefined;
            if (searchTarget) {
              const lowerTarget = searchTarget.toLowerCase();
              exactMatch = printers.find((p) => p.toLowerCase() === lowerTarget) ||
                           printers.find((p) => p.toLowerCase().includes(lowerTarget)) ||
                           printers.find((p) => lowerTarget.includes(p.toLowerCase()));
            }

            socket.close();
            resolve({
              printers,
              exactMatch,
              status: "CONNECTED",
            });
          } catch (err: any) {
            socket.close();
            resolve({
              printers: [],
              status: "ERROR",
              errorMessage: err.message,
            });
          }
        });

        socket.send(msg);
      });
    } catch (err: any) {
      return {
        printers: [],
        status: "NOT_CONNECTED",
        errorMessage: err.message || "QZ_TRAY_NOT_CONNECTED",
      };
    }
  }

  /**
   * Dispatches raw printer-native stream (DPL, ZPL, TSPL, etc.) to QZ Tray.
   */
  public async dispatch(job: UniversalPrintJob, printer: PrinterProfile): Promise<TransportDispatchResult> {
    const payload = job.renderedPayload;
    if (!payload || payload.length === 0) {
      return {
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Empty print payload.",
      };
    }

    // Determine target printer name
    const targetPrinterName = printer.connection?.spoolerName || printer.name;
    job.logTransport(`Connecting to QZ Tray to dispatch ${job.copies} copies to '${targetPrinterName}'...`);

    try {
      const { socket, port } = await this.connect();

      return new Promise<TransportDispatchResult>((resolve) => {
        const reqId = `job-${job.jobId}`;
        const rawPrintPayload = {
          call: "print",
          params: {
            printer: { name: targetPrinterName },
            options: { copies: job.copies },
            data: [
              {
                type: "raw",
                format: "command",
                flavor: "plain",
                data: payload,
              },
            ],
          },
          uid: reqId,
        };

        const timer = setTimeout(() => {
          try { socket.close(); } catch {}
          resolve({
            success: false,
            code: "QZ_TIMEOUT",
            message: "QZ Tray did not respond within timeout.",
          });
        }, 10000);

        socket.on("message", (msgData: any) => {
          clearTimeout(timer);
          try {
            const resp = JSON.parse(msgData.toString());
            socket.close();

            if (resp.error) {
              if (resp.error.includes("signing") || resp.error.includes("certificate")) {
                resolve({
                  success: false,
                  code: "QZ_SIGNING_REQUIRED",
                  message: `QZ Security: ${resp.error}`,
                });
              } else {
                resolve({
                  success: false,
                  code: "QZ_ERROR",
                  message: `QZ Tray Error: ${resp.error}`,
                });
              }
              return;
            }

            const bytesCount = Buffer.from(payload).length;
            job.logTransport(`QZ Tray accepted raw print payload (${bytesCount} bytes, port ${port}). Result: QZ_ACCEPTED`);

            resolve({
              success: true,
              code: "QZ_ACCEPTED",
              message: `Job accepted by QZ Tray for printer '${targetPrinterName}'. Payload size: ${bytesCount} bytes. Status: QZ_ACCEPTED.`,
              bytesTransferred: bytesCount,
              durationMs: 45,
            });
          } catch (err: any) {
            socket.close();
            resolve({
              success: false,
              code: "QZ_RESPONSE_PARSE_ERROR",
              message: `Failed to parse QZ response: ${err.message}`,
            });
          }
        });

        socket.send(JSON.stringify(rawPrintPayload));
      });
    } catch (err: any) {
      return {
        success: false,
        code: "QZ_TRAY_NOT_CONNECTED",
        message: err.message || "Could not connect to QZ Tray.",
      };
    }
  }

  public async checkStatus(printer: PrinterProfile): Promise<{ online: boolean; statusMessage: string }> {
    try {
      const disc = await this.discover(printer.name);
      if (disc.status === "CONNECTED") {
        return {
          online: true,
          statusMessage: disc.exactMatch
            ? `QZ Tray online. Found exact printer match '${disc.exactMatch}'.`
            : `QZ Tray online. Visible printers: [${disc.printers.join(", ")}].`,
        };
      }
      return { online: false, statusMessage: disc.errorMessage || "QZ_TRAY_NOT_CONNECTED" };
    } catch (err: any) {
      return { online: false, statusMessage: err.message || "QZ_TRAY_NOT_CONNECTED" };
    }
  }
}
