/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel — USB Transport Adapter
 * Standard     : SCS-PRINT-USB-001 (v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { IPrinterAdapter, TransportDispatchResult } from "./PrinterAdapter.ts";
import { UniversalPrintJob, PrintTransportType } from "../UniversalPrintJob.ts";
import { PrinterProfile } from "../../models/PrinterProfile.ts";

export class UsbPrinterAdapter implements IPrinterAdapter {
  public readonly transportType: PrintTransportType = "USB";

  public async dispatch(job: UniversalPrintJob, printer: PrinterProfile): Promise<TransportDispatchResult> {
    const payload = job.renderedPayload;
    if (!payload || payload.length === 0) {
      return {
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Print job payload is empty.",
      };
    }

    // Check if WebUSB or direct browser USB API is available
    const hasWebUsb = typeof navigator !== "undefined" && "usb" in navigator;

    if (!hasWebUsb) {
      // Governed rule: Return USB_ACCESS_REQUIRES_AGENT. Do NOT fake success.
      return {
        success: false,
        code: "USB_ACCESS_REQUIRES_AGENT",
        message: "Direct WebUSB API unavailable in current environment. Local Print Agent required.",
      };
    }

    try {
      job.logTransport(`Attempting USB dispatch to ${printer.name} (VID: ${printer.hardware?.usbVendorId || "RAW"})`);
      // Simulated browser WebUSB security boundary check
      return {
        success: false,
        code: "USB_ACCESS_REQUIRES_AGENT",
        message: "USB device access requires SMRITI Local Print Agent authorization.",
      };
    } catch (err: any) {
      return {
        success: false,
        code: "FAILED",
        message: `USB Dispatch Exception: ${err.message || String(err)}`,
      };
    }
  }

  public async checkStatus(printer: PrinterProfile): Promise<{ online: boolean; statusMessage: string }> {
    return {
      online: true,
      statusMessage: `USB device profile '${printer.name}' configured.`,
    };
  }
}
