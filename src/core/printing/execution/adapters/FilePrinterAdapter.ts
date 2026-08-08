/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel — File / Memory Transport Adapter
 * Standard     : SCS-PRINT-FILE-001 (v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { IPrinterAdapter, TransportDispatchResult } from "./PrinterAdapter.ts";
import { UniversalPrintJob, PrintTransportType } from "../UniversalPrintJob.ts";
import { PrinterProfile } from "../../models/PrinterProfile.ts";

export class FilePrinterAdapter implements IPrinterAdapter {
  public readonly transportType: PrintTransportType = "FILE";
  public lastOutputPayload?: string;

  public async dispatch(job: UniversalPrintJob, printer: PrinterProfile): Promise<TransportDispatchResult> {
    const payload = job.renderedPayload;
    if (!payload || payload.length === 0) {
      return {
        success: false,
        code: "INVALID_PAYLOAD",
        message: "File payload is empty.",
      };
    }

    this.lastOutputPayload = payload;
    const bytesTransferred = Buffer.from(payload).length;
    job.logTransport(`Captured ${bytesTransferred} bytes to File / Memory output buffer.`);

    return {
      success: true,
      code: "COMPLETED",
      message: `Rendered PRN script saved to output file stream for printer '${printer.name}'.`,
      bytesTransferred,
      durationMs: 5,
    };
  }

  public async checkStatus(printer: PrinterProfile): Promise<{ online: boolean; statusMessage: string }> {
    return { online: true, statusMessage: "File transport ready." };
  }
}
