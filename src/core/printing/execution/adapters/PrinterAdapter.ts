/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel — Printer Transport Adapter Facade
 * Standard     : SCS-PRINT-ADAPTER-001 (v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { UniversalPrintJob, PrintTransportType } from "../UniversalPrintJob.ts";
import { PrinterProfile } from "../../models/PrinterProfile.ts";

export type TransportResultCode =
  | "TRANSPORT_ACCEPTED"
  | "COMPLETED"
  | "USB_ACCESS_REQUIRES_AGENT"
  | "SENT_UNKNOWN_RESULT"
  | "NETWORK_TIMEOUT"
  | "CONNECTION_RESET"
  | "AGENT_UNAVAILABLE"
  | "TEMPORARY_SPOOLER_ERROR"
  | "UNSUPPORTED_TRANSPORT"
  | "INVALID_PAYLOAD"
  | "FAILED";

export interface TransportDispatchResult {
  success: boolean;
  code: TransportResultCode;
  message: string;
  bytesTransferred?: number;
  durationMs?: number;
}

export interface IPrinterAdapter {
  readonly transportType: PrintTransportType;
  dispatch(job: UniversalPrintJob, printer: PrinterProfile): Promise<TransportDispatchResult>;
  checkStatus(printer: PrinterProfile): Promise<{ online: boolean; statusMessage: string }>;
}
