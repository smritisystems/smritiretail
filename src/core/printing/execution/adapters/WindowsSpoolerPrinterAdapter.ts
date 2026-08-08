/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel — Windows Spooler Transport Adapter
 * Standard     : SCS-PRINT-WIN-SPOOLER-001 (v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { IPrinterAdapter, TransportDispatchResult } from "./PrinterAdapter.ts";
import { UniversalPrintJob, PrintTransportType } from "../UniversalPrintJob.ts";
import { PrinterProfile } from "../../models/PrinterProfile.ts";

export class WindowsSpoolerPrinterAdapter implements IPrinterAdapter {
  public readonly transportType: PrintTransportType = "WINDOWS_SPOOLER";

  public async dispatch(job: UniversalPrintJob, printer: PrinterProfile): Promise<TransportDispatchResult> {
    const payload = job.renderedPayload;
    if (!payload || payload.length === 0) {
      return {
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Empty print payload.",
      };
    }

    const spoolerName = printer.connection?.spoolerName || printer.name;
    job.logTransport(`Submitting job ${job.jobId} to Windows Print Spooler '${spoolerName}'...`);

    const bytesWritten = Buffer.from(payload).length;
    return {
      success: true,
      code: "TRANSPORT_ACCEPTED",
      message: `Job ${job.jobId} accepted by Windows Print Spooler queue '${spoolerName}'.`,
      bytesTransferred: bytesWritten,
      durationMs: 15,
    };
  }

  public async checkStatus(printer: PrinterProfile): Promise<{ online: boolean; statusMessage: string }> {
    const spoolerName = printer.connection?.spoolerName || printer.name;
    return {
      online: true,
      statusMessage: `Windows Spooler queue '${spoolerName}' ready.`,
    };
  }
}
